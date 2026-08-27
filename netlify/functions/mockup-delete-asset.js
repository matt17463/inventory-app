import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { parseJsonBody } from './_shared/mockupUtils.js';
import { deleteStoredAsset, queueStoredAssetCleanup } from './_shared/mockupStorage.js';

const TABLES = new Set(['mockup_blank_assets', 'mockup_artwork_assets']);

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, error: 'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'mockup-delete-asset', allowedRoles: ['admin', 'manager', 'employee'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);
  try {
    const body = parseJsonBody(event);
    const table = String(body.table || '');
    const assetId = String(body.asset_id || '');
    if (!TABLES.has(table) || !assetId) throw new Error('Invalid Mockup Studio asset deletion request.');
    const { data: row, error } = await auth.supabase.from(table).select('*').eq('id', assetId).single();
    if (error || !row) throw error || new Error('Mockup Studio asset was not found.');
    const placementColumn = table === 'mockup_blank_assets' ? 'blank_asset_id' : 'artwork_asset_id';
    const { data: dependentPlacements, error: placementError } = await auth.supabase.from('mockup_placements').select('id').eq(placementColumn, row.id);
    if (placementError) throw placementError;
    const placementIds = new Set((dependentPlacements || []).map((placement) => placement.id));
    const { data: dependentOutputs, error: outputError } = await auth.supabase.from('mockup_outputs').select('*').eq('project_id', row.project_id);
    if (outputError) throw outputError;
    const relatedOutputs = (dependentOutputs || []).filter((output) => placementIds.has(output.placement_id));
    const { error: deleteError } = await auth.supabase.from(table).delete().eq('id', assetId);
    if (deleteError) throw deleteError;
    const cleanupWarnings = [];
    for (const stored of [row, ...relatedOutputs]) {
      try { await deleteStoredAsset(auth.supabase, stored); }
      catch (storageError) {
        cleanupWarnings.push(storageError.message);
        await queueStoredAssetCleanup(auth.supabase, stored, `asset_deleted: ${storageError.message}`);
      }
    }
    if (table === 'mockup_artwork_assets' && row.prepared_storage_path) {
      const prepared = { project_id: row.project_id, storage_provider: row.prepared_storage_provider || row.storage_provider, storage_bucket: row.prepared_storage_bucket || row.storage_bucket, storage_path: row.prepared_storage_path };
      try { await deleteStoredAsset(auth.supabase, prepared, { includePreview: false }); }
      catch (storageError) { cleanupWarnings.push(storageError.message); await queueStoredAssetCleanup(auth.supabase, prepared, `prepared_artwork_deleted: ${storageError.message}`, { includePreview: false }); }
    }
    return jsonResponse(200, { success: true, deleted_id: assetId, cleanup_warning: cleanupWarnings.length ? cleanupWarnings.join(' | ') : null }, event);
  } catch (error) {
    console.error('Mockup asset deletion failed:', error);
    return jsonResponse(500, { success: false, error: error.message || 'Mockup Studio asset deletion failed.' }, event);
  }
}
