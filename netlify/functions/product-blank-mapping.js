import { authorizeEmployee, jsonResponse } from './_shared/security.js';

function clean(value) {
  return String(value ?? '').trim();
}

function bodyFrom(event) {
  try { return JSON.parse(event.body || '{}'); }
  catch { throw new Error('Request body must be valid JSON.'); }
}

function rpcError(error) {
  const message = clean(error?.message);
  if (/does not exist|schema cache|could not find/i.test(message)) {
    return new Error('Product-to-blank mapping SQL is not installed. Run deployment/sql/44_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql, then retry.');
  }
  return new Error(message || 'Product-to-blank mapping request failed.');
}

async function runRpc(supabase, name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw rpcError(error);
  return data;
}

async function searchBlanks(supabase, term, limit = 100) {
  const rpc = await supabase.rpc('sc_search_blank_products_for_pairing', {
    p_search: clean(term),
    p_limit: Math.max(1, Math.min(Number(limit) || 100, 250)),
  });
  if (!rpc.error) return rpc.data || [];

  let query = supabase
    .from('blank_products')
    .select('id, sku_base, name, sc_is_archived, brands:brand_id(name,code), product_types:product_type_id(name,code), colors:color_id(name,code), sizes:size_id(name,code)')
    .eq('sc_is_archived', false)
    .limit(Math.max(1, Math.min(Number(limit) || 100, 250)));
  const value = clean(term).replace(/[%_,]/g, '');
  if (value) query = query.or(`sku_base.ilike.%${value}%,name.ilike.%${value}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, message: 'Method not allowed.' }, event);

  const auth = await authorizeEmployee(event, {
    functionName: 'product-blank-mapping',
    allowedRoles: ['admin', 'manager'],
  });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, message: auth.message }, event);

  try {
    const input = bodyFrom(event);
    const action = clean(input.action).toLowerCase();
    let data;

    if (action === 'issues') {
      data = await runRpc(auth.supabase, 'sc_product_blank_mapping_issues_v1', {
        p_search: clean(input.search),
        p_limit: Math.max(1, Math.min(Number(input.limit) || 250, 1000)),
      });
    } else if (action === 'search_blanks') {
      data = await searchBlanks(auth.supabase, input.search, input.limit);
    } else if (action === 'set') {
      data = await runRpc(auth.supabase, 'sc_set_product_blank_mapping_v1', {
        p_source_kind: input.source_kind,
        p_source_key: input.source_key,
        p_blank_product_id: input.blank_product_id,
        p_mapping_source: clean(input.mapping_source) || 'manual_review',
        p_notes: clean(input.notes) || null,
        p_propagate_unpaired: input.propagate_unpaired !== false,
        p_actor_id: auth.user.id,
      });
    } else if (action === 'backfill') {
      data = await runRpc(auth.supabase, 'sc_backfill_product_blank_mappings_v1', {
        p_limit: Math.max(1, Math.min(Number(input.limit) || 5000, 20000)),
        p_actor_id: auth.user.id,
      });
    } else if (action === 'preview_substitution') {
      data = await runRpc(auth.supabase, 'sc_preview_blank_substitution_v1', {
        p_old_blank_product_id: input.old_blank_product_id,
        p_new_blank_product_id: input.new_blank_product_id,
      });
    } else if (action === 'apply_substitution') {
      data = await runRpc(auth.supabase, 'sc_apply_blank_substitution_v1', {
        p_old_blank_product_id: input.old_blank_product_id,
        p_new_blank_product_id: input.new_blank_product_id,
        p_notes: clean(input.notes) || null,
        p_actor_id: auth.user.id,
      });
    } else if (action === 'history') {
      const { data: rows, error } = await auth.supabase
        .from('sc_product_blank_mapping_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Math.max(1, Math.min(Number(input.limit) || 50, 250)));
      if (error) throw rpcError(error);
      data = rows || [];
    } else {
      return jsonResponse(400, { success: false, message: 'Unknown product-to-blank mapping action.' }, event);
    }

    return jsonResponse(200, { success: true, data }, event);
  } catch (error) {
    console.error('Product-to-blank mapping action failed:', error);
    return jsonResponse(500, { success: false, message: error.message || 'Product-to-blank mapping request failed.' }, event);
  }
}
