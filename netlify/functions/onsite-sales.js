import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { wooCollection, wooRequest } from './_shared/mockupUtils.js';

const clean = (value) => String(value ?? '').trim();
const logoAttribute = (row) => /logo|graphic|design/i.test(clean(row?.name));
const responseCache = new Map();
function cached(key, ttlMs, loader) { const hit=responseCache.get(key); if(hit && Date.now()-hit.at<ttlMs) return Promise.resolve(hit.value); return Promise.resolve(loader()).then((value)=>{responseCache.set(key,{at:Date.now(),value});return value;}); }

async function categories() { return cached('categories', 10 * 60 * 1000, async () => {
  const rows = wooCollection(await wooRequest('products/categories?per_page=100&orderby=name&order=asc&hide_empty=true'), 'product categories');
  return rows.map(({ id, name, slug, count }) => ({ id, name, slug, count }));
}); }


async function products(categoryId) {
  if (!categoryId) return [];
  // Woo products accept orderby=title. orderby=name is rejected by the REST API.
  const rows = [];
  for (let page = 1; page <= 20; page += 1) {
    const batch = wooCollection(await wooRequest(`products?category=${encodeURIComponent(categoryId)}&status=publish&per_page=100&page=${page}&orderby=title&order=asc`), 'category products');
    rows.push(...batch);
    if (batch.length < 100) break;
  }
  return rows.map(({ id, name, sku, type, attributes, images }) => ({ id, name, sku, type, attributes, image: images?.[0]?.src || '' }));
}

async function categoryMenu(categoryId) { return cached(`category-menu:${categoryId}`, 5 * 60 * 1000, async () => {
  const rows = await products(categoryId);
  const byName = new Map();
  for (const product of rows) {
    for (const attribute of product.attributes || []) {
      if (!logoAttribute(attribute)) continue;
      for (const raw of attribute.options || []) {
        const name = clean(raw);
        if (!name) continue;
        const key = name.toLocaleLowerCase();
        if (!byName.has(key)) byName.set(key, { name, product_ids: [], product_names: [] });
        const entry = byName.get(key);
        if (!entry.product_ids.includes(product.id)) entry.product_ids.push(product.id);
        if (!entry.product_names.includes(product.name)) entry.product_names.push(product.name);
      }
    }
  }
  return {
    products: rows.map(({ id, name, sku, type, image }) => ({ id, name, sku, type, image })),
    logos: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}); }

async function productOptions(productId) {
  if (!productId) throw new Error('Choose a WooCommerce product.');
  const product = await wooRequest(`products/${encodeURIComponent(productId)}`);
  const variations = product.type === 'variable'
    ? wooCollection(await wooRequest(`products/${encodeURIComponent(productId)}/variations?per_page=100`), 'product variations')
    : [];
  return {
    product: { id: product.id, name: product.name, sku: product.sku, type: product.type },
    attributes: product.attributes || [],
    variations: variations.map((row) => ({ id: row.id, sku: row.sku, stock_status: row.stock_status, stock_quantity: row.stock_quantity, attributes: row.attributes || [] })),
  };
}

async function inventory(supabase, search, version = 1) {
  const functionName = Number(version) >= 2 ? 'sc_onsite_inventory_search_v2' : 'sc_onsite_inventory_search_v1';
  const result = await supabase.rpc(functionName, { p_search: clean(search), p_limit: Number(version) >= 2 ? 5000 : 300 });
  if (result.error) throw result.error;
  return result.data || [];
}

async function complete(supabase, body, userId) {
  if (body.test_mode === true || clean(body.test_mode).toLowerCase() === 'true') {
    const rows = await inventory(supabase, '', 2);
    const blank = rows.find((row) => clean(row.blank_product_id) === clean(body.blank_product_id));
    if (!blank || Number(blank.available_quantity || 0) <= 0) throw new Error('The selected blank is no longer available for this test. Refresh inventory and choose another item.');
    return {
      test_mode: true,
      production_number: `TEST-${Date.now()}`,
      produced_at: new Date().toISOString(),
      label_size: ['2x3','4x6'].includes(clean(body.label_size)) ? clean(body.label_size) : '4x6',
      customer_name: clean(body.customer_name) || null,
      player_name: clean(body.player_name) || null,
      player_number: clean(body.player_number) || null,
      personalization_color: clean(body.personalization_color) || null,
      logo_name: clean(body.logo_name) || null,
      source_bin_label: 'TEST MODE — no inventory deduction',
      blank_label: [blank.brand, blank.style, blank.color, blank.size].filter(Boolean).join(' • '),
      sku_base: blank.sku_base,
    };
  }
  const result = await supabase.rpc('sc_complete_onsite_sale_v1', {
    p_blank_product_id: clean(body.blank_product_id) || null,
    p_customer_name: clean(body.customer_name) || null,
    p_player_name: clean(body.player_name) || null,
    p_player_number: clean(body.player_number) || null,
    p_personalization_color: clean(body.personalization_color) || null,
    p_logo_name: clean(body.logo_name) || null,
    p_woo_category_id: clean(body.woo_category_id) || null,
    p_woo_product_id: clean(body.woo_product_id) || null,
    p_woo_variation_id: clean(body.woo_variation_id) || null,
    p_label_size: ['2x3', '4x6'].includes(clean(body.label_size)) ? clean(body.label_size) : '4x6',
    p_notes: clean(body.notes) || null,
    p_created_by: userId,
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  const auth = await authorizeEmployee(event, { functionName: 'onsite-sales', allowedRoles: ['admin', 'manager', 'operator'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, message: auth.message }, event);
  try {
    const query = event.queryStringParameters || {};
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const action = clean(event.httpMethod === 'POST' ? body.action : query.action);
    let data;
    if (action === 'categories') data = await categories();
    else if (action === 'products') data = await products(query.category_id);
    else if (action === 'category-menu') data = await categoryMenu(query.category_id);
    else if (action === 'product-options') data = await productOptions(query.product_id);
    else if (action === 'inventory') data = await inventory(auth.supabase, query.search, 1);
    else if (action === 'inventory-v2') data = await inventory(auth.supabase, query.search, 2);
    else if (action === 'complete') data = await complete(auth.supabase, body, auth.user.id);
    else throw new Error('Unsupported on-site sales action.');
    return jsonResponse(200, { success: true, data }, event);
  } catch (error) {
    console.error('On-site sales failed:', error);
    return jsonResponse(500, { success: false, message: error.message || 'On-site sales action failed.' }, event);
  }
}
