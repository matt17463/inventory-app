import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { r2BucketName, r2Client, safeObjectKey } from './_shared/mockupStorage.js';

const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||''));

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { message: 'POST required' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'traveler-artwork-preflight', allowedRoles: ['admin','manager','operator'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { message: auth.message }, event);
  try {
    const body = JSON.parse(event.body || '{}');
    const recipeId = body.recipe_version_id;
    if (!isUuid(recipeId)) return jsonResponse(400, { message: 'Valid recipe version required' }, event);
    const { data: recipe, error: recipeError } = await auth.supabase.from('sc_manufacturing_recipe_versions')
      .select('id,status,artwork_asset_id,placements').eq('id',recipeId).single();
    if (recipeError || recipe?.status !== 'approved') return jsonResponse(409, { message: 'Approved recipe not available' }, event);
    const rawPlacements = Array.isArray(recipe.placements) ? recipe.placements : [];
    const ids = [...new Set([recipe.artwork_asset_id, ...rawPlacements.map(p => p.artwork_asset_id || recipe.artwork_asset_id)].filter(Boolean))];
    if (!ids.length || ids.some(id => !isUuid(id))) return jsonResponse(409, { message: 'Recipe is missing valid artwork references' }, event);
    const { data: assets, error } = await auth.supabase.from('mockup_artwork_assets')
      .select('id,storage_provider,storage_bucket,storage_path,preflight_status').in('id',ids);
    if (error) throw error;
    const byId = new Map((assets || []).map(asset => [asset.id, asset]));
    for (const id of ids) {
      const a = byId.get(id);
      if (!a || !['passed','approved','ready'].includes(String(a.preflight_status||'').toLowerCase()))
        return jsonResponse(409,{message:'Production artwork has not passed preflight',asset_id:id},event);
      if (!a.storage_path || !a.storage_bucket)
        return jsonResponse(409,{message:'Production artwork storage reference is missing',asset_id:id},event);
      if (a.storage_provider === 'r2') {
        if (a.storage_bucket !== r2BucketName())
          return jsonResponse(409,{message:'Production artwork R2 bucket mismatch',asset_id:id},event);
        try {
          await r2Client().send(new HeadObjectCommand({ Bucket:a.storage_bucket,Key:safeObjectKey(a.storage_path) }));
        } catch (headError) {
          console.error('Traveler artwork R2 preflight failed', { asset_id:id, error:headError?.name });
          return jsonResponse(409,{message:'Production artwork file could not be verified in R2',asset_id:id},event);
        }
      } else if (a.storage_provider === 'supabase') {
        const { data, error: downloadError } = await auth.supabase.storage.from(a.storage_bucket).download(a.storage_path);
        if (downloadError || !data || data.size === 0)
          return jsonResponse(409,{message:'Production artwork file could not be verified in storage',asset_id:id},event);
      } else {
        return jsonResponse(409,{message:'Unsupported artwork storage provider',asset_id:id},event);
      }
    }
    return jsonResponse(200,{verified:true,artwork_asset_ids:ids},event);
  } catch (e) {
    console.error('Traveler artwork preflight unavailable',e);
    return jsonResponse(503,{message:'Artwork storage verification is unavailable; traveler creation must remain blocked'},event);
  }
}
