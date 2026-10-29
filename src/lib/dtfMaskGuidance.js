import { removeDtfBackground, inspectPngAlpha, applyDtfMaskStrokes } from './dtfBackgroundRemoval.js';

// Coordinates refer to the contained image rectangle, including CSS transforms.
export function sourcePoint(rect,width,height,clientX,clientY){
  const scale=Math.min(rect.width/width,rect.height/height);
  const left=rect.left+(rect.width-width*scale)/2,top=rect.top+(rect.height-height*scale)/2;
  const x=(clientX-left)/scale,y=(clientY-top)/scale;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=width||y>=height)return null;
  return {x:Math.floor(x),y:Math.floor(y)};
}
export function validateGuidance(value){
  if(!value||!Number.isFinite(value.confidence)||value.confidence<0||value.confidence>1||
    !Array.isArray(value.points)||!value.points.length||value.points.length>48)throw Error('AI guidance is malformed. Use local removal.');
  const points=value.points.map(p=>{
    if(!['keep','remove'].includes(p?.kind)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1)
      throw Error('AI guidance coordinates are misaligned. Use local removal.');
    return {kind:p.kind,x:p.x,y:p.y};
  });
  if(!points.some(p=>p.kind==='remove'))throw Error('AI could not identify background regions. Add manual guidance.');
  return {points,confidence:value.confidence,reviewRequired:true};
}
// Flood selection uses immutable RGB and original alpha. Only the working alpha changes.
export function applyRegionGuidance(data,original,width,height,points,tolerance=25){
  if(!Array.isArray(points)||points.length>96)throw Error('Too many region selections (maximum 96).');
  if(!points.length)return;
  if(!Number.isFinite(tolerance)||tolerance<0||tolerance>180)throw Error('Invalid region sensitivity.');
  const count=width*height,queue=new Int32Array(count),seen=new Uint8Array(count);
  for(const p of points){
    if(!['remove','keep'].includes(p.kind)||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=width||p.y>=height)throw Error('Invalid region selection.');
    seen.fill(0);let head=0,tail=0;const start=p.y*width+p.x,base=start*4;
    if(!original[base+3])continue;
    const add=id=>{if(seen[id])return;seen[id]=1;const i=id*4;
      if(original[i+3]&&Math.sqrt(((original[i]-original[base])**2+(original[i+1]-original[base+1])**2+(original[i+2]-original[base+2])**2)/3)<=tolerance)queue[tail++]=id;};
    add(start);
    while(head<tail){const id=queue[head++],i=id*4,x=id%width;
      if(p.kind==='keep'){data[i]=original[i];data[i+1]=original[i+1];data[i+2]=original[i+2];data[i+3]=original[i+3];}
      else data[i+3]=0;
      if(x)add(id-1);if(x<width-1)add(id+1);if(id>=width)add(id-width);if(id<count-width)add(id+width);
    }
  }
}
export function prepareSourceMask(original,width,height,opts){
  const data=new Uint8ClampedArray(original),before=inspectPngAlpha(original,width,height);
  let report={removed:0,softened:0,originalHadTransparency:before.hasTransparency};
  if(opts.background!=='none'&&opts.background!=='ai'&&!(opts.background==='pick'&&opts.regionPoints?.length)){
    report={...report,...removeDtfBackground(data,width,height,{mode:opts.background,
      tolerance:opts.background==='white'?255-Number(opts.threshold):Number(opts.removalTolerance),
      feather:Number(opts.backgroundFeather??12),color:opts.backgroundColor,point:opts.backgroundPoint,
      scope:opts.backgroundScope||'connected',decontaminate:opts.backgroundDecontaminate!==false})};
  }
  if(opts.removeInteriorWhite){
    const holes=removeDtfBackground(data,width,height,{mode:'white',scope:'all',tolerance:255-Number(opts.interiorWhiteThreshold??245),feather:Number(opts.interiorWhiteFeather??4),decontaminate:opts.backgroundDecontaminate!==false});
    report.interiorRemoved=holes.removed;
  }
  if(opts.background==='ai'){
    const ai=validateGuidance(opts.aiGuidance);
    const points=ai.points.map(p=>({...p,x:Math.min(width-1,Math.floor(p.x*width)),y:Math.min(height-1,Math.floor(p.y*height))}));
    applyRegionGuidance(data,original,width,height,[...points.filter(p=>p.kind==='remove'),...points.filter(p=>p.kind==='keep')],Number(opts.removalTolerance??25));
    report.confidence=ai.confidence;
  }
  applyRegionGuidance(data,original,width,height,opts.regionPoints||[],Number(opts.removalTolerance??25));
  if(opts.maskStrokes?.length)Object.assign(report,applyDtfMaskStrokes(data,original,width,height,opts.maskStrokes));
  const after=inspectPngAlpha(data,width,height);
  let removed=0,softened=0;
  for(let i=3;i<data.length;i+=4){if(original[i]&&data[i]===0)removed++;else if(data[i]<original[i])softened++;}
  report={...report,removed,softened,sourceAlpha:after,reviewRequired:report.confidence<.75||removed/Math.max(1,width*height-before.transparent)>.9};
  if(after.allTransparent)throw Error('Mask erased all artwork. Restore details or reduce sensitivity.');
  return {data,report};
}
