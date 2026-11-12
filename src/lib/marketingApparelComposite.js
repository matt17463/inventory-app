/** Deterministic placement geometry for client-reviewed apparel visual proofs.
 * Coordinates describe the full blank photo, not a machine production placement.
 */
export function normalizeApparelPlacement(value={}){
 const clamp=(input,minimum,maximum,fallback)=>{
  const number=Number(input);
  return Number.isFinite(number)?Math.max(minimum,Math.min(maximum,number)):fallback;
 };
 const width=clamp(value.width,5,70,27);
 const x=clamp(value.x,width/2,100-width/2,50);
 const y=clamp(value.y,width/2,100-width/2,43);
 return {x,y,width};
}
export function apparelOverlayBox(blankWidth,blankHeight,logoWidth,logoHeight,placement={}){
 const p=normalizeApparelPlacement(placement);
 const bw=Number(blankWidth),bh=Number(blankHeight),lw=Number(logoWidth),lh=Number(logoHeight);
 if(![bw,bh,lw,lh].every(x=>Number.isFinite(x)&&x>0))throw Error("Blank photo and approved logo dimensions are required.");
 const width=bw*p.width/100;
 const height=width*lh/lw;
 const x=bw*p.x/100-width/2;
 const y=bh*p.y/100-height/2;
 if(height>bh||x<0||y<0||x+width>bw||y+height>bh)throw Error("Logo placement exceeds the blank photo. Reduce its size or change its position.");
 return {x,y,width,height};
}
export async function loadApparelImage(src){
 return new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(Error("Could not read the selected blank photo or approved logo."));
  img.src=src;
 });
}
export async function renderApparelComposite({blank,logo,placement={},maxDimension=1600}){
 if(!/^data:image\/(jpeg|png|webp);base64,/i.test(blank||""))throw Error("Choose a verified PNG, JPEG, or WebP blank photo.");
 if(!/^data:image\/(jpeg|png|webp);base64,/i.test(logo||""))throw Error("The approved client logo must be a PNG, JPEG, or WebP image.");
 const [blankImage,logoImage]=await Promise.all([loadApparelImage(blank),loadApparelImage(logo)]);
 if(blankImage.naturalWidth<500||blankImage.naturalHeight<500)throw Error("Blank photo must be at least 500 pixels on both sides.");
 const scale=Math.min(1,Math.max(900,Math.min(2000,Number(maxDimension)||1600))/Math.max(blankImage.naturalWidth,blankImage.naturalHeight));
 const width=Math.round(blankImage.naturalWidth*scale),height=Math.round(blankImage.naturalHeight*scale);
 const box=apparelOverlayBox(width,height,logoImage.naturalWidth,logoImage.naturalHeight,placement);
 const canvas=document.createElement("canvas");
 canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext("2d");
 if(!ctx)throw Error("Canvas image composition is unavailable.");
 ctx.fillStyle="#ffffff";ctx.fillRect(0,0,width,height);
 ctx.drawImage(blankImage,0,0,width,height);
 ctx.drawImage(logoImage,box.x,box.y,box.width,box.height);
 const result=canvas.toDataURL("image/jpeg",.86);
 if(result.length>3_200_000)throw Error("Composed mockup is too large for private artwork storage. Select a smaller blank photo.");
 return result;
}
