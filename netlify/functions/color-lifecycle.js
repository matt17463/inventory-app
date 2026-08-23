import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { wooCollection, wooRequest } from './_shared/mockupUtils.js';
import { supplierMatchKey } from './_shared/supplierConfirmationParser.js';
import { matchSupplierColor } from './_shared/supplierColorMatcher.js';

const FUNCTION_NAME = 'color-lifecycle';

function text(value) { return String(value ?? '').trim(); }
function id(value) { return text(value); }

function sourceSystem(value) {
  const key = supplierMatchKey(value);
  if (key.includes('sand') || key.includes('ssactivewear')) return 'ss_activewear';
  if (key.includes('momentec') || key.includes('augusta')) return 'momentec';
  return key;
}

async function allRows(supabase, table, select = '*') {
  const rows = [];
  for (let from = 0; from < 50000; from += 1000) {
    const result = await supabase.from(table).select(select).range(from, from + 999);
    if (result.error) throw result.error;
    rows.push(...(result.data || []));
    if ((result.data || []).length < 1000) break;
  }
  return rows;
}

function usageCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = id(row.color_id);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

async function wooColorTerms() {
  const attributes = wooCollection(await wooRequest('products/attributes?per_page=100'), 'product attributes');
  const color = attributes.find((row) => ['pa_color', 'color', 'colour'].includes(text(row.slug || row.name).toLowerCase()));
  if (!color?.id) throw new Error('WooCommerce global Color attribute was not found.');
  const terms = [];
  for (let page = 1; page <= 50; page += 1) {
    const next = wooCollection(await wooRequest(`products/attributes/${color.id}/terms?hide_empty=false&per_page=100&page=${page}`), 'color terms');
    terms.push(...next);
    if (next.length < 100) break;
  }
  return { attribute: color, terms };
}

function ruleId(rule, prefix) {
  return id(rule?.[`${prefix}_color_id`] ?? rule?.[`${prefix}_color_id_text`]);
}

function colorTerm(color, terms) {
  const directId = id(color.woo_term_id);
  if (directId) return terms.find((term) => id(term.id) === directId) || null;
  const keys = [color.woo_term_slug, color.slug, color.name, color.code].map(supplierMatchKey).filter(Boolean);
  return terms.find((term) => keys.includes(supplierMatchKey(term.slug)) || keys.includes(supplierMatchKey(term.name))) || null;
}

async function preview(supabase) {
  const [colors, products, blanks, rulesResult, woo] = await Promise.all([
    allRows(supabase, 'colors'),
    allRows(supabase, 'products', 'color_id'),
    allRows(supabase, 'blank_products', 'color_id'),
    supabase.rpc('sc_get_color_pairing_rules', { p_status: 'active' }),
    wooColorTerms(),
  ]);
  if (rulesResult.error) throw rulesResult.error;
  const productCounts = usageCounts(products);
  const blankCounts = usageCounts(blanks);
  const rules = rulesResult.data || [];
  const canonicalIds = new Set(rules.map((rule) => ruleId(rule, 'canonical')).filter(Boolean));
  const sourceIds = new Set(rules.map((rule) => ruleId(rule, 'source')).filter(Boolean));
  const mappedTermIds = new Set();

  const rows = colors.map((color) => {
    const colorId = id(color.id);
    const term = colorTerm(color, woo.terms);
    if (term) mappedTermIds.add(id(term.id));
    const productCount = productCounts.get(colorId) || 0;
    const blankCount = blankCounts.get(colorId) || 0;
    const usageCount = productCount + blankCount;
    const canonical = canonicalIds.has(colorId);
    const activeSourceRule = sourceIds.has(colorId);
    const eligible = color.is_active !== false && usageCount === 0 && !canonical;
    return {
      key: `color:${colorId}`, color_id: colorId, color_name: color.name, color_code: color.code,
      is_active: color.is_active !== false, product_count: productCount, blank_count: blankCount,
      usage_count: usageCount, active_pairing_source: activeSourceRule, active_pairing_canonical: canonical,
      woo_term_id: term?.id || null, woo_term_name: term?.name || null, woo_product_count: Number(term?.count || 0),
      eligible, reason: eligible ? (activeSourceRule ? 'Unused source alias; pairing rule will be retained' : 'Unused color')
        : canonical ? 'Protected canonical pairing color' : usageCount ? 'Used by inventory/products' : 'Already archived',
    };
  });

  for (const term of woo.terms) {
    if (mappedTermIds.has(id(term.id))) continue;
    const eligible = Number(term.count || 0) === 0;
    rows.push({
      key: `woo:${term.id}`, color_id: null, color_name: term.name, color_code: term.slug,
      is_active: true, product_count: 0, blank_count: 0, usage_count: 0,
      active_pairing_source: false, active_pairing_canonical: false,
      woo_term_id: term.id, woo_term_name: term.name, woo_product_count: Number(term.count || 0),
      eligible, reason: eligible ? 'Unused WooCommerce-only term' : 'Used by WooCommerce products',
    });
  }

  return { attribute_id: woo.attribute.id, rows: rows.sort((a, b) => a.color_name.localeCompare(b.color_name)) };
}

async function archiveSelected(supabase, body, userId) {
  const requested = new Set((body.keys || []).map(String));
  if (!requested.size) throw new Error('Select at least one unused color.');
  const current = await preview(supabase);
  const selected = current.rows.filter((row) => requested.has(row.key));
  if (selected.length !== requested.size) throw new Error('The color list changed. Refresh the cleanup preview and try again.');
  const blocked = selected.filter((row) => !row.eligible);
  if (blocked.length) throw new Error(`Cleanup stopped because ${blocked[0].color_name} is now in use or protected.`);

  const selectedColorIds = new Set(selected.filter((row) => row.color_id).map((row) => id(row.color_id)));
  const deletedWoo = [];
  const termIds = new Set(selected.map((row) => id(row.woo_term_id)).filter(Boolean));
  for (const termId of termIds) {
    const linkedActive = current.rows.filter((row) => id(row.woo_term_id) === termId && row.color_id && row.is_active);
    const allLinkedSelected = linkedActive.every((row) => selectedColorIds.has(id(row.color_id)));
    const termRow = current.rows.find((row) => id(row.woo_term_id) === termId);
    if (Number(termRow?.woo_product_count || 0) === 0 && (allLinkedSelected || linkedActive.length === 0)) {
      await wooRequest(`products/attributes/${current.attribute_id}/terms/${termId}?force=true`, { method: 'DELETE' });
      deletedWoo.push(termRow);
    }
  }

  const archived = [];
  for (const row of selected.filter((item) => item.color_id)) {
    const result = await supabase.from('colors').update({
      is_active: false, archived_at: new Date().toISOString(), archived_reason: 'Unused color cleanup v0.8.12',
    }).eq('id', row.color_id).eq('is_active', true).select('id,name').maybeSingle();
    if (result.error) throw result.error;
    if (result.data) archived.push(row);
  }

  const logRows = selected.map((row) => ({
    action: row.color_id ? 'archive_unused_color' : 'delete_unused_woo_term',
    color_id_text: row.color_id, color_name: row.color_name, woo_term_id: row.woo_term_id,
    details: row, created_by: userId,
  }));
  if (logRows.length) {
    const logged = await supabase.from('sc_color_cleanup_log').insert(logRows);
    if (logged.error) throw logged.error;
  }
  return { archived_colors: archived.length, deleted_woo_terms: deletedWoo.length };
}

async function resolveImportColors(supabase, body) {
  const system = sourceSystem(body.source_system);
  const values = [...new Set((body.values || []).map(text).filter(Boolean))];
  const [colors, rulesResult, aliasesResult] = await Promise.all([
    allRows(supabase, 'colors'),
    supabase.rpc('sc_get_color_pairing_rules', { p_status: 'active' }),
    supabase.from('sc_import_color_aliases').select('*').eq('source_system', system),
  ]);
  if (rulesResult.error) throw rulesResult.error;
  if (aliasesResult.error) throw aliasesResult.error;
  const activeColors = colors.filter((color) => color.is_active !== false);
  const resolved = values.map((value) => {
    const match = matchSupplierColor(value, colors, rulesResult.data || [], aliasesResult.data || [], system);
    const canonical = activeColors.find((color) => id(color.id) === id(match.color_id));
    return {
      source_value: value, source_key: supplierMatchKey(value), color_id: canonical ? id(canonical.id) : '',
      canonical_color_name: canonical?.name || '', match_method: match.color_match_method,
      resolved: Boolean(canonical),
    };
  });
  return {
    source_system: system, resolved,
    active_colors: activeColors.map((color) => ({ id: id(color.id), name: color.name, code: color.code })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

async function saveImportAliases(supabase, body, userId) {
  const system = sourceSystem(body.source_system);
  const mappings = Array.isArray(body.mappings) ? body.mappings : [];
  if (!system || !mappings.length) throw new Error('Choose a canonical color for every unresolved supplier color.');
  const colors = await allRows(supabase, 'colors');
  const activeById = new Map(colors.filter((color) => color.is_active !== false).map((color) => [id(color.id), color]));
  const rows = mappings.map((mapping) => {
    const sourceValue = text(mapping.source_value);
    const canonical = activeById.get(id(mapping.color_id));
    if (!sourceValue || !canonical) throw new Error(`Choose an active WooCommerce color for ${sourceValue || 'each supplier color'}.`);
    return {
      source_system: system, source_value: sourceValue, source_key: supplierMatchKey(sourceValue),
      canonical_color_id_text: id(canonical.id), canonical_color_name: canonical.name,
      notes: 'Saved during supplier catalog import preflight', created_by: userId, updated_at: new Date().toISOString(),
    };
  });
  const saved = await supabase.from('sc_import_color_aliases').upsert(rows, { onConflict: 'source_system,source_key' });
  if (saved.error) throw saved.error;
  return { saved_pairings: rows.length };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (!['GET', 'POST'].includes(event.httpMethod)) return jsonResponse(405, { success: false, message: 'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName: FUNCTION_NAME, allowedRoles: ['admin', 'manager'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, message: auth.message }, event);
  try {
    if (event.httpMethod === 'GET') return jsonResponse(200, { success: true, ...(await preview(auth.supabase)) }, event);
    const body = JSON.parse(event.body || '{}');
    let result;
    if (body.action === 'archive_selected') {
      if (auth.role !== 'admin') throw new Error('Only an administrator can archive colors or delete WooCommerce terms.');
      result = await archiveSelected(auth.supabase, body, auth.user.id);
    }
    else if (body.action === 'resolve_import_colors') result = await resolveImportColors(auth.supabase, body);
    else if (body.action === 'save_import_aliases') result = await saveImportAliases(auth.supabase, body, auth.user.id);
    else throw new Error('Unknown color lifecycle action.');
    return jsonResponse(200, { success: true, ...result }, event);
  } catch (error) {
    console.error('Color lifecycle failed:', error);
    const missingSql = /is_active|sc_import_color_aliases|sc_color_cleanup_log|does not exist|schema cache/i.test(error.message || '');
    return jsonResponse(400, { success: false, message: missingSql ? 'Color lifecycle SQL is not installed. Run deployment/sql/26_COLOR_LIFECYCLE_AND_IMPORT_ALIASES.sql, then retry.' : (error.message || 'Color lifecycle action failed.') }, event);
  }
}
