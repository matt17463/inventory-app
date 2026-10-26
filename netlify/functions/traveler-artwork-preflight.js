import { createHash } from 'node:crypto';
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
    const jobId = Number(body.job_id);
    const itemIds = body.job_item_ids;
    if (!Number.isSafeInteger(jobId) || jobId <= 0 || !Array.isArray(itemIds) || !itemIds.length || itemIds.length > 100
        || itemIds.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(itemIds).size !== itemIds.length)
      return jsonResponse(400, {message:'Valid job and distinct job line IDs are required'},event);
    const {data:job,error:jobError} = await auth.supabase.from('jobs').select('id,woocommerce_order_id').eq('id',jobId).single();
    if (jobError || !job) return jsonResponse(404,{message:'Job not found'},event);
    const {data:items,error:itemsError} = await auth.supabase.from('job_items')
      .select('id,job_id,woocommerce_line_item_id').eq('job_id',jobId).in('id',itemIds);
    if (itemsError || items?.length !== itemIds.length) return jsonResponse(409,{message:'Selected lines do not belong to job'},event);
    if (!isUuid(recipeId)) return jsonResponse(400, { message: 'Valid recipe version required' }, event);
    const { data: recipe, error: recipeError } = await auth.supabase.from('sc_manufacturing_recipe_versions')
      .select('id,status,artwork_asset_id,placements').eq('id',recipeId).single();
    if (recipeError || recipe?.status !== 'approved') return jsonResponse(409, { message: 'Approved recipe not available' }, event);
    const rawPlacements = Array.isArray(recipe.placements) ? recipe.placements : [];
    const {data:lineArtwork,error:lineArtworkError}=await auth.supabase.from('sc_job_line_placement_artwork')
      .select('job_item_id,recipe_version_id,placement_name,artwork_asset_id')
      .eq('recipe_version_id',recipeId).in('job_item_id',itemIds);
    if(lineArtworkError)throw lineArtworkError;
    const assignedFor=item=>(lineArtwork||[]).filter(row=>Number(row.job_item_id)===Number(item.id));
    // Each generic placement must be backed by an exact approved job-line assignment.
    for(const item of items){
      for(const placement of rawPlacements){
        if(placement.artwork_asset_id||recipe.artwork_asset_id)continue;
        const matches=assignedFor(item).filter(row=>row.placement_name===placement.placement_name);
        if(matches.length!==1)return jsonResponse(409,{message:'A required job artwork placement is not approved',job_item_id:item.id,placement_name:placement.placement_name},event);
      }
    }
    const recipeIds = [recipe.artwork_asset_id, ...rawPlacements.map(p => p.artwork_asset_id || recipe.artwork_asset_id)].filter(Boolean);
    const {data:allSelections,error:selectionError}=await auth.supabase.from('sc_order_graphic_selections')
      .select('job_item_id,source,external_order_id,external_line_id,resolution_snapshot')
      .or('job_item_id.in.('+itemIds.join(',')+')'+(job.woocommerce_order_id ? ',and(source.eq.woocommerce,external_order_id.eq.'+job.woocommerce_order_id+')' : ''));
    if (selectionError) throw selectionError;
    const selectedArtwork = item => (allSelections||[]).filter(sel =>
      Number(sel.job_item_id)===item.id ||
      (job.woocommerce_order_id && sel.source==='woocommerce' &&
       String(sel.external_order_id)===String(job.woocommerce_order_id) &&
       String(sel.external_line_id)===String(item.woocommerce_line_item_id))
    ).map(sel=>sel.resolution_snapshot?.artworkAssetId).filter(Boolean);
    const lineArtworkIds=item=>assignedFor(item).map(row=>row.artwork_asset_id);
    const ids = [...new Set([...recipeIds, ...items.flatMap(item=>[...selectedArtwork(item),...lineArtworkIds(item)])])];
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
          const objectMetadata = await r2Client().send(new HeadObjectCommand({ Bucket:a.storage_bucket,Key:safeObjectKey(a.storage_path) }));
          // R2 can return a successful HEAD for a zero-byte object, which cannot
          // be used as production artwork. Never issue a trusted receipt for it.
          if (!Number.isSafeInteger(objectMetadata?.ContentLength) || objectMetadata.ContentLength <= 0)
            return jsonResponse(409,{message:'Production artwork file is empty or its size could not be verified in R2',asset_id:id},event);
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
    // Only this authenticated service-role handler may issue a receipt; users cannot insert one.
    // Match the SQL trigger's deterministic, per-line storage reference fingerprint.
    for (const item of items) {
      const lineIds=[...new Set([...recipeIds,...selectedArtwork(item),...lineArtworkIds(item)])].sort();
      const fingerprintInput=lineIds.map(id=>{
        const a=byId.get(id);
        return [a.id,a.storage_provider||'',a.storage_bucket||'',a.storage_path||'',a.preflight_status||''].join(':');
      }).join('|');
      const fingerprint=createHash('md5').update(fingerprintInput).digest('hex');
      const checkedAt=new Date();
      const expiry=new Date(checkedAt.getTime()+2*60*1000);
      const {error:receiptError}=await auth.supabase.from('sc_traveler_storage_preflight').insert({
        job_id:jobId,recipe_version_id:recipeId,requested_by:auth.user.id,
        job_item_ids:[item.id],artwork_fingerprint:fingerprint,
        checked_at:checkedAt.toISOString(),expires_at:expiry.toISOString()
      });
      if(receiptError)throw receiptError;
    }
    return jsonResponse(200,{verified:true,artwork_asset_ids:ids,expires_in_seconds:120},event);
  } catch (e) {
    console.error('Traveler artwork preflight unavailable',e);
    return jsonResponse(503,{message:'Artwork storage verification is unavailable; traveler creation must remain blocked'},event);
  }
}
