import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { alphaBounds, DTF_DPI, removeEdgeConnectedWhite, setPngDpi, sourcePreflight, validatePrintDimensions } from './lib/dtfPreflight';
import './ArtworkPreflight.css';
import { addArtworkAsset, listMockupProjects } from './lib/mockupStudioApi';

function browserPng(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode PNG.')), 'image/png'));
}
async function makePng(file, options) {
  const bitmap = await createImageBitmap(file);
  try {
    const target = validatePrintDimensions(options.width, options.height);
    if (bitmap.width * bitmap.height > 24000000) throw new Error('Source exceeds the 24-megapixel browser processing limit.');
    const original = document.createElement('canvas');
    original.width = bitmap.width; original.height = bitmap.height;
    const originalContext = original.getContext('2d', { willReadFrequently:true });
    originalContext.drawImage(bitmap, 0, 0);
    const pixels = originalContext.getImageData(0, 0, bitmap.width, bitmap.height);
    let removed = 0;
    if (options.white) removed = removeEdgeConnectedWhite(pixels.data, bitmap.width, bitmap.height, Number(options.threshold));
    originalContext.putImageData(pixels, 0, 0);
    const bounds = alphaBounds(pixels.data, bitmap.width, bitmap.height);
    if (!bounds) throw new Error('No visible pixels remain. Decrease the white removal threshold or turn it off.');
    const output = document.createElement('canvas');
    output.width = target.width; output.height = target.height;
    const ctx = output.getContext('2d',{alpha:true});
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const contentWidth = target.width * .96, contentHeight = target.height * .96;
    const scale = Math.min(contentWidth / bounds.width, contentHeight / bounds.height);
    const drawWidth = Math.round(bounds.width * scale), drawHeight = Math.round(bounds.height * scale);
    ctx.drawImage(original, bounds.x, bounds.y, bounds.width, bounds.height,
      Math.floor((target.width - drawWidth)/2), Math.floor((target.height-drawHeight)/2), drawWidth, drawHeight);
    const png = await browserPng(output);
    const fixed = setPngDpi(new Uint8Array(await png.arrayBuffer()), DTF_DPI);
    return {
      blob:new Blob([fixed],{type:'image/png'}),
      removed, bounds, source:sourcePreflight(bounds.width,bounds.height,drawWidth,drawHeight),
      outputWidth:target.width, outputHeight:target.height,
    };
  } finally { bitmap.close?.(); }
}
function safeBase(s) {
  return String(s || 'prepared-artwork').replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]/gi,'-').slice(0,80) || 'prepared-artwork';
}

export default function ArtworkPreflight() {
  const [file,setFile] = useState(null);
  const [width,setWidth] = useState('12');
  const [height,setHeight] = useState('12');
  const [white,setWhite] = useState(false);
  const [threshold,setThreshold] = useState('245');
  const [source,setSource] = useState(null);
  const [output,setOutput] = useState(null);
  const [preview,setPreview] = useState('');
  const [busy,setBusy] = useState(false);
  const [projects,setProjects]=useState([]);
  const [projectId,setProjectId]=useState('');
  const [savedSource,setSavedSource]=useState('');
  const [savedPrepared,setSavedPrepared]=useState('');
  const [uploadBusy,setUploadBusy]=useState(false);
  const [message,setMessage] = useState('');
  useEffect(() => {
    if (!file) { setSource(null); return; }
    let active = true;
    createImageBitmap(file).then((bmp) => {
      if (active) setSource({width:bmp.width,height:bmp.height,type:file.type});
      bmp.close?.();
    }).catch((err) => { if (active) setMessage(err.message); });
    return () => { active = false; };
  }, [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(()=>{listMockupProjects().then(setProjects).catch(e=>setMessage('Artwork project list unavailable: '+e.message));},[]);
  const plan = (() => {
    if (!source) return null;
    try {
      const target = validatePrintDimensions(width,height);
      return sourcePreflight(source.width,source.height,target.width,target.height);
    } catch { return null; }
  })();

  async function prepare() {
    if (!file) return;
    setBusy(true); setMessage(''); setOutput(null); setPreview('');setSavedPrepared('');
    try {
      const result = await makePng(file,{width,height,white,threshold});
      setOutput(result);
      setPreview(URL.createObjectURL(result.blob));
      setMessage('Prepared locally. Review the checkerboard preview before downloading or approving for production.');
    } catch (err) { setMessage(err.message || 'Unable to prepare the file.'); }
    finally { setBusy(false); }
  }
  async function saveToProject() {
    if(!file||!output||!projectId)return;
    setUploadBusy(true);setMessage('');
    try {
      let sourceId=savedSource;
      if(!sourceId) {
        const sourceAsset=await addArtworkAsset({
          projectId,file,
          values:{artwork_name:safeBase(file.name)+' — original source',pixel_width:source?.width||null,
            pixel_height:source?.height||null,has_transparency:file.type==='image/png',
            preflight_status:'pending',exact_artwork_locked:true,
            metadata:{artwork_prep:'DTF',file_role:'original',original_unchanged:true}},
        });
        sourceId=sourceAsset.id;setSavedSource(sourceId);
      }
      const preparedName=safeBase(file.name)+'-dtf-'+width+'x'+height+'-300dpi.png';
      const prepared=new File([output.blob],preparedName,{type:'image/png'});
      const result=await addArtworkAsset({
        projectId,file:prepared,
        values:{artwork_name:preparedName,pixel_width:output.outputWidth,pixel_height:output.outputHeight,
          has_transparency:true,background_removed:white,preflight_status:'warning',
          exact_artwork_locked:true,metadata:{artwork_prep:'DTF',file_role:'derived',
            source_artwork_asset_id:sourceId,dpi:300,white_cleanup_applied:white,
            background_removed_pixels:output.removed,effective_source_dpi:output.source.effectiveDpi,
            preparation_tool:'artwork-preflight-v1',requires_visual_approval:true}},
      });
      setSavedPrepared(result.id);
      setMessage('Original and prepared artwork saved in Mockup Studio storage for this project. The prepared copy is flagged with a preflight warning until visually reviewed.');
    }catch(e){setMessage('Storage could not finish: '+(e.message||'error')+'. If the original was saved it remains in the project; retry to save the derivative.');}
    finally{setUploadBusy(false);}
  }
  function download() {
    if (!output) return;
    const url = URL.createObjectURL(output.blob);
    const anchor = document.createElement('a');
    anchor.href=url; anchor.download=safeBase(file.name)+'-dtf-'+width+'x'+height+'-300dpi.png';
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  return <main className="page sc-art-preflight">
    <section className="page-header">
      <div><p className="eyebrow">Artwork workflow · DTF</p><p><Link to="/dtf-studio">Open the new DTF Prep Studio →</Link></p><h1>Prepare customer artwork for DTF</h1>
        <p>Check image quality, optionally remove connected white background areas, crop transparent margins, and export a correctly sized PNG with 300 DPI metadata.</p></div>
    </section>
    <section className="card elevated-card sc-art-preflight-layout">
      <div className="sc-art-form">
        <h2>1. Load a source image</h2>
        <label>Source PNG, JPEG or WebP
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { setFile(e.target.files?.[0]||null);setOutput(null);setPreview('');setMessage('');setSavedSource('');setSavedPrepared(''); }} />
        </label>
        <p className="helper-text">Processing happens in your browser. This tool does not upload the source image or prepared file. Maximum 24 megapixels.</p>
        {source && <p><strong>Source:</strong> {source.width} × {source.height} pixels ({source.type})</p>}
        <h2>2. Set intended print canvas</h2>
        <div className="sc-art-sizes">
          <label>Width (inches)<input type="number" min=".25" max="20" step=".25" value={width} onChange={e=>setWidth(e.target.value)} /></label>
          <label>Height (inches)<input type="number" min=".25" max="20" step=".25" value={height} onChange={e=>setHeight(e.target.value)} /></label>
        </div>
        {plan && <p><strong>Output:</strong> {Math.round(Number(width)*DTF_DPI)} × {Math.round(Number(height)*DTF_DPI)} pixels @ 300 DPI.</p>}
        {plan?.needsUpscale && <p className="sc-art-warning">Resolution warning: the source is being enlarged by approximately {plan.scale.toFixed(1)}×. The resulting file can be tagged 300 DPI but will not gain genuine fine detail. Seek better source artwork or redraw it.</p>}
        <h2>3. Clean up background (optional)</h2>
        <label className="sc-art-check"><input type="checkbox" checked={white} onChange={e=>setWhite(e.target.checked)}/> Remove edge-connected near-white background</label>
        {white && <label>Brightness threshold: {threshold} (higher is more conservative)
          <input type="range" min="200" max="255" value={threshold} onChange={e=>setThreshold(e.target.value)} />
        </label>}
        <p className="helper-text">White removal cannot perfectly recover hair, glow, detailed white artwork or anti-aliased edges from flattened AI images. Inspect all edges and interior white design areas before printing.</p>
        <div className="sc-art-actions">
          <button type="button" onClick={prepare} disabled={!file||busy}>{busy?'Preparing…':'Prepare DTF PNG'}</button>
          <button type="button" onClick={download} disabled={!output}>Download prepared PNG</button>
        </div>
        {message && <p role="status">{message}</p>}
      </div>
      <div className="sc-art-preview">
        <h2>Production review</h2>
        <div className="sc-art-checker">
          {preview ? <img src={preview} alt="Prepared DTF file preview showing transparency" /> : <p>Prepared artwork will appear here on a transparency checkerboard.</p>}
        </div>
        {output && <>
          <p><strong>Actual exported canvas:</strong> {output.outputWidth} × {output.outputHeight} pixels; PNG with 300 DPI pHYs metadata.</p>
          <p><strong>Background cleanup:</strong> {output.removed.toLocaleString()} pixels made transparent.</p>
          <p className="sc-art-warning">Manual QA required: no automatic color separation, ICC profile, underbase, RIP settings or printable color accuracy is implied.</p>
          <div className="sc-art-persist">
            <h3>Save original and prepared copy to Artwork / Mockup Studio</h3>
            <label>Existing customer project<select value={projectId} onChange={e=>{setProjectId(e.target.value);setSavedSource('');setSavedPrepared('');}}>
              <option value="">Choose a project</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.project_name} · {p.customer_name||'Internal'}</option>)}
            </select></label>
            <button type="button" onClick={saveToProject} disabled={!projectId||uploadBusy||Boolean(savedPrepared)}>
              {uploadBusy?'Saving to artwork storage…':savedPrepared?'Files saved':'Save original + prepared PNG'}
            </button>
            <p>Files use the established authenticated Mockup Studio storage pipeline (R2 when configured). The source is preserved; the prepared file starts as <strong>warning / requires review</strong>, not approved for production.</p>
            {savedPrepared&&<p>Prepared artwork ID: <code>{savedPrepared}</code> · <Link to="/mockup-studio">Open Mockup Studio →</Link></p>}
          </div>
        </>}
        <h3>Other artwork methods</h3>
        <div className="sc-art-related">
          <Link to="/uv-studio">Omni UV artwork and texture preparation →</Link>
          <Link to="/material-settings">Laser / heat-press material recipes →</Link>
          <Link to="/mockup-studio">Mockup Studio production packets →</Link>
        </div>
      </div>
    </section>
  </main>;
}
