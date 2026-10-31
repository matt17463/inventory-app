// Read-only verification of the curated supplier evidence manifest. Never writes inventory.
import fs from 'node:fs/promises';
import sharp from 'sharp';
const sources=JSON.parse(await fs.readFile(new URL('./data/blank-photo-source-evidence-20261030.json',import.meta.url)));
const allowed=new Set(['cdn.ssactivewear.com','static.momentecbrands.com','cdnp.sanmar.com','www.independenttradingco.com']);
let failed=0;
for(const s of sources){
 try{
  const u=new URL(s.url);
  if(u.protocol!=='https:'||!allowed.has(u.hostname)||u.username||u.password)throw Error('Invalid image origin');
  if(!s.brand||!s.style||!s.color||!s.source_color||!s.evidence||!['exact','likely','provisional'].includes(s.confidence))throw Error('Incomplete match evidence');
  const r=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!r.ok||!/^image\//.test(r.headers.get('content-type')||''))throw Error('Image unavailable');
  const b=Buffer.from(await r.arrayBuffer());if(b.length>15*1024*1024)throw Error('Image too large');
  const m=await sharp(b).metadata();if(m.width<100||m.height<100)throw Error('Image too small');
 }catch(error){failed++;console.error(JSON.stringify({brand:s.brand,style:s.style,color:s.color,error:error.message}));}
 await new Promise(r=>setTimeout(r,150));
}
console.log(JSON.stringify({verified:sources.length-failed,failed}));if(failed)process.exitCode=1;
