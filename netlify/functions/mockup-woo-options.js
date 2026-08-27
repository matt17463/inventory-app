import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { wooCollection, wooRequest } from './_shared/mockupUtils.js';

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function findAttribute(rows, slugs, names) {
  return rows.find((row) => slugs.includes(normalized(row.slug)) || names.includes(normalized(row.name)));
}

async function termsFor(attribute) {
  if (!attribute?.id) return [];
  const terms = [];
  for (let page = 1; page <= 20; page += 1) {
    const next = wooCollection(
      await wooRequest(`products/attributes/${attribute.id}/terms?per_page=100&page=${page}`),
      `attribute ${attribute.id} terms`,
    );
    terms.push(...next.map((row) => ({ id: row.id, name: row.name, slug: row.slug })));
    if (next.length < 100) break;
  }
  return terms;
}

async function allWooRows(path) {
  const rows = [];
  for (let page = 1; page <= 20; page += 1) {
    const next = wooCollection(
      await wooRequest(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`),
      path,
    );
    rows.push(...next);
    if (next.length < 100) break;
  }
  return rows;
}

async function optionalWooRows(path, label, warnings) {
  try {
    return await allWooRows(path);
  } catch (error) {
    const message = `${label} could not be loaded: ${error.message}`;
    console.warn(`Optional WooCommerce discovery warning: ${message}`);
    warnings.push(message);
    return [];
  }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'GET') return jsonResponse(405, { success: false, error: 'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'mockup-woo-options', allowedRoles: ['admin', 'manager'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);

  try {
    // SiteGround/WooCommerce can throttle or transform bursts of concurrent REST
    // reads. Keep discovery deliberately sequential so one failed endpoint is
    // identifiable and retries do not amplify load.
    const warnings = [];
    const attributePayload = await wooRequest('products/attributes?per_page=100');
    // Categories, tags, and shipping classes improve the form but are not the
    // product-variation source of truth. A cache/WAF transformation on one of
    // these endpoints must not prevent Brand/Style/Color/Size from loading.
    const categories = await optionalWooRows('products/categories?orderby=name&order=asc', 'Product categories', warnings);
    const shippingClasses = await optionalWooRows('products/shipping_classes?orderby=name&order=asc', 'Shipping classes', warnings);
    const tags = await optionalWooRows('products/tags?orderby=name&order=asc', 'Product tags', warnings);
    const discovered = wooCollection(attributePayload, 'product attributes');
    const definitions = {
      brand: findAttribute(discovered, ['pa_brand'], ['brand']),
      style: findAttribute(discovered, ['pa_style'], ['style', 'product style']),
      color: findAttribute(discovered, ['pa_color'], ['color', 'colour']),
      size: findAttribute(discovered, ['pa_size'], ['size']),
    };
    const entries = [];
    for (const [key, attribute] of Object.entries(definitions)) {
      entries.push([key, attribute ? {
        id: attribute.id,
        name: attribute.name,
        slug: attribute.slug,
        terms: await termsFor(attribute),
      } : null]);
    }
    return jsonResponse(200, {
      success: true,
      checked_at: new Date().toISOString(),
      warnings,
      attributes: Object.fromEntries(entries),
      categories: categories.map((row) => ({ id: row.id, name: row.name, slug: row.slug, parent: row.parent || 0 })),
      shipping_classes: shippingClasses.map((row) => ({ id: row.id, name: row.name, slug: row.slug })),
      tags: tags.map((row) => ({ id: row.id, name: row.name, slug: row.slug })),
    }, event);
  } catch (error) {
    console.error('WooCommerce option discovery failed:', error);
    return jsonResponse(500, { success: false, error: error.message || 'WooCommerce options could not be loaded.' }, event);
  }
}
