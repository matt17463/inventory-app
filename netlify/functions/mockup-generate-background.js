import { authorizeEmployee, createServiceClient, jsonResponse } from './_shared/security.js';
import { loadMockupAsset, parseJsonBody, requiredEnv, safePathSegment } from './_shared/mockupUtils.js';
import { deleteStoredAsset, putMockupObject } from './_shared/mockupStorage.js';

function promptFor({ project, blank, artwork, placement, extra }) {
  const preserveWhiteInk = placement.perspective_config?.preserve_white_ink
    ?? artwork.metadata?.preserve_white_ink
    ?? true;
  return [
    'Create a professional ecommerce product mockup using the first input image as the exact blank product photograph and the second input image as the exact supplied artwork.',
    'Do not redraw, reinterpret, respell, simplify, recolor, crop, or add anything to the artwork. Preserve every letter, line, color, proportion, and transparent area.',
    preserveWhiteInk
      ? 'CRITICAL WHITE INK RULE: Every visible white or near-white letter, word, outline, and design element in the supplied artwork is intentional opaque printed white ink. Keep it solid white and clearly visible on the product. Do not treat white artwork—including white text—as transparency. Only pixels that are actually alpha-transparent in the source artwork may reveal the garment.'
      : `Use the requested ${placement.blend_mode || 'normal'} visual blend while preserving the supplied artwork structure.`,
    `The product is ${blank.product_color || ''} ${blank.product_type || 'product'}, ${blank.product_view || 'front'} view.`,
    `Apply the artwork as ${placement.decoration_method || 'DTF'} at ${String(placement.placement_name || 'center chest').replace(/_/g, ' ')}.`,
    `The supplied artwork asset is named ${artwork.artwork_name || artwork.original_file_name || 'uploaded artwork'}.`,
    placement.print_width_inches ? `The decoration should visually represent approximately ${placement.print_width_inches} inches wide.` : '',
    `Center coordinates are ${placement.x_pct}% horizontally and ${placement.y_pct}% vertically; visual width is ${placement.width_pct}% of the source image.`,
    'Make the decoration follow the surface perspective, folds, curvature, texture, lighting, and shadows while keeping the blank product and background recognizable.',
    project.exact_artwork_required ? 'Artwork fidelity is more important than creative interpretation.' : '',
    extra || placement.generation_instructions || '',
  ].filter(Boolean).join(' ');
}

async function failJob(supabase, jobId, error) {
  await supabase.from('mockup_generation_jobs').update({ status: 'failed', error_message: String(error?.message || error), completed_at: new Date().toISOString() }).eq('id', jobId);
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, error: 'Method not allowed.' }, event);

  const auth = await authorizeEmployee(event, { functionName: 'mockup-generate-background', allowedRoles: ['admin', 'manager', 'operator'] });
  if (!auth.ok) {
    try {
      const rejectedJobId = String(parseJsonBody(event).generation_job_id || '');
      if (rejectedJobId) await failJob(createServiceClient(), rejectedJobId, auth.message);
    } catch { /* The invocation is rejected even if the job ID cannot be parsed. */ }
    return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);
  }

  let jobId = '';
  const created = [];
  try {
    const body = parseJsonBody(event);
    jobId = String(body.generation_job_id || '');
    if (!jobId) throw new Error('Missing generation job ID.');

    const { data: job, error: jobError } = await auth.supabase.from('mockup_generation_jobs').select('*').eq('id', jobId).single();
    if (jobError) throw jobError;
    const [{ data: project, error: projectError }, { data: placement, error: placementError }] = await Promise.all([
      auth.supabase.from('mockup_projects').select('*').eq('id', job.project_id).single(),
      auth.supabase.from('mockup_placements').select('*').eq('id', job.placement_id).single(),
    ]);
    if (projectError) throw projectError;
    if (placementError) throw placementError;

    const [{ data: blank, error: blankError }, { data: artwork, error: artworkError }] = await Promise.all([
      auth.supabase.from('mockup_blank_assets').select('*').eq('id', placement.blank_asset_id).single(),
      auth.supabase.from('mockup_artwork_assets').select('*').eq('id', placement.artwork_asset_id).single(),
    ]);
    if (blankError) throw blankError;
    if (artworkError) throw artworkError;

    const model = String(process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5').trim();
    await auth.supabase.from('mockup_generation_jobs').update({ status: 'processing', started_at: new Date().toISOString(), model_name: model, error_message: null }).eq('id', jobId);
    await auth.supabase.from('mockup_projects').update({ status: 'generating' }).eq('id', project.id);

    const [blankFile, artworkFile] = await Promise.all([loadMockupAsset(auth.supabase, blank), loadMockupAsset(auth.supabase, artwork)]);
    const editableTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!editableTypes.has(String(blankFile.mimeType).split(';')[0].toLowerCase()) || !editableTypes.has(String(artworkFile.mimeType).split(';')[0].toLowerCase())) {
      throw new Error('AI Assist requires PNG, JPEG, or WebP source files. Export a raster copy of any SVG or PDF artwork and try again.');
    }
    const form = new FormData();
    form.append('model', model);
    form.append('image[]', new Blob([blankFile.bytes], { type: blankFile.mimeType }), safePathSegment(blankFile.name, 'blank.png'));
    form.append('image[]', new Blob([artworkFile.bytes], { type: artworkFile.mimeType }), safePathSegment(artworkFile.name, 'artwork.png'));
    form.append('prompt', promptFor({ project, blank, artwork, placement, extra: job.prompt_text }));
    if (model !== 'gpt-image-2') form.append('input_fidelity', 'high');
    form.append('quality', job.quality || 'high');
    form.append('size', job.output_size || '1024x1024');
    form.append('output_format', 'png');
    form.append('background', model !== 'gpt-image-2' && project.background_preference === 'transparent' ? 'transparent' : 'auto');
    form.append('n', String(Math.max(1, Math.min(Number(job.requested_variants || 1), 10))));

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${requiredEnv('OPENAI_API_KEY')}` },
      body: form,
      signal: AbortSignal.timeout(840000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `OpenAI image edit failed (HTTP ${response.status}).`);

    for (let index = 0; index < (payload.data || []).length; index += 1) {
      const item = payload.data[index];
      if (!item.b64_json) continue;
      const path = `${auth.user.id}/${project.id}/outputs/ai/${job.id}-v${index + 1}.png`;
      const location = await putMockupObject(auth.supabase, {
        key: path,
        bytes: Buffer.from(item.b64_json, 'base64'),
        contentType: 'image/png',
        makePreview: true,
      });
      const { data: output, error: outputError } = await auth.supabase.from('mockup_outputs').insert({
        project_id: project.id,
        placement_id: placement.id,
        generation_job_id: job.id,
        output_name: `${blank.asset_name} — AI assisted ${index + 1}`,
        output_kind: 'ai_enhanced',
        variant_number: index + 1,
        ...location,
        mime_type: 'image/png',
        metadata: { provider: 'openai', model, exact_artwork_requested: project.exact_artwork_required, usage: payload.usage || null, caption_render_state: 'current', blank_asset_id: blank.id, artwork_asset_id: artwork.id },
      }).select('*').single();
      if (outputError) throw outputError;
      created.push(output);
    }
    if (!created.length) throw new Error('The image provider returned no usable output images.');

    await auth.supabase.from('mockup_generation_jobs').update({ status: 'completed', completed_at: new Date().toISOString(), provider_request_id: response.headers.get('x-request-id') || null, request_metadata: { usage: payload.usage || null } }).eq('id', jobId);
    await auth.supabase.from('mockup_projects').update({ status: 'review' }).eq('id', project.id);
    return jsonResponse(200, { success: true, generation_job_id: jobId, outputs: created.map((row) => ({ id: row.id })) }, event);
  } catch (error) {
    console.error('Mockup generation failed:', error);
    if (created.length) {
      try { await auth.supabase.from('mockup_outputs').delete().eq('generation_job_id', jobId); } catch { /* best effort */ }
      for (const output of created) await deleteStoredAsset(auth.supabase, output).catch((cleanupError) => console.warn('Partial AI output cleanup failed:', cleanupError.message));
    }
    if (jobId) await failJob(auth.supabase, jobId, error);
    return jsonResponse(500, { success: false, error: error.message || 'Mockup generation failed.' }, event);
  }
}
