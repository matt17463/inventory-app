import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { loadMockupAsset, parseJsonBody, safePathSegment } from './_shared/mockupUtils.js';
import { deleteStoredAsset, putMockupObject } from './_shared/mockupStorage.js';
import { renderExactMockup } from './_shared/exactMockupRenderer.js';

function caption(value) {
  if (!value || typeof value !== 'object' || !String(value.text || '').trim()) return null;
  return {
    text: String(value.text).trim().slice(0, 500), font: String(value.font || 'Arial').slice(0, 80),
    size: Number(value.size || 36), color: String(value.color || '#111827'),
    background: String(value.background || '#ffffff'), alignment: String(value.alignment || 'center'),
    padding: Number(value.padding || 32), weight: Number(value.weight || 600),
  };
}

function replaceWooOutputReferences(value, oldOutputId, newOutputId) {
  const config = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
  if (String(config.main_product_image_output_id || '') === oldOutputId) {
    config.main_product_image_output_id = newOutputId;
  }
  const currentMap = config.variation_image_map && typeof config.variation_image_map === 'object' && !Array.isArray(config.variation_image_map)
    ? config.variation_image_map
    : {};
  config.variation_image_map = Object.fromEntries(Object.entries(currentMap).map(([key, outputId]) => [
    key,
    String(outputId || '') === oldOutputId ? newOutputId : outputId,
  ]));
  return config;
}

async function failJob(supabase, id, error) {
  if (!id) return;
  await supabase.from('mockup_generation_jobs').update({
    status: 'failed', error_message: String(error?.message || error).slice(0, 2000), completed_at: new Date().toISOString(),
  }).eq('id', id);
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, error: 'Use POST.' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'mockup-generate-exact', allowedRoles: ['admin', 'manager', 'operator', 'employee'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);

  let jobId = '';
  let location = null;
  try {
    const body = parseJsonBody(event);
    jobId = String(body.generation_job_id || '');
    let projectId = String(body.project_id || '');
    let placementId = String(body.placement_id || '');
    let queuedJob = null;
    if (jobId) {
      const { data, error: queuedJobError } = await auth.supabase.from('mockup_generation_jobs').select('*').eq('id', jobId).maybeSingle();
      if (queuedJobError) throw queuedJobError;
      queuedJob = data;
      if (!queuedJob || queuedJob.generation_mode !== 'exact_composite') throw new Error('The queued Exact Clean job could not be found.');
      projectId = queuedJob.project_id;
      placementId = queuedJob.placement_id;
    }
    const captionSettings = caption(body.caption || queuedJob?.request_metadata?.caption);
    const replaceOutputId = String(body.replace_output_id || queuedJob?.request_metadata?.replace_output_id || '');
    if (!projectId || !placementId) throw new Error('Project and placement are required.');

    const [{ data: project, error: projectError }, { data: placement, error: placementError }] = await Promise.all([
      auth.supabase.from('mockup_projects').select('*').eq('id', projectId).single(),
      auth.supabase.from('mockup_placements').select('*').eq('id', placementId).eq('project_id', projectId).single(),
    ]);
    if (projectError) throw projectError;
    if (placementError) throw placementError;
    const [{ data: blank, error: blankError }, { data: artwork, error: artworkError }] = await Promise.all([
      auth.supabase.from('mockup_blank_assets').select('*').eq('id', placement.blank_asset_id).single(),
      auth.supabase.from('mockup_artwork_assets').select('*').eq('id', placement.artwork_asset_id).single(),
    ]);
    if (blankError) throw blankError;
    if (artworkError) throw artworkError;

    let replacement = null;
    if (replaceOutputId) {
      const { data, error } = await auth.supabase
        .from('mockup_outputs')
        .select('*')
        .eq('id', replaceOutputId)
        .eq('project_id', projectId)
        .eq('placement_id', placementId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('The captioned mockup selected for regeneration was not found in this placement.');
      if (data.output_kind !== 'captioned') throw new Error('Only a captioned mockup can be regenerated and replaced.');
      replacement = data;
    }

    if (jobId) {
      const { error: startError } = await auth.supabase.from('mockup_generation_jobs').update({
        status: 'processing', model_name: 'server-sharp', started_at: new Date().toISOString(), error_message: null,
        request_metadata: {
          ...(queuedJob?.request_metadata || {}),
          caption: captionSettings,
          replace_output_id: replaceOutputId || null,
          renderer: 'exact_server_sharp',
          cors_independent: true,
          background: true,
        },
      }).eq('id', jobId);
      if (startError) throw startError;
    } else {
      const job = await auth.supabase.from('mockup_generation_jobs').insert({
        project_id: projectId, placement_id: placementId, generation_mode: 'exact_composite',
        status: 'processing', model_name: 'server-sharp', requested_variants: 1,
        started_at: new Date().toISOString(), request_metadata: { renderer: 'exact_server_sharp', cors_independent: true, background: false },
      }).select('*').single();
      if (job.error) throw job.error;
      jobId = job.data.id;
    }

    const [blankFile, artworkFile] = await Promise.all([
      loadMockupAsset(auth.supabase, blank), loadMockupAsset(auth.supabase, artwork),
    ]);
    if (String(artworkFile.mimeType).includes('pdf')) throw new Error('Exact Clean requires PNG, JPEG, WebP, or SVG artwork. Export this PDF as a transparent PNG and retry.');
    const rendered = await renderExactMockup({
      blankBytes: blankFile.bytes, artworkBytes: artworkFile.bytes, placement, caption: captionSettings,
    });
    const kind = captionSettings ? 'captioned' : 'clean';
    const key = `${auth.user.id}/${projectId}/outputs/exact/${jobId}-${safePathSegment(kind)}.png`;
    location = await putMockupObject(auth.supabase, { key, bytes: rendered.data, contentType: 'image/png', makePreview: true });
    const saved = await auth.supabase.from('mockup_outputs').insert({
      project_id: projectId, placement_id: placementId, generation_job_id: jobId,
      output_name: captionSettings?.text || `${blank.asset_name} — Exact Clean`, output_kind: kind,
      ...location, mime_type: 'image/png', pixel_width: rendered.width, pixel_height: rendered.height,
      caption_text: captionSettings?.text || null, caption_font: captionSettings?.font || 'Arial',
      caption_size: Number(captionSettings?.size || 36), caption_color: captionSettings?.color || '#111827',
      caption_background: captionSettings?.background || '#ffffff', caption_alignment: captionSettings?.alignment || 'center',
      caption_padding: Number(captionSettings?.padding || 32),
      metadata: {
        renderer: 'exact_server_sharp', exact_artwork: true, cors_independent: true,
        caption_render_state: 'current', blank_asset_id: blank.id, artwork_asset_id: artwork.id,
        replaces_output_id: replacement?.id || null,
      },
    }).select('*').single();
    if (saved.error) throw saved.error;

    if (replacement?.is_selected) {
      const { error: deselectError } = await auth.supabase
        .from('mockup_outputs')
        .update({ is_selected: false })
        .eq('project_id', projectId)
        .eq('placement_id', placementId);
      if (deselectError) throw deselectError;
      const { error: selectError } = await auth.supabase
        .from('mockup_outputs')
        .update({
          is_selected: true,
          approval_status: 'pending',
          approved_at: null,
          approved_by: null,
          woo_position: replacement.woo_position,
        })
        .eq('id', saved.data.id);
      if (selectError) {
        await auth.supabase.from('mockup_outputs').update({ is_selected: true }).eq('id', replacement.id);
        throw selectError;
      }
    }

    const nextWooConfig = replacement
      ? replaceWooOutputReferences(project.woo_config, replacement.id, saved.data.id)
      : project.woo_config;
    await auth.supabase.from('mockup_generation_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', jobId);
    await auth.supabase.from('mockup_projects').update({ status: 'review', woo_config: nextWooConfig }).eq('id', project.id);
    return jsonResponse(200, {
      success: true,
      output: { ...saved.data, is_selected: Boolean(replacement?.is_selected) },
      generation_job_id: jobId,
      replaced_output_id: replacement?.id || null,
    }, event);
  } catch (error) {
    console.error('Exact mockup generation failed:', error);
    if (location) await deleteStoredAsset(auth.supabase, location).catch(() => {});
    await failJob(auth.supabase, jobId, error);
    return jsonResponse(500, { success: false, error: error.message || 'Exact mockup generation failed.' }, event);
  }
}
