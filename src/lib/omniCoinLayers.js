// Browser-only color separation for xTool O1 Omni UV project handoff.
// Produces aligned transparent layers; does not emit xTool proprietary project files or printer commands.
export const DEFAULT_COIN_LAYERS = [
  {id:'base',name:'Base color',color:'#c8a44d',tolerance:75,enabled:true,order:1,process:'CMYK'},
  {id:'detail',name:'Accent / detail',color:'#202020',tolerance:75,enabled:true,order:2,process:'CMYK'},
];
export function normalizeHex(value) {
  if(!/^#[0-9a-f]{6}$/i.test(String(value)))throw Error('Layer colors must be six-digit hex colors');
  return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
}
export function separateCoinColors(image,layers) {
  if(!image||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<=0||image.height<=0||
     image.width*image.height>16_000_000||image.data?.length!==image.width*image.height*4)throw Error('Invalid RGBA artwork');
  if(!Array.isArray(layers)||layers.length<1||layers.length>12)throw Error('Choose 1–12 print layers');
  const active=layers.filter(x=>x.enabled!==false).map((x,i)=>({
    ...x, order:Number.isFinite(Number(x.order))?Number(x.order):i+1,
    rgb:normalizeHex(x.color),tolerance:Number(x.tolerance)
  })).sort((a,b)=>a.order-b.order);
  if(!active.length)throw Error('Enable at least one print layer');
  for(const layer of active)if(!Number.isFinite(layer.tolerance)||layer.tolerance<0||layer.tolerance>255)
    throw Error('Color tolerance must be between 0 and 255');
  const outputs=active.map(layer=>({id:layer.id,name:layer.name,color:layer.color,process:layer.process||'CMYK',
    order:layer.order,data:new Uint8ClampedArray(image.data.length),pixels:0}));
  let unmatched=0;
  for(let i=0;i<image.data.length;i+=4){
    const alpha=image.data[i+3];if(alpha<16)continue;
    let closest=-1,distance=Infinity;
    for(let j=0;j<active.length;j++){
      const c=active[j].rgb;
      const d=Math.hypot(image.data[i]-c[0],image.data[i+1]-c[1],image.data[i+2]-c[2]);
      if(d<distance){distance=d;closest=j;}
    }
    if(closest<0||distance>active[closest].tolerance){unmatched++;continue;}
    const out=outputs[closest];out.data.set(image.data.subarray(i,i+4),i);out.pixels++;
  }
  return {width:image.width,height:image.height,layers:outputs,unmatchedPixels:unmatched};
}
export function coinStudioManifest({title,widthMm,heightMm,depthMm,layers,unmatchedPixels=0}){
  if(!Number.isFinite(+widthMm)||+widthMm<=0||!Number.isFinite(+heightMm)||+heightMm<=0)
    throw Error('Specify positive dimensions');
  return {
    format:'skilled-crafting-omni-coin-handoff-v1',title:String(title||'Challenge coin'),
    device:'xTool O1 Omni',target:'xTool Studio',widthMm:+widthMm,heightMm:+heightMm,
    relativeReliefOnly:true,designReliefRangeMm:+depthMm,unmatchedPixels,
    operatorInstructions:[
      'Import depth PNG and all transparent color PNGs at the exact listed dimensions; align their centers.',
      'Choose the UV flatbed setup and appropriate tested coin/metal material settings in xTool Studio.',
      'Assign color artwork and relief/texture separately; map actual white, color and varnish passes in Studio.',
      'Confirm order and per-object print parameters in Studio; this manifest is not an executable printer profile.',
      'Run a physical coin adhesion, relief and registration test before approving production.'
    ],
    layers:layers.map(x=>({id:x.id,name:x.name,color:x.color,process:x.process,order:x.order,
      filename:x.filename||'',pixels:x.pixels}))
  };
}
