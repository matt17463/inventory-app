import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DTF_DEFAULTS, DTF_DPI, validatePrintDimensions, alphaBounds,
  processDtfPixels, qualityReport, exportDtfPng, vectorSilhouette, cmykToRgb,
} from './lib/dtfStudioEngine';
import { inspectPngAlpha, validateDtfTransparency } from './lib/dtfBackgroundRemoval.js';
import { PROCESS_ANGLES, PROCESS_CHANNELS, screenAngleWarnings } from './lib/dtfMulticolor.js';
import { addArtworkAsset, getMockupProjectBundle, listMockupProjects, signedAssetUrl } from './lib/mockupStudioApi';
import { sourcePoint, validateGuidance } from './lib/dtfMaskGuidance.js';
import { preparedMask } from './lib/dtfMaskClient.js';
import { authenticatedFunctionFetch } from './lib/netlifyFunctionClient.js';
import './DTFPrepStudio.css';

const PRESETS = {
  'Clean logo': { background:'white', halftone:'none', knockout:'none', alphaMode:'hard', defringe:1 },
  'Black shirt': { background:'none', halftone:'knockout', knockout:'shirt', shirtColor:'#000000', alphaMode:'hard', defringe:1 },
  'Colored shirt': { background:'none', halftone:'knockout', knockout:'shirt', alphaMode:'hard', defringe:1 },
  'Fades only': { background:'none', halftone:'fades', knockout:'none', alphaMode:'hard' },
  'Vintage halftone': { background:'none', halftone:'full', knockout:'none', alphaMode:'hard' },
  'CMYK multicolor dots': { background:'none', halftone:'multicolor', knockout:'none', alphaMode:'hard', lpi:35, screenAngles:{...PROCESS_ANGLES}, screenEnabled:{C:true,M:true,Y:true,K:true}, screenGain:0 },
  'Original-color dots': { background:'none', halftone:'color-dots', knockout:'none', alphaMode:'hard', lpi:35, colorDotDensity:80 },
};
function makeCanvas(width,height) {
  const c=document.createElement('canvas');c.width=width;c.height=height;return c;
}
async function renderArtwork(bitmap,opts,maxEdge=0) {
  const target=validatePrintDimensions(opts.width,opts.height);
  const ratio=maxEdge?Math.min(1,maxEdge/Math.max(target.width,target.height)):1;
  const outW=Math.max(1,Math.round(target.width*ratio)),outH=Math.max(1,Math.round(target.height*ratio));
  if(bitmap.width*bitmap.height>24000000)throw Error('Source exceeds the 24-megapixel processing limit.');
  const staged=makeCanvas(bitmap.width,bitmap.height),sc=staged.getContext('2d',{willReadFrequently:true});
  sc.drawImage(bitmap,0,0);
  let bounds={x:0,y:0,width:bitmap.width,height:bitmap.height};
  let backgroundResult={removed:0,softened:0,matched:0,originalHadTransparency:false};
  if(opts.background!=='none'||opts.removeInteriorWhite||opts.crop||opts.maskStrokes?.length||opts.regionPoints?.length){
    const original=sc.getImageData(0,0,staged.width,staged.height);
    const masked=await preparedMask(bitmap,original.data,opts);
    backgroundResult=masked.report;
    sc.putImageData(new ImageData(new Uint8ClampedArray(masked.data),staged.width,staged.height),0,0);
    if(opts.crop)bounds=alphaBounds(masked.data,staged.width,staged.height);
    if(!bounds)throw Error('All visible artwork was removed. Restore details or reduce sensitivity.');
    if((opts.requireMaskReview||backgroundResult.reviewRequired)&&!opts.maskReviewed&&!opts.previewMask)throw Error('Review the working mask and choose Apply reviewed mask before export.');
  }
  if(opts.reviewBounds)bounds=opts.reviewBounds;
  const output=makeCanvas(outW,outH),ctx=output.getContext('2d',{willReadFrequently:true});
  const drawRatio=Math.min(outW*.96/bounds.width,outH*.96/bounds.height);
  const dw=Math.max(1,Math.round(bounds.width*drawRatio)),dh=Math.max(1,Math.round(bounds.height*drawRatio));
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(staged,bounds.x,bounds.y,bounds.width,bounds.height,
    Math.round((outW-dw)/2),Math.round((outH-dh)/2),dw,dh);
  const pixels=ctx.getImageData(0,0,outW,outH);
  // Background removal occurs at original resolution BEFORE resampling and halftones.
  // The proof garment is never drawn into this canvas.
  const stats=processDtfPixels(pixels.data,outW,outH,{...opts,background:'none'},DTF_DPI*ratio);
  const finalAlpha=inspectPngAlpha(pixels.data,outW,outH);
  validateDtfTransparency({settings:opts,report:backgroundResult,finalAlpha});
  stats.removedBackground=backgroundResult.removed;
  stats.softenedBackground=backgroundResult.softened;
  ctx.putImageData(pixels,0,0);
  return {canvas:output,pixels,stats,backgroundResult,finalAlpha,
    sourceWidth:bounds.width,sourceHeight:bounds.height,dimensions:target,bounds};
}
function download(blob,name){
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function field(label,children){return <label className="dtf-field"><span>{label}</span>{children}</label>;}
function Tuning({title,children}){return <details className="dtf-panel" open><summary>{title}</summary><div className="dtf-panel-content">{children}</div></details>;}
function Slider({label,value,onChange,min=0,max=100,step=1}) {
  return <label className="dtf-field"><span>{label}<strong>{value}</strong></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
}
const baseName=s=>String(s||'artwork').replace(/\.[^.]*$/,'').replace(/[^\w-]+/g,'-').slice(0,68);
export default function DTFPrepStudio(){
  const [opts,setOpts]=useState({...DTF_DEFAULTS,regionPoints:[]});
  const [aiState,setAiState]=useState('Ready'),[aiError,setAiError]=useState('');
  const [renderedOpts,setRenderedOpts]=useState(null),[maskNeedsReview,setMaskNeedsReview]=useState(false);
  const [aiIntent,setAiIntent]=useState('keep');
  const [regionTool,setRegionTool]=useState('remove'),[zoom,setZoom]=useState(1);
  const [compare,setCompare]=useState(false),[beforeUrl,setBeforeUrl]=useState(''),[split,setSplit]=useState(50);
  const [history,setHistory]=useState([]),[future,setFuture]=useState([]);
  const revisionRef=useRef(0),panRef=useRef(null);
  function record(){setHistory(h=>[...h.slice(-49),opts]);setFuture([]);}
  function maskChange(k,v){change(k,v);}
  function undo(){if(!history.length)return;revisionRef.current++;setFuture(f=>[opts,...f]);setOpts(history.at(-1));setHistory(h=>h.slice(0,-1));setSavedPrepared('');}
  function redo(){if(!future.length)return;revisionRef.current++;setHistory(h=>[...h,opts]);setOpts(future[0]);setFuture(f=>f.slice(1));setSavedPrepared('');}
  const [file,setFile]=useState(null),[bitmap,setBitmap]=useState(null);
  const [sourceUrl,setSourceUrl]=useState(''),[proofUrl,setProofUrl]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[report,setReport]=useState(null);
  const [projects,setProjects]=useState([]),[projectId,setProjectId]=useState(''),[bundle,setBundle]=useState(null);
  const [savedSource,setSavedSource]=useState(''),[savedPrepared,setSavedPrepared]=useState('');
  const [assetId,setAssetId]=useState(''),[garmentId,setGarmentId]=useState(''),[garmentUrls,setGarmentUrls]=useState({});
  const [proofMode,setProofMode]=useState('checker'),[proofColor,setProofColor]=useState('#161b25');
  const [colorMode,setColorMode]=useState('rgb'),[cmyk,setCmyk]=useState([0,0,0,95]);
  const [channelView,setChannelView]=useState('composite');
  const [garmentScale,setGarmentScale]=useState(45),[garmentTop,setGarmentTop]=useState(38);
  const [sourceMeta,setSourceMeta]=useState(null),[vectorColor,setVectorColor]=useState('#ffffff');
  const imgRef=useRef(null),currentRef=useRef(0),reportRef=useRef(null);
  const maskDraggingRef=useRef(false),maskLastRef=useRef(null);
  const change=(k,v)=>{if(!['maskTool','maskBrushSize'].includes(k)){setHistory(h=>[...h.slice(-49),opts]);setFuture([]);}revisionRef.current++;setOpts(o=>({...o,[k]:v,maskReviewed:false}));setSavedPrepared('');};
  const changeChannel=(section,channel,value)=>{
    setOpts(o=>({...o,[section]:{...o[section],[channel]:value}}));
    setSavedPrepared('');
  };
  const channelWarnings=useMemo(()=>opts.halftone==='multicolor'?screenAngleWarnings(opts):[],[opts]);
  function chooseSource(nextFile) {
    if(nextFile&&(!['image/png','image/jpeg','image/webp'].includes(nextFile.type)||nextFile.size>20*1024*1024)){setMessage('Choose a PNG, JPEG or WebP up to 20 MB.');return;}
    revisionRef.current++;setBitmap(null);setFile(nextFile);setSavedSource('');setSavedPrepared('');setHistory([]);setFuture([]);setAiState('Ready');setAiError('');setZoom(1);
    setOpts(o=>({...o,backgroundPoint:null,regionPoints:[],aiGuidance:null,requireMaskReview:false,maskReviewed:false,maskStrokes:[],removeInteriorWhite:false,background:['pick','ai'].includes(o.background)?'none':o.background}));
  }
  function pickBackground(event) {
    if(regionTool==='pan'||opts.maskTool!=='none'||!bitmap)return;
    const point=sourcePoint(event.currentTarget.getBoundingClientRect(),bitmap.width,bitmap.height,event.clientX,event.clientY);
    if(!point)return;
    if((opts.regionPoints||[]).length>=96){setMessage('Maximum 96 region selections. Clear points or save a revision.');return;}
    record();revisionRef.current++;
    setOpts(o=>({...o,background:o.background==='none'&&regionTool==='remove'?'pick':o.background,backgroundPoint:point,regionPoints:[...(o.regionPoints||[]),{...point,kind:regionTool}],maskReviewed:false}));
    setSavedPrepared('');
  }
  async function requestAi(){
    const revision=revisionRef.current,source=bitmap;
    setAiState('Analyzing');setAiError('');
    try{
      const ratio=Math.min(1,768/Math.max(source.width,source.height)),c=makeCanvas(Math.max(1,Math.round(source.width*ratio)),Math.max(1,Math.round(source.height*ratio)));
      c.getContext('2d').drawImage(source,0,0,c.width,c.height);
      const response=await authenticatedFunctionFetch('/.netlify/functions/dtf-ai-guidance',{method:'POST',body:JSON.stringify({image:c.toDataURL('image/png').split(',')[1],mimeType:'image/png'}),signal:AbortSignal.timeout(30000)});
      const data=await response.json();if(!response.ok)throw Error(data.message||'Gemini unavailable. Use local removal.');
      if(revisionRef.current!==revision){setAiState('Correction needed');setAiError('Source or settings changed during analysis. Request a new preview.');return;}
      const guidance={...validateGuidance(data),provenance:data.provenance};
      // Conservative intent offers only exterior candidates; all-background includes interior proposals.
      if(aiIntent==='keep')guidance.points=guidance.points.filter(p=>p.kind==='keep'||p.x<.06||p.x>.94||p.y<.06||p.y>.94);
      validateGuidance(guidance);
      record();setAiState('Generating mask');
      setOpts(o=>({...o,background:'ai',aiGuidance:guidance,removeInteriorWhite:false,requireMaskReview:true,maskReviewed:false}));setSavedPrepared('');
    }catch(e){setAiState(/quota/i.test(e.message)?'Quota reached':'Provider unavailable');setAiError(e.message+' Manual and local methods remain available.');}
  }
  function paintMask(event) {
    if(!bitmap||!['erase','restore'].includes(opts.maskTool))return;
    const point=sourcePoint(event.currentTarget.getBoundingClientRect(),bitmap.width,bitmap.height,event.clientX,event.clientY);
    if(!point)return;const {x,y}=point;
    if((opts.maskStrokes||[]).length>=2000){setMessage('Brush limit reached. Save a revision or clear the mask; earlier edits have been retained.');return;}
    const radius=Math.max(1,Math.min(600,Number(opts.maskBrushSize)||28));
    const last=maskLastRef.current;
    if(last&&Math.hypot(last.x-x,last.y-y)<Math.max(2,radius*.27))return;
    maskLastRef.current={x,y};
    const distance=last?Math.hypot(last.x-x,last.y-y):0,steps=Math.max(1,Math.ceil(distance/Math.max(1,radius*.5)));
    const marks=Array.from({length:steps},(_,i)=>({kind:opts.maskTool,x:last?last.x+(x-last.x)*(i+1)/steps:x,y:last?last.y+(y-last.y)*(i+1)/steps:y,r:radius}));
    revisionRef.current++;setOpts(o=>({...o,maskReviewed:false,maskStrokes:[...(o.maskStrokes||[]),...marks.slice(0,2000-(o.maskStrokes||[]).length)]}));
    setSavedPrepared('');
  }
  function startMask(event) {
    if(regionTool==='pan'){event.preventDefault();panRef.current={x:event.clientX,y:event.clientY,left:event.currentTarget.parentElement.scrollLeft,top:event.currentTarget.parentElement.scrollTop};event.currentTarget.setPointerCapture?.(event.pointerId);return;}
    if(!['erase','restore'].includes(opts.maskTool))return;
    record();event.preventDefault();maskDraggingRef.current=true;maskLastRef.current=null;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    paintMask(event);
  }
  function finishMask(){maskDraggingRef.current=false;maskLastRef.current=null;panRef.current=null;}
  useEffect(()=>{listMockupProjects().then(setProjects).catch(e=>setMessage('Project list: '+e.message));},[]);
  useEffect(()=>{
    if(!projectId){setBundle(null);setGarmentUrls({});return;}
    let active=true;getMockupProjectBundle(projectId).then(b=>{if(active)setBundle(b);}).catch(e=>{if(active)setMessage(e.message);});
    return ()=>{active=false;};
  },[projectId]);
  useEffect(()=>{
    let active=true;setGarmentUrls({});
    if(!bundle?.blanks?.length)return;
    Promise.all(bundle.blanks.map(async row=>{
      try{return [row.id,await signedAssetUrl(row,3600,{preferPreview:true})||row.source_url||''];}
      catch{return [row.id,row.source_url||''];}
    })).then(pairs=>{if(active)setGarmentUrls(Object.fromEntries(pairs));});
    return ()=>{active=false;};
  },[bundle]);
  useEffect(()=>{
    if(!file){setBitmap(null);setSourceUrl('');setSourceMeta(null);return;}
    let active=true;const url=URL.createObjectURL(file);setSourceUrl(url);
    createImageBitmap(file).then(b=>{if(b.width*b.height>24000000){b.close();throw Error('Source exceeds the 24-megapixel processing limit.');}if(active){setBitmap(b);setSourceMeta({width:b.width,height:b.height});}else b.close();})
      .catch(e=>{if(active)setMessage('Could not decode image: '+e.message);});
    return ()=>{active=false;URL.revokeObjectURL(url);};
  },[file]);
  useEffect(()=>{return ()=>{if(bitmap)bitmap.close?.();};},[bitmap]);
  useEffect(()=>{
    if(!bitmap){setProofUrl('');setReport(null);return;}
    const number=++currentRef.current;
    const timeout=setTimeout(async()=>{
      try{
        const render=await renderArtwork(bitmap,{...opts,channelView,previewMask:true},950);
        if(number!==currentRef.current)return;
        const url=render.canvas.toDataURL('image/png');
        setProofUrl(url);setRenderedOpts(opts);setMaskNeedsReview(render.backgroundResult.reviewRequired);
        if(compare){const before=await renderArtwork(bitmap,{...opts,background:'none',removeInteriorWhite:false,regionPoints:[],maskStrokes:[],requireMaskReview:false,reviewBounds:render.bounds,channelView},950);if(number!==currentRef.current)return;setBeforeUrl(before.canvas.toDataURL('image/png'));}
        setReport(qualityReport(render.sourceWidth,render.sourceHeight,render.dimensions.width,render.dimensions.height,render.stats,opts));
        reportRef.current=render.stats;
        if(opts.background==='ai')setAiState(opts.maskReviewed?'Applied':render.backgroundResult.reviewRequired?'Correction needed':'Preview ready');
        setMessage('');
      }catch(e){if(number===currentRef.current){setRenderedOpts(null);if(opts.background==='ai')setAiState('Correction needed');setProofUrl('');setReport(null);setMessage(e.message);}}
    },140);
    return ()=>{clearTimeout(timeout);if(currentRef.current===number)currentRef.current=number+1;};
  },[bitmap,opts,channelView,compare]);
  async function loadR2(){
    const selected=bundle?.artwork?.find(r=>r.id===assetId);
    if(!selected)return;
    const row=selected.metadata?.role==='derived'?bundle.artwork.find(r=>r.id===selected.metadata.source_artwork_asset_id):selected;
    if(!row){setMessage('The immutable source for this derivative is unavailable. Load its original before replaying the mask.');return;}
    setBusy(true);
    try{
      const url=await signedAssetUrl(row,3600,{preferPreview:false})||row.source_url;
      if(!url)throw Error('This artwork record has no downloadable source.');
      const res=await fetch(url);
      if(!res.ok)throw Error('Could not download artwork ('+res.status+').');
      const blob=await res.blob();
      if(!blob.type.startsWith('image/')||!['image/png','image/jpeg','image/webp'].includes(blob.type))
        throw Error('Choose a PNG, JPEG or WebP artwork asset.');
      chooseSource(new File([blob],row.original_file_name||row.artwork_name||'r2-artwork.png',{type:blob.type}));
      setSavedSource(row.id);setSavedPrepared('');
      if(selected.metadata?.recipe && typeof selected.metadata.recipe==='object')setOpts(o=>({...o,...selected.metadata.recipe,maskReviewed:false}));
    }catch(e){setMessage('R2 artwork: '+e.message);}finally{setBusy(false);}
  }
  async function prepareFull(){
    if(!bitmap)throw Error('Upload an image first.');
    // Preview-only channel isolation must never leak into an exported or saved file.
    return renderArtwork(bitmap,{...opts,channelView:'composite'});
  }
  async function downloadPng(){
    setBusy(true);
    try{
      const render=await prepareFull(),blob=await exportDtfPng(render.canvas);
      download(blob,baseName(file.name)+'-dtf-'+opts.width+'x'+opts.height+'-300dpi.png');
      setMessage('300 PPI RGBA PNG exported with actual transparency. Background removed: '+render.backgroundResult.removed.toLocaleString()+' source pixels. Inspect checkerboard and verify in your RIP.');
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  async function downloadVector(){
    setBusy(true);
    try{
      const render=await renderArtwork(bitmap,{...opts,channelView:'composite'},850),svg=vectorSilhouette(render.pixels.data,render.canvas.width,render.canvas.height,vectorColor,12000,DTF_DPI*render.canvas.width/render.dimensions.width);
      download(new Blob([svg],{type:'image/svg+xml'}),baseName(file.name)+'-one-color-outline.svg');
      setMessage('One-color silhouette SVG exported for limited solid artwork. This is not a faithful full-color vectorization.');
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  async function saveR2(){
    if(!file||!projectId)return;
    setBusy(true);
    try{
      const render=await prepareFull(),blob=await exportDtfPng(render.canvas);
      let sourceId=savedSource;
      if(!sourceId){
        const s=await addArtworkAsset({projectId,file,values:{
          artwork_name:baseName(file.name)+' — original (DTF Studio)',pixel_width:sourceMeta.width,
          pixel_height:sourceMeta.height,has_transparency:file.type==='image/png',preflight_status:'pending',
          exact_artwork_locked:true,metadata:{dtf_studio:'v1',role:'immutable_source'} }});
        sourceId=s.id;setSavedSource(sourceId);
      }
      const prepared=new File([blob],baseName(file.name)+'-dtf-studio-300dpi.png',{type:'image/png'});
      const r=await addArtworkAsset({projectId,file:prepared,values:{
        artwork_name:prepared.name,pixel_width:render.canvas.width,pixel_height:render.canvas.height,
        has_transparency:render.finalAlpha.hasTransparency,background_removed:render.backgroundResult.removed>0,
        preflight_status:'warning',preflight_notes:'DTF Studio derivative — manual artwork and transfer approval required',
        exact_artwork_locked:true,metadata:{
          dtf_studio:'v1',role:'derived',source_artwork_asset_id:sourceId,recipe:{...opts},
          background_removal:{...render.backgroundResult},output_alpha:{...render.finalAlpha},
          resolution:qualityReport(render.sourceWidth,render.sourceHeight,render.canvas.width,render.canvas.height,render.stats,opts),
          dpi:DTF_DPI,requires_visual_approval:true,approved_for_production:false
        }}});
      setSavedPrepared(r.id);setMessage('Source and prepared revision stored with project artwork in R2. The new derivative requires review before use.');
      const b=await getMockupProjectBundle(projectId);setBundle(b);
    }catch(e){setMessage('Save failed: '+e.message+'; any source already saved remains in the project.');}
    finally{setBusy(false);}
  }
  const garment=bundle?.blanks?.find(b=>b.id===garmentId);
  const target=useMemo(()=>{try{return validatePrintDimensions(opts.width,opts.height);}catch{return null;}},[opts.width,opts.height]);
  const bgValue=colorMode==='cmyk'?'#'+cmykToRgb(...cmyk).map(v=>v.toString(16).padStart(2,'0')).join(''):proofColor;
  return <main className="dtf-studio">
    <header className="dtf-head">
      <div><p className="dtf-eyebrow">SKILLED CRAFTING / ARTWORK ENGINE</p><h1>DTF Prep Studio</h1>
        <p>Non-destructive production preparation · original artwork stays unchanged</p></div>
      <div className="dtf-head-actions">
        <Link to="/artwork-preflight">Basic preflight</Link><Link to="/client-graphics">Client graphics</Link>
        <button onClick={downloadPng} disabled={!bitmap||busy}>↓ Export 300 PPI PNG</button>
      </div>
    </header>
    <div className="dtf-workspace">
      <section className="dtf-viewer">
        <div className="dtf-canvasbar"><strong>01 / ORIGINAL SOURCE</strong><span>{sourceMeta?sourceMeta.width+' × '+sourceMeta.height+' px':'No source'}</span></div>
        <div className="dtf-canvas dtf-source" style={{overflow:'auto',display:'block'}}>
          {sourceUrl?<><img ref={imgRef} alt="Original source artwork; click background to remove when Pick mode is selected" src={sourceUrl} style={{maxWidth:'none',maxHeight:'none',width:zoom*100+'%',height:zoom*100+'%',flexShrink:0}} draggable={false} className={opts.background==='pick'||opts.maskTool!=='none'?'dtf-source-picker':''} title={opts.maskTool!=='none'?'Drag on Source to paint the working mask':opts.background==='pick'?'Click the background color to remove':'Original unchanged'} onClick={pickBackground} onPointerDown={startMask} onPointerMove={e=>{if(panRef.current){const p=panRef.current;e.currentTarget.parentElement.scrollLeft=p.left+p.x-e.clientX;e.currentTarget.parentElement.scrollTop=p.top+p.y-e.clientY;}if(maskDraggingRef.current&&(e.buttons||e.pointerType==='touch'))paintMask(e);}} onPointerUp={finishMask} onPointerCancel={finishMask} onLostPointerCapture={finishMask}/><svg className="dtf-point-overlay" style={{width:zoom*100+'%',height:zoom*100+'%'}} viewBox={'0 0 '+(sourceMeta?.width||1)+' '+(sourceMeta?.height||1)} aria-label="Red points remove regions; green points protect regions">{[...(opts.background==='ai'?(opts.aiGuidance?.points||[]).map(p=>({...p,x:p.x*(sourceMeta?.width||1),y:p.y*(sourceMeta?.height||1)})):[]),...(opts.regionPoints||[])].map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={Math.max(sourceMeta?.width||1,sourceMeta?.height||1)/80} fill={p.kind==='keep'?'#20df99':'#ff4155'} stroke="white" strokeWidth={Math.max(sourceMeta?.width||1,sourceMeta?.height||1)/400}/>)}</svg></>:<label className="dtf-empty">Drop in a customer's artwork<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>chooseSource(e.target.files?.[0]||null)}/></label>}
        </div>
        <div className="dtf-canvasbar"><strong>02 / LIVE PROOF</strong><span>{target?target.width+' × '+target.height+' px':'No canvas'} · 300 PPI</span></div>
        <div className={'dtf-canvas dtf-proof '+(proofMode==='checker'?'dtf-checker':'')}
          style={proofMode==='color'?{background:bgValue}:{}}>
          {proofMode==='garment'&&garmentUrls[garmentId]&&<img className="dtf-garment" src={garmentUrls[garmentId]} alt={garment?.asset_name||'Garment blank'}/>}
          {proofUrl&&<img className={proofMode==='garment'?'dtf-garment-art':'dtf-proof-art'} style={proofMode==='garment'?{width:garmentScale+'%',top:garmentTop+'%'}:{}} src={proofUrl} alt="Processed artwork proof; not a production approval"/>}
          {compare&&beforeUrl&&proofMode!=='garment'&&<img className="dtf-before-overlay" style={{clipPath:'inset(0 '+(100-split)+'% 0 0)'}} src={beforeUrl} alt="Before mask; left side of comparison"/>}
          {!proofUrl&&<p>Processed proof appears here automatically.</p>}
        </div>
        <div className="dtf-review-tools">
          <Slider label="Source zoom" min={1} max={5} step={.25} value={zoom} onChange={setZoom}/>
          {field('Source interaction',<select value={regionTool} onChange={e=>{setRegionTool(e.target.value);change('maskTool','none');}}><option value="remove">Click to remove region</option><option value="keep">Click to keep / restore region</option><option value="pan">Drag to pan</option></select>)}
          <label className="dtf-check"><input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)}/> Before / after split</label>
          {compare&&<Slider label="Comparison split" value={split} onChange={setSplit}/>}
          <p className="dtf-note">{(opts.regionPoints||[]).filter(p=>p.kind==='remove').length} removed region selections · {(opts.regionPoints||[]).filter(p=>p.kind==='keep').length} protected region selections. Points accumulate; keep restores connected source pixels.</p>
        </div>
        <div className="dtf-metrics">
          <span><b>OUTPUT</b> {target?target.width+' × '+target.height+' px':'—'}</span>
          <span><b>NATIVE DETAIL</b> {report?report.estimatedNativeDpi+' PPI':'—'}</span>
          <span><b>HALFTONE</b> {opts.halftone==='none'?'Off':opts.halftone==='multicolor'?'CMYK multicolor · '+opts.lpi+' LPI':opts.halftone==='color-dots'?'Original-color dots · '+opts.lpi+' LPI':opts.lpi+' LPI'}</span>
        </div>
        {report?.warnings?.length>0&&<aside className="dtf-warning"><b>Preflight checks</b><ul>{report.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></aside>}
        <p className="dtf-note">Shirt previews are visual mockups, not color-managed RIP simulations. PNG exports never contain the garment backdrop.</p>
      </section>
      <aside className="dtf-sidebar">
        <Tuning title="Artwork source & R2 library">
          {field('Upload customer artwork',<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>chooseSource(e.target.files?.[0]||null)}/>)}
          {field('Customer / mockup project',<select value={projectId} onChange={e=>{setProjectId(e.target.value);setAssetId('');setGarmentId('');setSavedSource('');setSavedPrepared('');}}><option value="">Choose a project for R2</option>{projects.map(p=><option key={p.id} value={p.id}>{p.project_name} · {p.customer_name||'Internal'}</option>)}</select>)}
          {field('Existing project artwork',<select value={assetId} onChange={e=>setAssetId(e.target.value)}><option value="">Choose an existing source</option>{(bundle?.artwork||[]).map(a=><option key={a.id} value={a.id}>{a.artwork_name}</option>)}</select>)}
          <button className="dtf-secondary" disabled={!assetId||busy} onClick={loadR2}>Load selected R2 artwork</button>
        </Tuning>
        <Tuning title="Print size & actual resolution">
          <div className="dtf-pair">
            {field('Width (in)',<input type="number" min=".25" max="20" step=".25" value={opts.width} onChange={e=>change('width',e.target.value)}/>)}
            {field('Height (in)',<input type="number" min=".25" max="20" step=".25" value={opts.height} onChange={e=>change('height',e.target.value)}/>)}
          </div>
          {field('Quick size',<select value="" onChange={e=>{const [w,h]=e.target.value.split(',');setOpts(o=>({...o,width:w,height:h}));setSavedPrepared('');}}><option value="">Choose print size</option><option value="3.5,3.5">Left chest 3.5″</option><option value="10,10">Full chest 10″</option><option value="12,12">Full 12″ × 12″</option><option value="10,5">Back 10″ × 5″</option><option value="2,8">Sleeve 2″ × 8″</option></select>)}
          <label className="dtf-check"><input type="checkbox" checked={opts.crop} onChange={e=>change('crop',e.target.checked)}/> Crop transparent source margins</label>
          <p className="dtf-note">Output is resampled to true pixel dimensions. Upscaling does not recreate missing source detail.</p>
        </Tuning>
        <Tuning title="Remove background → Transparent PNG">
          <button type="button" className="dtf-remove-action" disabled={!bitmap||aiState==='Analyzing'||aiState==='Generating mask'} onClick={requestAi}>AI Remove Background</button>
          {field('AI intent',<select value={aiIntent} onChange={e=>setAiIntent(e.target.value)}><option value="keep">Keep artwork — exterior guidance</option><option value="all">Remove all unwanted background — include gaps</option></select>)}
          <p className="dtf-note">AI sends a thumbnail to Google Gemini for analysis when invoked. Google free-tier content may be used to improve its products. AI suggests regions; color-based masking keeps original artwork pixels. Photos and ambiguous white details may need correction. Review mask before apply is always enabled.</p>
          <p role="status">{aiState}</p>{aiError&&<p className="dtf-channel-warning" role="alert">{aiError}</p>}
          {maskNeedsReview&&<p className="dtf-channel-warning">The mask may remove meaningful artwork. Inspect red removal points, green keep points and the proof; restore details before applying.</p>}
          {(opts.requireMaskReview||maskNeedsReview)&&<button type="button" disabled={!proofUrl||opts.maskReviewed||renderedOpts!==opts} onClick={()=>{setOpts(o=>({...o,maskReviewed:true}));setSavedPrepared('');setAiState('Applied');}}>Apply reviewed mask</button>}
          <div className="dtf-mask-buttons"><button type="button" disabled={!history.length} onClick={undo}>Undo mask edit</button><button type="button" disabled={!future.length} onClick={redo}>Redo mask edit</button><button type="button" onClick={()=>change('regionPoints',[])}>Clear region points</button></div>
          <button type="button" className="dtf-secondary" disabled={!bitmap} onClick={()=>{record();revisionRef.current++;setOpts(o=>({...o,background:'auto',aiGuidance:null,requireMaskReview:false,maskReviewed:false}));setAiState('Local-method fallback');setSavedPrepared('');}}>Use local edge/color removal</button>
          <button type="button" className="dtf-remove-action" disabled={!bitmap}
            onClick={()=>{record();revisionRef.current++;setOpts(o=>({...o,background:'auto',backgroundPoint:null,backgroundScope:'connected',backgroundFeather:12,requireMaskReview:false,maskReviewed:false}));setSavedPrepared('');}}>
            Remove background automatically
          </button>
          {field('Removal method',<select value={opts.background} onChange={e=>{change('background',e.target.value);}}>
            <option value="none">Keep original background</option>
            <option value="ai">AI Subject/Logo Mask — review required</option>
            <option value="auto">Automatic — dominant edge color</option>
            <option value="white">Remove white / off-white</option>
            <option value="sampled">Remove chosen background color</option>
            <option value="pick">Click a region in Source to remove</option>
          </select>)}
          {opts.background==='pick'&&<p className="dtf-pick-tip"><strong>Click unwanted regions in SOURCE to accumulate removals.</strong> The selected connected region becomes truly transparent. {opts.backgroundPoint?'Selected point: '+opts.backgroundPoint.x+', '+opts.backgroundPoint.y+'. Click another region to add it; use Keep to restore intentional details.':'Choose a background pixel to continue.'}</p>}
          {opts.background==='white'&&<Slider label="White threshold" value={opts.threshold} min={200} max={255} onChange={v=>change('threshold',v)}/>}
          {opts.background==='sampled'&&field('Background RGB color',<input type="color" value={opts.backgroundColor} onChange={e=>change('backgroundColor',e.target.value)}/>)}
          {opts.background!=='none'&&<>
            {opts.background!=='white'&&<Slider label="Color tolerance" value={opts.removalTolerance} min={0} max={150} step={1} onChange={v=>change('removalTolerance',v)}/>}
            <Slider label="Edge softness (source pixels)" value={opts.backgroundFeather??12} min={0} max={40} step={1} onChange={v=>change('backgroundFeather',v)}/>
            {field('Removal coverage',<select value={opts.backgroundScope||'connected'} onChange={e=>change('backgroundScope',e.target.value)}>
              <option value="connected">Connected background only (protect artwork)</option>
              <option value="all">All matching pixels (also removes interior matches)</option>
            </select>)}
            {opts.backgroundScope==='all'&&<p className="dtf-channel-warning">All matching pixels can erase white lettering or other design details. Inspect the proof.</p>}
            <label className="dtf-check"><input type="checkbox" checked={opts.backgroundDecontaminate!==false} onChange={e=>change('backgroundDecontaminate',e.target.checked)}/> Decontaminate edge colors</label>
            {report?.stats&&<div className="dtf-alpha-result"><strong>Real background removal</strong><span>{(report.stats.removedBackground||0).toLocaleString()} source pixels transparent · {(report.stats.softenedBackground||0).toLocaleString()} softened</span></div>}
          </>}
          <div className="dtf-manual-mask">
            <strong>Enclosed background and white holes</strong>
            <label className="dtf-check"><input type="checkbox" checked={!!opts.removeInteriorWhite} onChange={e=>change('removeInteriorWhite',e.target.checked)}/> Remove enclosed white/off-white areas too</label>
            {opts.removeInteriorWhite&&<>
              <Slider label="Interior white minimum brightness" min={205} max={255} value={opts.interiorWhiteThreshold??245} onChange={v=>change('interiorWhiteThreshold',v)}/>
              <Slider label="Interior edge softness" min={0} max={20} value={opts.interiorWhiteFeather??4} onChange={v=>change('interiorWhiteFeather',v)}/>
              <p className="dtf-channel-warning">This removes matching white pixels anywhere, including intentional white text or logos. Inspect the Proof closely and use Restore original design pixels to recover white details.</p>
            </>}
            <button type="button" className="dtf-secondary" disabled={!bitmap} onClick={()=>{setOpts(o=>({...o,background:o.background==='none'?'auto':o.background,removeInteriorWhite:true,interiorWhiteThreshold:245,interiorWhiteFeather:4}));setSavedPrepared('');}}>Clean exterior + enclosed white</button>
          </div>
          <div className="dtf-manual-mask">
            <strong>Manual background cleanup</strong>
            {field('Paint on original Source image',<select value={opts.maskTool||'none'} onChange={e=>{setRegionTool('remove');change('maskTool',e.target.value);}}>
              <option value="none">No brush — select region</option>
              <option value="erase">Erase to transparency</option>
              <option value="restore">Restore original design pixels</option>
            </select>)}
            {opts.maskTool!=='none'&&<Slider label="Brush radius (source pixels)" min={2} max={180} value={opts.maskBrushSize||28} onChange={v=>change('maskBrushSize',v)}/>}
            <div className="dtf-mask-buttons">
              <button type="button" className="dtf-secondary" disabled={!opts.maskStrokes?.length} onClick={undo}>Undo brush stroke</button>
              <button type="button" className="dtf-secondary" disabled={!opts.maskStrokes?.length} onClick={()=>maskChange('maskStrokes',[])}>Clear manual mask</button>
            </div>
            <p className="dtf-note">{(opts.maskStrokes||[]).length} brush marks. Drag on the Source image to modify the working transparency mask; the original source file remains unchanged. Changes appear in Proof.</p>
          </div>
          <Slider label="Defringe" value={opts.defringe} min={0} max={3} step={1} onChange={v=>change('defringe',v)}/>
          {field('Final alpha',<select value={opts.alphaMode} onChange={e=>change('alphaMode',e.target.value)}>
            <option value="hard">DTF hard alpha (opaque or transparent)</option>
            <option value="preserve">Preserve soft edge transparency</option>
          </select>)}
          <Slider label="Alpha cutoff" value={opts.alphaThreshold} min={0} max={254} onChange={v=>change('alphaThreshold',v)}/>
          <p className="dtf-note">Transparency is written to the PNG alpha channel before the 300 PPI export. Checkerboard and garment colors are preview-only. Automatic color selection works best with solid backgrounds; detailed photographic backgrounds may require a manually refined mask.</p>
        </Tuning>
        <Tuning title="Halftones & garment knockout">
          {field('Quick preset',<select value="" onChange={e=>{setOpts(o=>({...o,...PRESETS[e.target.value]}));setSavedPrepared('');}}><option value="">Choose processing preset</option>{Object.keys(PRESETS).map(k=><option key={k}>{k}</option>)}</select>)}
          {field('Halftone style',<select value={opts.halftone} onChange={e=>change('halftone',e.target.value)}><option value="none">Off</option><option value="fades">Transparent gradients only</option><option value="knockout">Shirt-color knockout</option><option value="full">Full halftone (vintage)</option><option value="multicolor">CMYK multicolor rosette (4 channels)</option><option value="color-dots">Original-color dots (RGB)</option></select>)}
          {field('Knockout',<select value={opts.knockout} onChange={e=>change('knockout',e.target.value)}><option value="none">Do not knock out</option><option value="shirt">Remove shirt-matched color</option></select>)}
          {field('Shirt RGB',<input type="color" value={opts.shirtColor} onChange={e=>change('shirtColor',e.target.value)}/>)}
          <Slider label="Knockout tolerance" value={opts.knockoutTolerance} min={1} max={200} onChange={v=>change('knockoutTolerance',v)}/>
          <Slider label="Line frequency (LPI)" value={opts.lpi} min={15} max={55} onChange={v=>change('lpi',v)}/>

          {opts.halftone!=='multicolor'&&<Slider label="Screen angle" value={opts.angle} min={0} max={90} step={2.5} onChange={v=>change('angle',v)}/>}
          {opts.halftone==='color-dots'&&<Slider label="Dot coverage (%)" value={opts.colorDotDensity??80} min={10} max={100} step={5} onChange={v=>change('colorDotDensity',v)}/>}
          {opts.halftone==='multicolor'&&<div className="dtf-color-channels">
            <div className="dtf-channel-title"><strong>CMYK COLOR CHANNELS</strong><button type="button" className="dtf-secondary" onClick={()=>change('screenAngles',{...PROCESS_ANGLES})}>Reset angles</button></div>
            {PROCESS_CHANNELS.map(channel=><div className="dtf-channel-row" key={channel}>
              <label className="dtf-channel-toggle"><input type="checkbox" checked={opts.screenEnabled?.[channel]!==false} onChange={e=>changeChannel('screenEnabled',channel,e.target.checked)}/>
                <span className={'dtf-ink-dot dtf-ink-'+channel.toLowerCase()} aria-hidden="true"/> <strong>{({C:'Cyan',M:'Magenta',Y:'Yellow',K:'Black'})[channel]}</strong>
              </label>
              <label className="dtf-angle-field">Angle (°)<input type="number" min="-180" max="180" step="2.5" value={opts.screenAngles?.[channel]??PROCESS_ANGLES[channel]} onChange={e=>changeChannel('screenAngles',channel,Number(e.target.value))} disabled={opts.screenEnabled?.[channel]===false}/></label>
            </div>)}
            <Slider label="Dot gain compensation (%)" value={opts.screenGain??0} min={-20} max={20} step={1} onChange={v=>change('screenGain',v)}/>
            {field('Proof channel (preview only)',<select value={channelView} onChange={e=>setChannelView(e.target.value)}><option value="composite">Combined four-color proof</option><option value="C">Cyan screen only</option><option value="M">Magenta screen only</option><option value="Y">Yellow screen only</option><option value="K">Black screen only</option></select>)}
            {channelWarnings.length>0&&<p className="dtf-channel-warning" role="alert">{channelWarnings.join(' ')}</p>}
            <p className="dtf-note">This creates a CMYK-style rosette as fully opaque RGB dots on transparency. It is not an ICC conversion, actual CMYK ink separation, or white-ink channel. Export always uses combined enabled colors regardless of proof channel.</p>
          </div>}
          {field('Dot shape',<select value={opts.dot} onChange={e=>change('dot',e.target.value)}>{['circle','ellipse','diamond','square','line'].map(s=><option key={s} value={s}>{s}</option>)}</select>)}
          <p className="dtf-note">Start with a printed calibration sheet to determine your RIP/provider's minimum viable dot. The RIP may screen or resample the PNG again.</p>
        </Tuning>
        <Tuning title="Tonal adjustments">
          <Slider label="Black point" value={opts.blackPoint} max={230} onChange={v=>change('blackPoint',v)}/>
          <Slider label="White point" value={opts.whitePoint} min={24} max={255} onChange={v=>change('whitePoint',v)}/>
          <Slider label="Gamma" value={opts.gamma} min={.3} max={3} step={.05} onChange={v=>change('gamma',v)}/>
          <Slider label="Sharpen" value={opts.sharpen} min={0} max={2} step={.1} onChange={v=>change('sharpen',v)}/>
        </Tuning>
        <Tuning title="Proof backdrop & garment mockup">
          {field('Proof background',<select value={proofMode} onChange={e=>setProofMode(e.target.value)}><option value="checker">Transparency checkerboard</option><option value="color">Solid RGB / CMYK preview</option><option value="garment">R2 garment photo</option></select>)}
          {proofMode==='color'&&<>
            {field('Preview color entry',<select value={colorMode} onChange={e=>setColorMode(e.target.value)}><option value="rgb">RGB</option><option value="cmyk">CMYK (approximate screen preview)</option></select>)}
            {colorMode==='rgb'?<input type="color" value={proofColor} onChange={e=>setProofColor(e.target.value)}/>:<div className="dtf-quad">{['C','M','Y','K'].map((ch,i)=>field(ch,<input key={ch} aria-label={'CMYK '+ch} type="number" min="0" max="100" value={cmyk[i]} onChange={e=>setCmyk(arr=>arr.map((v,j)=>i===j?Number(e.target.value):v))}/>))}</div>}
          </>}
          {proofMode==='garment'&&<>
            {field('Blank garment in selected project',<select value={garmentId} onChange={e=>setGarmentId(e.target.value)}><option value="">Select garment blank</option>{(bundle?.blanks||[]).map(b=><option key={b.id} value={b.id}>{b.asset_name} · {b.product_color||'Color unspecified'}</option>)}</select>)}
            <Slider label="Art scale on mockup (%)" min={10} max={85} value={garmentScale} onChange={setGarmentScale}/>
            <Slider label="Print center from top (%)" min={10} max={85} value={garmentTop} onChange={setGarmentTop}/>
          </>}
        </Tuning>
        <Tuning title="Export and save revision">
          <button onClick={downloadPng} disabled={!bitmap||busy}>Export transparent 300 PPI PNG</button>
          {field('Single-color silhouette vector fill',<input type="color" value={vectorColor} onChange={e=>setVectorColor(e.target.value)}/>)}
          <button className="dtf-secondary" onClick={downloadVector} disabled={!bitmap||busy}>Export one-color SVG silhouette</button>
          <button className="dtf-secondary" onClick={saveR2} disabled={!bitmap||!projectId||busy||Boolean(savedPrepared)}>{savedPrepared?'Revision saved in R2':'Save source + new derivative to R2'}</button>
          <p className="dtf-note">Saving never replaces an approved production asset. Derived files are marked for review. PNG is RGB/RGBA; true ICC CMYK conversion and white-channel separation require RIP-specific workflows.</p>
          {savedPrepared&&<p className="dtf-good">Saved artwork revision <code>{savedPrepared.slice(0,8)}</code> · <Link to="/mockup-studio">Open project</Link></p>}
        </Tuning>
        <button className="dtf-reset" onClick={()=>{record();revisionRef.current++;setOpts({...DTF_DEFAULTS,regionPoints:[]});setAiState('Ready');setAiError('');setSavedPrepared('');}}>Reset adjustments</button>
      </aside>
    </div>
    {busy&&<div role="status" className="dtf-progress">Preparing full-resolution artwork or transferring R2 asset…</div>}
    {message&&<p role="status" className="dtf-message">{message}</p>}
  </main>;
}
