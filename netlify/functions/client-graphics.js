import {authorizeEmployee,jsonResponse} from './_shared/security.js';
const TABLES={families:'sc_client_graphic_families',variants:'sc_client_graphic_variants',rules:'sc_client_graphic_rules',bindings:'sc_client_graphic_product_bindings',transfer:'sc_client_graphic_transfer_reviews'};
const FIELDS={
 families:['customer_id','name','internal_name','storefront_label','storefront_visibility','state','parent_family_id'],
 variants:['family_id','artwork_asset_id','label','process','width_inches','height_inches','finish','version','state','approved_at'],
 rules:['family_id','variant_id','priority','garment_type','garment_style','garment_color','color_group','size_group','placement_name','process','effective_from','effective_until','enabled'],
 bindings:['woo_product_id','graphic_family_id','mode','allowed'],
 transfer:['woo_product_id','woo_variation_id','source_kind','source_key','source_value','proposed_family_id','status','evidence','verified_by','verified_at']
};
const uuid=s=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(s||''));
const reply=(code,data,e)=>jsonResponse(code,data,e);
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return reply(204,{},event);
 if(!['GET','POST'].includes(event.httpMethod))return reply(405,{message:'Method not allowed'},event);
 const auth=await authorizeEmployee(event,{functionName:'client-graphics',allowedRoles:['admin','manager','operator']});
 if(!auth.ok)return reply(auth.statusCode,{message:auth.message},event);
 try{
  const input=event.httpMethod==='GET'?(event.queryStringParameters||{}):JSON.parse(event.body||'{}');
  const entity=String(input.entity||'families');
  if(!TABLES[entity])return reply(400,{message:'Invalid graphics collection'},event);
  const db=auth.supabase.from(TABLES[entity]);
  if(event.httpMethod==='GET'){
   let query=db.select('*').order('created_at',{ascending:false}).limit(500);
   if(input.family_id && uuid(input.family_id) && ['variants','rules'].includes(entity))query=query.eq('family_id',input.family_id);
   const {data,error}=await query;
   if(error)throw error;
   return reply(200,{records:data||[]},event);
  }
  if(!['admin','manager'].includes(auth.role))return reply(403,{message:'Manager approval required to change graphic definitions'},event);
  if(entity==='transfer')return reply(403,{message:'Legacy transfer is read-only until separate verification phase'},event);
  const values=input.values;
  if(!values||typeof values!=='object'||Array.isArray(values))return reply(400,{message:'Missing data'},event);
  const record=Object.fromEntries(FIELDS[entity].filter(k=>Object.prototype.hasOwnProperty.call(values,k)).map(k=>[k,values[k]]));
  if(!Object.keys(record).length)return reply(400,{message:'No valid fields'},event);
  if(entity==='variants' && record.state==='approved')return reply(403,{message:'Variant approval requires artwork preflight workflow'},event);
  if(entity==='rules' && record.enabled===true)return reply(403,{message:'Rule activation requires verified sample and conflict tests'},event);
  if(entity==='bindings' && record.allowed===true)return reply(403,{message:'Storefront activation reserved for transfer verification phase'},event);
  if(entity==='families' && !String(record.name||'').trim() && !input.id)return reply(400,{message:'Graphic family name is required'},event);
  let q;
  if(input.id){if(!uuid(input.id))return reply(400,{message:'Invalid record ID'},event);q=db.update(record).eq('id',input.id).select('*').single();}
  else q=db.insert(record).select('*').single();
  const {data,error}=await q;if(error)throw error;return reply(200,{record:data},event);
 }catch(error){return reply(500,{message:'Graphic catalog operation failed',detail:String(error.message||'').slice(0,160)},event);}
}
