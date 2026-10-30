import fs from 'node:fs/promises';
const groups=JSON.parse(await fs.readFile(new URL('./data/blank-photo-remaining-style-colors-20261030.json',import.meta.url),'utf8'));
const normalize=(s)=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const out=[];const stats=[];
const sourceGroups=groups.filter(g=>/^(Independent|Independent Trading Co\.)$/i.test(g.brand) && !/^SF/i.test(g.style));
for(const g of sourceGroups){
 const handle=(g.style==='4000'?'ind4000':g.style).toLowerCase();
 const endpoint='https://www.independenttradingco.com/products/'+handle+'.js';
 try{
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(12000)});
  if(!response.ok){stats.push({brand:g.brand,style:g.style,problem:'HTTP '+response.status});continue;}
  const product=await response.json();
  const vendor=normalize(product.vendor||''), known=normalize(product.handle||'');
  if(!vendor.includes('independent')||known!==handle){stats.push({brand:g.brand,style:g.style,problem:'vendor/handle mismatch',vendor,handle:known});continue;}
  let matched=0;
  for(const row of g.colors){
   const wanted=normalize(row.name);if(!wanted||wanted==='na')continue;
   const candidates=(product.variants||[]).filter(v=>[v.option1,v.option2,v.option3].some(opt=>normalize(opt)===wanted));
   const url=candidates.map(v=>v.featured_image?.src||v.featured_image?.url).find(Boolean);
   if(!url)continue;
   const normalizedUrl=url.startsWith('//')?'https:'+url:url;
   if(!/^https:\/\/(cdn\.shopify\.com|www\.independenttradingco\.com|independenttradingco\.com)\//.test(normalizedUrl))continue;
   try{
    const img=await fetch(normalizedUrl,{method:'HEAD',signal:AbortSignal.timeout(9000)});
    if(!img.ok||!/^image\//i.test(img.headers.get('content-type')||''))continue;
    out.push({brand:g.brand,style:g.style,color:row.name,url:normalizedUrl,source:'Independent Trading Company official'});
    matched++;
   }catch{}
  }
  stats.push({style:g.style,brand:g.brand,matched,total:g.colors.length,vendor,handle:product.handle});
 }catch(err){stats.push({style:g.style,problem:String(err).slice(0,180)})}
}
console.log('OFFICIAL_IMAGE_SUMMARY',JSON.stringify({source:'Independent Trading Company',groups:sourceGroups.length,photoColors:out.length,stats}));
for(let i=0;i<out.length;i+=15)console.log('OFFICIAL_IMAGE_BATCH:'+JSON.stringify(out.slice(i,i+15)));
