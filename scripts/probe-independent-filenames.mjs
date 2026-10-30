for(const style of ['ss4500','ss4600qz','ind4000','ss3000','ss4001y','ss4500z']){
 try{
  const resp=await fetch('https://www.independenttradingco.com/products/'+style,{signal:AbortSignal.timeout(16000)});
  const h=await resp.text();
  const pattern=new RegExp('(?:[a-z0-9_\\-.]+)'+style+'(?:[a-z0-9_\\-.]+)\\.(?:jpg|webp|png)','gi');
  const names=[...new Set([...h.matchAll(pattern)].map(x=>x[0]))];
  const selected=names.filter(n=>/(front|flat|black|charcoal|navy|bone|grey)/i.test(n));
  console.log('OFFICIAL_FILENAME_PROBE',JSON.stringify({style,status:resp.status,total:names.length,examples:selected.slice(0,32)}));
 }catch(e){console.log('OFFICIAL_FILENAME_ERROR',style,String(e))}
}
for(const base of ['https://static.momentecbrands.com/product/790_080_lquarter.jpg','https://static.augustasportswear.com/product/5100_B080_lquarter.jpg']){
 for(const ua of [0,1]){
  try{
   const res=await fetch(base,{method:'HEAD',headers:ua?{'Referer':'https://www.momentecbrands.com/','User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/123.0 Safari/537.36','Accept':'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'}:{},signal:AbortSignal.timeout(8000)});
   console.log('MOMENTEC_HEADER_PROBE',new URL(base).pathname,ua,res.status,res.headers.get('content-type'));
  }catch(e){console.log('MOMENTEC_HEADER_ERROR',String(e))}
 }
}
