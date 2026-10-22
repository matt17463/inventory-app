import {authorizeEmployee,jsonResponse} from './_shared/security.js';
import {summarizePlugins,summarizeShippingZones,skuSampleDiagnostics} from './_shared/commerceIntegrityAnalysis.js';

const base=()=>String(process.env.WOO_SITE_URL||process.env.WOOCOMMERCE_SITE_URL||'').trim().replace(/\/+$/,'');
const wpPass=()=>String(process.env.SC_WP_APP_PASSWORD||process.env.SC_WP_APP_PASSWPRD||'').trim();
const wcKey=()=>String(process.env.WC_CONSUMER_KEY||process.env.WOOCOMMERCE_CONSUMER_KEY||'').trim();
const wcSecret=()=>String(process.env.WC_CONSUMER_SECRET||process.env.WOOCOMMERCE_CONSUMER_SECRET||'').trim();
const shortErr=e=>String(e?.message||e||'Service unavailable').slice(0,180);

function target(path){
 const host=new URL(base());
 if(host.protocol!=='https:')throw Error('WooCommerce host must be HTTPS.');
 const url=new URL(path,host.origin);
 if(url.origin!==host.origin||!url.pathname.startsWith('/wp-json/'))throw Error('Invalid read-only API path.');
 return url.toString();
}
async function jsonGet(path,username,password){
 if(!username||!password)throw Error('Read-only credentials are not configured.');
 const url=target(path);
 const res=await fetch(url,{method:'GET',redirect:'error',
  headers:{Authorization:'Basic '+Buffer.from(username+':'+password).toString('base64'),
   Accept:'application/json','Cache-Control':'no-store'},
  signal:AbortSignal.timeout(10000)});
 if(!res.ok||res.status===202)throw Error('HTTP '+res.status+' from WordPress/WooCommerce; check permissions and hosting WAF.');
 if(!String(res.headers.get('content-type')||'').includes('json'))throw Error('WordPress returned a non-JSON response; possible hosting challenge.');
 return res.json();
}
const woo=path=>jsonGet('/wp-json/wc/v3/'+path,wcKey(),wcSecret());
const wp=path=>jsonGet('/wp-json/wp/v2/'+path,String(process.env.SC_WP_USERNAME||''),wpPass());
const problem=(label,error)=>({source:label,status:'unavailable',reason:shortErr(error)});
async function pluginResult(){
 try{
  const plugins=await wp('plugins?per_page=100&_fields=plugin,name,version,status');
  if(!Array.isArray(plugins))throw Error('WordPress returned unexpected plugin inventory.');
  return {status:'observed',...summarizePlugins(plugins)};
 }catch(e){return problem('WordPress Plugin REST API',e);}
}
async function shippingResult(){
 try{
  const zones=await woo('shipping/zones?per_page=30');
  if(!Array.isArray(zones))throw Error('Unexpected Woo shipping zone response.');
  const selected=zones.filter(z=>Number.isSafeInteger(Number(z.id))&&Number(z.id)>=0).slice(0,8);
  const checks=await Promise.allSettled(selected.map(z=>woo('shipping/zones/'+Number(z.id)+'/methods?per_page=50')));
  const byZone={},failed=[];
  selected.forEach((z,i)=>{
   if(checks[i].status==='fulfilled'&&Array.isArray(checks[i].value))byZone[z.id]=checks[i].value;
   else failed.push(String(z.name||z.id).slice(0,60));
  });
  return {status:failed.length?'partial':'observed',
   ...summarizeShippingZones(selected,byZone),
   zoneLimitReached:zones.length>8,
   inaccessibleZones:failed,
   advancedRulesAccessibleViaCoreApi:false,
  };
 }catch(e){return problem('WooCommerce shipping zones',e);}
}
async function skuResult(){
 try{
  const products=await woo('products?per_page=25&_fields=id,sku,variations,type');
  if(!Array.isArray(products))throw Error('Unexpected Woo products response.');
  const variationParents=products.filter(p=>p.type==='variable'&&(p.variations||[]).length>0).slice(0,3);
  const responses=await Promise.allSettled(variationParents.map(p=>woo('products/'+Number(p.id)+'/variations?per_page=40&_fields=id,sku')));
  const variations=responses.filter(x=>x.status==='fulfilled'&&Array.isArray(x.value)).flatMap(x=>x.value);
  return {status:responses.some(x=>x.status==='rejected')?'partial':'observed',
   ...skuSampleDiagnostics(products,variations),
   sampledVariationParents:variationParents.length,requestedProductLimit:25,
   missingVariationParents:responses.filter(x=>x.status==='rejected').length,
  };
 }catch(e){return problem('WooCommerce bounded SKU sample',e);}
}
export const handler=async event=>{
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='GET')return jsonResponse(405,{success:false,error:'Read-only GET required.'},event);
 const access=await authorizeEmployee(event,{functionName:'wordpress-commerce-integrity',allowedRoles:['admin','manager']});
 if(!access.ok)return jsonResponse(access.statusCode,{success:false,error:access.message},event);
 const live=await Promise.all([pluginResult(),shippingResult(),skuResult()]);
 return jsonResponse(200,{success:true,checkedAt:new Date().toISOString(),
  status:live.every(x=>x.status==='observed')?'partial-verification':'incomplete',
  readOnly:true,mutationsPerformed:false,
  plugins:live[0],shipping:live[1],skuSample:live[2],
  note:'These checks only read installed plugin metadata, shipping method configuration and a bounded product/SKU sample. They do not calculate checkout rates, reveal plugin internal hooks or prove SKU-writer precedence. The historic WordPress audit is a dated snapshot, not current state.'},event);
};
