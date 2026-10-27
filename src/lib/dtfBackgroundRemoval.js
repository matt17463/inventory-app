// Actual pixel-alpha background removal for DTF PNG artwork.
// Safe for browser workers and Node tests. Never flattens against a proof backdrop.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rgbDiff=(data,offset,rgb)=>Math.sqrt(
  ((data[offset]-rgb[0])**2+(data[offset+1]-rgb[1])**2+(data[offset+2]-rgb[2])**2)/3
);
export function detectEdgeBackground(data,width,height) {
  if(data.length!==width*height*4||width<1||height<1)throw Error('Invalid source pixels.');
  // Dominant quantized edge color, NOT the image average. Diverse/photo edges fail closed.
  const bins=new Map();
  const step=Math.max(1,Math.floor((2*width+2*height)/4096));
  let total=0;
  const add=(x,y)=>{
    const i=(y*width+x)*4;
    if(data[i+3]<245)return;
    const key=((data[i]>>4)<<8)|((data[i+1]>>4)<<4)|(data[i+2]>>4);
    const bin=bins.get(key)||{count:0,r:0,g:0,b:0};
    bin.count++;bin.r+=data[i];bin.g+=data[i+1];bin.b+=data[i+2];
    bins.set(key,bin);total++;
  };
  for(let x=0;x<width;x+=step){add(x,0);if(height>1)add(x,height-1);}
  for(let y=step;y<height-step;y+=step){add(0,y);if(width>1)add(width-1,y);}
  if(!total)return null;
  const winner=[...bins.values()].sort((a,b)=>b.count-a.count)[0];
  const confidence=winner.count/total;
  if(confidence<.3)return null;
  return {color:[winner.r,winner.g,winner.b].map(v=>Math.round(v/winner.count)),confidence};
}
const parseColor=color=>{
  if(Array.isArray(color)&&color.length===3&&color.every(v=>Number.isFinite(v)&&v>=0&&v<=255))return color;
  const m=/^#([0-9a-f]{6})$/i.exec(String(color||''));
  if(!m)throw Error('Choose an RGB background color.');
  return [0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16));
};
export function removeDtfBackground(data,width,height,options={}) {
  if(data.length!==width*height*4||width<1||height<1)throw Error('Invalid source pixels.');
  const mode=options.mode||'auto';
  if(!['auto','white','sampled','pick'].includes(mode))throw Error('Unknown background removal mode.');
  const confidence=mode==='auto'?detectEdgeBackground(data,width,height):null;
  if(mode==='auto'&&!confidence)throw Error('Could not identify one consistent edge background. Use Pick from Source or Select Color for complex artwork.');
  const picked=options.point;
  if(mode==='pick'&&(!picked||!Number.isInteger(picked.x)||!Number.isInteger(picked.y)||
    picked.x<0||picked.x>=width||picked.y<0||picked.y>=height)) {
    throw Error('Click the background on the Source image to choose the region to remove.');
  }
  const offset=mode==='pick'?(picked.y*width+picked.x)*4:0;
  const color=mode==='auto'?confidence.color:mode==='white'?[255,255,255]:
    mode==='pick'?[data[offset],data[offset+1],data[offset+2]]:parseColor(options.color);
  const tolerance=clamp(Number(options.tolerance??35),0,180);
  const feather=clamp(Number(options.feather??12),0,64);
  const scope=options.scope==='all'?'all':'connected';
  const count=width*height,seen=scope==='connected'?new Uint8Array(count):null;
  const queue=scope==='connected'?new Int32Array(count):null;
  let head=0,tail=0,removed=0,softened=0,matched=0;
  const candidates=(id)=>{
    if(seen[id])return;
    seen[id]=1;
    const i=id*4;
    if(data[i+3]===0||rgbDiff(data,i,color)<=tolerance+feather)queue[tail++]=id;
  };
  function apply(id){
    const i=id*4;
    if(data[i+3]===0)return;
    const diff=rgbDiff(data,i,color);
    if(diff>tolerance+feather)return;
    matched++;
    const originalAlpha=data[i+3];
    const factor=diff<=tolerance?0:feather>0?(diff-tolerance)/feather:1;
    const nextAlpha=Math.round(originalAlpha*factor);
    if(nextAlpha===originalAlpha)return;
    if(nextAlpha===0){data[i]=data[i+1]=data[i+2]=data[i+3]=0;removed++;return;}
    if(options.decontaminate!==false&&nextAlpha>=12){
      // Recover colors from a flat background matte, only for partially kept edge pixels.
      const a=nextAlpha/255;
      for(let c=0;c<3;c++)data[i+c]=clamp(Math.round((data[i+c]-color[c]*(1-a))/a),0,255);
    }
    data[i+3]=nextAlpha;softened++;
  }
  if(scope==='all'){
    for(let id=0;id<count;id++)apply(id);
  }else{
    if(mode==='pick')candidates(picked.y*width+picked.x);
    else {
      for(let x=0;x<width;x++){candidates(x);if(height>1)candidates((height-1)*width+x);}
      for(let y=0;y<height;y++){candidates(y*width);if(width>1)candidates(y*width+width-1);}
    }
    while(head<tail){
      const id=queue[head++],x=id%width,y=Math.floor(id/width);
      // Flood based on ORIGINAL RGB similarity. Update visited pixel after deciding neighbors.
      if(x>0)candidates(id-1);
      if(x<width-1)candidates(id+1);
      if(y>0)candidates(id-width);
      if(y<height-1)candidates(id+width);
      apply(id);
    }
  }
  return {removed,softened,matched,color,confidence:confidence?.confidence??null,mode,scope};
}
export function inspectPngAlpha(data,width,height){
  if(data.length!==width*height*4)throw Error('Invalid alpha pixel buffer.');
  let transparent=0,opaque=0,partial=0;
  for(let i=3;i<data.length;i+=4){
    if(data[i]===0)transparent++;
    else if(data[i]===255)opaque++;
    else partial++;
  }
  return {transparent,opaque,partial,hasTransparency:transparent+partial>0,allTransparent:opaque+partial===0};
}
export function validateDtfTransparency({settings,report,finalAlpha}){
  if(finalAlpha.allTransparent)throw Error('Background removal erased all artwork. Adjust tolerance or restore the source.');
  if(settings.background&&settings.background!=='none'&&!finalAlpha.hasTransparency)
    throw Error('The exported image would still have an opaque background. Select a background region and retry.');
  if(settings.background&&settings.background!=='none'&&report.removed===0&&report.softened===0&&finalAlpha.transparent===0)
    throw Error('No background pixels were removed. Choose the correct color or Pick from Source.');
  return true;
}
