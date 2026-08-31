import { authorizeEmployee, jsonResponse } from './_shared/security.js';

const FUNCTION_NAME = 'new-product-line';

function clean(value) {
  return String(value ?? '').trim();
}

function bodyFrom(event) {
  try { return JSON.parse(event.body || '{}'); }
  catch { throw new Error('Request body must be valid JSON.'); }
}

function integer(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`Choose a valid ${label}.`);
  return parsed;
}

function integerArray(value, label) {
  const rows = [...new Set((Array.isArray(value) ? value : []).map(Number))];
  if (!rows.length || rows.some((item) => !Number.isSafeInteger(item) || item <= 0)) {
    throw new Error(`Choose at least one valid ${label}.`);
  }
  return rows;
}

function decimal(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be zero or greater.`);
  return parsed;
}

function rpcError(error) {
  const message = clean(error?.message);
  if (/does not exist|schema cache|could not find/i.test(message)) {
    return new Error('New Product Line Setup SQL is not installed. Run deployment/sql/46_NEW_PRODUCT_LINE_SETUP.sql, then retry.');
  }
  return new Error(message || 'New product-line request failed.');
}

async function lookups(supabase) {
  const [brands, styles, colors, sizes] = await Promise.all([
    supabase.from('brands').select('id,name,code').order('name'),
    supabase.from('product_types').select('id,name,code').order('name'),
    supabase.from('sc_active_colors').select('id,name,code').order('name'),
    supabase.from('sizes').select('id,name,code').order('name'),
  ]);
  for (const result of [brands, styles, colors, sizes]) {
    if (result.error) throw rpcError(result.error);
  }
  return {
    brands: brands.data || [], styles: styles.data || [],
    colors: colors.data || [], sizes: sizes.data || [],
  };
}

function rpcArgs(input) {
  return {
    p_line_name: clean(input.line_name),
    p_brand_id: integer(input.brand_id, 'brand'),
    p_product_type_id: integer(input.product_type_id, 'style'),
    p_color_ids: integerArray(input.color_ids, 'color'),
    p_size_ids: integerArray(input.size_ids, 'size'),
    p_unit_cost: decimal(input.unit_cost ?? 0, 'Unit cost'),
    p_low_stock_threshold: Math.floor(decimal(input.low_stock_threshold ?? 0, 'Low-stock threshold')),
    p_cost_review_required: input.cost_review_required === true,
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (!['GET', 'POST'].includes(event.httpMethod)) return jsonResponse(405, { success: false, message: 'Method not allowed.' }, event);

  const auth = await authorizeEmployee(event, {
    functionName: FUNCTION_NAME,
    allowedRoles: ['admin', 'manager'],
  });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, message: auth.message }, event);

  try {
    const input = event.httpMethod === 'POST' ? bodyFrom(event) : {};
    const action = event.httpMethod === 'GET' ? 'lookups' : clean(input.action).toLowerCase();
    let data;

    if (action === 'lookups') {
      data = await lookups(auth.supabase);
    } else if (action === 'preview') {
      const result = await auth.supabase.rpc('sc_preview_new_product_line_v1', rpcArgs(input));
      if (result.error) throw rpcError(result.error);
      data = result.data;
    } else if (action === 'apply') {
      const args = rpcArgs(input);
      args.p_preview_token = clean(input.preview_token);
      args.p_actor = auth.user.id;
      const result = await auth.supabase.rpc('sc_apply_new_product_line_v1', args);
      if (result.error) throw rpcError(result.error);
      data = result.data;
    } else if (action === 'history') {
      const result = await auth.supabase
        .from('sc_product_line_setups')
        .select('id,line_name,created_count,reused_count,woo_products_linked,cost_review_required,created_at,brands:brand_id(name,code),product_types:product_type_id(name,code)')
        .order('created_at', { ascending: false })
        .limit(Math.max(1, Math.min(Number(input.limit) || 25, 100)));
      if (result.error) throw rpcError(result.error);
      data = result.data || [];
    } else {
      return jsonResponse(400, { success: false, message: 'Unknown new product-line action.' }, event);
    }

    return jsonResponse(200, { success: true, data }, event);
  } catch (error) {
    console.error('New product-line action failed:', error);
    const status = /preview changed|conflict|duplicate|archived/i.test(error.message) ? 409 : 500;
    return jsonResponse(status, { success: false, message: error.message || 'New product-line request failed.' }, event);
  }
}
