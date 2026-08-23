import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { lifecyclePreview, text } from './_shared/colorLifecycleData.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (!['GET', 'POST'].includes(event.httpMethod)) return jsonResponse(405, { success: false, message: 'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'color-lifecycle-fast', allowedRoles: ['admin', 'manager'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, message: auth.message }, event);
  try {
    if (event.httpMethod === 'POST') {
      if (auth.role !== 'admin') throw new Error('Only an administrator can start WooCommerce color jobs.');
      const body = JSON.parse(event.body || '{}');
      const jobId = text(body.job_id);
      if (!jobId || !['scan', 'cleanup'].includes(body.action)) throw new Error('A valid color lifecycle job is required.');
      const queued = await auth.supabase.from('sc_color_lifecycle_jobs').insert({
        id: jobId, action: body.action, status: 'queued', requested_keys: body.keys || [], created_by: auth.user.id,
      });
      if (queued.error) throw queued.error;
      return jsonResponse(200, { success: true, job_id: jobId }, event);
    }
    const jobId = text(event.queryStringParameters?.job_id);
    if (jobId) {
      const job = await auth.supabase.from('sc_color_lifecycle_jobs').select('*').eq('id', jobId).maybeSingle();
      if (job.error) throw job.error;
      return jsonResponse(200, { success: true, job: job.data || null }, event);
    }
    return jsonResponse(200, { success: true, ...(await lifecyclePreview(auth.supabase)) }, event);
  } catch (error) {
    console.error('Fast color lifecycle request failed:', error);
    return jsonResponse(400, { success: false, message: /sc_color_lifecycle_jobs|sc_color_lifecycle_usage_counts|does not exist|schema cache/i.test(error.message || '')
      ? 'Color background-job SQL is not installed. Run deployment/sql/27_COLOR_LIFECYCLE_BACKGROUND_JOBS.sql, then retry.'
      : (error.message || 'Color lifecycle request failed.') }, event);
  }
}
