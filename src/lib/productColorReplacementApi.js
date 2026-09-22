import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function request(body) {
  const response = await authenticatedFunctionFetch('/.netlify/functions/product-color-replacement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `Product color replacement failed (HTTP ${response.status}).`);
  }
  return payload;
}

export async function searchWooProductsForColorReplacement(search) {
  const result = await request({ action: 'search', search });
  return result.products || [];
}

export async function inspectWooProductColors(productId) {
  return request({ action: 'inspect', product_id: Number(productId) });
}

export async function previewWooProductColorReplacement({ productId, oldColor, newColor }) {
  const result = await request({
    action: 'preview',
    product_id: Number(productId),
    old_color: oldColor,
    new_color: newColor,
  });
  return result.preview;
}

export async function applyWooProductColorReplacement({
  productId,
  oldColor,
  newColor,
  confirmationToken,
  repairOpenPullSheets = true,
  reason = '',
}) {
  return request({
    action: 'apply',
    product_id: Number(productId),
    old_color: oldColor,
    new_color: newColor,
    confirmation_token: confirmationToken,
    repair_open_pull_sheets: repairOpenPullSheets,
    reason,
  });
}
