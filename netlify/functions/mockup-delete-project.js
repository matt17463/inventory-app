import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { parseJsonBody } from './_shared/mockupUtils.js';
import { deleteStoredAsset, queueStoredAssetCleanup } from './_shared/mockupStorage.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, error: 'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'mockup-delete-project', allowedRoles: ['admin', 'manager'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);

  try {
    const projectId = String(parseJsonBody(event).project_id || '');
    if (!projectId) throw new Error('Missing mockup project ID.');
    const assetQueries = await Promise.all([
      auth.supabase.from('mockup_blank_assets').select('*').eq('project_id', projectId),
      auth.supabase.from('mockup_artwork_assets').select('*').eq('project_id', projectId),
      auth.supabase.from('mockup_outputs').select('*').eq('project_id', projectId),
      auth.supabase.from('mockup_production_packets').select('*').eq('project_id', projectId),
    ]);
    const firstError = assetQueries.find((query) => query.error)?.error;
    if (firstError) throw firstError;

    const { error: deleteError } = await auth.supabase.from('mockup_projects').delete().eq('id', projectId);
    if (deleteError) throw deleteError;
    const warnings = [];
    for (const query of assetQueries) {
      for (const row of query.data || []) {
        try { await deleteStoredAsset(auth.supabase, row); }
        catch (storageError) { warnings.push(storageError.message); await queueStoredAssetCleanup(auth.supabase, row, `project_deleted: ${storageError.message}`); }
        if (row.prepared_storage_path) {
          const prepared = { project_id: projectId, storage_provider: row.prepared_storage_provider || row.storage_provider, storage_bucket: row.prepared_storage_bucket || row.storage_bucket, storage_path: row.prepared_storage_path };
          try { await deleteStoredAsset(auth.supabase, prepared, { includePreview: false }); }
          catch (storageError) { warnings.push(storageError.message); await queueStoredAssetCleanup(auth.supabase, prepared, `project_prepared_asset_deleted: ${storageError.message}`, { includePreview: false }); }
        }
      }
    }
    return jsonResponse(200, { success: true, deleted_project_id: projectId, cleanup_warning: warnings.length ? warnings.join(' | ') : null }, event);
  } catch (error) {
    console.error('Mockup project deletion failed:', error);
    return jsonResponse(500, { success: false, error: error.message || 'Mockup project deletion failed.' }, event);
  }
}
