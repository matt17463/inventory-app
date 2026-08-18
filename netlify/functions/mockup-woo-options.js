import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { wooRequest } from './_shared/mockupUtils.js';

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
    const next = await wooRequest(`products/attributes/${attribute.id}/terms?per_page=100&page=${page}`);
    terms.push(...next.map((row) => ({ id: row.id, name: row.name, slug: row.slug })));
    if (next.length < 100) break;
  }
  return terms;
}

async function allWooRows(path) {
  const rows = [];
  for (let page = 1; page <= 20; page += 1) {
    const next = await wooRequest(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    rows.push(...next);
    if (next.length < 100) break;
  }
  return rows;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'GET') return jsonResponse(405, { success: false, error: 'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'mockup-woo-options', allowedRoles: ['admin', 'manager'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);

  try {
    const [discovered, categories, shippingClasses] = await Promise.all([
      wooRequest('products/attributes?per_page=100'),
      allWooRows('products/categories?orderby=name&order=asc'),
      allWooRows('products/shipping_classes?orderby=name&order=asc'),
    ]);
    const definitions = {
      brand: findAttribute(discovered, ['pa_brand'], ['brand']),
      style: findAttribute(discovered, ['pa_style'], ['style', 'product style']),
      color: findAttribute(discovered, ['pa_color'], ['color', 'colour']),
      size: findAttribute(discovered, ['pa_size'], ['size']),
    };
    const entries = await Promise.all(Object.entries(definitions).map(async ([key, attribute]) => [key, attribute ? {
      id: attribute.id,
      name: attribute.name,
      slug: attribute.slug,
      terms: await termsFor(attribute),
    } : null]));
    return jsonResponse(200, {
      success: true,
      attributes: Object.fromEntries(entries),
      categories: categories.map((row) => ({ id: row.id, name: row.name, slug: row.slug, parent: row.parent || 0 })),
      shipping_classes: shippingClasses.map((row) => ({ id: row.id, name: row.name, slug: row.slug })),
    }, event);
  } catch (error) {
    console.error('WooCommerce option discovery failed:', error);
    return jsonResponse(500, { success: false, error: error.message || 'WooCommerce options could not be loaded.' }, event);
  }
}
