import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DTF_DEFAULTS, DTF_DPI, validatePrintDimensions, alphaBounds, removeEdgeColor,
  processDtfPixels, qualityReport, exportDtfPng, vectorSilhouette, cmykToRgb,
} from './lib/dtfStudioEngine';
import { removeEdgeConnectedWhite } from './lib/dtfPreflight';
import { addArtworkAsset, getMockupProjectBundle, listMockupProjects, signedAssetUrl } from './lib/mockupStudioApi';
import './DTFPrepStudio.css';

const PRESETS = {
  'Clean logo': { background:'white', halftone:'none', knockout:'none', alphaMode:'hard', defringe:1 },
  'Black shirt': { background:'none', halftone:'knockout', knockout:'shirt', shirtColor:'#000000', alphaMode:'hard', defringe:1 },
  'Colored shirt': { background:'none', halftone:'knockout', knockout:'shirt', alphaMode:'hard', defringe:1 },
  'Fades only': { background:'none', halftone:'fades', knockout:'none', alphaMode:'hard' },
  'Vintage halftone': { background:'none', halftone:'full', knockout:'none', alphaMode:'hard' },
};
function makeCanvas(width,height) {
  const c=document.createElement('canvas');c.width=width;c.height=height;return c;
}
function renderArtwork(bitmap, opts, maxEdge=0) {
  const target=validatePrintDimensions(opts.width,opts.height);
  const ratio=maxEdge?Math.min(1,maxEdge/Math.max(target.width,target.height)):1;
  const outW=Math.max(1,Math.round(target.width*ratio)),outH=Math.max(1,Math.round(target.height*ratio));
  if(bitmap.width*bitmap.height>24000000)throw Error('Source exceeds the 24-megapixel processing limit.');
  const staged=makeCanvas(bitmap.width,bitmap.height),sc=staged.getContext('2d',{willReadFrequently:true});
  sc.drawImage(bitmap,0,0);
  let bounds={x:0,y:0,width:bitmap.width,height:bitmap.height};
  if(opts.background!=='none'||opts.crop){
    const p=sc.getImageData(0,0,staged.width,staged.height);
    if(opts.background==='white')removeEdgeConnectedWhite(p.data,staged.width,staged.height,Number(opts.threshold));
    if(opts.background==='sampled')removeEdgeColor(p.data,staged.width,staged.height,
      [0,2,4].map(i=>parseInt(opts.backgroundColor.slice(1).slice(i,i+2),16)),Number(opts.removalTolerance));
    sc.putImageData(p,0,0);
    if(opts.crop)bounds=alphaBounds(p.data,staged.width,staged.height);
    if(!bounds)throw Error('All visible artwork was removed. Reduce the background threshold.');
  }
  const output=makeCanvas(outW,outH),ctx=output.getContext('2d',{willReadFrequently:true});
  const drawRatio=Math.min(outW*.96/bounds.width,outH*.96/bounds.height);
  const dw=Math.max(1,Math.round(bounds.width*drawRatio)),dh=Math.max(1,Math.round(bounds.height*drawRatio));
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(staged,bounds.x,bounds.y,bounds.width,bounds.height,
    Math.round((outW-dw)/2),Math.round((outH-dh)/2),dw,dh);
  const pixels=ctx.getImageData(0,0,outW,outH);
  // The background has already been removed on the native source; never flood the
  // final canvas again, as that can erase isolated white artwork after resampling.
  const stats=processDtfPixels(pixels.data,outW,outH,{...opts,background:'none'},DTF_DPI*ratio);
  ctx.putImageData(pixels,0,0);
  return {canvas:output,pixels,stats,sourceWidth:bounds.width,sourceHeight:bounds.height,dimensions:target};
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
  const [opts,setOpts]=useState({...DTF_DEFAULTS});
  const [file,setFile]=useState(null),[bitmap,setBitmap]=useState(null);
  const [sourceUrl,setSourceUrl]=useState(''),[proofUrl,setProofUrl]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[report,setReport]=useState(null);
  const [projects,setProjects]=useState([]),[projectId,setProjectId]=useState(''),[bundle,setBundle]=useState(null);
  const [savedSource,setSavedSource]=useState(''),[savedPrepared,setSavedPrepared]=useState('');
  const [assetId,setAssetId]=useState(''),[garmentId,setGarmentId]=useState(''),[garmentUrls,setGarmentUrls]=useState({});
  const [proofMode,setProofMode]=useState('checker'),[proofColor,setProofColor]=useState('#161b25');
  const [colorMode,setColorMode]=useState('rgb'),[cmyk,setCmyk]=useState([0,0,0,95]);
  const [garmentScale,setGarmentScale]=useState(45),[garmentTop,setGarmentTop]=useState(38);
  const [sourceMeta,setSourceMeta]=useState(null),[vectorColor,setVectorColor]=useState('#ffffff');
  const imgRef=useRef(null),currentRef=useRef(0),reportRef=useRef(null);
  const change=(k,v)=>{setOpts(o=>({...o,[k]:v}));setSavedPrepared('');};
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
    createImageBitmap(file).then(b=>{if(active){setBitmap(b);setSourceMeta({width:b.width,height:b.height});}else b.close();})
      .catch(e=>{if(active)setMessage('Could not decode image: '+e.message);});
    return ()=>{active=false;URL.revokeObjectURL(url);};
  },[file]);
  useEffect(()=>{return ()=>{if(bitmap)bitmap.close?.();};},[bitmap]);
  useEffect(()=>{
    if(!bitmap){setProofUrl('');setReport(null);return;}
    const number=++currentRef.current;
    const timeout=setTimeout(()=>{
      try{
        const render=renderArtwork(bitmap,opts,950);
        if(number!==currentRef.current)return;
        const url=render.canvas.toDataURL('image/png');
        setProofUrl(url);
        setReport(qualityReport(render.sourceWidth,render.sourceHeight,render.dimensions.width,render.dimensions.height,render.stats,opts));
        reportRef.current=render.stats;
        setMessage('');
      }catch(e){if(number===currentRef.current){setProofUrl('');setReport(null);setMessage(e.message);}}
    },140);
    return ()=>{clearTimeout(timeout);currentRef.current++;};
  },[bitmap,opts]);
  async function loadR2(){
    const row=bundle?.artwork?.find(r=>r.id===assetId);
    if(!row)return;
    setBusy(true);
    try{
      const url=await signedAssetUrl(row,3600,{preferPreview:false})||row.source_url;
      if(!url)throw Error('This artwork record has no downloadable source.');
      const res=await fetch(url);
      if(!res.ok)throw Error('Could not download artwork ('+res.status+').');
      const blob=await res.blob();
      if(!blob.type.startsWith('image/')||!['image/png','image/jpeg','image/webp'].includes(blob.type))
        throw Error('Choose a PNG, JPEG or WebP artwork asset.');
      setFile(new File([blob],row.original_file_name||row.artwork_name||'r2-artwork.png',{type:blob.type}));
      setSavedSource(row.id);setSavedPrepared('');
      if(row.metadata?.recipe && typeof row.metadata.recipe==='object')setOpts(o=>({...o,...row.metadata.recipe}));
    }catch(e){setMessage('R2 artwork: '+e.message);}finally{setBusy(false);}
  }
  async function prepareFull(){
    if(!bitmap)throw Error('Upload an image first.');
    return renderArtwork(bitmap,opts);
  }
  async function downloadPng(){
    setBusy(true);
    try{
      const render=await prepareFull(),blob=await exportDtfPng(render.canvas);
      download(blob,baseName(file.name)+'-dtf-'+opts.width+'x'+opts.height+'-300dpi.png');
      setMessage('300 PPI PNG exported. Review in your RIP and complete a physical test before production.');
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  async function downloadVector(){
    setBusy(true);
    try{
      const render=renderArtwork(bitmap,opts,850),svg=vectorSilhouette(render.pixels.data,render.canvas.width,render.canvas.height,vectorColor,12000,DTF_DPI*render.canvas.width/render.dimensions.width);
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
        has_transparency:true,background_removed:opts.background!=='none',
        preflight_status:'warning',preflight_notes:'DTF Studio derivative — manual artwork and transfer approval required',
        exact_artwork_locked:true,metadata:{
          dtf_studio:'v1',role:'derived',source_artwork_asset_id:sourceId,recipe:{...opts},
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
        <div className="dtf-canvas dtf-source">
          {sourceUrl?<img ref={imgRef} alt="Original source artwork" src={sourceUrl}/>:<label className="dtf-empty">Drop in a customer's artwork<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{setSavedSource('');setSavedPrepared('');setFile(e.target.files?.[0]||null);}}/></label>}
        </div>
        <div className="dtf-canvasbar"><strong>02 / LIVE PROOF</strong><span>{target?target.width+' × '+target.height+' px':'No canvas'} · 300 PPI</span></div>
        <div className={'dtf-canvas dtf-proof '+(proofMode==='checker'?'dtf-checker':'')}
          style={proofMode==='color'?{background:bgValue}:{}}>
          {proofMode==='garment'&&garmentUrls[garmentId]&&<img className="dtf-garment" src={garmentUrls[garmentId]} alt={garment?.asset_name||'Garment blank'}/>}
          {proofUrl&&<img className={proofMode==='garment'?'dtf-garment-art':'dtf-proof-art'} style={proofMode==='garment'?{width:garmentScale+'%',top:garmentTop+'%'}:{}} src={proofUrl} alt="Processed artwork proof; not a production approval"/>}
          {!proofUrl&&<p>Processed proof appears here automatically.</p>}
        </div>
        <div className="dtf-metrics">
          <span><b>OUTPUT</b> {target?target.width+' × '+target.height+' px':'—'}</span>
          <span><b>NATIVE DETAIL</b> {report?report.estimatedNativeDpi+' PPI':'—'}</span>
          <span><b>HALFTONE</b> {opts.halftone==='none'?'Off':opts.lpi+' LPI'}</span>
        </div>
        {report?.warnings?.length>0&&<aside className="dtf-warning"><b>Preflight checks</b><ul>{report.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></aside>}
        <p className="dtf-note">Shirt previews are visual mockups, not color-managed RIP simulations. PNG exports never contain the garment backdrop.</p>
      </section>
      <aside className="dtf-sidebar">
        <Tuning title="Artwork source & R2 library">
          {field('Upload customer artwork',<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{setSavedSource('');setSavedPrepared('');setFile(e.target.files?.[0]||null);}}/>)}
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
        <Tuning title="Background & edge removal">
          {field('Remove background',<select value={opts.background} onChange={e=>change('background',e.target.value)}>
            <option value="none">Keep original</option><option value="white">Connected near-white</option><option value="sampled">Connected selected color</option>
          </select>)}
          {opts.background==='white'&&<Slider label="White threshold" value={opts.threshold} min={200} max={255} onChange={v=>change('threshold',v)}/>}
          {opts.background==='sampled'&&<>{field('Background RGB',<input type="color" value={opts.backgroundColor} onChange={e=>change('backgroundColor',e.target.value)}/>)}<Slider label="Tolerance" value={opts.removalTolerance} min={0} max={160} onChange={v=>change('removalTolerance',v)}/></>}
          <Slider label="Defringe" value={opts.defringe} min={0} max={3} step={1} onChange={v=>change('defringe',v)}/>
          {field('Alpha processing',<select value={opts.alphaMode} onChange={e=>change('alphaMode',e.target.value)}><option value="hard">Opaque pixels only (DTF)</option><option value="preserve">Preserve soft transparency</option></select>)}
          <Slider label="Alpha cutoff" value={opts.alphaThreshold} min={0} max={254} onChange={v=>change('alphaThreshold',v)}/>
        </Tuning>
        <Tuning title="Halftones & garment knockout">
          {field('Quick preset',<select value="" onChange={e=>{setOpts(o=>({...o,...PRESETS[e.target.value]}));setSavedPrepared('');}}><option value="">Choose processing preset</option>{Object.keys(PRESETS).map(k=><option key={k}>{k}</option>)}</select>)}
          {field('Halftone style',<select value={opts.halftone} onChange={e=>change('halftone',e.target.value)}><option value="none">Off</option><option value="fades">Transparent gradients only</option><option value="knockout">Shirt-color knockout</option><option value="full">Full halftone (vintage)</option></select>)}
          {field('Knockout',<select value={opts.knockout} onChange={e=>change('knockout',e.target.value)}><option value="none">Do not knock out</option><option value="shirt">Remove shirt-matched color</option></select>)}
          {field('Shirt RGB',<input type="color" value={opts.shirtColor} onChange={e=>change('shirtColor',e.target.value)}/>)}
          <Slider label="Knockout tolerance" value={opts.knockoutTolerance} min={1} max={200} onChange={v=>change('knockoutTolerance',v)}/>
          <Slider label="Line frequency (LPI)" value={opts.lpi} min={15} max={55} onChange={v=>change('lpi',v)}/>
          <Slider label="Screen angle" value={opts.angle} min={0} max={90} step={2.5} onChange={v=>change('angle',v)}/>
          {field('Dot shape',<select value={opts.dot} onChange={e=>change('dot',e.target.value)}>{['circle','ellipse','diamond','square','line'].map(s=><option key={s} value={s}>{s}</option>)}</select>)}
          <p className="dtf-note">Start with a printed calibration sheet to determine your RIP/provider's minimum viable dot.</p>
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
        <button className="dtf-reset" onClick={()=>{setOpts({...DTF_DEFAULTS});setSavedPrepared('');}}>Reset adjustments</button>
      </aside>
    </div>
    {busy&&<div role="status" className="dtf-progress">Preparing full-resolution artwork or transferring R2 asset…</div>}
    {message&&<p role="status" className="dtf-message">{message}</p>}
  </main>;
}
