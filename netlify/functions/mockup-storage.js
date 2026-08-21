import { randomUUID } from 'node:crypto';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { assertSafeExternalAssetUrl, fetchSafeExternalAsset, parseJsonBody } from './_shared/mockupUtils.js';
import {
  cleanObjectName,
  defaultMockupStorageProvider,
  deleteStoredAsset,
  putMockupObject,
  presignedR2Put,
  r2BucketName,
  r2Configured,
  safeObjectKey,
  signedStoredAssetUrl,
} from './_shared/mockupStorage.js';

const ALLOWED_FOLDERS = new Set(['blanks', 'artwork', 'outputs', 'production']);

function positiveSize(value) {
  const size = Number(value || 0);
  if (!Number.isSafeInteger(size) || size < 1 || size > 52_428_800) throw new Error('Mockup uploads must be between 1 byte and 50 MB.');
  return size;
}

function safeContentType(value) {
  const contentType = String(value || 'application/octet-stream').toLowerCase();
  if (!/^(image\/(png|jpeg|webp|svg\+xml)|application\/pdf)$/.test(contentType)) throw new Error(`Unsupported mockup file type: ${contentType}.`);
  return contentType;
}

function inferredExternalContentType(contentType, filename) {
  const normalized = String(contentType || '').split(';')[0].toLowerCase();
  if (/^(image\/(png|jpeg|webp|svg\+xml)|application\/pdf)$/.test(normalized)) return normalized;
  const extension = String(filename || '').toLowerCase().split('?')[0].split('.').pop();
  const inferred = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    svg: 'image/svg+xml', pdf: 'application/pdf',
  }[extension];
  if (!inferred) throw new Error(`The external artwork server returned an unsupported file type: ${normalized || 'unknown'}.`);
  return inferred;
}

async function createUpload(user, body) {
  if (defaultMockupStorageProvider() !== 'r2') throw new Error('New Mockup Studio uploads are not configured for R2.');
  const projectId = String(body.project_id || '');
  const folder = String(body.folder || '');
  if (!/^[a-f0-9-]{36}$/i.test(projectId)) throw new Error('A valid Mockup Studio project ID is required.');
  if (!ALLOWED_FOLDERS.has(folder)) throw new Error('Invalid Mockup Studio upload folder.');
  const contentType = safeContentType(body.content_type);
  positiveSize(body.file_size);
  const filename = cleanObjectName(body.filename || 'asset');
  const key = `${user.id}/${projectId}/${folder}/${randomUUID()}-${filename}`;
  const previewRequested = Boolean(body.preview_content_type);
  const previewKey = previewRequested ? `previews/${key.replace(/\.[a-z0-9]{1,8}$/i, '')}.webp` : null;
  return {
    provider: 'r2',
    bucket: r2BucketName(),
    path: key,
    upload_url: await presignedR2Put({ key, contentType }),
    preview_provider: previewRequested ? 'r2' : null,
    preview_bucket: previewRequested ? r2BucketName() : null,
    preview_path: previewKey,
    preview_upload_url: previewRequested ? await presignedR2Put({ key: previewKey, contentType: 'image/webp' }) : null,
  };
}

async function createRestoreUpload(body) {
  const provider = String(body.provider || '');
  if (provider !== 'r2') throw new Error('Only R2 restore uploads require a presigned URL.');
  if (String(body.bucket || '') !== r2BucketName()) throw new Error('The archive references an unexpected R2 bucket.');
  const key = safeObjectKey(body.path);
  const contentType = safeContentType(body.content_type);
  positiveSize(body.file_size);
  return { upload_url: await presignedR2Put({ key, contentType }), provider, bucket: r2BucketName(), path: key };
}

async function importExternalArtwork(user, supabase, body) {
  if (defaultMockupStorageProvider() !== 'r2') throw new Error('Artwork Vault imports require Mockup Studio R2 storage.');
  const projectId = String(body.project_id || '');
  if (!/^[a-f0-9-]{36}$/i.test(projectId)) throw new Error('A valid Mockup Studio project ID is required.');
  const sourceUrl = assertSafeExternalAssetUrl(body.source_url);
  const { data: project, error: projectError } = await supabase.from('mockup_projects').select('id').eq('id', projectId).single();
  if (projectError || !project) throw projectError || new Error('Mockup Studio project was not found.');

  const downloaded = await fetchSafeExternalAsset(sourceUrl);
  const remoteName = downloaded.name || 'external-artwork';
  const requestedName = String(body.filename || '').trim();
  const filename = cleanObjectName(/\.[a-z0-9]{1,8}$/i.test(requestedName) ? requestedName : remoteName);
  const contentType = inferredExternalContentType(downloaded.mimeType, filename || remoteName);
  const key = `${user.id}/${projectId}/artwork/imported/${randomUUID()}-${filename}`;
  const location = await putMockupObject(supabase, {
    key,
    bytes: downloaded.bytes,
    contentType,
    makePreview: true,
  });
  if (location.storage_provider !== 'r2') throw new Error('External artwork was not stored in R2.');
  const details = body.artwork && typeof body.artwork === 'object' && !Array.isArray(body.artwork) ? body.artwork : {};
  const importedAt = new Date().toISOString();
  const metadata = details.metadata && typeof details.metadata === 'object' && !Array.isArray(details.metadata) ? details.metadata : {};
  const insert = {
    project_id: projectId,
    artwork_name: String(details.artwork_name || requestedName || filename || 'Artwork').slice(0, 300),
    artwork_request_id_text: details.artwork_request_id_text ? String(details.artwork_request_id_text).slice(0, 200) : null,
    artwork_vault_reference: details.artwork_vault_reference ? String(details.artwork_vault_reference).slice(0, 200) : null,
    source_url: sourceUrl,
    mime_type: contentType,
    original_file_name: filename,
    has_transparency: details.has_transparency ?? null,
    exact_artwork_locked: details.exact_artwork_locked !== false,
    preflight_status: ['pending', 'passed', 'warning', 'failed'].includes(details.preflight_status) ? details.preflight_status : 'pending',
    preflight_notes: details.preflight_notes ? String(details.preflight_notes).slice(0, 2000) : null,
    metadata: {
      ...metadata,
      external_source_url: sourceUrl,
      external_final_url: downloaded.finalUrl,
      external_imported_at: importedAt,
    },
    created_by: user.id,
    ...location,
  };
  const { data: artwork, error: insertError } = await supabase.from('mockup_artwork_assets').insert(insert).select('*').single();
  if (insertError) {
    await deleteStoredAsset(supabase, location).catch((cleanupError) => console.error('Failed to clean up an uncommitted R2 artwork import:', cleanupError));
    throw insertError;
  }
  return { artwork, imported_at: importedAt };
}

async function signDownload(supabase, body) {
  const row = {
    storage_provider: body.provider,
    storage_bucket: body.bucket,
    storage_path: body.path,
    mime_type: body.mime_type,
  };
  return { url: await signedStoredAssetUrl(supabase, row, Number(body.expires_in || 3600)) };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, error: 'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'mockup-storage', allowedRoles: ['admin', 'manager', 'employee'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);
  try {
    const body = parseJsonBody(event);
    const action = String(body.action || 'status');
    const result = action === 'status'
      ? { configured: r2Configured(), default_provider: defaultMockupStorageProvider(), bucket: r2Configured() ? r2BucketName() : null }
      : action === 'create_upload'
        ? await createUpload(auth.user, body)
        : action === 'import_external_artwork'
          ? await importExternalArtwork(auth.user, auth.supabase, body)
        : action === 'create_restore_upload'
          ? await createRestoreUpload(body)
          : action === 'sign_download'
            ? await signDownload(auth.supabase, body)
            : null;
    if (!result) throw new Error('Unknown mockup storage action.');
    return jsonResponse(200, { success: true, ...result }, event);
  } catch (error) {
    console.error('Mockup storage request failed:', error);
    return jsonResponse(500, { success: false, error: error.message || 'Mockup storage request failed.' }, event);
  }
}
