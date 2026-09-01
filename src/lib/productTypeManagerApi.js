import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function payload(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) throw new Error(body?.message || `Product Type Manager request failed (HTTP ${response.status}).`);
  return body.data;
}

export async function getProductTypeManagerSummary() {
  return payload(await authenticatedFunctionFetch('/.netlify/functions/product-type-manager?action=summary'));
}

export async function scanProductTypeWooMatches() {
  return payload(await authenticatedFunctionFetch('/.netlify/functions/product-type-manager?action=woo-scan'));
}

export async function createProductType(input) {
  return payload(await authenticatedFunctionFetch('/.netlify/functions/product-type-manager', {
    method: 'POST',
    body: JSON.stringify({ action: 'create-type', ...input }),
  }));
}

export async function assignProductType(input) {
  return payload(await authenticatedFunctionFetch('/.netlify/functions/product-type-manager', {
    method: 'POST',
    body: JSON.stringify({ action: 'assign', ...input }),
  }));
}
