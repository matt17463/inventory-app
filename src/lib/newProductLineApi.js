import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function request(payload, method = 'POST') {
  const response = await authenticatedFunctionFetch('/.netlify/functions/new-product-line', {
    method,
    ...(method === 'POST' ? { body: JSON.stringify(payload || {}) } : {}),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(body.message || `New product-line request failed (HTTP ${response.status}).`);
  }
  return body.data;
}

export const getNewProductLineLookups = () => request(null, 'GET');
export const previewNewProductLine = (input) => request({ action: 'preview', ...input });
export const applyNewProductLine = (input) => request({ action: 'apply', ...input });
export const getNewProductLineHistory = (limit = 25) => request({ action: 'history', limit });
