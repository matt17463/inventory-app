import { loadMarketingAssortment } from '../../src/lib/marketingStoreAssortment.js';
import { verifiedWooProduct } from "./_shared/teamStoreCommerce.js";
import { wooBaseUrl, wooCollection, wooRequest } from './_shared/mockupUtils.js';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const visibleAttributes = new Set(['fabric', 'fit', 'care', 'decoration', 'material', 'size chart']);
const clean = value => typeof value === 'string' ? value.trim().slice(0, 300) : '';
const key = value => clean(value).toLowerCase().replace(/^pa_/, '').replace(/[-_]/g, ' ');
const attribute = (row, keys) => clean(row.attributes?.find(item => keys.includes(key(item.slug || item.name)))?.option);

export async function readMarketingStoreProduct(id, request = wooRequest, shopUrl = wooBaseUrl()) {
  if (!/^\d{1,15}$/.test(String(id))) throw Error('Invalid WooCommerce product ID.');
  const product = await request('products/' + id);
  if (String(product?.id) !== String(id)) throw Error('The store returned an unexpected product identifier.');
  let verified;
  try {
    verified = verifiedWooProduct(product, shopUrl);
  } catch {
    throw Error('Every selected product must be published and visible in the configured WooCommerce store.');
  }
  const specifications = (product.attributes || [])
    .filter(item => item.visible && visibleAttributes.has(key(item.slug || item.name)) && Array.isArray(item.options))
    .map(item => ({ label: clean(item.name), value: clean(item.options.map(clean).filter(Boolean).join(', ')) }))
    .filter(item => item.label && item.value);
  const details = { sku: clean(product.sku), specifications, orderUrl: verified.product_permalink, livePrice: verified.display_price };
  if (product.type === 'simple') {
    if (product.purchasable !== true || product.stock_status === 'outofstock' || verified.display_price === null)
      throw Error('A selected store product is unavailable or lacks a confirmed selling price.');
    return { ...details, variants: [] };
  }
  const variants = [];
  for (let page = 1; page <= 6; page++) {
    const rows = wooCollection(await request('products/' + id + '/variations?per_page=100&page=' + page), 'marketing variants');
    for (const row of rows) {
      if (row.status !== 'publish' || row.purchasable !== true || row.stock_status === 'outofstock') continue;
      const price = row.price === '' || row.price == null ? NaN : Number(row.price);
      if (!Number.isFinite(price) || price < 0) throw Error('Confirm each sellable variation has a customer price.');
      variants.push({
        size: attribute(row, ['size', 'sizes']),
        color: attribute(row, ['color', 'colour', 'colors', 'colours']),
        sku: clean(row.sku), price,
      });
    }
    if (rows.length < 100) {
      if (!variants.length) throw Error('A selected store product has no purchasable variants.');
      return { ...details, variants };
    }
  }
  throw Error('The selected store product exceeds the supported variation count.');
}

export async function handler(event) {
  const respond = (status, value) => {
    const response = jsonResponse(status, value, event);
    return { ...response, headers: { ...response.headers, 'Cache-Control': 'no-store, private' } };
  };
  if (event.httpMethod === 'OPTIONS') return respond(204, {});
  if (event.httpMethod !== 'GET') return respond(405, { message: 'Method not allowed.' });
  const auth = await authorizeEmployee(event, { functionName: 'marketing-store-assortment', allowedRoles: ['admin', 'manager', 'operator', 'marketing'] });
  if (!auth.ok) return respond(auth.statusCode, { message: auth.message });
  const accountId = event.queryStringParameters?.account_id;
  if (!uuid.test(accountId || '')) return respond(400, { message: 'Select a valid marketing account.' });
  try {
    const products = await loadMarketingAssortment(auth.supabase, accountId, readMarketingStoreProduct);
    return respond(200, { products });
  } catch (error) {
    console.error('Marketing assortment could not be loaded', { name: error.name, code: error.code });
    const safeMessage = /^(Link the marketing account|A selected store product|Confirm the USD|Confirm each sellable|Select and approve|Every selected product|An offered color|The selected store product|This store product type)/.test(error.message);
    return respond(422, { message: safeMessage ? error.message : 'The selected assortment could not be verified against WooCommerce and Mockup Studio.' });
  }
}
