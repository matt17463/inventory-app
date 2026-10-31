import fs from 'node:fs/promises';
const groups=JSON.parse(await fs.readFile(new URL('./data/blank-photo-remaining-style-colors-20261030.json',import.meta.url),'utf8'));
const normalized=(s)=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const wanted=new Map();
for(const g of groups){
 if(!/^(Augusta|Augusta Sportswear|C2 Sport|Badger|Alleson Athletic|Nexgen|Pacific)$/i.test(g.brand))continue;
 const k=normalized(g.style);
 if(!k||k==='na')continue;
 if(!wanted.has(k))wanted.set(k,[]);
 wanted.get(k).push(g);
}
const base='https://www.momentecbrands.com/ASGCatalogEntryListView?ajaxStoreImageDir=%2Fwcsstore%2FASGStorefrontAssetStore%2F&beginIndex=1500&catalogId=10601&categoryId=3074457345616696193&facet_1=is_search_enabled%3Atrue&fromPage=catalogEntryList&langId=-1&page=Category&resultType=products&storeId=10251&urlRequestType=Base';
function extractCatalogEntries(html){
 const results=[];let at=0;
 while((at=html.indexOf('CatalogEntryData:',at))!==-1){
  const start=html.indexOf('{',at+17);
  if(start<0)break;
  let depth=0,inString=false,escaped=false,end=-1;
  for(let i=start;i<html.length;i++){
   const ch=html[i];
   if(inString){
    if(escaped)escaped=false;
    else if(ch==='\\')escaped=true;
    else if(ch==='"')inString=false;
   }else if(ch==='"')inString=true;
   else if(ch==='{')depth++;
   else if(ch==='}'&&--depth===0){end=i+1;break}
  }
  if(end>start){try{results.push(JSON.parse(html.slice(start,end)))}catch{}at=end}
  else at=start+1;
 }
 return results;
}
function vendorMatch(entry,group){
 const brand=normalized(entry.brand),g=normalized(group.brand);
 if(g==='pacific')return brand==='pacificheadwear';
 if(g==='nexgen')return brand==='augusta' && normalized(entry.name).includes('nexgen');
 if(g==='badger')return brand==='badgersport'||brand==='badger';
 if(g==='augustasportswear')return brand==='augusta'||brand===g;
 return brand===g;
}
const matched=new Map(),seenStyles=new Map();let pages=0,errors=0;
const pagesToVisit=Array.from({length:115},(_,i)=>i*20);
let pos=0;
await Promise.all(Array.from({length:4},async()=>{
 while(pos<pagesToVisit.length){
  const index=pagesToVisit[pos++];
  try{
   const url=base.replace('beginIndex=1500','beginIndex='+index);
   const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(16000)});
   if(!res.ok){errors++;continue}
   const html=await res.text();
   const entries=extractCatalogEntries(html);
   pages++;
   for(const item of entries){
    const sku=normalized(item.sku||item.product_number);
    const gList=wanted.get(sku);
    if(!gList?.length)continue;
    for(const g of gList){
     if(!vendorMatch(item,g))continue;
     const key=g.brand+'|'+g.style;
     seenStyles.set(key,{brand:g.brand,style:g.style,officialBrand:item.brand,officialTitle:item.name,officialSku:item.sku,catalogEntry:item});
     let colors=[];
     try {colors=JSON.parse(String(item.color_images||'[]').replace(/&quot;/g,'"').replace(/&amp;/g,'&'))}
     catch{}
     for(const variant of g.colors){
      const exact=colors.find(c=>normalized(String(c.color).replace(/\s*\([^)]*\)\s*$/,''))===normalized(variant.name));
      if(!exact?.image)continue;
      const image=String(exact.image).replace(/\.jpg$/,'_aws_640.jpg');
      let parsed;
      try{parsed=new URL(image)}catch{continue}
      if(parsed.protocol!=='https:'|| !['static.momentecbrands.com','static.augustasportswear.com'].includes(parsed.hostname))continue;
      const photoKey=[g.brand,g.style,variant.name].map(normalized).join('|');
      matched.set(photoKey,{brand:g.brand,style:g.style,color:variant.name,url:image,source:'Momentec official catalog',officialTitle:item.name});
     }
    }
   }
  }catch{errors++}
  await new Promise(resolve=>setTimeout(resolve,110));
 }
}));
if(process.env.SUPPLIER_EVIDENCE_DIR){
 await fs.writeFile(process.env.SUPPLIER_EVIDENCE_DIR+'/momentec-candidates.json',JSON.stringify({styles:[...seenStyles.values()],candidates:[...matched.values()]},null,2));
}
const verified=[];
for(const record of matched.values()){
 try{
  const head=await fetch(record.url,{method:'HEAD',signal:AbortSignal.timeout(7000),headers:{'User-Agent':'Mozilla/5.0'}});
  if(head.ok && /^image\//i.test(head.headers.get('content-type')||''))verified.push(record);
 }catch{}
}
console.log('MOMENTEC_MATCH_SUMMARY',JSON.stringify({pages,errors,stylesFound:seenStyles.size,colorsCandidates:matched.size,verified:verified.length,styles:[...seenStyles.values()].slice(0,65).map(({catalogEntry,...style})=>{void catalogEntry;return style;})}));
for(let i=0;i<verified.length;i+=12)console.log('MOMENTEC_IMAGE_BATCH:'+JSON.stringify(verified.slice(i,i+12)));
