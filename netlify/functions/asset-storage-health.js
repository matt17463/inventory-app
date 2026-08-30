import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { operationalStorageHealth } from './_shared/operationalStorage.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'GET') return jsonResponse(405, { success: false, error: 'Use GET.' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'asset-storage-health', allowedRoles: ['admin', 'manager'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);
  try {
    const [r2, inventory, buckets] = await Promise.all([
      operationalStorageHealth(),
      auth.supabase.from('sc_asset_storage_inventory').select('*'),
      auth.supabase.rpc('sc_storage_bucket_inventory_v1'),
    ]);
    if (inventory.error) throw inventory.error;
    if (buckets.error) throw buckets.error;
    const supabaseObjects = (buckets.data || []).reduce((sum, row) => sum + Number(row.object_count || 0), 0);
    const supabaseReferences = (inventory.data || [])
      .filter((row) => row.provider === 'supabase')
      .reduce((sum, row) => sum + Number(row.stored_file_count || 0), 0);
    return jsonResponse(200, {
      success: true, checked_at: new Date().toISOString(), r2,
      inventory: inventory.data || [], supabase_buckets: buckets.data || [],
      summary: {
        supabase_objects: supabaseObjects,
        supabase_database_references: supabaseReferences,
        migration_complete: supabaseObjects === 0 && supabaseReferences === 0,
      },
    }, event);
  } catch (error) {
    console.error('Asset storage health failed:', error);
    return jsonResponse(500, { success: false, error: error.message || 'Asset storage health failed.' }, event);
  }
};
