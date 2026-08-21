import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { parseJsonBody } from './_shared/mockupUtils.js';
import { deleteStoredAsset } from './_shared/mockupStorage.js';

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
    await deleteStoredAsset(auth.supabase, row);
    if (table === 'mockup_artwork_assets' && row.prepared_storage_path) {
      await deleteStoredAsset(auth.supabase, {
        storage_provider: row.prepared_storage_provider || row.storage_provider,
        storage_bucket: row.prepared_storage_bucket || row.storage_bucket,
        storage_path: row.prepared_storage_path,
      }, { includePreview: false });
    }
    const { error: deleteError } = await auth.supabase.from(table).delete().eq('id', assetId);
    if (deleteError) throw deleteError;
    return jsonResponse(200, { success: true, deleted_id: assetId }, event);
  } catch (error) {
    console.error('Mockup asset deletion failed:', error);
    return jsonResponse(500, { success: false, error: error.message || 'Mockup Studio asset deletion failed.' }, event);
  }
}
