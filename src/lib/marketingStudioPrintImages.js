/**
 * US Letter browser print preflight. The browser renderer is fixed at 816 CSS
 * pixels across 8.5 inches (96 CSS px/in). Intrinsic image dimensions must
 * support their actual printed box, not just a nominal file DPI metadata tag.
 */
export function studioEffectiveImageDpi({width,height,boxWidthPx,boxHeightPx,fit="contain"}={}){
 const numbers=[width,height,boxWidthPx,boxHeightPx];
 if(!numbers.every(v=>Number.isFinite(v)&&v>0))return 0;
 const pixelsPerInch=96;
 const ratio=fit==="cover"?Math.max(boxWidthPx/width,boxHeightPx/height):Math.min(boxWidthPx/width,boxHeightPx/height);
 return Math.floor(pixelsPerInch/ratio);
}
export function inspectStudioImage({label,width,height,boxWidthPx,boxHeightPx,fit="contain",minDpi=200}={}){
 const dpi=studioEffectiveImageDpi({width,height,boxWidthPx,boxHeightPx,fit});
 return {label,dpi,passes:dpi>=minDpi,message:dpi>=minDpi?"":label+" is "+dpi+" effective DPI at printed size; use a higher-resolution approved image (minimum "+minDpi+" DPI)."};
}
export async function checkStudioPrintImages(doc,{scene=""}={}){
 const page=doc?.querySelector?.(".page");
 if(!page)throw Error("Cannot inspect images without a rendered US Letter print page.");
 const win=doc.defaultView;
 if(!win?.Image)throw Error("Print image inspection requires a browser document.");
 const checks=[];
 const checkElement=(img,label,minDpi)=>{
  const rect=img.getBoundingClientRect();
  checks.push(inspectStudioImage({label,width:img.naturalWidth,height:img.naturalHeight,boxWidthPx:rect.width,boxHeightPx:rect.height,minDpi}));
 };
 const logo=page.querySelector(".client-logo");
 if(logo)checkElement(logo,"Approved client logo",200);
 for(const [i,img] of Array.from(page.querySelectorAll(".piece img")).entries())checkElement(img,"Decorated merchandise "+(i+1),200);
 if(scene){
  const hero=page.querySelector(".hero");
  if(!hero)throw Error("Printed hero is missing for image inspection.");
  const backdrop=await new Promise((resolve,reject)=>{
   const img=new win.Image();
   img.onload=()=>resolve(img);
   img.onerror=()=>reject(Error("Decorative background could not be decoded for print."));
   img.src=scene;
  });
  const rect=hero.getBoundingClientRect();
  checks.push(inspectStudioImage({label:"Decorative hero scenery",width:backdrop.naturalWidth,height:backdrop.naturalHeight,boxWidthPx:rect.width,boxHeightPx:rect.height,fit:"cover",minDpi:150}));
 }
 return {ready:checks.every(x=>x.passes),checks,errors:checks.filter(x=>!x.passes).map(x=>x.message)};
}
