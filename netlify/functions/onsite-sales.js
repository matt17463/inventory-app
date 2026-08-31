import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { wooCollection, wooRequest } from './_shared/mockupUtils.js';

const clean = (value) => String(value ?? '').trim();
const number = (value) => Number(value || 0);

async function categories() {
  const rows = wooCollection(await wooRequest('products/categories?per_page=100&orderby=name&order=asc&hide_empty=true'), 'product categories');
  return rows.map(({ id, name, slug, count }) => ({ id, name, slug, count }));
}

async function products(categoryId) {
  if (!categoryId) return [];
  const rows = wooCollection(await wooRequest(`products?category=${encodeURIComponent(categoryId)}&status=publish&per_page=100&orderby=name&order=asc`), 'category products');
  return rows.map(({ id, name, sku, type, attributes, images }) => ({ id, name, sku, type, attributes, image: images?.[0]?.src || '' }));
}

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

async function inventory(supabase, search) {
  const result = await supabase.rpc('sc_onsite_inventory_search_v1', { p_search: clean(search), p_limit: 300 });
  if (result.error) throw result.error;
  return result.data || [];
}

async function complete(supabase, body, userId) {
  const result = await supabase.rpc('sc_complete_onsite_sale_v1', {
    p_blank_product_id: number(body.blank_product_id),
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
    else if (action === 'product-options') data = await productOptions(query.product_id);
    else if (action === 'inventory') data = await inventory(auth.supabase, query.search);
    else if (action === 'complete') data = await complete(auth.supabase, body, auth.user.id);
    else throw new Error('Unsupported on-site sales action.');
    return jsonResponse(200, { success: true, data }, event);
  } catch (error) {
    console.error('On-site sales failed:', error);
    return jsonResponse(500, { success: false, message: error.message || 'On-site sales action failed.' }, event);
  }
}
