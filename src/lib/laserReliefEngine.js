// Shared, browser-side 2.5D relief engine. All depth values are relative [0,1].
// No machine motion, laser commands, or unverified depth-in-mm claims.
export const LASER_PRESETS = [
  { id:'coin', label:'Metal challenge coin', widthMm:38.1, heightMm:38.1, depthMm:0.35, material:'brass', machine:'mopa_fiber', mode:'logo' },
  { id:'medallion', label:'Metal medallion', widthMm:50, heightMm:50, depthMm:0.25, material:'steel', machine:'mopa_fiber', mode:'logo' },
  { id:'wood', label:'Wood relief plaque', widthMm:150, heightMm:100, depthMm:1.2, material:'wood', machine:'xtool_p2', mode:'photo' },
  { id:'slate', label:'Slate art / shallow relief', widthMm:100, heightMm:100, depthMm:0.15, material:'slate', machine:'xtool_s1', mode:'grayscale' },
  { id:'portrait', label:'Portrait on wood', widthMm:100, heightMm:150, depthMm:0.6, material:'wood', machine:'xtool_p2', mode:'photo' },
  { id:'uv', label:'UV texture reuse', widthMm:70, heightMm:50, depthMm:0.25, material:'other', machine:'xtool_omni', mode:'logo' }
];
const limit=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export function luminance(data,index) {
  const i=index*4;
  return (data[i]*0.2126+data[i+1]*0.7152+data[i+2]*0.0722)/255;
}
export function blurHeights(values,width,height,radius=1) {
  const r=limit(Math.round(radius),0,20);
  if(!r)return new Float32Array(values);
  const temp=new Float32Array(values.length),out=new Float32Array(values.length);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){
    let total=0,count=0;
    for(let k=-r;k<=r;k++){total+=values[y*width+limit(x+k,0,width-1)];count++;}
    temp[y*width+x]=total/count;
  }
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){
    let total=0,count=0;
    for(let k=-r;k<=r;k++){total+=temp[limit(y+k,0,height-1)*width+x];count++;}
    out[y*width+x]=total/count;
  }
  return out;
}
function distanceToBackground(mask,width,height) {
  const dist=new Float32Array(width*height);
  const large=width+height;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x;
    dist[i]=mask[i]?(x===0||y===0||x===width-1||y===height-1?1:large):0;
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x;if(!mask[i])continue;
    if(x>0)dist[i]=Math.min(dist[i],dist[i-1]+1);
    if(y>0)dist[i]=Math.min(dist[i],dist[i-width]+1);
  }
  for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){
    const i=y*width+x;if(!mask[i])continue;
    if(x<width-1)dist[i]=Math.min(dist[i],dist[i+1]+1);
    if(y<height-1)dist[i]=Math.min(dist[i],dist[i+width]+1);
  }
  return dist;
}
export function generateHeightmap(imageData,{mode='logo',invert=false,detail=40,smoothing=1,bevel=8,contrast=1.2}={}) {
  const {width,height,data}=imageData;
  if(!width||!height||width*height>16_000_000)throw Error('Invalid source size');
  const count=width*height,values=new Float32Array(count),mask=new Uint8Array(count);
  const threshold=0.12;
  let opaque=0,transparent=0,brightBorders=0,borderCount=0;
  for(let i=0;i<count;i++) {
    const a=data[i*4+3]/255;
    mask[i]=a>=threshold?1:0;
    opaque+=mask[i];
    transparent+=a<0.99?1:0;
  }
  // For opaque white-background logos, infer a foreground mask from border white.
  if(mode==='logo'&&opaque===count){
    for(let x=0;x<width;x++){brightBorders+=luminance(data,x)+luminance(data,(height-1)*width+x);borderCount+=2;}
    for(let y=0;y<height;y++){brightBorders+=luminance(data,y*width)+luminance(data,y*width+width-1);borderCount+=2;}
    if(brightBorders/borderCount>0.91){
      for(let i=0;i<count;i++)mask[i]=luminance(data,i)<0.89?1:0;
    }
  }
  const dist=mode==='logo'?distanceToBackground(mask,width,height):null;
  const bevelPixels=limit(Number(bevel)||8,1,Math.min(width,height)/3);
  for(let i=0;i<count;i++){
    if(!mask[i]){values[i]=0;continue;}
    const lum=luminance(data,i);
    if(mode==='logo'){
      const dome=limit(dist[i]/bevelPixels,0,1);
      const texture=(1-lum)*(Number(detail)/100)*0.25;
      values[i]=limit(dome*(0.8+texture),0,1);
    }else{
      const raw=invert?1-lum:lum;
      values[i]=limit((raw-0.5)*Number(contrast)+0.5,0,1);
    }
  }
  let result=blurHeights(values,width,height,Number(smoothing)||0);
  if(mode!=='logo'&&detail>0){
    const low=blurHeights(result,width,height,Math.max(2,Math.round(width/120)));
    const factor=Number(detail)/120;
    for(let i=0;i<count;i++)result[i]=limit(result[i]+(result[i]-low[i])*factor,0,1);
  }
  if(mode==='logo'&&invert) for(let i=0;i<count;i++) if(mask[i])result[i]=1-result[i];
  for(let i=0;i<count;i++)if(!mask[i])result[i]=0;
  return {width,height,values:result,mask,source:'algorithm'};
}
export function fromAiDepth(source,gray,width,height,{invert=false,smoothing=1}={}) {
  // Source is ImageData; AI depth is greyscale ImageData resized to source dimensions.
  const values=new Float32Array(width*height),mask=new Uint8Array(values.length);
  for(let i=0;i<values.length;i++){
    mask[i]=source.data[4*i+3]>30?1:0;
    values[i]=mask[i]?(invert?1-luminance(gray.data,i):luminance(gray.data,i)):0;
  }
  return {width,height,values:blurHeights(values,width,height,smoothing),mask,source:'depth-anything-v2-small'};
}
export function paintHeightmap(map,cx,cy,{tool='raise',radius=15,strength=0.12}={}) {
  const {width,height,values,mask}=map;
  const r=limit(Number(radius)||1,1,256),next=new Float32Array(values);
  const left=Math.max(0,Math.floor(cx-r)),right=Math.min(width-1,Math.ceil(cx+r));
  const top=Math.max(0,Math.floor(cy-r)),bottom=Math.min(height-1,Math.ceil(cy+r));
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
    const dist=Math.hypot(x-cx,y-cy);if(dist>r)continue;
    const i=y*width+x;if(!mask[i])continue;
    const a=(1-dist/r)*(Number(strength)||0.1);
    const curr=values[i];
    if(tool==='raise')next[i]=limit(curr+a,0,1);
    if(tool==='lower')next[i]=limit(curr-a,0,1);
    if(tool==='flatten')next[i]=curr+(0.5-curr)*a*4;
    if(tool==='smooth') {
      let sum=0,n=0;
      for(let yy=Math.max(0,y-2);yy<=Math.min(height-1,y+2);yy++)for(let xx=Math.max(0,x-2);xx<=Math.min(width-1,x+2);xx++){
        sum+=values[yy*width+xx];n++;
      }
      next[i]=curr+(sum/n-curr)*a*4;
    }
  }
  return {...map,values:next};
}
export function grayscaleImageData(map,{invert=false}={}) {
  const {width,height,values}=map;
  const bytes=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<values.length;i++){
    const v=Math.round(limit(invert?1-values[i]:values[i],0,1)*255);
    bytes[4*i]=v;bytes[4*i+1]=v;bytes[4*i+2]=v;bytes[4*i+3]=255;
  }
  return new ImageData(bytes,width,height);
}
export function renderHeightmap(canvas,map,options={}){
  if(!canvas||!map)return;
  canvas.width=map.width;canvas.height=map.height;
  canvas.getContext('2d',{willReadFrequently:true}).putImageData(grayscaleImageData(map,options),0,0);
}
function crc32(bytes){
  let crc=0xffffffff;
  for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^(crc&1?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function chunk(type,bytes){
  const out=new Uint8Array(12+bytes.length),v=new DataView(out.buffer);
  v.setUint32(0,bytes.length);for(let i=0;i<4;i++)out[4+i]=type.charCodeAt(i);
  out.set(bytes,8);v.setUint32(bytes.length+8,crc32(out.subarray(4,8+bytes.length)));
  return out;
}
export async function export16BitPng(map,{invert=false}={}){
  if(typeof CompressionStream==='undefined')throw Error('16-bit export requires a browser with CompressionStream support; use 8-bit PNG here.');
  const {width,height,values}=map;
  const raw=new Uint8Array(height*(width*2+1));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x,number=Math.round(limit(invert?1-values[i]:values[i],0,1)*65535);
    const offset=y*(width*2+1)+1+x*2;
    raw[offset]=number>>>8;raw[offset+1]=number&255;
  }
  const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'));
  const zipped=new Uint8Array(await new Response(stream).arrayBuffer());
  const ihdr=new Uint8Array(13),dv=new DataView(ihdr.buffer);
  dv.setUint32(0,width);dv.setUint32(4,height);ihdr[8]=16;ihdr[9]=0; // grayscale, no alpha
  return new Blob([new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zipped),chunk('IEND',new Uint8Array(0))],{type:'image/png'});
}
export function stlRelief(map,{widthMm=38.1,heightMm=38.1,depthMm=0.35,baseMm=1,maxSamples=84}={}){
  const cols=Math.min(map.width,Math.max(2,maxSamples)),rows=Math.min(map.height,Math.max(2,Math.round(cols*map.height/map.width)));
  const X=x=>x*widthMm/(cols-1),Y=y=>y*heightMm/(rows-1);
  const Z=(x,y)=>baseMm+map.values[Math.round(y*(map.height-1)/(rows-1))*map.width+Math.round(x*(map.width-1)/(cols-1))]*depthMm;
  const output=['solid skilled_crafting_laser_relief'];
  function triangle(a,b,c){
    const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
    let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const len=Math.hypot(...n)||1;n=n.map(x=>x/len);
    output.push('facet normal '+n.join(' '),' outer loop','  vertex '+a.join(' '),'  vertex '+b.join(' '),'  vertex '+c.join(' '),' endloop','endfacet');
  }
  for(let y=0;y<rows-1;y++)for(let x=0;x<cols-1;x++){
    const a=[X(x),Y(y),Z(x,y)],b=[X(x+1),Y(y),Z(x+1,y)],c=[X(x),Y(y+1),Z(x,y+1)],d=[X(x+1),Y(y+1),Z(x+1,y+1)];
    triangle(a,b,c);triangle(b,d,c);
  }
  triangle([0,0,0],[0,heightMm,0],[widthMm,0,0]);
  triangle([widthMm,0,0],[0,heightMm,0],[widthMm,heightMm,0]);
  for(let x=0;x<cols-1;x++){
    triangle([X(x),0,0],[X(x+1),0,Z(x+1,0)],[X(x),0,Z(x,0)]);
    triangle([X(x),0,0],[X(x+1),0,0],[X(x+1),0,Z(x+1,0)]);
    triangle([X(x),heightMm,0],[X(x),heightMm,Z(x,rows-1)],[X(x+1),heightMm,Z(x+1,rows-1)]);
    triangle([X(x),heightMm,0],[X(x+1),heightMm,Z(x+1,rows-1)],[X(x+1),heightMm,0]);
  }
  for(let y=0;y<rows-1;y++){
    triangle([0,Y(y),0],[0,Y(y),Z(0,y)],[0,Y(y+1),Z(0,y+1)]);
    triangle([0,Y(y),0],[0,Y(y+1),Z(0,y+1)],[0,Y(y+1),0]);
    triangle([widthMm,Y(y),0],[widthMm,Y(y+1),Z(cols-1,y+1)],[widthMm,Y(y),Z(cols-1,y)]);
    triangle([widthMm,Y(y),0],[widthMm,Y(y+1),0],[widthMm,Y(y+1),Z(cols-1,y+1)]);
  }
  output.push('endsolid skilled_crafting_laser_relief');
  return output.join('\n');
}
export function svgCutOutline({widthMm,heightMm}){
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+widthMm+'mm" height="'+heightMm+'mm" viewBox="0 0 '+widthMm+' '+heightMm+'"><rect x="0" y="0" width="'+widthMm+'" height="'+heightMm+'" fill="none" stroke="#000000" stroke-width="0.15"/></svg>';
}
export function renderReliefPreview(canvas,map,{yaw=22,pitch=55,depthMm=0.35,widthMm=38,heightMm=38,material='brass'}={}){
 if(!canvas||!map)return;
 const ctx=canvas.getContext('2d'),w=canvas.width=680,h=canvas.height=440;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#171e27';ctx.fillRect(0,0,w,h);
 const palettes={brass:[194,151,66],steel:[155,170,183],wood:[174,115,62],slate:[105,115,122],other:[142,157,181]};
 const rgb=palettes[material]||palettes.other;
 const cols=Math.min(map.width,74),rows=Math.max(2,Math.round(cols*map.height/map.width));
 const rad=Math.PI/180,ya=yaw*rad,pi=pitch*rad;
 const size=Math.max(widthMm,heightMm),depthVisual=Math.max(.03,depthMm/size*5.5);
 const scale=Math.min(w/(size*1.85),h/(size*1.6));
 function point(x,y,z){
   const xx=(x/ (cols-1)-0.5)*widthMm,yy=(y/(rows-1)-0.5)*heightMm;
   const rx=xx*Math.cos(ya)-yy*Math.sin(ya),ry=xx*Math.sin(ya)+yy*Math.cos(ya);
   return [w/2+rx*scale,h/2+(ry*Math.cos(pi)-z*size*depthVisual*Math.sin(pi))*scale,ry*Math.sin(pi)+z*size*depthVisual*Math.cos(pi)];
 }
 function ht(x,y){const sx=Math.round(x*(map.width-1)/(cols-1)),sy=Math.round(y*(map.height-1)/(rows-1));return map.values[sy*map.width+sx];}
 const quads=[];
 for(let y=0;y<rows-1;y++)for(let x=0;x<cols-1;x++){
   const a=ht(x,y),b=ht(x+1,y),c=ht(x+1,y+1),d=ht(x,y+1);
   const poly=[point(x,y,a),point(x+1,y,b),point(x+1,y+1,c),point(x,y+1,d)];
   const nx=-(b-a),ny=-(d-a),shade=limit(0.64+nx*1.4+ny*1.5,0.25,1.25);
   quads.push({poly,shade,z:poly.reduce((s,p)=>s+p[2],0)/4});
 }
 quads.sort((a,b)=>a.z-b.z);
 for(const q of quads){
   ctx.beginPath();q.poly.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
   ctx.fillStyle='rgb('+rgb.map(v=>Math.round(limit(v*q.shade,0,255))).join(',')+')';ctx.fill();
 }
 ctx.fillStyle='#aab5c3';ctx.font='13px sans-serif';
 ctx.fillText('SIMULATED RELIEF — not an actual engraving depth',16,h-16);
}
export function downloadBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
