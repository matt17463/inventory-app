// Deterministic first-pass product photo enrichment from public SanMar Sports catalog data.
// Only exact supplier brand/style/color matches are allowed; no generic image guessing.
import { authorizeEmployee, createServiceClient, jsonResponse, auditFunctionSecurity } from './_shared/security.js';

const SOURCE='https://sanmarsports.com';
const normalize=(value)=>String(value??'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'');
const LIMIT=5;
const STYLE_OVERRIDES=new Map([['bellacanvas:3001','bc3001']]);
const BRAND_NAMES=new Map([['gildan','gildan'],['bellacanvas','bellacanvas'],['sporttek','sporttek'],['portco','portcompany']]);
const SUPPORTED=new Set(['gildan','bellacanvas','sporttek','portco']);
const UNSAFE_STYLE=new Set(['na','other','unknown','general','shirt','tee','hoodie','hat','sweatshirt','']);

function catalogStyle(brand,style) {
 const b=normalize(brand), s=normalize(style);
 if(!SUPPORTED.has(b)||UNSAFE_STYLE.has(s)||!s||!/^[a-z0-9]{3,12}$/.test(s))return '';
 return STYLE_OVERRIDES.get(b+':'+s)||s;
}
function validImage(url) {
 try {
   const parsed=new URL(String(url||'').startsWith('//')?'https:'+url:url);
   return parsed.protocol==='https:' && (parsed.hostname==='sanmarsports.com'||parsed.hostname==='www.sanmarsports.com'||parsed.hostname==='cdn.shopify.com')
     && /\.(png|jpe?g|webp)$/i.test(parsed.pathname) ? parsed.href:'';
 } catch {return ''}
}
function suitableTitle(product,brand,style){
 const title=normalize(product.title||'');
 const vendor=normalize(product.vendor||'');
 const prefix=BRAND_NAMES.get(normalize(brand));
 const trueStyle=normalize(style);
 return Boolean(prefix && (title.includes(prefix)||vendor.includes(prefix)|| (normalize(brand)==='portco'&&(title.includes('portco')||vendor.includes('portco')))) && title.includes(trueStyle));
}
function bestImage(product,style,color){
 const target=normalize(color), s=normalize(style);
 if(!target || target==='na'||target==='unknown')return '';
 const variants=Array.isArray(product.variants)?product.variants:[];
 for(const v of variants){
  const options=[v.option1,v.option2,v.option3].filter(Boolean).map(normalize);
  if(!options.includes(target))continue;
  const url=validImage(v.featured_image?.src || v.featured_image?.url || v.image?.src);
  if(url)return url;
 }
 const urls=(Array.isArray(product.images)?product.images:[]).map(i=>validImage(i?.src||i?.url||i)).filter(Boolean);
 // Media image filenames include supplier style and exact color, e.g. 18500_black_model_front.
 const matches=urls.filter(url=>{
  const filename=decodeURIComponent(new URL(url).pathname.split('/').pop()||'').toLowerCase();
  const prefix=filename.split('_model_front')[0].split('_flat_front')[0].replace(/\.(jpe?g|webp|png)$/,'');
  const parts=prefix.split('_');
  return normalize(parts[0])===s && normalize(parts.slice(1).join(''))===target;
 });
 return matches.find(u=>/model_front/i.test(u)) || matches[0] || '';
}
async function loadBlanks(db) {
 const results=[];
 for(let start=0;start<10000;start+=600) {
  const {data,error}=await db.from('blank_products')
   .select('id,sku_base,image_url,image_storage_path,brands:brand_id(name),product_types:product_type_id(name),colors:color_id(name)')
   .eq('sc_is_archived',false).order('id').range(start,start+599);
  if(error)throw error;
  results.push(...(data||[]));
  if((data||[]).length<600)break;
 }
 return results;
}
async function fetchProduct(style) {
 const safe=String(style).toLowerCase();
 const response=await fetch(SOURCE+'/products/'+encodeURIComponent(safe)+'.js',{
  headers:{'Accept':'application/json','User-Agent':'SkilledCraftingInventoryReference/1.0'},
  signal:AbortSignal.timeout(7000),
 });
 if(!response.ok)throw Error('Supplier product unavailable: HTTP '+response.status);
 if(!/\b(json|javascript)\b/i.test(String(response.headers.get('content-type')||'')))throw Error('Supplier catalog returned an unexpected content type');
 return response.json();
}
export async function syncSupplierPhotoBatch(db,{cursor=0,limit=LIMIT,dryRun=false}={}){
 const blanks=await loadBlanks(db);
 const grouped=new Map();
 for(const row of blanks){
  const brand=row.brands?.name||'', style=row.product_types?.name||'',color=row.colors?.name||'';
  const sourceStyle=catalogStyle(brand,style);
  if(!sourceStyle||!color||['na','unknown'].includes(normalize(color)))continue;
  const groupKey=normalize(brand)+':'+normalize(style);
  if(!grouped.has(groupKey))grouped.set(groupKey,{brand,style,sourceStyle,colors:new Map()});
  // Group identities stay stable while photos are populated, so cursor pagination never skips styles.
  if(row.image_url||row.image_storage_path)continue;
  const group=grouped.get(groupKey);
  if(!group.colors.has(color))group.colors.set(color,[]);
  group.colors.get(color).push(row.id);
 }
 const groups=[...grouped.values()].sort((a,b)=>(a.brand+a.style).localeCompare(b.brand+b.style));
 const start=Math.max(0,Math.min(Number(cursor)||0,groups.length));
 const size=Math.max(1,Math.min(Number(limit)||LIMIT,8));
 let updated=0, colorsMatched=0;
 const results=[];
 for(const group of groups.slice(start,start+size)){
  const record={brand:group.brand,style:group.style,colorsMatched:0,updated:0};
  if(!group.colors.size){results.push(record);continue}
  try{
   const product=await fetchProduct(group.sourceStyle);
   if(!suitableTitle(product,group.brand,group.sourceStyle))throw Error('Supplier brand/style title mismatch');
   for(const [color,ids] of group.colors){
    const image=bestImage(product,group.sourceStyle,color);
    if(!image)continue;
    record.colorsMatched++;colorsMatched++;
    if(!dryRun){
     for(let i=0;i<ids.length;i+=200){
      const {data,error}=await db.from('blank_products').update({image_url:image})
       .in('id',ids.slice(i,i+200)).is('image_url',null).is('image_storage_path',null)
       .select('id');
      if(error)throw error;
      const count=(data||[]).length;
      record.updated+=count;updated+=count;
     }
    }
   }
  }catch(error){record.error=String(error?.message||error).slice(0,220)}
  results.push(record);
 }
 return {source:'SanMar Sports public product catalog',dryRun,updated,colorsMatched,
   groupsProcessed:results.length,totalEligibleGroups:groups.length,
   nextCursor:start+size<groups.length?start+size:null,results};
}
export {catalogStyle,suitableTitle,bestImage,validImage};
export const handler=async(event)=>{
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return jsonResponse(405,{message:'POST required'},event);
 const auth=await authorizeEmployee(event,{functionName:'supplier-photo-sync',allowedRoles:['admin','manager']});
 if(!auth.ok)return jsonResponse(auth.statusCode,{message:auth.message},event);
 try{
  const input=JSON.parse(event.body||'{}');
  const output=await syncSupplierPhotoBatch(auth.supabase,{
   cursor:input.cursor||0,limit:input.limit||LIMIT,dryRun:input.dry_run===true,
  });
  await auditFunctionSecurity({functionName:'supplier-photo-sync',action:'enrich_blank_photos',outcome:'success',
   userId:auth.user.id,role:auth.role,event,metadata:{updated:output.updated,processed:output.groupsProcessed}});
  return jsonResponse(200,output,event);
 }catch(error){return jsonResponse(500,{message:error?.message||'Supplier image lookup failed'},event)}
};
