import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { wooBaseUrl, wooRequest } from './_shared/mockupUtils.js';
import { verifiedWooProduct } from './_shared/teamStoreCommerce.js';
import {wcCategory,verifyCategoryProducts,upsertWpStore} from './_shared/wpClientStores.js';
function input(event){try{return JSON.parse(event.body||'{}');}catch{return {};}}
function slugify(value){return String(value||'').toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'').slice(0,60);}
function validId(value){return /^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(String(value||''));}
function errorStatus(error){return /unique|duplicate|23505|already exists/i.test(error?.message||'')?409:400;}
function pacificDate(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const value=Object.fromEntries(parts.map(x=>[x.type,x.value]));return value.year+'-'+value.month+'-'+value.day;}
async function getCampaign(supabase,id){
  if(!validId(id))throw Error('Choose a valid campaign.');
  const {data,error}=await supabase.from('sc_team_store_workflows').select('*').eq('id',id).single();
  if(error)throw error;return data;
}
async function getProducts(supabase,id){const {data,error}=await supabase.from('sc_team_store_products').select('*').eq('campaign_id',id).order('created_at');if(error)throw error;return data||[];}
function canEdit(c){return !['live','complete'].includes(c.stage) && c.status==='active';}

export async function handler(event){
  if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
  const method=event.httpMethod;
  if(!['GET','POST'].includes(method))return jsonResponse(405,{success:false,error:'Method not allowed'},event);
  const body=method==='POST'?input(event):(event.queryStringParameters||{});
  const action=String(body.action||'');
  const auth=await authorizeEmployee(event,{functionName:'team-store-admin',
    allowedRoles:['approve','publish','close'].includes(action)?['admin','manager']:['admin','manager','marketing']});
  if(!auth.ok)return jsonResponse(auth.statusCode,{success:false,error:auth.message},event);
  const sb=auth.supabase;
  try {
    if(method==='GET' && action==='products'){
      const search=String(body.search||'').trim().slice(0,100);
      if(!search && !body.product_id)return jsonResponse(400,{success:false,error:'Enter a product ID or search term.'},event);
      const productId=Number(body.product_id);
      if(body.product_id && (!Number.isSafeInteger(productId)||productId<=0))throw Error('Invalid Woo product ID');
      const path=body.product_id?'products/'+productId:'products?search='+encodeURIComponent(search)+'&per_page=25&status=publish';
      const results=await wooRequest(path);
      const products=(Array.isArray(results)?results:[results]).map(p=>{try{return verifiedWooProduct(p,wooBaseUrl());}catch{return null;}}).filter(Boolean);
      return jsonResponse(200,{success:true,products},event);
    }
    if(method!=='POST'||!['add','remove','approve','publish','close'].includes(action))
      return jsonResponse(400,{success:false,error:'Unsupported campaign action'},event);
    const c=await getCampaign(sb,body.campaign_id);
    if(action==='add'){
      if(!canEdit(c))throw Error('Add products before publishing or use a new campaign.');
      if(body.confirm_dedicated!==true)throw Error('Confirm this WooCommerce product is dedicated to this school/team campaign.');
      const productId=Number(body.woo_product_id);
      if(!Number.isSafeInteger(productId)||productId<=0)throw Error('Choose a Woo product.');
      if(!c.wp_category_id)throw Error('Choose or automatically create a client WooCommerce category in Store Design first.');
      const woo=await wooRequest('products/'+productId);
      if(!(woo.categories||[]).some(cat=>Number(cat.id)===Number(c.wp_category_id)))
        throw Error('Assign this product to the client category in WordPress → Products before adding it to the store.');
      const p=verifiedWooProduct(woo,wooBaseUrl());
      const {data,error}=await sb.from('sc_team_store_products').insert({...p,campaign_id:c.id,created_by:auth.user.id}).select('*').single();
      if(error)throw error;return jsonResponse(200,{success:true,product:data},event);
    }
    if(action==='remove'){
      if(!canEdit(c))throw Error('Published campaign assortments are locked.');
      if(!validId(body.entry_id))throw Error('Select a campaign product.');
      const {error}=await sb.from('sc_team_store_products').delete().eq('campaign_id',c.id).eq('id',body.entry_id);
      if(error)throw error;return jsonResponse(200,{success:true},event);
    }
    if(action==='approve'){
      if(!canEdit(c))throw Error('Only draft campaigns can be approved.');
      if(!body.customer_confirmed)throw Error('Confirm client approval of products, pricing, artwork and deadlines.');
      if(!c.wp_draft_created_at)throw Error('Generate the WordPress landing page draft and preview it before client approval.');
      if(!c.wp_category_id)throw Error('Select a specific WooCommerce client category.');
      if(!(await getProducts(sb,c.id)).length)throw Error('Select a dedicated WooCommerce product first.');
      const {error}=await sb.from('sc_team_store_workflows').update({customer_approval_at:new Date().toISOString(),approved_by:auth.user.id}).eq('id',c.id);
      if(error)throw error;return jsonResponse(200,{success:true,approved:true},event);
    }
    if(action==='publish'){
      if(!canEdit(c))throw Error('This campaign cannot be published from its current state.');
      if(!c.customer_approval_at)throw Error('Record confirmed client approval before opening the store.');
      const slug=slugify(body.slug||c.storefront_slug||c.store_name);
      if(!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug))throw Error('A valid store slug is required.');
      if(c.store_close_date && c.store_close_date < pacificDate())throw Error('Ordering deadline has passed.');
      const products=await getProducts(sb,c.id);if(!products.length)throw Error('At least one Woo product is required.');
      await wcCategory(c.wp_category_id);
      await verifyCategoryProducts(c.wp_category_id,products);
      // WordPress owns the actual landing page. If WP is unavailable do not promote
      // the app campaign to live. The companion plugin must be activated first.
      const page=await upsertWpStore(c,'publish');
      if(page.status!=='publish'||!page.url)throw Error('WordPress did not confirm a public storefront.');
      const now=new Date().toISOString();
      const {data,error}=await sb.from('sc_team_store_workflows')
        .update({storefront_slug:slug,stage:'live',status:'active',published_at:now,closed_at:null,
          wp_store_post_id:page.post_id,wp_store_url:page.url,wp_published_at:now})
        .eq('id',c.id).eq('status','active').select('id,storefront_slug').single();
      if(error)throw error;
      return jsonResponse(200,{success:true,url:page.url,wordpress_post_id:page.post_id,store_slug:data.storefront_slug},event);
    }
    if(action==='close'){
      if(c.stage!=='live')throw Error('Only open stores can be closed.');
      // Closing must first hide the WordPress landing page. Do not unpublish
      // Woo products: they may be referenced by ordinary customers elsewhere.
      const page=await upsertWpStore(c,'draft');
      if(page.status!=='draft')throw Error('WordPress could not hide the landing page. Campaign remains open.');
      const {error}=await sb.from('sc_team_store_workflows')
        .update({stage:'complete',status:'complete',closed_at:new Date().toISOString()}).eq('id',c.id);
      if(error)throw error;
      return jsonResponse(200,{success:true,closed:true,
        warning:'WordPress landing page made private. WooCommerce products remain purchasable through direct links until separately archived in WooCommerce.'},event);
    }
    return jsonResponse(400,{success:false,error:'Unsupported action'},event);
  } catch(error){
    console.error('team-store-admin:',action,error?.message);
    return jsonResponse(errorStatus(error),{success:false,error:error?.message||'Campaign management failed'},event);
  }
}
