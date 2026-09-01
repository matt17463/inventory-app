import { randomUUID } from 'node:crypto';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { cleanObjectName, presignedR2Put, r2BucketName } from './_shared/mockupStorage.js';
import {
  deleteOperationalObject,
  operationalR2Configured,
  operationalStorageProvider,
  safeOperationalKey,
  signedOperationalUrl,
} from './_shared/operationalStorage.js';

const SCOPES = new Map([
  ['samples', { prefix: 'operational/samples', max: 25 * 1024 * 1024, imageOnly: true }],
  ['products', { prefix: 'operational/products', max: 25 * 1024 * 1024, imageOnly: true }],
  ['production', { prefix: 'operational/production', max: 25 * 1024 * 1024, imageOnly: true }],
]);

function contentType(value, imageOnly = false) {
  const type = String(value || 'application/octet-stream').toLowerCase();
  const allowed = imageOnly ? /^image\/(png|jpeg|webp|gif)$/ : /^(image\/(png|jpeg|webp|gif)|application\/pdf)$/;
  if (!allowed.test(type)) throw new Error(`Unsupported asset type: ${type}.`);
  return type;
}

function size(value, max) {
  const amount = Number(value || 0);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > max) throw new Error(`Asset must be between 1 byte and ${Math.round(max / 1048576)} MB.`);
  return amount;
}

async function createUpload(user, body) {
  operationalStorageProvider();
  const scope = SCOPES.get(String(body.scope || ''));
  if (!scope) throw new Error('Invalid operational asset scope.');
  const mime = contentType(body.content_type, scope.imageOnly);
  const bytes = size(body.file_size, scope.max);
  const filename = cleanObjectName(body.filename || 'asset');
  const key = `${scope.prefix}/${user.id}/${randomUUID()}-${filename}`;
  const previewKey = body.preview_content_type
    ? `${scope.prefix}/previews/${user.id}/${randomUUID()}-${filename.replace(/\.[a-z0-9]{1,8}$/i, '')}.webp`
    : null;
  return {
    storage_provider: 'r2', storage_bucket: r2BucketName(), storage_path: key, file_size_bytes: bytes,
    mime_type: mime,
    upload_url: await presignedR2Put({ key: safeOperationalKey(key), contentType: mime }),
    preview_storage_provider: previewKey ? 'r2' : null,
    preview_storage_bucket: previewKey ? r2BucketName() : null,
    preview_storage_path: previewKey,
    preview_upload_url: previewKey ? await presignedR2Put({ key: safeOperationalKey(previewKey), contentType: 'image/webp' }) : null,
  };
}

async function signDownloads(supabase, body) {
  const references = Array.isArray(body.references) ? body.references.slice(0, 250) : [];
  const urls = {};
  await Promise.all(references.map(async (reference) => {
    const id = String(reference.id || '');
    if (!id) return;
    urls[id] = await signedOperationalUrl(supabase, reference, Number(body.expires_in || 3600));
  }));
  return { urls };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, error: 'Use POST.' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'asset-storage', allowedRoles: ['admin', 'manager', 'operator', 'employee'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);
  try {
    const body = JSON.parse(event.body || '{}');
    const action = String(body.action || 'status');
    let result;
    if (action === 'status') result = { configured: operationalR2Configured(), provider: operationalStorageProvider(), bucket: r2BucketName() };
    else if (action === 'create_upload') result = await createUpload(auth.user, body);
    else if (action === 'sign_downloads') result = await signDownloads(auth.supabase, body);
    else if (action === 'delete') {
      await deleteOperationalObject(auth.supabase, body.reference || {});
      if (body.preview_reference?.path) await deleteOperationalObject(auth.supabase, body.preview_reference);
      result = { deleted: true };
    } else throw new Error('Unknown asset storage action.');
    return jsonResponse(200, { success: true, ...result }, event);
  } catch (error) {
    console.error('Operational asset storage failed:', error);
    return jsonResponse(500, { success: false, error: error.message || 'Operational asset storage failed.' }, event);
  }
};
