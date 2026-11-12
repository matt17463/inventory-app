/**
 * Print asset preflight, independent of the rendering engine.
 * Coordinates are physical points (72 points per inch). Intrinsic pixels
 * are checked before rasterizing the 2550 x 3300 US Letter output.
 */
export const SCHOOL_FLYER_PRINT = Object.freeze({widthPt:612,heightPt:792,widthPx:2550,heightPx:3300,dpi:300});
export function effectiveDpi({width,height,boxWidthPt,boxHeightPt}){
 if(![width,height,boxWidthPt,boxHeightPt].every(v=>Number.isFinite(v)&&v>0))return 0;
 // SVG uses preserveAspectRatio meet, so actual occupied size is bounded by box.
 const scale=Math.min(boxWidthPt/width,boxHeightPt/height);
 return Math.floor(72/scale);
}
export function inspectFlyerAsset({label,width,height,boxWidthPt,boxHeightPt,minDpi=200}){
 const dpi=effectiveDpi({width,height,boxWidthPt,boxHeightPt});
 return {label,dpi,passes:dpi>=minDpi,message:dpi>=minDpi?"":`${label}: image resolution is approximately ${dpi} DPI at its printed size (minimum ${minDpi} DPI).`};
}
export async function checkFlyerRasterAssets(d,{approvedCover=""}={}){
 const load=src=>new Promise((resolve,reject)=>{
  if(!src)return resolve(null);
  if(typeof Image==="undefined")return reject(Error("Image inspection is available only in the browser."));
  const i=new Image();
  i.onload=()=>resolve({width:i.naturalWidth,height:i.naturalHeight});
  i.onerror=()=>reject(Error("Could not read print asset for resolution check."));
  i.src=src;
 });
 const items=[
  {label:"Skilled Crafting logo",src:d.businessLogo,boxWidthPt:82,boxHeightPt:43,minDpi:200},
  {label:"School mascot / logo",src:d.heroArtwork||d.schoolLogo,boxWidthPt:172,boxHeightPt:152,minDpi:200},
  {label:"School logo for details",src:d.schoolLogo,boxWidthPt:80,boxHeightPt:76,minDpi:200},
  ...(approvedCover?[
   {label:"Approved full-page cover",src:approvedCover,boxWidthPt:612,boxHeightPt:792,minDpi:300}
  ]:[
   {label:"Illustrated scenery",src:d.backgroundArtwork,boxWidthPt:612,boxHeightPt:331,minDpi:150}
  ]),
  ...(d.products||[]).map((p,i)=>({label:`Product ${i+1} mockup`,src:p.mockup,boxWidthPt:210,boxHeightPt:213,minDpi:200}))
 ];
 const checks=[];
 for(const item of items){
  if(!item.src)continue; 
  const dimensions=await load(item.src);
  checks.push(inspectFlyerAsset({...dimensions,...item}));
 }
 return {ready:checks.every(x=>x.passes),checks,errors:checks.filter(x=>!x.passes).map(x=>x.message)};
}
