import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function payload(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    throw new Error(body?.message || `On-site sales request failed (HTTP ${response.status}).`);
  }
  return body.data;
}

export async function getOnsiteCategories() {
  return payload(await authenticatedFunctionFetch('/.netlify/functions/onsite-sales?action=categories'));
}

export async function getOnsiteProducts(categoryId) {
  return payload(await authenticatedFunctionFetch(`/.netlify/functions/onsite-sales?action=products&category_id=${encodeURIComponent(categoryId || '')}`));
}

export async function getOnsiteProductOptions(productId) {
  return payload(await authenticatedFunctionFetch(`/.netlify/functions/onsite-sales?action=product-options&product_id=${encodeURIComponent(productId || '')}`));
}

export async function searchOnsiteInventory(search = '') {
  return payload(await authenticatedFunctionFetch(`/.netlify/functions/onsite-sales?action=inventory&search=${encodeURIComponent(search)}`));
}

export async function completeOnsiteItem(input) {
  return payload(await authenticatedFunctionFetch('/.netlify/functions/onsite-sales', {
    method: 'POST',
    body: JSON.stringify({ action: 'complete', ...input }),
  }));
}
