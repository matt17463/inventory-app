// One-off verification tool: fetch supplier-hosted official style/color photographs for missing blank variants.
// Output is a read-only JSON manifest; inventory updates must be explicitly matched by brand/style/color.
import fs from 'node:fs/promises';
import { catalogStyle, suitableTitle, bestImage } from '../netlify/functions/supplier-photo-sync.js';

const targets=JSON.parse(await fs.readFile(new URL('./data/blank-guide-photo-targets.json',import.meta.url),'utf8'));
const groups=new Map();
for(const row of targets){
 const sourceStyle=catalogStyle(row.brand,row.style);
 if(!sourceStyle||!String(row.color||'').trim()||!Number(row.variants))continue;
 const k=row.brand+'|'+row.style;
 if(!groups.has(k))groups.set(k,{brand:row.brand,style:row.style,sourceStyle,colors:[]});
 groups.get(k).colors.push(row.color);
}
let urlsChecked=0;
let successes=0;
let failures=0;
let requests=0;
const found=[];
const problems=[];
async function verify(url){
 requests++;
 try{
  const res=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(10000)});
  return res.ok && /image\/(jpeg|png|webp)/i.test(res.headers.get('content-type')||'');
 }catch{return false;}
}
async function fetchGroup(group){
 let product;
 try{
  const response=await fetch('https://sanmarsports.com/products/'+encodeURIComponent(group.sourceStyle)+'.js',{signal:AbortSignal.timeout(10000),headers:{'Accept':'application/json'}});
  if(!response.ok)throw new Error('product HTTP '+response.status);
  product=await response.json();
  if(!suitableTitle(product,group.brand,group.sourceStyle))throw new Error('brand/style identity mismatch: '+String(product.title||'').slice(0,80));
 }catch(e){problems.push({brand:group.brand,style:group.style,error:e.message});return;}
 for(const color of group.colors){
  const url=bestImage(product,group.sourceStyle,color);
  if(!url)continue;
  urlsChecked++;
  if(await verify(url)){
   found.push({brand:group.brand,style:group.style,color,url});
   successes++;
  }else{failures++;problems.push({brand:group.brand,style:group.style,color,error:'image URL failed HEAD validation'});}
 }
}
const items=[...groups.values()];
let offset=0;
await Promise.all(Array.from({length:5},async()=>{
 while(offset<items.length){const i=offset++;await fetchGroup(items[i]);}
}));
console.log('PHOTO_AUDIT_SUMMARY',JSON.stringify({candidates:targets.length,styles:items.length,matched:successes,imageFailures:failures,checked:urlsChecked,networkRequests:requests,unmatched:targets.length-successes,problems:problems.length}));
for(let i=0;i<found.length;i+=20)console.log('PHOTO_RECORDS_JSON:'+JSON.stringify(found.slice(i,i+20)));
for(const problem of problems.slice(0,50))console.log('PHOTO_UNMATCHED:',JSON.stringify(problem));
