import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function callStorage(body) {
  const response = await authenticatedFunctionFetch('/.netlify/functions/asset-storage', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || 'Asset storage request failed.');
  return payload;
}

async function previewBlob(file, maxPixels = 720) {
  if (!String(file?.type || '').startsWith('image/') || /svg|gif/i.test(file.type)) return null;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxPixels / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d', { alpha: true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.76));
  } finally {
    bitmap?.close?.();
  }
}

async function put(url, body, contentType) {
  const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
  if (!response.ok) throw new Error(`R2 upload failed (HTTP ${response.status}). Check the R2 CORS policy.`);
}

export async function uploadOperationalImage(file, scope) {
  if (!file) return {};
  const preview = await previewBlob(file).catch(() => null);
  const upload = await callStorage({
    action: 'create_upload', scope, filename: file.name || 'image',
    content_type: file.type || 'image/jpeg', file_size: file.size,
    preview_content_type: preview ? 'image/webp' : null,
  });
  await put(upload.upload_url, file, file.type || 'image/jpeg');
  if (preview && upload.preview_upload_url) await put(upload.preview_upload_url, preview, 'image/webp');
  return {
    storage_provider: 'r2', storage_bucket: upload.storage_bucket, storage_path: upload.storage_path,
    file_size_bytes: file.size, mime_type: file.type || 'image/jpeg',
    preview_storage_provider: preview ? 'r2' : null,
    preview_storage_bucket: preview ? upload.preview_storage_bucket : null,
    preview_storage_path: preview ? upload.preview_storage_path : null,
    preview_size_bytes: preview?.size || null,
  };
}

export async function operationalAssetUrls(rows, options = {}) {
  const {
    idField = 'id', urlField = 'image_url', providerField = 'storage_provider', bucketField = 'storage_bucket',
    pathField = 'storage_path', previewProviderField = 'preview_storage_provider',
    previewBucketField = 'preview_storage_bucket', previewPathField = 'preview_storage_path',
  } = options;
  const urls = Object.fromEntries((rows || []).filter((row) => row?.[urlField]).map((row) => [String(row[idField]), row[urlField]]));
  const references = (rows || []).filter((row) => row?.[pathField]).map((row) => {
    const usePreview = Boolean(row?.[previewPathField]);
    return {
      id: String(row[idField]),
      provider: usePreview ? (row[previewProviderField] || row[providerField]) : row[providerField],
      bucket: usePreview ? (row[previewBucketField] || row[bucketField]) : row[bucketField],
      path: usePreview ? row[previewPathField] : row[pathField],
    };
  });
  if (references.length) {
    for (let index = 0; index < references.length; index += 200) {
      const signed = await callStorage({ action: 'sign_downloads', references: references.slice(index, index + 200), expires_in: 3600 });
      Object.assign(urls, signed.urls || {});
    }
  }
  return urls;
}

export async function deleteOperationalAsset(row, options = {}) {
  const {
    providerField = 'storage_provider', bucketField = 'storage_bucket', pathField = 'storage_path',
    previewProviderField = 'preview_storage_provider', previewBucketField = 'preview_storage_bucket',
    previewPathField = 'preview_storage_path', legacyBucket = '',
  } = options;
  const path = row?.[pathField];
  if (!path) return;
  return callStorage({
    action: 'delete',
    reference: { provider: row[providerField] || (legacyBucket ? 'supabase' : ''), bucket: row[bucketField] || legacyBucket, path },
    preview_reference: row?.[previewPathField] ? {
      provider: row[previewProviderField] || row[providerField],
      bucket: row[previewBucketField] || row[bucketField], path: row[previewPathField],
    } : null,
  });
}

export function operationalStorageStatus() {
  return callStorage({ action: 'status' });
}
