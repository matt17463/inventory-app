// Read-only WooCommerce logo-attribute migration audit. Does not mutate Woo products.
import {authorizeEmployee,jsonResponse} from './_shared/security.js';
import {fingerprint} from './_shared/wooLogoMigration.js';
const clean=v=>String(v??'').trim();
const env=(...keys)=>keys.map(k=>clean(process.env[k])).find(Boolean)||'';
const isLogo=a=>/(^|[^a-z])(logo|graphic|design|artwork)([^a-z]|$)/i.test([a.name,a.slug].join(' '));
const norm=v=>clean(v).toLowerCase().replace(/\s+/g,' ');
const unique=items=>[...new Set(items)];
async function wc(path,key,secret,base){
 const url=new URL('/wp-json/wc/v3/'+path,base);
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(12000),headers:{Authorization:'Basic '+Buffer.from(key+':'+secret).toString('base64'),Accept:'application/json'}});
 if(!response.ok)throw Error('WooCommerce read-only API request failed (HTTP '+response.status+').');
 return response.json();
}
export async function readWooLogoBaseline(id){
 const key=env('WC_CONSUMER_KEY','WOOCOMMERCE_CONSUMER_KEY'),secret=env('WC_CONSUMER_SECRET','WOOCOMMERCE_CONSUMER_SECRET');
 if(!key||!secret)throw Error('WooCommerce credentials are not configured.');
 const base=new URL(env('WOO_SITE_URL','WOOCOMMERCE_SITE_URL','WP_SITE_URL','WORDPRESS_SITE_URL')||'https://skilledcrafting.com');
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw Error('Woo site configuration invalid.');
 const product=await wc('products/'+id,key,secret,base);
 if(Number(product.id)!==id||!['variable','simple'].includes(product.type))throw Error('Expected an exact simple or variable Woo product.');
 const variations=[];let complete=product.type==='simple';
 for(let page=1;product.type==='variable'&&page<=10;page++){
  const batch=await wc('products/'+id+'/variations?per_page=100&page='+page,key,secret,base);
  if(!Array.isArray(batch))throw Error('Unexpected Woo variation response.');
  variations.push(...batch);if(batch.length<100){complete=true;break;}
 }
 if(new Set(variations.map(v=>v.id)).size!==variations.length)throw Error('Duplicate Woo variation IDs returned.');
 const snapshot={product,variations:variations.sort((a,b)=>a.id-b.id)};
 return {...snapshot,complete,source_hash:fingerprint(snapshot),captured_at:new Date().toISOString()};
}
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return jsonResponse(405,{success:false,message:'POST required'},event);
 const auth=await authorizeEmployee(event,{functionName:'woo-logo-migration-preview',allowedRoles:['admin','manager']});
 if(!auth.ok)return jsonResponse(auth.statusCode,{success:false,message:auth.message},event);
 try{
  const request=JSON.parse(event.body||'{}');
  const id=Number(request.woo_product_id);
  if(!Number.isSafeInteger(id)||id<1)return jsonResponse(400,{success:false,message:'Exact Woo parent ID required'},event);
  const key=env('WC_CONSUMER_KEY','WOOCOMMERCE_CONSUMER_KEY'),secret=env('WC_CONSUMER_SECRET','WOOCOMMERCE_CONSUMER_SECRET');
  if(!key||!secret)throw Error('WooCommerce read-only credentials are not configured.');
  const base=new URL(env('WOO_SITE_URL','WOOCOMMERCE_SITE_URL','WP_SITE_URL','WORDPRESS_SITE_URL')||'https://skilledcrafting.com');
  if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw Error('Woo site configuration invalid.');
  const product=await wc('products/'+id,key,secret,base);
  if(Number(product.id)!==id||product.type!=='variable')throw Error('Expected exact variable Woo parent.');
  const logoAttributes=(product.attributes||[]).filter(isLogo);
  const choices=unique(logoAttributes.flatMap(a=>a.options||[]).map(norm).filter(Boolean));
  const seen=new Set(),variations=[];
  let page=1;
  for(;page<=10;page++){
   const batch=await wc('products/'+id+'/variations?per_page=100&page='+page,key,secret,base);
   if(!Array.isArray(batch))throw Error('Unexpected Woo variation response.');
   for(const v of batch){
    if(seen.has(v.id))throw Error('Duplicate Woo variation ID in API response.');
    seen.add(v.id);
    const attrs=v.attributes||[];
    const logos=attrs.filter(isLogo).map(a=>clean(a.option)).filter(Boolean);
    const physical=attrs.filter(a=>!isLogo(a)).map(a=>({name:a.name,slug:a.slug,value:clean(a.option)}));
    variations.push({id:v.id,sku:v.sku,logo_values:logos,physical_attributes:physical,image_id:v.image?.id||null,image_src:v.image?.src||null,price:v.price,regular_price:v.regular_price,sale_price:v.sale_price,stock_status:v.stock_status,manage_stock:v.manage_stock,stock_quantity:v.stock_quantity});
   }
   if(batch.length<100)break;
  }
  const incomplete=page>10;
  const groups=new Map();
  for(const v of variations){
   const k=JSON.stringify(v.physical_attributes.map(a=>[a.slug||a.name.toLowerCase(),norm(a.value)]).sort((a,b)=>a[0].localeCompare(b[0])));
   const group=groups.get(k)||{physical_attributes:v.physical_attributes,variation_ids:[],logo_values:[],price_values:[],stock_modes:[]};
   group.variation_ids.push(v.id);group.logo_values.push(...v.logo_values);
   group.price_values.push(v.price);group.stock_modes.push(String(v.manage_stock)+':'+String(v.stock_quantity));
   groups.set(k,group);
  }
  const conflicts=[...groups.values()].filter(g=>unique(g.price_values).length>1||unique(g.stock_modes).length>1||g.variation_ids.length!==unique(g.logo_values.map(norm)).length);
  const warnings=[];
  if(incomplete)warnings.push('More than 1000 variation rows. Audit is truncated; migration blocked.');
  if(logoAttributes.length!==1)warnings.push('Expected one unambiguous logo attribute; found '+logoAttributes.length+'.');
  if(!choices.length)warnings.push('No logo option values found.');
  if(variations.some(v=>v.logo_values.length!==1))warnings.push('Some variations have missing or multiple logo values.');
  if(conflicts.length)warnings.push('Physical-variation groups have price, stock or logo coverage differences. Review each group before consolidation.');
  warnings.push('Legacy variation images are NOT proof of canonical graphic binding or approval.');
  return jsonResponse(200,{success:true,data:{parent_id:id,product_name:product.name,existing_variation_count:variations.length,logo_attributes:logoAttributes.map(a=>({id:a.id,name:a.name,slug:a.slug,visible:a.visible,variation:a.variation,options:a.options})),logo_choices:choices,physical_group_count:groups.size,groups:[...groups.values()].map(g=>({...g,logo_values:unique(g.logo_values),price_values:unique(g.price_values)})),variations,conflict_group_count:conflicts.length,warnings,migration_allowed:false,operation:'read_only_preview'}},event);
 }catch(error){console.error('Woo migration audit error:',error.message);return jsonResponse(500,{success:false,message:error.message||'Migration preview unavailable'},event);}
}
