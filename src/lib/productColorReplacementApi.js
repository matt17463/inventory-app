import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function request(body) {
  const response = await authenticatedFunctionFetch('/.netlify/functions/product-color-replacement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `Product Color Manager failed (HTTP ${response.status}).`);
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
    action: 'preview_replace',
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
}) {
  return request({
    action: 'apply_replace',
    product_id: Number(productId),
    old_color: oldColor,
    new_color: newColor,
    confirmation_token: confirmationToken,
    repair_open_pull_sheets: repairOpenPullSheets,
  });
}

export async function previewWooProductColorAddition({ productId, templateColor, newColor }) {
  const result = await request({
    action: 'preview_add',
    product_id: Number(productId),
    template_color: templateColor,
    new_color: newColor,
  });
  return result.preview;
}

export async function uploadProductColorImage(productId, file) {
  const prepared = await request({
    action: 'prepare_image_upload',
    product_id: Number(productId),
    filename: file.name || 'variation-image',
    content_type: file.type || 'application/octet-stream',
    file_size: file.size,
  });
  const response = await fetch(prepared.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!response.ok) throw new Error(`R2 variation-image upload failed (HTTP ${response.status}).`);
  return prepared.reference;
}

export async function cancelProductColorImageUploads(productId, references) {
  if (!references?.length) return { deleted: 0 };
  return request({
    action: 'cancel_image_uploads',
    product_id: Number(productId),
    references,
  });
}

export async function applyWooProductColorAddition({
  productId,
  templateColor,
  newColor,
  confirmationToken,
  uploadedImages,
}) {
  return request({
    action: 'apply_add',
    product_id: Number(productId),
    template_color: templateColor,
    new_color: newColor,
    confirmation_token: confirmationToken,
    uploaded_images: uploadedImages,
  });
}
