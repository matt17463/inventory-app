import fs from 'node:fs/promises';
const groups=JSON.parse(await fs.readFile(new URL('./data/blank-photo-remaining-style-colors-20261030.json',import.meta.url),'utf8'));
const normalize=(s)=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const out=[];const stats=[];
const sourceGroups=groups.filter(g=>/^(Independent|Independent Trading Co\.)$/i.test(g.brand) && !/^SF/i.test(g.style));
for(const g of sourceGroups){
 const style=(g.style==='4000'?'IND4000':g.style).toUpperCase();
 const handle=style.toLowerCase();
 const endpoint='https://www.independenttradingco.com/products/'+handle;
 try{
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(16000)});
  if(!response.ok){stats.push({brand:g.brand,style:g.style,problem:'HTTP '+response.status});continue;}
  const html=await response.text();
  const title=(html.match(/<title[^>]*>([^<]+)<\/title>/i)||[])[1]||'';
  if(!/Independent Trading Company/i.test(title)||!html.toUpperCase().includes(style)){
   stats.push({brand:g.brand,style:g.style,problem:'manufacturer/style mismatch',title});continue;
  }
  const pattern=new RegExp('Independent_Trading_Co\\._'+style+'_(.+?)_Front_High\\.(jpg|jpeg|png|webp)','gi');
  const images=new Map();
  for(const match of html.matchAll(pattern)){
   const color=normalize(match[1]);
   if(!images.has(color)) images.set(color,match[0]);
  }
  let matched=0;
  for(const row of g.colors){
   const wanted=normalize(row.name);
   if(!wanted||wanted==='na')continue;
   const file=images.get(wanted);
   if(!file)continue;
   const url='https://www.independenttradingco.com/cdn/shop/files/'+encodeURIComponent(file);
   try{
    const img=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(12000)});
    if(!img.ok||!/^image\//i.test(img.headers.get('content-type')||''))continue;
    out.push({brand:g.brand,style:g.style,color:row.name,url,source:'Independent Trading Company official'});
    matched++;
   }catch{}
  }
  stats.push({style:g.style,brand:g.brand,matched,total:g.colors.length,images:images.size,title});
 }catch(err){stats.push({style:g.style,problem:String(err).slice(0,180)})}
}
console.log('OFFICIAL_IMAGE_SUMMARY',JSON.stringify({source:'Independent Trading Company',groups:sourceGroups.length,photoColors:out.length,stats}));
for(let i=0;i<out.length;i+=15)console.log('OFFICIAL_IMAGE_BATCH:'+JSON.stringify(out.slice(i,i+15)));
