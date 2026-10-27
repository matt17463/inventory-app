// Deterministic browser-side DTF processing. Never treat preview backdrops as artwork.
import { removeEdgeConnectedWhite, alphaBounds, validatePrintDimensions, DTF_DPI, setPngDpi } from './dtfPreflight.js';
import { PROCESS_ANGLES, PROCESS_ENABLED, createProcessScreens, createColorDotScreen, screenProcessPixel, screenColorDotPixel, screenAngleWarnings } from './dtfMulticolor.js';

const clamp = n => Math.max(0, Math.min(255, Math.round(n)));
const between = (n, min, max) => Math.max(min, Math.min(max, n));
export const DTF_DEFAULTS = Object.freeze({
  width: 12, height: 12, background: 'none', threshold: 245, backgroundColor: '#ffffff',
  removalTolerance: 35, defringe: 0, alphaThreshold: 4, alphaMode: 'hard',
  knockout: 'none', shirtColor: '#000000', knockoutTolerance: 55,
  halftone: 'none', lpi: 35, angle: 22.5, dot: 'circle',
  screenAngles: PROCESS_ANGLES, screenEnabled: PROCESS_ENABLED,
  screenGain: 0, colorDotDensity: 80,
  gamma: 1, blackPoint: 0, whitePoint: 255, sharpen: 0,
  crop: true, preserveRatio: true,
});
export function parseRgb(hex) {
  const clean = String(hex || '').trim().replace(/^#/, '');
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(clean)) throw new Error('Use a valid RGB hex color.');
  const full = clean.length === 3 ? [...clean].map(x => x + x).join('') : clean;
  return [0,2,4].map(i => parseInt(full.slice(i, i+2), 16));
}
export function cmykToRgb(c, m, y, k) {
  const q = [c,m,y,k].map(n => between(Number(n) || 0, 0, 100)/100);
  return [0,1,2].map(i => clamp(255 * (1-q[i]) * (1-q[3])));
}
export function rgbToCmyk(r,g,b) {
  const n=[r,g,b].map(v=>between(v,0,255)/255);
  const k=1-Math.max(...n);
  if (k >= .999999) return [0,0,0,100];
  return [...n.map(v=>Math.round((1-v-k)/(1-k)*100)),Math.round(k*100)];
}
function rgbDistance(data, i, color) {
  const dr=data[i]-color[0], dg=data[i+1]-color[1], db=data[i+2]-color[2];
  return Math.sqrt((dr*dr+dg*dg+db*db)/3);
}
export function removeEdgeColor(data, width, height, color, tolerance=35) {
  const total=width*height;
  const seen=new Uint8Array(total), queue=new Int32Array(total);
  let head=0, tail=0, removed=0;
  function visit(id) {
    if(id<0||id>=total||seen[id]) return;
    seen[id]=1; const i=id*4;
    if(data[i+3]===0||rgbDistance(data,i,color)<=tolerance)queue[tail++]=id;
  }
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}
  for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1);}
  while(head<tail){
    const id=queue[head++],i=id*4;
    if(data[i+3]){data[i+3]=0;removed++;}
    const x=id%width,y=Math.floor(id/width);
    if(x>0)visit(id-1);if(x<width-1)visit(id+1);
    if(y>0)visit(id-width);if(y<height-1)visit(id+width);
  }
  return removed;
}
export function halftoneSpot(x,y,ppi,lpi,angle,dot='circle') {
  const cell=ppi/between(lpi,15,55);
  const rad=angle*Math.PI/180, ca=Math.cos(rad),sa=Math.sin(rad);
  const u=((x*ca+y*sa)/cell)%1, v=((-x*sa+y*ca)/cell)%1;
  const dx=Math.abs((u+1)%1-.5),dy=Math.abs((v+1)%1-.5);
  // Spot values are area coverage thresholds: 0% empty, 100% fully solid.
  if(dot==='square')return between(4*Math.max(dx,dy)**2,0,1);
  if(dot==='diamond')return between(2*(dx+dy)**2,0,1);
  if(dot==='line')return between(2*dy,0,1);
  if(dot==='ellipse')return between(Math.PI*(1.6*dx*dx+.625*dy*dy),0,1);
  return between(Math.PI*(dx*dx+dy*dy),0,1);
}
// Mutates a copy supplied by the caller. Result is full-size print pixels, NOT a mockup.
export function processDtfPixels(data,width,height,options={},ppi=300) {
  if(data.length !== width*height*4)throw new Error('Image buffer does not match dimensions.');
  const o={...DTF_DEFAULTS,...options};
  const stats={removedBackground:0, knockedOut:0, partialAlpha:0, transparent:0, printable:0};
  if(o.background==='white')stats.removedBackground=removeEdgeConnectedWhite(data,width,height,Number(o.threshold));
  if(o.background==='sampled')stats.removedBackground=removeEdgeColor(data,width,height,parseRgb(o.backgroundColor),between(Number(o.removalTolerance),0,255));
  const shirt=parseRgb(o.shirtColor);
  const amount=between(Number(o.sharpen),0,2);
  // Copy pre-sharpen colors so results do not depend on traversal direction.
  const original=amount>0?new Uint8ClampedArray(data):null;
  const bp=between(Number(o.blackPoint),0,254),wp=between(Number(o.whitePoint),bp+1,255);
  const gamma=between(Number(o.gamma),.2,4);
  const lpi=between(Number(o.lpi),15,55),angle=Number(o.angle)||0;
  const alphaCut=between(Number(o.alphaThreshold),0,255);
  const fringe=between(Number(o.defringe),0,3);
  const processScreens=o.halftone==='multicolor'?createProcessScreens(o,ppi):null;
  const colorScreen=o.halftone==='color-dots'?createColorDotScreen(o,ppi):null;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    let alpha=data[i+3];
    if(!alpha){data[i]=data[i+1]=data[i+2]=0;stats.transparent++;continue;}
    for(let c=0;c<3;c++){
      let level=255*Math.pow(between((data[i+c]-bp)/(wp-bp),0,1),1/gamma);
      if(original&&x>0&&x<width-1&&y>0&&y<height-1){
        const avg=(original[i-4+c]+original[i+4+c]+original[i-width*4+c]+original[i+width*4+c])/4;
        level+=amount*(original[i+c]-avg);
      }
      data[i+c]=clamp(level);
    }
    if(fringe && alpha<255) alpha=clamp(alpha-fringe*32);
    if(o.knockout==='shirt'){
      const d=rgbDistance(data,i,shirt),t=between(Number(o.knockoutTolerance),1,255);
      if(d<t){alpha=clamp(alpha*d/t);stats.knockedOut++;}
    }
    if(alpha<=alphaCut)alpha=0;
    if(alpha && processScreens) {
      const ink=screenProcessPixel(data,i,x,y,alpha,processScreens);
      if(ink)stats.printable++;else stats.transparent++;
      continue;
    }
    if(alpha && colorScreen) {
      const ink=screenColorDotPixel(data,i,x,y,alpha,colorScreen);
      if(ink)stats.printable++;else stats.transparent++;
      continue;
    }
    if(alpha && o.halftone!=='none') {
      const lum=(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])/255;
      let coverage=alpha/255;
      if(o.halftone==='full')coverage*=(1-.86*lum);
      const shouldScreen=o.halftone==='full'||(o.halftone==='fades'&&alpha<250)||(o.halftone==='knockout'&&o.knockout==='shirt');
      if(shouldScreen) alpha=halftoneSpot(x+.5,y+.5,ppi,lpi,angle,o.dot)<=coverage?255:0;
    }
    if(o.alphaMode==='hard' || o.halftone!=='none')alpha=alpha>alphaCut?255:0;
    data[i+3]=alpha;
    if(!alpha){data[i]=data[i+1]=data[i+2]=0;stats.transparent++;}
    else {stats.printable++;if(alpha<255)stats.partialAlpha++;}
  }
  return stats;
}
export function qualityReport(sourceWidth,sourceHeight,outputWidth,outputHeight,stats,options) {
  const scale=Math.min(outputWidth/sourceWidth,outputHeight/sourceHeight);
  const warnings=[];
  if(scale>1.01) warnings.push('Source is enlarged '+scale.toFixed(1)+'×. Upscaling does not recreate lost detail.');
  if(stats.partialAlpha)warnings.push(stats.partialAlpha.toLocaleString()+' partly transparent pixels remain; inspect for haze.');
  if(options.halftone!=='none' && DTF_DPI/Number(options.lpi)<6)warnings.push('Halftone cell has fewer than 6 pixels; test for stable dots.');
  if(options.knockout==='shirt')warnings.push('Review knockout carefully: the chosen color may also occur inside the artwork.');
  if(options.halftone==='multicolor') {
    warnings.push(...screenAngleWarnings(options));
    warnings.push('CMYK-dot composite is a visual RGB simulation, not RIP channel separations or an ICC-managed proof. Validate output and underbase with your printer.');
    warnings.push('Pure white CMYK pixels make no colored dots. White ink must be handled through the DTF RIP.');
  }
  if(options.halftone==='color-dots')warnings.push('Original-color dots are an artistic alpha pattern. Confirm RIP white underbase and actual transfer quality before production.');
  return {outputWidth,outputHeight,dpi:DTF_DPI,sourceWidth,sourceHeight,estimatedNativeDpi:Math.round(DTF_DPI/Math.max(scale,.01)),stats,warnings};
}
export async function exportDtfPng(canvas) {
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG encoding failed')),'image/png'));
  return new Blob([setPngDpi(new Uint8Array(await blob.arrayBuffer()),DTF_DPI)],{type:'image/png'});
}
// Actual one-color vector silhouette consisting of horizontal rectangles. Not a photo/vector reproduction.
export function vectorSilhouette(data,width,height,fill='#000000',maxRuns=12000,ppi=300) {
  const rects=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;){
    if(data[(y*width+x)*4+3]!==255){x++;continue;}
    const start=x;
    while(x<width&&data[(y*width+x)*4+3]===255)x++;
    rects.push('<rect x="'+start+'" y="'+y+'" width="'+(x-start)+'" height="1"/>');
    if(rects.length>maxRuns)throw new Error('This artwork has too much detail for one-color vector tracing. Export the PNG instead.');
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" width="'+(width/ppi)+'in" height="'+(height/ppi)+'in"><g fill="'+fill+'">'+rects.join('')+'</g></svg>';
}
export { alphaBounds, validatePrintDimensions, DTF_DPI };
