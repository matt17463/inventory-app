import { supabase } from '../supabaseClient';
import { authenticatedFunctionFetch } from './netlifyFunctionClient';

export const MOCKUP_SOURCE_BUCKET = 'sc-mockup-source';
export const MOCKUP_OUTPUT_BUCKET = 'sc-mockup-output';
export const MOCKUP_PRODUCTION_BUCKET = 'sc-mockup-production';

let storageStatusPromise;

function cleanFileName(name = 'asset') {
  const parts = String(name).split('.');
  const extension = parts.length > 1 ? `.${parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '')}` : '';
  const base = parts.join('.').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'asset';
  return `${base.slice(0, 80)}${extension}`;
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data?.user?.id;
  if (!userId) throw new Error('Your employee session has expired. Sign in again.');
  return userId;
}

async function storageFunction(body) {
  const response = await authenticatedFunctionFetch('/.netlify/functions/mockup-storage', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || 'Mockup storage request failed.');
  return payload;
}

export function getMockupStorageStatus(refresh = false) {
  if (refresh || !storageStatusPromise) storageStatusPromise = storageFunction({ action: 'status' });
  return storageStatusPromise;
}

export async function retryMockupStorageCleanup() {
  const response = await authenticatedFunctionFetch('/.netlify/functions/mockup-storage-cleanup', { method: 'POST', body: '{}' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || 'Deferred mockup file cleanup failed.');
  return payload;
}

async function browserPreview(file, maxPixels = 800) {
  if (!String(file?.type || '').startsWith('image/') || /svg|gif/i.test(file.type)) return null;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxPixels / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d', { alpha: true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.78));
  } catch {
    return null;
  } finally {
    bitmap?.close?.();
  }
}

async function putPresigned(url, blob, contentType) {
  const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
  if (!response.ok) throw new Error(`R2 upload failed (HTTP ${response.status}). Confirm the R2 CORS configuration and Netlify environment variables.`);
}

async function uploadFile({ file, bucket, projectId, folder }) {
  if (!file) throw new Error('Choose a file to upload.');
  const storage = await getMockupStorageStatus();
  if (storage.default_provider === 'r2') {
    const preview = await browserPreview(file);
    const upload = await storageFunction({
      action: 'create_upload', project_id: projectId, folder,
      filename: file.name || 'asset', content_type: file.type || 'application/octet-stream', file_size: file.size,
      preview_content_type: preview ? 'image/webp' : null,
    });
    await putPresigned(upload.upload_url, file, file.type || 'application/octet-stream');
    if (preview && upload.preview_upload_url) await putPresigned(upload.preview_upload_url, preview, 'image/webp');
    return {
      storage_provider: 'r2', storage_bucket: upload.bucket, storage_path: upload.path, file_size_bytes: file.size,
      preview_storage_provider: preview ? 'r2' : null,
      preview_storage_bucket: preview ? upload.preview_bucket : null,
      preview_storage_path: preview ? upload.preview_path : null,
      preview_size_bytes: preview?.size || null,
      _pending_upload_cleanup: { project_id: projectId, path: upload.path, preview_path: preview ? upload.preview_path : null },
    };
  }
  const userId = await currentUserId();
  const path = `${userId}/${projectId}/${folder}/${crypto.randomUUID()}-${cleanFileName(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return { storage_provider: 'supabase', storage_bucket: bucket, storage_path: path, file_size_bytes: file.size };
}

function mockupRecordType(row) {
  if (row?.asset_name !== undefined) return 'mockup_blank_assets';
  if (row?.artwork_name !== undefined) return 'mockup_artwork_assets';
  if (row?.output_name !== undefined) return 'mockup_outputs';
  if (row?.packet_number !== undefined) return 'mockup_production_packets';
  return '';
}

export async function signedAssetUrl(row, expiresIn = 3600, { preferPreview = true } = {}) {
  const usePreview = preferPreview && row?.preview_storage_path;
  const bucket = usePreview ? (row.preview_storage_bucket || row.storage_bucket) : row?.storage_bucket;
  const path = usePreview ? row.preview_storage_path : row?.storage_path;
  const provider = usePreview ? (row.preview_storage_provider || row.storage_provider || 'supabase') : (row?.storage_provider || 'supabase');
  if (!bucket || !path) return '';
  if (provider === 'r2') {
    const recordType = mockupRecordType(row);
    if (!recordType || !row?.id) throw new Error('Mockup image record information is missing. Refresh the project and retry.');
    const payload = await storageFunction({
      action: 'sign_download', record_type: recordType, record_id: row.id,
      storage_field: usePreview ? 'preview_storage_path' : 'storage_path', expires_in: expiresIn,
    });
    return payload.url || '';
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || '';
}

export async function signedUrlsForAssets(rows = [], expiresIn = 3600, { preferPreview = true } = {}) {
  const failures = [];
  const entries = await Promise.all(rows.map(async (row) => {
    if (!row.storage_path && row.source_url) return [row.id, row.source_url];
    try {
      return [row.id, await signedAssetUrl(row, expiresIn, { preferPreview })];
    } catch (error) {
      failures.push(`${row.asset_name || row.artwork_name || row.output_name || row.id}: ${error.message}`);
      return [row.id, ''];
    }
  }));
  if (failures.length) throw new Error(`Could not load ${failures.length} Mockup Studio image${failures.length === 1 ? '' : 's'}: ${failures.slice(0, 3).join(' | ')}`);
  return Object.fromEntries(entries);
}

async function cancelPendingUpload(cleanup) {
  if (!cleanup?.path) return;
  await storageFunction({ action: 'cancel_upload', ...cleanup }).catch((error) => console.warn('Abandoned R2 upload cleanup failed:', error));
}

export async function listMockupProjects() {
  const { data, error } = await supabase
    .from('mockup_project_summary')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createMockupProject(values) {
  const storage = await getMockupStorageStatus();
  const payload = {
    project_name: String(values.project_name || '').trim(),
    customer_id_text: values.customer_id_text || null,
    customer_name: String(values.customer_name || '').trim() || null,
    campaign_name: String(values.campaign_name || '').trim() || null,
    project_type: values.project_type || 'store_product',
    output_style: values.output_style || 'clean_catalog',
    background_preference: values.background_preference || 'preserve_source',
    exact_artwork_required: values.exact_artwork_required !== false,
    notes: String(values.notes || '').trim() || null,
    storage_provider: storage.default_provider,
  };
  if (!payload.project_name) throw new Error('Enter a project name.');
  const { data, error } = await supabase.from('mockup_projects').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateMockupProject(projectId, changes) {
  const { data, error } = await supabase
    .from('mockup_projects')
    .update(changes)
    .eq('id', projectId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMockupProject(projectId) {
  const response = await authenticatedFunctionFetch('/.netlify/functions/mockup-delete-project', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || payload?.message || 'The mockup project could not be deleted.');
  return payload;
}

export async function deleteMockupOutput(outputId) {
  const response = await authenticatedFunctionFetch('/.netlify/functions/mockup-delete-output', {
    method: 'POST',
    body: JSON.stringify({ output_id: outputId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || payload?.message || 'The generated mockup could not be deleted.');
  return payload;
}

export async function getMockupProjectBundle(projectId) {
  const [project, blanks, artwork, placements, jobs, outputs, pricing, reviews, exports, packets, archives] = await Promise.all([
    supabase.from('mockup_projects').select('*').eq('id', projectId).single(),
    supabase.from('mockup_blank_assets').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('mockup_artwork_assets').select('*').eq('project_id', projectId).order('created_at'),
    supabase.from('mockup_placements').select('*').eq('project_id', projectId).order('layer_order'),
    supabase.from('mockup_generation_jobs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(50),
    supabase.from('mockup_outputs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('mockup_pricing_items').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('mockup_reviews').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(100),
    supabase.from('mockup_woo_exports').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(50),
    supabase.from('mockup_production_packets').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(20),
    supabase.from('mockup_project_archives').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(20),
  ]);
  const result = { project: project.data };
  const named = { blanks, artwork, placements, jobs, outputs, pricing, reviews, exports, packets, archives };
  if (project.error) throw project.error;
  Object.entries(named).forEach(([key, response]) => {
    if (response.error) throw response.error;
    result[key] = response.data || [];
  });
  return result;
}

async function archiveFunction(body) {
  const response = await authenticatedFunctionFetch('/.netlify/functions/mockup-archive-project', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || payload?.message || 'The local archive operation failed.');
  }
  return payload;
}

export async function beginMockupLocalArchive(projectId, manifest) {
  return archiveFunction({ action: 'begin', project_id: projectId, manifest });
}

export async function continueMockupLocalArchive(archiveId, onProgress = () => {}) {
  let response;
  do {
    response = await archiveFunction({ action: 'continue', archive_id: archiveId });
    onProgress({
      stage: 'cleanup',
      completed: Number(response.archive?.file_count || 0) - Number(response.remaining || 0),
      total: Number(response.archive?.file_count || 0),
      message: response.completed
        ? 'Cloud cleanup completed. The project is now locally archived.'
        : `Removing verified cloud copies: ${response.remaining} file(s) remaining…`,
    });
  } while (!response.completed);
  return response;
}

export async function completeMockupLocalArchiveRestore(archiveId, restoredFileKeys) {
  return archiveFunction({
    action: 'restore_complete',
    archive_id: archiveId,
    restored_file_keys: restoredFileKeys,
  });
}

export async function searchMockupBlankCatalog(search = '') {
  const term = String(search || '').trim().replace(/[%_,]/g, '');
  let query = supabase
    .from('blank_products')
    .select('id,sku_base,name,image_url,unit_cost,brands:brand_id(name,code),product_types:product_type_id(name,code),colors:color_id(name,code),sizes:size_id(name,code)')
    .eq('sc_is_archived', false)
    .limit(60);
  if (term) query = query.or(`sku_base.ilike.%${term}%,name.ilike.%${term}%`);
  const { data, error } = await query.order('name');
  if (error) throw error;
  return data || [];
}

export async function listMockupCustomers() {
  const { data, error } = await supabase.from('customers').select('*').order('name').limit(500);
  if (error) throw error;
  return data || [];
}

export async function listArtworkVaultCandidates() {
  const candidates = [];
  for (const table of ['sc_artwork_system_requests', 'sc_artwork_system_reorders', 'phase5_artwork_requests']) {
    const { data, error } = await supabase.from(table).select('*').limit(200);
    if (error) continue;
    for (const row of data || []) {
      candidates.push({ ...row, _source_table: table, _source_row_id: row.id });
      if (table === 'sc_artwork_system_requests' && Array.isArray(row.mockups)) {
        row.mockups.forEach((mockup, index) => {
          if (!mockup?.file_url) return;
          candidates.push({
            ...row,
            ...mockup,
            id: `${row.id}-mockup-${index + 1}`,
            title: mockup.title || `${row.organization || row.customer_name || 'Artwork request'} — Mockup ${index + 1}`,
            _source_table: table,
            _source_row_id: row.id,
          });
        });
      }
    }
  }
  return candidates;
}

async function importExternalArtwork({ projectId, sourceUrl, filename, artwork }) {
  return storageFunction({
    action: 'import_external_artwork',
    project_id: projectId,
    source_url: sourceUrl,
    filename: filename || 'artwork',
    artwork,
  });
}

export async function addBlankAsset({ projectId, file, values = {}, catalogItem = null }) {
  let location = {};
  if (file) location = await uploadFile({ file, bucket: MOCKUP_SOURCE_BUCKET, projectId, folder: 'blanks' });
  else if (values.source_url || catalogItem?.image_url) location = { source_url: values.source_url || catalogItem.image_url };
  else throw new Error('Upload a blank-product image or choose a catalog item with an image.');

  const cleanup = location._pending_upload_cleanup;
  delete location._pending_upload_cleanup;
  const payload = {
    project_id: projectId,
    blank_product_id_text: catalogItem?.id ? String(catalogItem.id) : values.blank_product_id_text || null,
    asset_name: values.asset_name || catalogItem?.name || file?.name || 'Blank product',
    product_type: values.product_type || catalogItem?.product_types?.name || 'other',
    product_color: values.product_color || catalogItem?.colors?.name || null,
    product_view: values.product_view || 'front',
    mime_type: file?.type || values.mime_type || null,
    original_file_name: file?.name || null,
    pixel_width: values.pixel_width || null,
    pixel_height: values.pixel_height || null,
    preflight_status: values.preflight_status || 'pending',
    preflight_notes: values.preflight_notes || null,
    metadata: {
      ...(values.metadata || {}),
      catalog_brand: catalogItem?.brands?.name || null,
      catalog_style: catalogItem?.product_types?.name || null,
      catalog_color: catalogItem?.colors?.name || null,
      catalog_size: catalogItem?.sizes?.name || null,
      catalog_sku_base: catalogItem?.sku_base || null,
    },
    ...location,
  };
  const { data, error } = await supabase.from('mockup_blank_assets').insert(payload).select('*').single();
  if (error) { await cancelPendingUpload(cleanup); throw error; }
  return data;
}

export async function addArtworkAsset({ projectId, file, values = {} }) {
  let location = {};
  if (file) location = await uploadFile({ file, bucket: MOCKUP_SOURCE_BUCKET, projectId, folder: 'artwork' });
  else if (values.source_url) {
    const imported = await importExternalArtwork({
      projectId,
      sourceUrl: values.source_url,
      filename: values.original_file_name || values.artwork_name || 'artwork',
      artwork: {
        artwork_name: values.artwork_name,
        artwork_request_id_text: values.artwork_request_id_text,
        artwork_vault_reference: values.artwork_vault_reference,
        has_transparency: values.has_transparency,
        exact_artwork_locked: values.exact_artwork_locked,
        preflight_status: values.preflight_status,
        preflight_notes: values.preflight_notes,
        metadata: values.metadata,
      },
    });
    if (!imported.artwork?.id) throw new Error('The external artwork was copied to R2 but its project record was not returned.');
    return imported.artwork;
  }
  else throw new Error('Upload artwork or choose an artwork-vault item with a usable file URL.');

  const cleanup = location._pending_upload_cleanup;
  delete location._pending_upload_cleanup;
  const payload = {
    project_id: projectId,
    artwork_name: values.artwork_name || file?.name || 'Artwork',
    artwork_request_id_text: values.artwork_request_id_text || null,
    artwork_vault_reference: values.artwork_vault_reference || null,
    mime_type: file?.type || values.mime_type || null,
    original_file_name: file?.name || values.original_file_name || null,
    pixel_width: values.pixel_width || null,
    pixel_height: values.pixel_height || null,
    has_transparency: values.has_transparency ?? null,
    exact_artwork_locked: values.exact_artwork_locked !== false,
    preflight_status: values.preflight_status || 'pending',
    preflight_notes: values.preflight_notes || null,
    metadata: values.metadata || {},
    ...location,
  };
  const { data, error } = await supabase.from('mockup_artwork_assets').insert(payload).select('*').single();
  if (error) { await cancelPendingUpload(cleanup); throw error; }
  return data;
}

export async function removeMockupAsset(table, row) {
  const response = await authenticatedFunctionFetch('/.netlify/functions/mockup-delete-asset', {
    method: 'POST',
    body: JSON.stringify({ table, asset_id: row?.id }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || 'The Mockup Studio asset could not be removed.');
  return payload;
}

export async function saveMockupPlacement(values) {
  const payload = {
    project_id: values.project_id,
    blank_asset_id: values.blank_asset_id,
    artwork_asset_id: values.artwork_asset_id,
    placement_name: values.placement_name || 'center_chest',
    decoration_method: values.decoration_method || 'dtf',
    x_pct: Number(values.x_pct ?? 50),
    y_pct: Number(values.y_pct ?? 45),
    width_pct: Number(values.width_pct ?? 40),
    print_width_inches: values.print_width_inches ? Number(values.print_width_inches) : null,
    print_height_inches: values.print_height_inches ? Number(values.print_height_inches) : null,
    rotation_degrees: Number(values.rotation_degrees || 0),
    opacity: Number(values.opacity ?? 1),
    blend_mode: values.blend_mode || 'source-over',
    shadow_strength: Number(values.shadow_strength ?? 0.15),
    curvature: Number(values.curvature || 0),
    perspective_config: {
      ...(values.perspective_config || {}),
      preserve_white_ink: values.preserve_white_ink
        ?? values.perspective_config?.preserve_white_ink
        ?? true,
    },
    generation_instructions: values.generation_instructions || null,
    layer_order: Number(values.layer_order || 0),
  };
  const query = values.id
    ? supabase.from('mockup_placements').update(payload).eq('id', values.id)
    : supabase.from('mockup_placements').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteMockupPlacement(id) {
  if (!id) throw new Error('Placement ID is required.');
  const { error } = await supabase.from('mockup_placements').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function copyPlacementToBlanks(placement, blankAssetIds = []) {
  const targetIds = [...new Set(blankAssetIds)]
    .filter((id) => id && id !== placement.blank_asset_id);
  if (!targetIds.length) return [];

  const basePayload = {
    project_id: placement.project_id,
    artwork_asset_id: placement.artwork_asset_id,
    placement_name: placement.placement_name || 'center_chest',
    decoration_method: placement.decoration_method || 'dtf',
    x_pct: Number(placement.x_pct ?? 50),
    y_pct: Number(placement.y_pct ?? 45),
    width_pct: Number(placement.width_pct ?? 40),
    height_pct: placement.height_pct ? Number(placement.height_pct) : null,
    print_width_inches: placement.print_width_inches ? Number(placement.print_width_inches) : null,
    print_height_inches: placement.print_height_inches ? Number(placement.print_height_inches) : null,
    rotation_degrees: Number(placement.rotation_degrees || 0),
    opacity: Number(placement.opacity ?? 1),
    blend_mode: placement.blend_mode || 'source-over',
    shadow_strength: Number(placement.shadow_strength ?? 0.15),
    curvature: Number(placement.curvature || 0),
    perspective_config: placement.perspective_config || {},
    generation_instructions: placement.generation_instructions || null,
    layer_order: Number(placement.layer_order || 0),
    is_active: placement.is_active !== false,
  };

  const copied = [];
  for (const blankAssetId of targetIds) {
    const { data, error } = await supabase
      .from('mockup_placements')
      .upsert({ ...basePayload, blank_asset_id: blankAssetId }, {
        onConflict: 'blank_asset_id,artwork_asset_id,placement_name',
      })
      .select('*')
      .single();
    if (error) throw new Error(`Could not copy placement to blank ${blankAssetId}: ${error.message}`);
    if (!data) throw new Error(`Copy to blank ${blankAssetId} did not return a saved placement.`);
    copied.push(data);
  }

  if (copied.length !== targetIds.length) {
    throw new Error(`Only ${copied.length} of ${targetIds.length} placement copies were saved.`);
  }
  return copied;
}

export async function saveExactCompositeOutput({ projectId, placementId, blob, caption = null, metadata = {} }) {
  const outputKind = caption ? 'captioned' : 'clean';
  const file = new File([blob], `${outputKind}.png`, { type: 'image/png' });
  const location = await uploadFile({ file, bucket: MOCKUP_OUTPUT_BUCKET, projectId, folder: 'outputs' });

  const { data, error } = await supabase.from('mockup_outputs').insert({
    project_id: projectId,
    placement_id: placementId,
    output_name: caption?.text || `Exact mockup ${new Date().toLocaleString()}`,
    output_kind: outputKind,
    ...location,
    mime_type: 'image/png',
    caption_text: caption?.text || null,
    caption_font: caption?.font || 'Arial',
    caption_size: Number(caption?.size || 36),
    caption_color: caption?.color || '#111827',
    caption_background: caption?.background || '#ffffff',
    caption_alignment: caption?.alignment || 'center',
    caption_padding: Number(caption?.padding || 32),
    metadata: { renderer: 'exact_browser_canvas', exact_artwork: true, ...metadata },
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function requestExactMockup({ projectId, placementId, caption = null, replaceOutputId = null }) {
  const { data: job, error } = await supabase.from('mockup_generation_jobs').insert({
    project_id: projectId, placement_id: placementId, generation_mode: 'exact_composite',
    status: 'queued', model_name: 'server-sharp', requested_variants: 1,
    request_metadata: {
      caption: caption || null,
      replace_output_id: replaceOutputId || null,
      renderer: 'exact_server_sharp',
      background: true,
    },
  }).select('*').single();
  if (error) throw error;

  let invocationError = '';
  try {
    const response = await authenticatedFunctionFetch('/.netlify/functions/mockup-generate-exact-background', {
      method: 'POST', body: JSON.stringify({ generation_job_id: job.id, caption, replace_output_id: replaceOutputId || null }),
    });
    const responseText = await response.text();
    let payload = {};
    try { payload = responseText ? JSON.parse(responseText) : {}; } catch { /* background acknowledgements may be empty */ }
    if (!response.ok || payload?.success === false) invocationError = payload?.error || `Exact Clean generation could not be started (HTTP ${response.status}).`;
  } catch (errorValue) { invocationError = errorValue?.message || 'Exact Clean generation could not be started.'; }

  if (invocationError) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data: current } = await supabase.from('mockup_generation_jobs').select('status,error_message').eq('id', job.id).single();
      if (current?.status === 'failed') throw new Error(current.error_message || invocationError);
      if (current?.status !== 'queued') { invocationError = ''; break; }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (invocationError) {
      await supabase.from('mockup_generation_jobs').update({
        status: 'failed', error_message: invocationError.slice(0, 2000), completed_at: new Date().toISOString(),
      }).eq('id', job.id).eq('status', 'queued');
      throw new Error(invocationError);
    }
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < 14 * 60 * 1000) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const { data: current, error: currentError } = await supabase.from('mockup_generation_jobs').select('*').eq('id', job.id).single();
    if (currentError) throw currentError;
    if (current.status === 'failed') throw new Error(current.error_message || 'Exact Clean generation failed.');
    if (current.status === 'completed') {
      const { data: outputs, error: outputsError } = await supabase.from('mockup_outputs').select('*').eq('generation_job_id', job.id).order('variant_number');
      if (outputsError) throw outputsError;
      return { success: true, job: current, output: outputs?.[0] || null, outputs: outputs || [] };
    }
  }
  throw new Error('Exact Clean is still running. Refresh this project in a few minutes to see the result.');
}

export async function downloadMockupStoredFile(reference) {
  if (reference.provider === 'r2') {
    const record = reference.references?.[0];
    if (!record?.record_type || !record?.record_id || !record?.field) throw new Error('The archive file is missing its database reference.');
    const payload = await storageFunction({
      action: 'sign_download', record_type: record.record_type, record_id: record.record_id,
      storage_field: record.field, expires_in: 3600,
    });
    const response = await fetch(payload.url);
    if (!response.ok) throw new Error(`R2 archive download failed (HTTP ${response.status}).`);
    return response.blob();
  }
  const { data, error } = await supabase.storage.from(reference.bucket).download(reference.path);
  if (error || !data) throw error || new Error('Supabase returned no archive file data.');
  return data;
}

export async function restoreMockupStoredFile(reference, file, archiveId) {
  if (reference.provider === 'r2') {
    const upload = await storageFunction({
      action: 'create_restore_upload', provider: 'r2', bucket: reference.bucket, path: reference.path,
      archive_id: archiveId, file_key: reference.key,
      content_type: reference.mime_type || file.type || 'application/octet-stream', file_size: file.size,
    });
    await putPresigned(upload.upload_url, file, reference.mime_type || file.type || 'application/octet-stream');
    return;
  }
  const { error } = await supabase.storage.from(reference.bucket).upload(reference.path, file, {
    contentType: reference.mime_type || file.type || undefined,
    cacheControl: '31536000',
    upsert: true,
  });
  if (error) throw error;
}

export async function migrateMockupProjectStorage(projectId, onProgress = () => {}) {
  let result;
  let processed = 0;
  do {
    const response = await authenticatedFunctionFetch('/.netlify/functions/mockup-migrate-storage', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, batch_size: 6 }),
    });
    result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) throw new Error(result?.error || 'The project storage migration failed.');
    processed += Number(result.migrated || 0);
    onProgress({ processed, remaining: Number(result.remaining || 0), warnings: result.warnings || [] });
  } while (Number(result.remaining || 0) > 0);
  return { ...result, processed };
}

export async function requestAiMockup({ projectId, placementId, variants = 1, quality = 'high', outputSize = '1024x1024', instructions = '' }) {
  const { data: job, error } = await supabase.from('mockup_generation_jobs').insert({
    project_id: projectId,
    placement_id: placementId,
    generation_mode: 'ai_assisted',
    requested_variants: Number(variants || 1),
    quality,
    output_size: outputSize,
    prompt_text: instructions || null,
  }).select('*').single();
  if (error) throw error;

  let invocationError = '';
  try {
    const response = await authenticatedFunctionFetch('/.netlify/functions/mockup-generate-background', {
      method: 'POST',
      body: JSON.stringify({ generation_job_id: job.id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) invocationError = payload?.error || payload?.message || `AI mockup generation could not be started (HTTP ${response.status}).`;
  } catch (error) {
    invocationError = error?.message || 'AI mockup generation could not be started.';
  }
  if (invocationError) {
    let accepted = false;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data: current, error: currentError } = await supabase.from('mockup_generation_jobs').select('status,error_message').eq('id', job.id).single();
      if (currentError) throw currentError;
      if (current.status === 'failed') throw new Error(current.error_message || invocationError);
      if (current.status !== 'queued') { accepted = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (!accepted) {
      await supabase.from('mockup_generation_jobs').update({ status: 'failed', error_message: invocationError, completed_at: new Date().toISOString() }).eq('id', job.id);
      throw new Error(invocationError);
    }
  }

  const startedAt = Date.now();
  const timeoutMs = 14 * 60 * 1000;
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const { data: refreshedJob, error: refreshError } = await supabase
      .from('mockup_generation_jobs')
      .select('*')
      .eq('id', job.id)
      .single();
    if (refreshError) throw refreshError;
    if (refreshedJob.status === 'failed') {
      throw new Error(refreshedJob.error_message || 'AI mockup generation failed.');
    }
    if (refreshedJob.status === 'completed') {
      const { data: outputs, error: outputsError } = await supabase
        .from('mockup_outputs')
        .select('*')
        .eq('generation_job_id', job.id)
        .order('variant_number');
      if (outputsError) throw outputsError;
      return { success: true, job: refreshedJob, outputs: outputs || [] };
    }
  }
  throw new Error('AI mockup generation is still running. Refresh this project in a few minutes to see the result.');
}

export async function updateMockupOutput(outputId, changes) {
  const { data, error } = await supabase.from('mockup_outputs').update(changes).eq('id', outputId).select('*').single();
  if (error) throw error;
  return data;
}

export async function selectMockupOutput(outputId, selected = true) {
  const { data, error } = await supabase.rpc('sc_mockup_select_output', {
    p_output_id: outputId,
    p_selected: selected,
  });
  if (error) throw error;
  return data;
}

export async function approveMockupOutput(outputId, status = 'internal_approved', selected = null) {
  const { data, error } = await supabase.rpc('sc_mockup_internal_review', {
    p_output_id: outputId,
    p_status: status,
    p_selected: selected,
  });
  if (error) throw error;
  return data;
}

export async function createMockupReviewLink(projectId, expiresInDays = 14) {
  const { data: token, error } = await supabase.rpc('sc_mockup_create_review_token', {
    p_project_id: projectId,
    p_expires_in_days: Number(expiresInDays || 14),
  });
  if (error) throw error;
  return `${window.location.origin}/mockup-review?token=${encodeURIComponent(token)}`;
}

export async function savePricingItem(values) {
  const pricingPath = values.pricing_path === 'wholesale' ? 'wholesale' : 'direct_retail';
  const payload = {
    project_id: values.project_id,
    label: String(values.label || '').trim(),
    pricing_type: values.pricing_type || 'per_item',
    pricing_path: pricingPath,
    quantity: Number(values.quantity || 1),
    unit_cost: Number(values.unit_cost || 0),
    wholesale_price: pricingPath === 'wholesale' ? Number(values.wholesale_price || 0) : null,
    markup_percent: 0,
    sell_price: Number(values.sell_price || 0),
    sort_order: Number(values.sort_order || 0),
  };
  if (!payload.label) throw new Error('Enter a pricing label.');
  if (!(payload.quantity > 0)) throw new Error('Enter a quantity greater than zero.');
  if (payload.unit_cost < 0 || payload.sell_price < 0 || (pricingPath === 'wholesale' && payload.wholesale_price < 0)) throw new Error('Pricing values cannot be negative.');
  const query = values.id
    ? supabase.from('mockup_pricing_items').update(payload).eq('id', values.id)
    : supabase.from('mockup_pricing_items').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return data;
}

export async function deletePricingItem(id) {
  const { error } = await supabase.from('mockup_pricing_items').delete().eq('id', id);
  if (error) throw error;
}

export async function publishMockupToWooCommerce(projectId, config, onProgress = () => {}) {
  const operation = Number(config.update_existing_product_id || 0)
    ? (config.status === 'publish' ? 'update_published' : 'update_draft')
    : (config.status === 'publish' ? 'publish' : 'create_draft');
  const { data: exportRow, error: exportError } = await supabase.from('mockup_woo_exports').insert({
    project_id: projectId,
    operation,
    status: 'queued',
    request_payload: config,
    response_payload: { stage: 'queued' },
  }).select('*').single();
  if (exportError) throw exportError;

  let invocationMessage = '';
  try {
    const response = await authenticatedFunctionFetch('/.netlify/functions/mockup-publish-woocommerce-background', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, export_id: exportRow.id, config }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      invocationMessage = payload?.error || payload?.message || `WooCommerce export could not be started (HTTP ${response.status}).`;
    }
  } catch (error) {
    invocationMessage = error?.message || 'WooCommerce export could not be started.';
  }

  // A gateway can end the browser request after the server has already started
  // the export. Before reporting a false startup failure, check the durable job
  // row for evidence that the background worker accepted it.
  if (invocationMessage) {
    let started = false;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data: current, error } = await supabase
        .from('mockup_woo_exports')
        .select('status,woo_product_id,error_message')
        .eq('id', exportRow.id)
        .single();
      if (error) throw error;
      if (current.status === 'failed') throw new Error(current.error_message || invocationMessage);
      if (current.status !== 'queued' || current.woo_product_id) {
        started = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (!started) {
      await supabase.from('mockup_woo_exports').update({ status: 'failed', error_message: invocationMessage, completed_at: new Date().toISOString() }).eq('id', exportRow.id);
      throw new Error(invocationMessage);
    }
  }

  onProgress({ stage: 'queued', message: 'WooCommerce export queued. You may keep this page open while variations are created.' });
  let lastProgress = '';
  for (let attempt = 0; attempt < 320; attempt += 1) {
    const { data: current, error } = await supabase
      .from('mockup_woo_exports')
      .select('status,woo_product_id,response_payload,error_message')
      .eq('id', exportRow.id)
      .single();
    if (error) throw error;
    if (current.status === 'failed') throw new Error(current.error_message || 'WooCommerce export failed.');
    if (current.status === 'completed') {
      const result = current.response_payload || {};
      return {
        success: true,
        product: {
          id: current.woo_product_id || result.product_id,
          status: result.status,
          permalink: result.permalink,
        },
        ...result,
      };
    }

    const progress = current.response_payload || {};
    const progressKey = JSON.stringify(progress);
    if (progressKey !== lastProgress) {
      lastProgress = progressKey;
      const processed = Number(progress.variations_processed || 0);
      const total = Number(progress.variations_total || 0);
      const message = progress.stage === 'variations' && total
        ? `Creating WooCommerce variations: ${processed} of ${total} operations completed.`
        : progress.stage === 'images'
          ? `Adding WooCommerce mockup images: ${Number(progress.images_processed || 0)} of ${Number(progress.images_total || 0)} completed.`
        : progress.stage === 'product_ready'
          ? `WooCommerce product ${progress.product_id} created. Preparing variations…`
          : 'Preparing the WooCommerce product…';
      onProgress({ ...progress, message });
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error('WooCommerce is still processing this export. Refresh the project in a few minutes to check its status.');
}

export async function getWooCommerceMockupOptions() {
  const response = await authenticatedFunctionFetch('/.netlify/functions/mockup-woo-options');
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || payload?.message || 'WooCommerce attributes could not be loaded.');
  return {
    ...(payload.attributes || {}),
    checked_at: payload.checked_at || null,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    categories: payload.categories || [],
    shipping_classes: payload.shipping_classes || [],
    tags: payload.tags || [],
  };
}

export async function saveProductionPacket(projectId, packetData) {
  const { data, error } = await supabase.rpc('sc_mockup_mark_production_ready', {
    p_project_id: projectId,
    p_packet_data: packetData || {},
  });
  if (error) throw error;
  return data;
}
