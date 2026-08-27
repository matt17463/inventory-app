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
    const captionSettings = caption(body.caption);
    if (jobId) {
      const { data: queuedJob, error: queuedJobError } = await auth.supabase.from('mockup_generation_jobs').select('*').eq('id', jobId).maybeSingle();
      if (queuedJobError) throw queuedJobError;
      if (!queuedJob || queuedJob.generation_mode !== 'exact_composite') throw new Error('The queued Exact Clean job could not be found.');
      projectId = queuedJob.project_id;
      placementId = queuedJob.placement_id;
    }
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

    if (jobId) {
      const { error: startError } = await auth.supabase.from('mockup_generation_jobs').update({
        status: 'processing', model_name: 'server-sharp', started_at: new Date().toISOString(), error_message: null,
        request_metadata: { renderer: 'exact_server_sharp', cors_independent: true, background: true },
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
      metadata: { renderer: 'exact_server_sharp', exact_artwork: true, cors_independent: true, caption_render_state: 'current', blank_asset_id: blank.id, artwork_asset_id: artwork.id },
    }).select('*').single();
    if (saved.error) throw saved.error;
    await auth.supabase.from('mockup_generation_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', jobId);
    await auth.supabase.from('mockup_projects').update({ status: 'review' }).eq('id', project.id);
    return jsonResponse(200, { success: true, output: saved.data, generation_job_id: jobId }, event);
  } catch (error) {
    console.error('Exact mockup generation failed:', error);
    if (location) await deleteStoredAsset(auth.supabase, location).catch(() => {});
    await failJob(auth.supabase, jobId, error);
    return jsonResponse(500, { success: false, error: error.message || 'Exact mockup generation failed.' }, event);
  }
}
