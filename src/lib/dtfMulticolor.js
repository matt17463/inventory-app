/**
 * Artistic multi-channel DTF halftone rasterizer.
 * Creates fully opaque RGB dots / transparent gaps in a single PNG.
 * NOT an ICC CMYK conversion, individual RIP ink separation, or white channel.
 */
const bound = (n, a, b) => Math.max(a, Math.min(b, n));
export const PROCESS_ANGLES = Object.freeze({ C:15, M:75, Y:0, K:45 });
export const PROCESS_ENABLED = Object.freeze({ C:true, M:true, Y:true, K:true });
export const PROCESS_CHANNELS = Object.freeze(['C','M','Y','K']);

function spotValue(x, y, screen) {
  const u=(x*screen.cos+y*screen.sin)/screen.cell;
  const v=(-x*screen.sin+y*screen.cos)/screen.cell;
  const dx=Math.abs(u-Math.floor(u)-.5), dy=Math.abs(v-Math.floor(v)-.5);
  const dot=screen.dot;
  if(dot==='square') return bound(4*Math.max(dx,dy)**2,0,1);
  if(dot==='diamond') return bound(2*(dx+dy)**2,0,1);
  if(dot==='line') return bound(2*dy,0,1);
  if(dot==='ellipse') return bound(Math.PI*(1.6*dx*dx+.625*dy*dy),0,1);
  return bound(Math.PI*(dx*dx+dy*dy),0,1);
}
function makeScreen(angle,lpi,ppi,dot) {
  const rad=angle*Math.PI/180;
  return {
    cos:Math.cos(rad),sin:Math.sin(rad),
    cell:Math.max(.01,Number(ppi)||300)/bound(Number(lpi)||35,15,55),
    dot:['circle','ellipse','square','diamond','line'].includes(dot)?dot:'circle',
  };
}
export function createProcessScreens(options={},ppi=300) {
  const angles={...PROCESS_ANGLES,...options.screenAngles};
  const enabled={...PROCESS_ENABLED,...options.screenEnabled};
  const gain=bound(Number(options.screenGain)||0,-20,20)/100;
  const screens={};
  for(const channel of PROCESS_CHANNELS) {
    const a=Number(angles[channel]);
    screens[channel]={...makeScreen(Number.isFinite(a)?a:PROCESS_ANGLES[channel],
      options.lpi,ppi,options.dot),enabled:enabled[channel]!==false};
  }
  screens.view=PROCESS_CHANNELS.includes(options.channelView)?options.channelView:'composite';
  screens.gain=gain;
  return screens;
}
/** Naive geometric RGB->CMYK: screen preview, NOT color managed separation. */
export function cmykCoverage(r,g,b) {
  const [rn,gn,bn]=[r,g,b].map(n=>bound(n/255,0,1));
  const k=1-Math.max(rn,gn,bn);
  if(k>=.999999)return [0,0,0,1];
  return [(1-rn-k)/(1-k),(1-gn-k)/(1-k),(1-bn-k)/(1-k),k].map(n=>bound(n,0,1));
}
export function screenProcessPixel(data,index,x,y,alpha,screens) {
  const cmyk=cmykCoverage(data[index],data[index+1],data[index+2]);
  const mask=[false,false,false,false];
  const a=alpha/255;
  for(let n=0;n<4;n++) {
    const name=PROCESS_CHANNELS[n],screen=screens[name];
    if(!screen.enabled||(screens.view!=='composite'&&screens.view!==name))continue;
    const base=cmyk[n]*a;
    // Dot-gain only changes nonzero midtones. White remains empty and 100% stays solid.
    const tint=base<=0?0:base>=1?1:bound(base+screens.gain,0,1);
    if(tint>0 && spotValue(x+.5,y+.5,screen)<=tint)mask[n]=true;
  }
  if(!mask.some(Boolean)) {
    data[index]=data[index+1]=data[index+2]=data[index+3]=0;
    return false;
  }
  // Display simulated subtractive CMYK ink over transparency; any ink hit is opaque.
  const [c,m,yInk,k]=mask;
  data[index]=c||k?0:255;
  data[index+1]=m||k?0:255;
  data[index+2]=yInk||k?0:255;
  data[index+3]=255;
  return true;
}
export function createColorDotScreen(options={},ppi=300) {
  const angle=Number(options.angle);
  return {...makeScreen(Number.isFinite(angle)?angle:22.5,options.lpi,ppi,options.dot),
    density:bound(Number(options.colorDotDensity)||80,10,100)/100};
}
/** Preserve each source pixel's RGB color, screening only its alpha coverage. */
export function screenColorDotPixel(data,index,x,y,alpha,screen) {
  if(spotValue(x+.5,y+.5,screen)>alpha/255*screen.density) {
    data[index]=data[index+1]=data[index+2]=data[index+3]=0;
    return false;
  }
  data[index+3]=255;return true;
}
export function screenAngleWarnings(options={}) {
  const warnings=[];
  const a={...PROCESS_ANGLES,...options.screenAngles},enabled={...PROCESS_ENABLED,...options.screenEnabled};
  const channels=PROCESS_CHANNELS.filter(name=>enabled[name]!==false);
  for(let i=0;i<channels.length;i++)for(let j=i+1;j<channels.length;j++){
    const u=Number(a[channels[i]]),v=Number(a[channels[j]]);
    if(!Number.isFinite(u)||!Number.isFinite(v)){warnings.push('Invalid channel screen angle.');continue;}
    let difference=Math.abs(u-v)%90;
    difference=Math.min(difference,90-difference);
    if(difference<9)warnings.push(channels[i]+' and '+channels[j]+' screens have nearly matching angles; moiré is likely.');
  }
  return warnings;
}
