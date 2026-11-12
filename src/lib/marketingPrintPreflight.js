/** Conservative 300-DPI target for full-color US Letter marketing proofs.
 * This is a raster pixel-dimension gate, not a color/print proof certification.
 */
export const PRINT_TARGETS={
 logo:{widthPx:300,description:"Brand logo"},
 product:{widthPx:540,description:"Merchandise mockup"},
 hero:{widthPx:2550,description:"Full-width scenic background"}
};
export function marketingPrintImageCheck({type,width,height,label}={}){
 const target=PRINT_TARGETS[type]||PRINT_TARGETS.product;
 const w=Number(width),h=Number(height);
 const minimumHeight=type==="hero"?600:type==="logo"?200:420;
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1){
  return {ok:false,message:(label||target.description)+" could not be decoded."};
 }
 if(w<target.widthPx||h<minimumHeight){
  return {ok:false,message:(label||target.description)+" is "+w+" × "+h+" px; supply at least "+target.widthPx+" px wide and "+minimumHeight+" px high for this layout."};
 }
 return {ok:true,message:(label||target.description)+" meets the raster dimension gate."};
}
export function marketingPrintPreflightSummary(results=[]){
 const errors=(Array.isArray(results)?results:[]).filter(r=>!r.ok).map(r=>r.message);
 return {passed:errors.length===0,errors};
}
