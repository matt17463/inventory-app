import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { wooCollection, wooRequest } from './_shared/mockupUtils.js';
import { id, lifecyclePreview, text } from './_shared/colorLifecycleData.js';

const FUNCTION_NAME = 'color-lifecycle-background';

async function updateJob(supabase, jobId, values) {
  const result = await supabase.from('sc_color_lifecycle_jobs').update({ ...values, updated_at: new Date().toISOString() }).eq('id', jobId);
  if (result.error) throw result.error;
}

async function scanWooColors(supabase, jobId) {
  const attributes = wooCollection(await wooRequest('products/attributes?per_page=100'), 'product attributes');
  const color = attributes.find((row) => ['pa_color', 'color', 'colour'].includes(text(row.slug || row.name).toLowerCase()));
  if (!color?.id) throw new Error('WooCommerce global Color attribute was not found.');
  let termCount = 0;
  for (let page = 1; page <= 100; page += 1) {
    const terms = wooCollection(await wooRequest(`products/attributes/${color.id}/terms?hide_empty=false&per_page=100&page=${page}`), 'color terms');
    if (terms.length) {
      const inserted = await supabase.from('sc_color_woo_term_snapshot').upsert(terms.map((term) => ({
        scan_id: jobId, attribute_id: color.id, term_id: term.id, term_name: term.name,
        term_slug: term.slug || null, product_count: Number(term.count || 0), scanned_at: new Date().toISOString(),
      })), { onConflict: 'scan_id,term_id' });
      if (inserted.error) throw inserted.error;
      termCount += terms.length;
    }
    if (terms.length < 100) break;
  }
  return { attribute_id: color.id, terms_scanned: termCount };
}

async function cleanupSelected(supabase, jobId, keys, userId) {
  const requested = new Set((keys || []).map(String));
  if (!requested.size) throw new Error('No unused colors were selected.');
  const current = await lifecyclePreview(supabase);
  if (current.scan_required) throw new Error('Run a WooCommerce color scan before cleanup.');
  const selected = current.rows.filter((row) => requested.has(row.key));
  if (selected.length !== requested.size) throw new Error('The color list changed. Run a new scan and review it again.');
  const blocked = selected.filter((row) => !row.eligible);
  if (blocked.length) throw new Error(`Cleanup stopped because ${blocked[0].color_name} is now in use or protected.`);

  const selectedColorIds = new Set(selected.filter((row) => row.color_id).map((row) => id(row.color_id)));
  const requestedTermIds = new Set(selected.map((row) => id(row.woo_term_id)).filter(Boolean));
  const liveTerms = [];
  for (let page = 1; page <= 100; page += 1) {
    const pageTerms = wooCollection(await wooRequest(`products/attributes/${current.attribute_id}/terms?hide_empty=false&per_page=100&page=${page}`), 'color terms');
    liveTerms.push(...pageTerms);
    if (pageTerms.length < 100) break;
  }
  const liveById = new Map(liveTerms.map((term) => [id(term.id), term]));
  const deletableTermIds = [];
  for (const termId of requestedTermIds) {
    const linkedActive = current.rows.filter((row) => id(row.woo_term_id) === termId && row.color_id && row.is_active);
    const allLinkedSelected = linkedActive.every((row) => selectedColorIds.has(id(row.color_id)));
    if (!allLinkedSelected && linkedActive.length) continue;
    const latest = liveById.get(termId);
    if (!latest) continue; // A prior safe retry may already have removed this zero-use term.
    if (Number(latest?.count || 0) !== 0) throw new Error(`${latest?.name || termId} became used in WooCommerce. Nothing further was removed.`);
    deletableTermIds.push(Number(termId));
  }

  const deletedTermIds = [];
  for (let index = 0; index < deletableTermIds.length; index += 50) {
    const batch = deletableTermIds.slice(index, index + 50);
    await wooRequest(`products/attributes/${current.attribute_id}/terms/batch`, { method: 'POST', body: { delete: batch } });
    deletedTermIds.push(...batch);
  }

  const archived = [];
  for (const row of selected.filter((item) => item.color_id)) {
    const result = await supabase.from('colors').update({
      is_active: false, archived_at: new Date().toISOString(), archived_reason: 'Unused color cleanup v0.8.13',
    }).eq('id', row.color_id).eq('is_active', true).select('id,name').maybeSingle();
    if (result.error) throw result.error;
    if (result.data) archived.push(row);
  }
  const logs = selected.map((row) => ({
    action: row.color_id ? 'archive_unused_color' : 'delete_unused_woo_term',
    color_id_text: row.color_id, color_name: row.color_name, woo_term_id: row.woo_term_id,
    details: { ...row, background_job_id: jobId }, created_by: userId,
  }));
  if (logs.length) {
    const logged = await supabase.from('sc_color_cleanup_log').insert(logs);
    if (logged.error) throw logged.error;
  }
  if (requestedTermIds.size) {
    const removedSnapshot = await supabase.from('sc_color_woo_term_snapshot')
      .delete().eq('scan_id', current.scan_id).in('term_id', Array.from(requestedTermIds));
    if (removedSnapshot.error) throw removedSnapshot.error;
  }
  return { archived_colors: archived.length, deleted_woo_terms: deletedTermIds.length };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, message: 'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName: FUNCTION_NAME, allowedRoles: ['admin'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, message: auth.message }, event);
  let jobId = '';
  try {
    const body = JSON.parse(event.body || '{}');
    jobId = text(body.job_id);
    if (!jobId || !['scan', 'cleanup'].includes(body.action)) throw new Error('A valid color lifecycle job is required.');
    const existing = await auth.supabase.from('sc_color_lifecycle_jobs').select('status,result').eq('id', jobId).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.status === 'completed') return jsonResponse(200, { success: true, job_id: jobId, ...(existing.data.result || {}) }, event);
    const created = await auth.supabase.from('sc_color_lifecycle_jobs').upsert({
      id: jobId, action: body.action, status: 'running', requested_keys: body.keys || [],
      created_by: auth.user.id, started_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (created.error) throw created.error;
    const result = body.action === 'scan'
      ? await scanWooColors(auth.supabase, jobId)
      : await cleanupSelected(auth.supabase, jobId, body.keys, auth.user.id);
    await updateJob(auth.supabase, jobId, { status: 'completed', result, completed_at: new Date().toISOString(), error_message: null });
    return jsonResponse(200, { success: true, job_id: jobId, ...result }, event);
  } catch (error) {
    console.error('Color lifecycle background job failed:', error);
    if (jobId) {
      await updateJob(auth.supabase, jobId, { status: 'failed', error_message: error.message || 'Background color job failed.', completed_at: new Date().toISOString() }).catch(() => {});
    }
    return jsonResponse(500, { success: false, job_id: jobId, message: error.message || 'Background color job failed.' }, event);
  }
}
