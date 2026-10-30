const urls=[
'https://www.independenttradingco.com/products/ss4500z',
'https://www.independenttradingco.com/products/ss4500z.js',
'https://www.ssactivewear.com/p/independent_trading_co/ss4500z',
'https://www.momentecbrands.com/ASGCatalogEntryListView?ajaxStoreImageDir=%2Fwcsstore%2FASGStorefrontAssetStore%2F&beginIndex=1500&catalogId=10601&categoryId=3074457345616696193&facet_1=is_search_enabled%3Atrue&fromPage=catalogEntryList&langId=-1&page=Category&resultType=products&storeId=10251&urlRequestType=Base',
'https://static.momentecbrands.com/product/5100_080_lquarter.jpg',
'https://static.augustasportswear.com/product/5100_B080_lquarter.jpg',
'https://static.momentecbrands.com/product/5100_080_lquarter_aws_120.jpg',
'https://static.momentecbrands.com/product/5200_080_lquarter.jpg',
'https://static.momentecbrands.com/product/1575_080_lquarter.jpg',
];
for(const url of urls){
 try{
  const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});
  const type=res.headers.get('content-type')||'';
  if(type.includes('text/html')){
   const html=await res.text();
   let titles=(html.match(/<title[^>]*>[^<]{3,160}/gi)||[]).slice(0,2);
   let og=(html.match(/<meta[^>]+(?:og:image|twitter:image)[^>]*>/gi)||[]).slice(0,3);
   console.log('PROBE',res.status,new URL(url).hostname,new URL(url).pathname,'HTMLLEN',html.length,'CatalogEntries',(html.match(/CatalogEntryData:/g)||[]).length,'title',JSON.stringify(titles),'og',JSON.stringify(og).slice(0,600));
  }else console.log('PROBE',res.status,new URL(url).hostname,new URL(url).pathname,'TYPE',type,'BYTES',res.headers.get('content-length'));
 }catch(e){console.log('PROBE_ERROR',url,String(e))}
}