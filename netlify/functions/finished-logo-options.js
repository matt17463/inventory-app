import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { wooCollection, wooRequest } from './_shared/mockupUtils.js';
import { productLogoOptions } from './_shared/finishedLogoOptions.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'GET') return jsonResponse(405, { success: false, message: 'Method not allowed' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'finished-logo-options' });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, message: auth.message }, event);
  try {
    const page = Number(event.queryStringParameters?.page || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 500) return jsonResponse(400, { success: false, message: 'Invalid catalog page' }, event);
    const products = wooCollection(await wooRequest(`products?status=publish&per_page=50&page=${page}&orderby=id&order=asc`), 'finished-product logo attributes');
    return jsonResponse(200, { success: true, logos: productLogoOptions(products), next_page: products.length === 50 ? page + 1 : null }, event);
  } catch (error) {
    return jsonResponse(502, { success: false, message: `Product logo discovery failed: ${error.message}` }, event);
  }
}
