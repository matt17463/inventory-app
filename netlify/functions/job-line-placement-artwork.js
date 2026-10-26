import {authorizeEmployee,jsonResponse} from './_shared/security.js';
const isUuid = value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||''));
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return jsonResponse(405,{message:'POST required'},event);
 const auth=await authorizeEmployee(event,{functionName:'job-line-placement-artwork',allowedRoles:['admin','manager']});
 if(!auth.ok)return jsonResponse(auth.statusCode,{message:auth.message},event);
 try{
  const body=JSON.parse(event.body||'{}');
  const itemId=Number(body.job_item_id),recipeId=body.recipe_version_id,assetId=body.artwork_asset_id;
  const placement=String(body.placement_name||'').trim();
  if(!Number.isSafeInteger(itemId)||itemId<=0||!isUuid(recipeId)||!isUuid(assetId)||!placement||placement.length>80)
   return jsonResponse(400,{message:'Valid job line, recipe, placement and artwork are required'},event);
  const {data,error}=await auth.supabase.rpc('sc_approve_job_line_placement_artwork',{
   p_job_item_id:itemId,p_recipe_version_id:recipeId,p_placement_name:placement,
   p_artwork_asset_id:assetId,p_actor:auth.user.id
  });
  if(error)return jsonResponse(409,{message:'Artwork assignment was rejected; confirm recipe position and approved artwork'},event);
  return jsonResponse(200,{id:data,approved:true},event);
 }catch(e){console.error('Job artwork approval failed',e);return jsonResponse(500,{message:'Job artwork approval unavailable'},event);}
}
