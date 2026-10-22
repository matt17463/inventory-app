import { createServiceClient, jsonResponse } from './_shared/security.js';
const validSlug=(v)=>/^[a-z0-9][a-z0-9-]{2,59}$/.test(String(v||''));
function todayPacific(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));return v.year+'-'+v.month+'-'+v.day;
}
export async function handler(event){
  if(event.httpMethod!=='GET')return jsonResponse(405,{success:false,error:'Method not allowed'},event);
  const slug=String(event.queryStringParameters?.slug||'');
  if(!validSlug(slug))return jsonResponse(404,{success:false,error:'Store not found'},event);
  try {
    const db=createServiceClient();
    const {data:c,error}=await db.from('sc_team_store_workflows')
      .select('id,storefront_slug,storefront_description,workflow_name,customer_name,store_close_date,fulfillment_method,campaign_kind,stage,status,closed_at')
      .eq('storefront_slug',slug).eq('stage','live').eq('status','active').is('closed_at',null).maybeSingle();
    if(error)throw error;
    if(!c||c.store_close_date&&c.store_close_date<todayPacific())return jsonResponse(404,{success:false,error:'This store is not currently accepting orders.'},event);
    const {data:products,error:pe}=await db.from('sc_team_store_products')
      .select('woo_product_id,product_name,product_permalink,image_url,display_price,currency')
      .eq('campaign_id',c.id).order('created_at');
    if(pe)throw pe;
    return jsonResponse(200,{
      success:true,
      store:{name:c.workflow_name,organization:c.customer_name,description:c.storefront_description,
        deadline:c.store_close_date,fulfillment_method:c.fulfillment_method,kind:c.campaign_kind,slug:c.storefront_slug},
      products:(products||[]).map(p=>({
        id:p.woo_product_id,name:p.product_name,url:p.product_permalink,
        image_url:p.image_url,price:p.display_price,currency:p.currency,
      })),
      checkout_provider:'woocommerce',
      price_notice:'Final price, size, inventory availability, shipping, taxes and payment are confirmed in WooCommerce checkout.',
    },event);
  } catch(e){
    console.error('team-store-public failed',e.message);
    return jsonResponse(503,{success:false,error:'The storefront is temporarily unavailable.'},event);
  }
}
