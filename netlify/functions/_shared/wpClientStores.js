import { wooBaseUrl, wooRequest } from './mockupUtils.js';
// Support the legacy misspelled Netlify secret without exposing or rotating it.
const wpPassword = () => process.env.SC_WP_APP_PASSWORD || process.env.SC_WP_APP_PASSWPRD;
export function wpStoreConfigured() {
  return Boolean(process.env.SC_WP_USERNAME && wpPassword() && process.env.WOO_SITE_URL);
}
function wpAuth() {
  if (!wpStoreConfigured()) {
    throw new Error('WordPress Application Password is not configured. Install/activate Skilled Crafting Client Storefronts and set SC_WP_USERNAME and SC_WP_APP_PASSWORD in Netlify production environment.');
  }
  return 'Basic '+Buffer.from(process.env.SC_WP_USERNAME+':'+wpPassword()).toString('base64');
}
export async function wpStoreRequest(route,{method='POST',body,bytes,mimeType,filename}={}) {
  const base=wooBaseUrl();
  const url=new URL('/wp-json/'+route.replace(/^\/+/,''),base);
  if(url.origin!==new URL(base).origin||url.protocol!=='https:')throw Error('Invalid WordPress host configuration.');
  const headers={Authorization:wpAuth(),Accept:'application/json'};
  if(bytes) {
    headers['Content-Type']=mimeType;
    headers['Content-Disposition']='attachment; filename="'+String(filename||'client-logo.png').replace(/[^a-zA-Z0-9._-]/g,'_')+'"';
  }else headers['Content-Type']='application/json';
  const response=await fetch(url,{method,headers,body:bytes||JSON.stringify(body||{}),signal:AbortSignal.timeout(35000)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok) {
    const status=response.status;
    const msg=result?.message||'WordPress request failed';
    throw Error('WordPress HTTP '+status+': '+String(msg).slice(0,280)+'. Check plugin activation, application password, and SiteGround security/WAF settings.');
  }
  return result;
}
export async function wcCategory(id){
  const n=Number(id);
  if(!Number.isSafeInteger(n)||n<=0)throw Error('Choose a WooCommerce client product category.');
  const category=await wooRequest('products/categories/'+n);
  if(Number(category?.id)!==n)throw Error('WooCommerce category not found.');
  return {id:n,name:category.name,slug:category.slug};
}
export async function verifyCategoryProducts(categoryId,products) {
  if(!products.length)throw Error('Add approved client products before publishing the storefront.');
  for(const row of products) {
    const p=await wooRequest('products/'+row.woo_product_id);
    if(p?.status!=='publish')throw Error('Woo product #'+row.woo_product_id+' must be published.');
    const ids=(p.categories||[]).map(c=>Number(c.id));
    if(!ids.includes(Number(categoryId)))
      throw Error('Woo product #'+p.id+' is not assigned to the client category. Add it in WordPress → Products before publishing.');
  }
}
export function wpStorePayload(c,status) {
  return {
    campaign_id:c.id,
    name:c.workflow_name||c.store_name,
    slug:c.storefront_slug,
    organization:c.customer_name,
    category_id:c.wp_category_id,
    status,
    template:c.wp_template||'athletics',
    primary:c.wp_primary_color||'#16443b',
    secondary:c.wp_secondary_color||'#f0b83a',
    accent:c.wp_accent_color||'#f6f9fb',
    logo_media_id:c.wp_logo_media_id||0,
    headline:c.wp_headline||c.workflow_name,
    description:c.storefront_description||'',
    instructions:c.ordering_instructions||'Select a product and complete your order through WooCommerce.',
    delivery:c.delivery_instructions||c.fulfillment_method||'Delivery and pickup confirmed at checkout.',
    deadline:c.store_close_date||'',
  };
}
export async function upsertWpStore(c,status='draft') {
  if(c.order_channel!=='woocommerce')throw Error('WordPress stores are only for recurring WooCommerce clients.');
  await wcCategory(c.wp_category_id);
  return wpStoreRequest('skilled-crafting/v1/client-store',{body:wpStorePayload(c,status)});
}
