// Photographic reference selection for warehouse identification.
// A provisional style photograph must not be treated as proof of exact garment color.
export const photoKey=(value)=>String(value??'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'');
const aliasStyle=new Map([['gildan:6400','gildan:64000']]);
const validStyle=(value)=>Boolean(photoKey(value)&& !['na','unknown','other','misc','blank','none'].includes(photoKey(value)));
export function referenceIndex(rows){
 const byStyle=new Map();
 for(const row of rows){
  if(!row.savedPhoto || !photoKey(row.brand)||!validStyle(row.style))continue;
  const styleKey=photoKey(row.brand)+':'+photoKey(row.style);
  if(!byStyle.has(styleKey))byStyle.set(styleKey,[]);
  byStyle.get(styleKey).push(row);
 }
 return byStyle;
}
export function referenceFor(blank,index){
 if(blank.savedPhoto)return {photo:blank.savedPhoto,exactPhoto:blank.savedPhoto,kind:'assigned',note:blank.savedPhoto.includes('sanmarsports.com')?'Supplier photo — verify label':'Saved product photo'};
 const key=photoKey(blank.brand)+':'+photoKey(blank.style);
 if(!validStyle(blank.style)||!photoKey(blank.brand))return {photo:'',exactPhoto:'',kind:'missing',note:'No photo assigned'};
 const alternate=aliasStyle.get(key);
 const pool=index.get(key)|| (alternate?index.get(alternate):null)||[];
 if(!pool.length)return {photo:'',exactPhoto:'',kind:'missing',note:'No photo assigned'};
 // Prefer the same recorded color, but keep the match provisional because the image belongs to another SKU.
 const sameColor=pool.find((candidate)=>photoKey(candidate.color)===photoKey(blank.color));
 const source=sameColor||pool[0];
 return {
  photo:source.savedPhoto,exactPhoto:'',kind:alternate?'alias':'style',
  note:alternate?'Possible Gildan 64000 style reference (catalog says 6400); confirm the neck label'
    : sameColor?'Likely style/color reference from another SKU — verify label'
    :'Style reference only — pictured color may differ',
 };
}
