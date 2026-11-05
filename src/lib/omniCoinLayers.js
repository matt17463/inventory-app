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
export const COIN_STUDIO_CANDIDATES = {
  brass: {studioMode:'UV Flatbed',materialPreset:'Choose exact metal / brass in Studio',effect:'Flat',
    inkMode:'White+Color',whiteInk:'Rigid white',whiteLayers:1,colorLayers:1,varnishLayers:0,
    precision:'Studio material default',feather:'Studio material default',whiteChoke:'Studio material default',
    textureThicknessMm:null,smoothness:'Studio material default',source:'shop trial candidate'},
  steel: {studioMode:'UV Flatbed',materialPreset:'Choose exact stainless / metal in Studio',effect:'Flat',
    inkMode:'White+Color',whiteInk:'Rigid white',whiteLayers:1,colorLayers:1,varnishLayers:0,
    precision:'Studio material default',feather:'Studio material default',whiteChoke:'Studio material default',
    textureThicknessMm:null,smoothness:'Studio material default',source:'shop trial candidate'}
};
export function buildCoinStudioParameters({material='brass',recipe=null,overrides={}}={}){
  const candidate=COIN_STUDIO_CANDIDATES[material==='steel'?'steel':'brass'];
  // Existing approved recipe values only; reject fields that Studio cannot safely infer.
  const settings=recipe?.status==='approved'&&recipe?.machine_type==='xtool_omni'&&recipe.settings&&typeof recipe.settings==='object'?recipe.settings:{};
  const source=Object.keys(settings).length?'approved material recipe':'shop trial candidate';
  const values={
    studioMode:settings.studio_mode||candidate.studioMode,
    materialPreset:settings.material_preset||candidate.materialPreset,
    effect:settings.print_effect||candidate.effect,
    inkMode:settings.ink_mode||candidate.inkMode,
    whiteInk:settings.white_ink_type||candidate.whiteInk,
    whiteLayers:typeof settings.white_layers==='number'?settings.white_layers:candidate.whiteLayers,
    colorLayers:typeof settings.color_layers==='number'?settings.color_layers:candidate.colorLayers,
    varnishLayers:typeof settings.varnish_layers==='number'?settings.varnish_layers:candidate.varnishLayers,
    textureThicknessMm:typeof settings.target_relief_mm==='number'?settings.target_relief_mm:candidate.textureThicknessMm,
    smoothness:settings.texture_smoothness??candidate.smoothness,
    precision:settings.precision??candidate.precision,
    feather:settings.feather??candidate.feather,
    whiteChoke:settings.white_ink_choke??candidate.whiteChoke
  };
  const allowed=Object.fromEntries(Object.entries(overrides||{}).filter(([k])=>Object.hasOwn(values,k)));
  const result={...values,...allowed};
  for(const key of ['whiteLayers','colorLayers','varnishLayers']){
    const v=Number(result[key]);
    if(!Number.isInteger(v)||v<0||v>20)throw Error(key+' must be an integer from 0 to 20');
    result[key]=v;
  }
  if(result.textureThicknessMm!==null&&result.textureThicknessMm!==''){
    const v=Number(result.textureThicknessMm);
    if(!Number.isFinite(v)||v<0||v>7)throw Error('Texture thickness must be 0–7 mm');
    result.textureThicknessMm=v;
  }else result.textureThicknessMm=null;
  if(!['Flat','Texture','Relief'].includes(result.effect))throw Error('Choose a supported UV printing effect');
  return {values:result,evidence:source,recipeId:source==='approved material recipe'?recipe.id:null,
    notes:['Candidate white/color/varnish counts are proposed comparison values, not manufacturer-verified brass/stainless specifications.',
      'Check Studio live material defaults for precision, feather percentage and white ink choke; do not assume numeric settings.',
      'For Texture or Relief, test height and smoothness on an actual primed coin; relative depth PNG is not physical ink height.',
      'Verify object-by-object processing parameters and By layer order inside xTool Studio.']};
}
export function coinStudioManifest({title,widthMm,heightMm,depthMm,layers,unmatchedPixels=0,processingParameters=null}){
  if(!Number.isFinite(+widthMm)||+widthMm<=0||!Number.isFinite(+heightMm)||+heightMm<=0)
    throw Error('Specify positive dimensions');
  return {
    format:'skilled-crafting-omni-coin-handoff-v1',title:String(title||'Challenge coin'),
    device:'xTool O1 Omni',target:'xTool Studio',widthMm:+widthMm,heightMm:+heightMm,
    relativeReliefOnly:true,designReliefRangeMm:+depthMm,unmatchedPixels,processingParameters,
    operatorInstructions:[
      'Import depth PNG and all transparent color PNGs at the exact listed dimensions; align their centers.',
      'Choose the UV flatbed setup and appropriate tested coin/metal material settings in xTool Studio.',
      'Assign color artwork and relief/texture separately; map actual white, color and varnish passes in Studio.',
      'Open Settings Overview and confirm per-object print parameters: UV Flatbed, material preset, Flat/Texture/Relief, ink mode, rigid white, white/color/varnish layers, precision, feather, white choke and any supported thickness/smoothness.',
      'Set By layer processing if desired, arranging layers top-to-bottom; naming or color alone does not set machine parameters.',
      'Confirm order and per-object print parameters in Studio; this manifest is not an executable printer profile.',
      'Run a physical coin adhesion, relief and registration test before approving production.'
    ],
    layers:layers.map(x=>({id:x.id,name:x.name,color:x.color,process:x.process,order:x.order,
      filename:x.filename||'',pixels:x.pixels}))
  };
}
