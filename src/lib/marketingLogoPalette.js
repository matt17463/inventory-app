/** Suggest dominant opaque logo colors. Results are screen-space estimates, not approved brand specifications. */
export function dominantMarketingColors(pixels, limit = 5) {
  const counts = new Map();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha < 180) continue;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (Math.max(r,g,b) > 245 && Math.min(r,g,b) > 240) continue;
    const key = [r,g,b].map(c => Math.min(255,Math.round(c/16)*16));
    const hex = '#' + key.map(c=>c.toString(16).padStart(2,'0')).join('').toUpperCase();
    counts.set(hex,(counts.get(hex)||0)+1);
  }
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([hex])=>hex);
}
export async function suggestMarketingLogoPalette(url) {
  if (!url) throw Error('Select a logo first.');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Logo image could not be loaded for color analysis.'));img.src=url;});
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,128/Math.max(img.naturalWidth,img.naturalHeight));
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)throw Error('Color analysis is not supported by this browser.');
  context.drawImage(img,0,0,canvas.width,canvas.height);
  let pixels;
  try { pixels=context.getImageData(0,0,canvas.width,canvas.height).data; }
  catch { throw Error('This logo host does not permit browser color analysis. Upload a local copy of the logo or enter verified HEX colors manually.'); }
  return dominantMarketingColors(pixels);
}
