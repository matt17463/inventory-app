// Read-only diagnostic helpers. A shipping-method row is NOT a calculated cart rate.
export function wpPluginSlug(value) {
 const raw=String(value||'').toLowerCase();
 return raw.split('/')[0].replace(/[^a-z0-9-]/g,'').slice(0,120);
}
export const writerSlugSet=new Set(['wc-sku-builder-manager','woocommerce-product-sku-generator','sku-for-woocommerce']);
export function summarizePlugins(rows,{expectedStorefrontVersion='0.1.3'}={}){
 const list=Array.isArray(rows)?rows:[],known=new Map();
 for(const p of list){
  const slug=wpPluginSlug(p.plugin||p.slug||'');
  if(slug)known.set(slug,{slug,version:String(p.version||''),status:String(p.status||'').toLowerCase()});
 }
 const store=known.get('skilled-crafting-client-storefronts');
 const writerPlugins=[...known.values()].filter(p=>writerSlugSet.has(p.slug)&&p.status==='active');
 const advanced=known.get('woocommerce-advanced-free-shipping');
 return {
  installedPluginCount:list.length,
  storefront:store?{installedVersion:store.version,expectedVersion:expectedStorefrontVersion,
    match:store.version===expectedStorefrontVersion,active:store.status==='active'}:null,
  skuWriters:writerPlugins.map(({slug,version})=>({slug,version})),
  multipleSkuWriterCandidates:writerPlugins.length>1,
  advancedFreeShippingActive:advanced?.status==='active',
  source:'wordpress-rest',
 };
}
export function summarizeShippingZones(zones,methodsByZone){
 const records=[];
 for(const zone of zones||[]){
  const id=Number(zone.id);
  if(!Number.isSafeInteger(id)||id<0)continue;
  const methods=Array.isArray(methodsByZone?.[id])?methodsByZone[id]:[];
  const clean=methods.map(m=>{
   const settings=m.settings||{};
   const field=name=>String(settings[name]?.value??'');
   return {id:Number(m.instance_id||0),methodId:String(m.method_id||'').slice(0,70),
    title:String(m.title||'').slice(0,120),enabled:Boolean(m.enabled),
    requires:field('requires'),minAmount:field('min_amount'),
    cost:field('cost'),calculationType:field('type')||field('calculation_type')};
  });
  const active=clean.filter(m=>m.enabled);
  records.push({zoneId:id,zone:String(zone.name||'').slice(0,120),
    methods:clean,activeMethodCount:active.length,
    hasCoreFreeShipping:active.some(m=>m.methodId==='free_shipping'),
    hasFlatRate:active.some(m=>m.methodId==='flat_rate')});
 }
 return {zones:records,checkedZones:records.length,
  caveat:'Shipping rules are read from WooCommerce configuration, not calculated against any real cart, address, tax or coupons. Third-party extensions may add rules not exposed by the core Woo REST methods.'};
}
export function skuSampleDiagnostics(products,variations) {
 const skuCount=new Map();let counted=0,skus=0;
 for(const p of [...(products||[]),...(variations||[])]){
  counted++;
  const sku=String(p.sku||'').trim();
  if(!sku)continue;
  skus++;skuCount.set(sku,(skuCount.get(sku)||0)+1);
 }
 return {recordsScanned:counted,withSku:skus,withoutSku:counted-skus,
  duplicateSkuCount:[...skuCount.values()].filter(n=>n>1).length,
  limitedSample:true,
  caveat:'A bounded WooCommerce sample, not an exhaustive SKU collision audit. No IDs, customer data, SKU values or product prices are returned.'};
}
