const base='https://www.momentecbrands.com/ASGCatalogEntryListView?ajaxStoreImageDir=%2Fwcsstore%2FASGStorefrontAssetStore%2F&beginIndex=1500&catalogId=10601&categoryId=3074457345616696193&facet_1=is_search_enabled%3Atrue&fromPage=catalogEntryList&langId=-1&page=Category&resultType=products&storeId=10251&urlRequestType=Base';
function extractCatalogEntries(html){
 const results=[];
 let at=0;
 while((at=html.indexOf('CatalogEntryData:',at))!==-1){
  let start=html.indexOf('{',at+17);
  if(start<0)break;
  let depth=0,inString=false,escaped=false,end=-1;
  for(let i=start;i<html.length;i++){
   const ch=html[i];
   if(inString){
    if(escaped)escaped=false;
    else if(ch==='\\')escaped=true;
    else if(ch==='"')inString=false;
   }else{
    if(ch==='"')inString=true;
    else if(ch==='{')depth++;
    else if(ch==='}'){
     depth--;
     if(depth===0){end=i+1;break}
    }
   }
  }
  if(end>start){
   try{results.push(JSON.parse(html.slice(start,end)))}catch(error){console.log('CATALOG_PARSE_ERROR',error.message)}
   at=end;
  }else at=start+1;
 }
 return results;
}
for(const index of [0,20,1500]){
 try{
  const url=base.replace('beginIndex=1500','beginIndex='+index);
  const res=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0'}});
  const html=await res.text();
  const entries=extractCatalogEntries(html);
  console.log('MOMENTEC_COLOR_SHAPE',JSON.stringify({index,colorType:typeof entries[0]?.color_images,colorSlice:String(entries[0]?.color_images||'').slice(0,260)}));
  console.log('MOMENTEC_CATALOG_PAGE',JSON.stringify({index,http:res.status,len:html.length,records:entries.length,examples:entries.slice(0,5).map(x=>({brand:x.brand,style:x.sku,title:x.name,source:x.imageUrl,colors:(()=>{try{return JSON.parse(x.color_images||'[]').length}catch{return 0}})()}))}));
 }catch(error){console.log('MOMENTEC_CATALOG_ERROR',index,String(error))}
}
