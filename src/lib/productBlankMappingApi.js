import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function action(payload) {
  const response = await authenticatedFunctionFetch('/.netlify/functions/product-blank-mapping', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(body.message || `Product mapping request failed (HTTP ${response.status}).`);
  return body.data;
}

export const getProductBlankMappingIssues = (search = '', limit = 250) => action({ action: 'issues', search, limit });
export const searchMappingBlanks = (search = '', limit = 100) => action({ action: 'search_blanks', search, limit });
export const setProductBlankMapping = (input) => action({ action: 'set', ...input });
export const backfillProductBlankMappings = (limit = 5000) => action({ action: 'backfill', limit });
export const previewBlankSubstitution = (oldBlankProductId, newBlankProductId) => action({
  action: 'preview_substitution', old_blank_product_id: oldBlankProductId, new_blank_product_id: newBlankProductId,
});
export const applyBlankSubstitution = (oldBlankProductId, newBlankProductId, notes = '') => action({
  action: 'apply_substitution', old_blank_product_id: oldBlankProductId, new_blank_product_id: newBlankProductId, notes,
});
export const getProductBlankMappingHistory = (limit = 50) => action({ action: 'history', limit });
