import { supabase } from '../supabaseClient';
import { authenticatedFunctionFetch } from './netlifyFunctionClient';

export const MOCKUP_SOURCE_BUCKET = 'sc-mockup-source';
export const MOCKUP_OUTPUT_BUCKET = 'sc-mockup-output';
export const MOCKUP_PRODUCTION_BUCKET = 'sc-mockup-production';

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

async function uploadFile({ file, bucket, projectId, folder }) {
  if (!file) throw new Error('Choose a file to upload.');
  const userId = await currentUserId();
  const path = `${userId}/${projectId}/${folder}/${crypto.randomUUID()}-${cleanFileName(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return { storage_bucket: bucket, storage_path: path };
}

export async function signedAssetUrl(bucket, path, expiresIn = 3600) {
  if (!bucket || !path) return '';
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || '';
}

export async function signedUrlsForAssets(rows = [], expiresIn = 3600) {
  const entries = await Promise.all(rows.map(async (row) => {
    if (row.source_url) return [row.id, row.source_url];
    try {
      return [row.id, await signedAssetUrl(row.storage_bucket, row.storage_path, expiresIn)];
    } catch {
      return [row.id, ''];
    }
  }));
  return Object.fromEntries(entries);
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
    supabase.from('mockup_generation_jobs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('mockup_outputs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('mockup_pricing_items').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('mockup_reviews').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('mockup_woo_exports').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('mockup_production_packets').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('mockup_project_archives').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
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
        ? 'Supabase cleanup completed. The project is now locally archived.'
        : `Removing verified Supabase copies: ${response.remaining} file(s) remaining…`,
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
  for (const table of ['sc_artwork_system_requests', 'phase5_artwork_requests']) {
    const { data, error } = await supabase.from(table).select('*').limit(200);
    if (!error) candidates.push(...(data || []).map((row) => ({ ...row, _source_table: table })));
  }
  return candidates;
}

export async function addBlankAsset({ projectId, file, values = {}, catalogItem = null }) {
  let location = {};
  if (file) location = await uploadFile({ file, bucket: MOCKUP_SOURCE_BUCKET, projectId, folder: 'blanks' });
  else if (values.source_url || catalogItem?.image_url) location = { source_url: values.source_url || catalogItem.image_url };
  else throw new Error('Upload a blank-product image or choose a catalog item with an image.');

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
  if (error) throw error;
  return data;
}

export async function addArtworkAsset({ projectId, file, values = {} }) {
  let location = {};
  if (file) location = await uploadFile({ file, bucket: MOCKUP_SOURCE_BUCKET, projectId, folder: 'artwork' });
  else if (values.source_url) location = { source_url: values.source_url };
  else throw new Error('Upload artwork or choose an artwork-vault item with a usable file URL.');

  const payload = {
    project_id: projectId,
    artwork_name: values.artwork_name || file?.name || 'Artwork',
    artwork_request_id_text: values.artwork_request_id_text || null,
    artwork_vault_reference: values.artwork_vault_reference || null,
    mime_type: file?.type || values.mime_type || null,
    original_file_name: file?.name || null,
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
  if (error) throw error;
  return data;
}

export async function removeMockupAsset(table, row) {
  if (row?.storage_bucket && row?.storage_path) {
    const { error: storageError } = await supabase.storage.from(row.storage_bucket).remove([row.storage_path]);
    if (storageError) throw storageError;
  }
  const { error } = await supabase.from(table).delete().eq('id', row.id);
  if (error) throw error;
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
  const userId = await currentUserId();
  const outputKind = caption ? 'captioned' : 'clean';
  const path = `${userId}/${projectId}/outputs/${crypto.randomUUID()}-${outputKind}.png`;
  const { error: uploadError } = await supabase.storage.from(MOCKUP_OUTPUT_BUCKET).upload(path, blob, {
    contentType: 'image/png',
    cacheControl: '3600',
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.from('mockup_outputs').insert({
    project_id: projectId,
    placement_id: placementId,
    output_name: caption?.text || `Exact mockup ${new Date().toLocaleString()}`,
    output_kind: outputKind,
    storage_bucket: MOCKUP_OUTPUT_BUCKET,
    storage_path: path,
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

  const response = await authenticatedFunctionFetch('/.netlify/functions/mockup-generate-background', {
    method: 'POST',
    body: JSON.stringify({ generation_job_id: job.id }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || payload?.message || 'AI mockup generation failed.');

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

export async function createMockupReviewLink(projectId, expiresInDays = 14) {
  const { data: token, error } = await supabase.rpc('sc_mockup_create_review_token', {
    p_project_id: projectId,
    p_expires_in_days: Number(expiresInDays || 14),
  });
  if (error) throw error;
  return `${window.location.origin}/mockup-review?token=${encodeURIComponent(token)}`;
}

export async function savePricingItem(values) {
  const payload = {
    project_id: values.project_id,
    label: values.label,
    pricing_type: values.pricing_type || 'per_item',
    quantity: Number(values.quantity || 1),
    unit_cost: Number(values.unit_cost || 0),
    markup_percent: Number(values.markup_percent || 0),
    sell_price: Number(values.sell_price || 0),
    sort_order: Number(values.sort_order || 0),
  };
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
    categories: payload.categories || [],
    shipping_classes: payload.shipping_classes || [],
  };
}

export async function saveProductionPacket(projectId, packetData) {
  const packetNumber = `MS-${String(projectId).slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
  const { data, error } = await supabase.from('mockup_production_packets').insert({
    project_id: projectId,
    packet_number: packetNumber,
    status: 'ready',
    packet_data: packetData || {},
  }).select('*').single();
  if (error) throw error;
  return data;
}
