import {randomBytes} from 'node:crypto';
import {authorizeEmployee,jsonResponse} from './_shared/security.js';
import {wcCategory,wpStoreRequest,upsertWpStore,wpStoreConfigured} from './_shared/wpClientStores.js';
import {wooRequest} from './_shared/mockupUtils.js';

const roles=['admin','manager','marketing'];
const managers=['admin','manager'];
const color=v=>/^#[0-9a-fA-F]{6}$/.test(String(v))?String(v).toLowerCase():null;
const slug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
const checkId=v=>/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(String(v||''));
function decodeBody(event){try{return JSON.parse(event.body||'{}');}catch{return {};}}
async function readCampaign(sb,id){
 if(!checkId(id))throw Error('Choose a saved campaign.');
 const {data,error}=await sb.from('sc_team_store_workflows').select('*').eq('id',id).single();
 if(error)throw error;
 if(data.order_channel!=='woocommerce')throw Error('Occasional QuickBooks-invoiced orders do not create WordPress stores.');
 return data;
}
function requireDraft(c){
 if(c.stage==='live'||c.stage==='complete')throw Error('This store is live or closed; clone a new season before changing its site design.');
 if(c.customer_approval_at)throw Error('Storefront has been approved. Generate a new season if design changes are needed, or have a manager revoke approval first.');
}
async function write(sb,id,patch){
 const {data,error}=await sb.from('sc_team_store_workflows').update(patch).eq('id',id).select('*').single();
 if(error)throw error;return data;
}
async function createClientCategory(c){
 const normal=slug(c.customer_name||c.workflow_name).slice(0,38)||'client';
 const season=slug(c.season_label).slice(0,12);
 const specific='sc-'+normal+'-'+(season?season+'-':'')+c.id.slice(0,8);
 const existing=await wooRequest('products/categories?slug='+encodeURIComponent(specific)+'&per_page=10');
 if(existing?.length){
  const hit=existing.find(row=>row.slug===specific);
  if(hit)return {id:hit.id,name:hit.name,slug:hit.slug};
 }
 const created=await wooRequest('products/categories',{method:'POST',body:{name:c.customer_name+(c.season_label?' — '+c.season_label:''),slug:specific,description:'Client-specific catalog for '+c.workflow_name}});
 if(!created?.id)throw Error('WooCommerce did not create the category.');
 return {id:created.id,name:created.name,slug:created.slug};
}
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(!['POST','GET'].includes(event.httpMethod))return jsonResponse(405,{success:false,error:'Method not allowed'},event);
 const body=event.httpMethod==='POST'?decodeBody(event):event.queryStringParameters||{};
 const action=String(body.action||'');
 const allowed=action==='clone'?managers:roles;
 const auth=await authorizeEmployee(event,{functionName:'team-store-site',allowedRoles:allowed});
 if(!auth.ok)return jsonResponse(auth.statusCode,{success:false,error:auth.message},event);
 const sb=auth.supabase;
 try {
  if(action==='status') return jsonResponse(200,{success:true,wordpress_configured:wpStoreConfigured(),plugin_required:true},event);
  const c=await readCampaign(sb,body.campaign_id);
  if(action==='save'){
   requireDraft(c);
   const theme=String(body.template||'athletics');
   if(!['athletics','scholastic','business','fundraising'].includes(theme))throw Error('Choose a supported WordPress store layout.');
   for(const name of ['primary','secondary','accent']) if(!color(body[name]))throw Error('Invalid '+name+' logo color.');
   const storeSlug=slug(body.slug||c.storefront_slug||c.workflow_name);
   if(!/^[a-z0-9][a-z0-9-]{2,59}$/.test(storeSlug))throw Error('Enter a valid store URL slug.');
   const patch={
    storefront_slug:storeSlug,wp_template:theme,
    wp_primary_color:color(body.primary),wp_secondary_color:color(body.secondary),wp_accent_color:color(body.accent),
    wp_headline:String(body.headline||'').slice(0,160),
    ordering_instructions:String(body.instructions||'').slice(0,2200),
    delivery_instructions:String(body.delivery||'').slice(0,2200),
    storefront_description:String(body.description||'').slice(0,2200),
    season_label:String(body.season||'').slice(0,65),
   };
   return jsonResponse(200,{success:true,campaign:await write(sb,c.id,patch)},event);
  }
  if(action==='category'){
   requireDraft(c);
   const next=body.category_id?await wcCategory(body.category_id):await createClientCategory(c);
   const data=await write(sb,c.id,{wp_category_id:next.id});
   return jsonResponse(200,{success:true,category:next,campaign_id:data.id},event);
  }
  if(action==='upload-logo'){
   requireDraft(c);
   if(!wpStoreConfigured())throw Error('Configure the WordPress Application Password before uploading logos.');
   const encoded=String(body.base64||'');
   const type=String(body.mime_type||'');
   if(!['image/png','image/jpeg','image/webp'].includes(type))throw Error('Logo must be PNG, JPEG, or WebP.');
   if(encoded.length>2800000)throw Error('Logo exceeds the 2 MB upload limit.');
   const bytes=Buffer.from(encoded,'base64');
   if(!bytes.length||bytes.length>2*1024*1024)throw Error('Logo is empty or exceeds the 2 MB limit.');
   const result=await wpStoreRequest('wp/v2/media',{bytes,mimeType:type,filename:'sc-client-'+c.id.slice(0,8)+'.'+(type==='image/png'?'png':type==='image/webp'?'webp':'jpg')});
   if(!result?.id)throw Error('WordPress did not return a media ID.');
   await write(sb,c.id,{wp_logo_media_id:result.id});
   return jsonResponse(200,{success:true,media_id:result.id},event);
  }
  if(action==='draft'){
   requireDraft(c);
   if(!c.wp_category_id)throw Error('Create or choose the client WooCommerce product category first.');
   if(!c.storefront_slug)throw Error('Save the store URL and design before generating WordPress draft.');
   const page=await upsertWpStore(c,'draft');
   await write(sb,c.id,{wp_store_post_id:page.post_id,wp_store_url:page.url,wp_draft_created_at:new Date().toISOString()});
   return jsonResponse(200,{success:true,url:page.url,post_id:page.post_id,status:page.status},event);
  }
  if(action==='clone'){
   const name=String(body.next_name||'').trim().slice(0,160);
   const season=String(body.season||'').trim().slice(0,60);
   if(name.length<3||!season)throw Error('Provide new campaign name and season.');
   const {data,error}=await sb.from('sc_team_store_workflows').insert({
    workflow_name:name,store_name:name,customer_name:c.customer_name,
    coordinator_name:c.coordinator_name,campaign_kind:c.campaign_kind,
    order_channel:c.order_channel,fulfillment_method:c.fulfillment_method,
    fundraiser_model:c.fundraiser_model,fundraiser_flat_amount:c.fundraiser_flat_amount,
    fundraiser_percent:c.fundraiser_percent,fundraiser_terms:c.fundraiser_terms,
    storefront_description:c.storefront_description,
    wp_template:c.wp_template,wp_primary_color:c.wp_primary_color,wp_secondary_color:c.wp_secondary_color,
    wp_accent_color:c.wp_accent_color,wp_logo_media_id:c.wp_logo_media_id,
    wp_headline:c.wp_headline,ordering_instructions:c.ordering_instructions,
    delivery_instructions:c.delivery_instructions,season_label:season,
    cloned_from_campaign_id:c.id,stage:'request',status:'active',created_by:auth.user.id,
   }).select('id').single();
   if(error)throw error;
   return jsonResponse(200,{success:true,id:data.id,message:'New season created as a draft. Customer approval, deadline, category, products, WordPress page and payout review must be completed again.'},event);
  }
  return jsonResponse(400,{success:false,error:'Unknown store-design action'},event);
 }catch(e){
  console.error('team-store-site action failed',action,String(e.message).slice(0,280));
  return jsonResponse(422,{success:false,error:e.message||'WordPress store setup failed'},event);
 }
}
