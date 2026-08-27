import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { deleteStoredReference } from './_shared/mockupStorage.js';

const BATCH_SIZE = 25;

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, error: 'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'mockup-storage-cleanup', allowedRoles: ['admin', 'manager'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);
  try {
    const { data: rows, error } = await auth.supabase.from('mockup_storage_cleanup_queue').select('*').in('status', ['pending', 'failed']).order('created_at').limit(BATCH_SIZE);
    if (error) throw error;
    let completed = 0;
    const failures = [];
    for (const row of rows || []) {
      await auth.supabase.from('mockup_storage_cleanup_queue').update({ status: 'processing', attempt_count: Number(row.attempt_count || 0) + 1 }).eq('id', row.id);
      try {
        await deleteStoredReference(auth.supabase, { provider: row.storage_provider, bucket: row.storage_bucket, path: row.storage_path });
        await auth.supabase.from('mockup_storage_cleanup_queue').update({ status: 'completed', completed_at: new Date().toISOString(), last_error: null }).eq('id', row.id);
        completed += 1;
      } catch (cleanupError) {
        failures.push(`${row.storage_path}: ${cleanupError.message}`);
        await auth.supabase.from('mockup_storage_cleanup_queue').update({ status: 'failed', last_error: String(cleanupError.message || cleanupError).slice(0, 2000) }).eq('id', row.id);
      }
    }
    const { count } = await auth.supabase.from('mockup_storage_cleanup_queue').select('id', { count: 'exact', head: true }).in('status', ['pending', 'failed']);
    return jsonResponse(200, { success: true, processed: rows?.length || 0, completed, remaining: count || 0, failures: failures.slice(0, 10) }, event);
  } catch (error) {
    console.error('Mockup deferred storage cleanup failed:', error);
    return jsonResponse(500, { success: false, error: error.message || 'Deferred storage cleanup failed.' }, event);
  }
}
