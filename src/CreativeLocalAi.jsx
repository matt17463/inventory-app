import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { applyLocalSegmentationAlpha } from './lib/creativeLocalMask';

const MODEL='onnx-community/ormbg-ONNX';
let browserModel=null;
function imageDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('Cannot read this image.'));reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);});}
async function browserSegmenter(progress){
  if(browserModel)return browserModel;
  const {pipeline}=await import('@huggingface/transformers');
  browserModel=await pipeline('background-removal',MODEL,{device:'wasm',dtype:'uint8',progress_callback:(event)=>{if(event?.progress!=null)progress(Math.round(event.progress));}});
  return browserModel;
}
export default function CreativeLocalAi(){
  const [file,setFile]=useState(null),[state,setState]=useState('Idle'),[percent,setPercent]=useState(0),[error,setError]=useState('');
  const [result,setResult]=useState(''),[quality,setQuality]=useState(null);
  const resultRef=useRef('');
  useEffect(()=>()=>{if(resultRef.current)URL.revokeObjectURL(resultRef.current);},[]);
  async function run(){
    if(!file){setError('Choose an artwork file first.');return;}
    setError('');setPercent(0);setState('Loading local model');
    let original=null;
    try{
      const imageSource=await imageDataUrl(file);
      original=new Image();original.src=imageSource;await original.decode();
      if(original.width*original.height>24000000)throw Error('Source must be under 24 megapixels.');
      const segmenter=await browserSegmenter(setPercent);
      setState('Separating subject from background');
      const output=await segmenter([imageSource]);
      const maskRaw=output?.[0];
      if(!maskRaw?.toCanvas)throw Error('Local model did not return a usable segmentation mask.');
      const maskCanvas=maskRaw.toCanvas();
      const canvas=document.createElement('canvas');canvas.width=original.width;canvas.height=original.height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(original,0,0,canvas.width,canvas.height);
      const alpha=document.createElement('canvas');alpha.width=canvas.width;alpha.height=canvas.height;
      const ac=alpha.getContext('2d',{willReadFrequently:true});
      ac.drawImage(maskCanvas,0,0,canvas.width,canvas.height);
      const pixels=ac.getImageData(0,0,alpha.width,alpha.height);
      const mask=applyLocalSegmentationAlpha(pixels.data);
      pixels.data.set(mask.data);
      ac.putImageData(pixels,0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(alpha,0,0);
      ctx.globalCompositeOperation='source-over';
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob)throw Error('PNG export failed.');
      const url=URL.createObjectURL(blob);
      if(resultRef.current)URL.revokeObjectURL(resultRef.current);
      resultRef.current=url;setResult(url);
      setQuality({width:canvas.width,height:canvas.height,subjectPercent:Math.round(mask.foreground/mask.data.length*400),softPixels:mask.partial,bytes:blob.size});
      setState('Complete — review mask and edges');
    }catch(err){setState('Unavailable');setError(err?.message||'Local model failed. Try manual DTF background tools.');}
  }
  function selectFile(event){
    const f=event.target.files?.[0];setError('');
    if(resultRef.current){URL.revokeObjectURL(resultRef.current);resultRef.current='';}
    setResult('');setQuality(null);setState('Idle');
    if(!f){setFile(null);return;}
    if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>12*1024*1024){setError('Choose a PNG, JPEG or WebP file under 12 MB.');setFile(null);return;}
    setFile(f);
  }
  return <section className="cos-card">
    <h3>Free, on-device AI background removal</h3>
    <p>Uses a locally running ONNX model (ORMBG, Apache 2.0). The first run downloads model files; subsequent runs may use your browser cache. Artwork stays in your browser and is not sent to an inference API. No paid API key is required.</p>
    <label className="cos-field">Source image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectFile}/></label>
    <div className="cos-input-row"><button type="button" disabled={!file||['Loading local model','Separating subject from background'].includes(state)} onClick={run}>{state==='Idle'||state==='Unavailable'?'Remove background locally':'Run again locally'}</button><small role="status">{state} {state==='Loading local model'&&percent>0?'· '+percent+'%':''}</small></div>
    {error&&<p role="alert" className="cos-warning">{error}</p>}
    {result&&<div className="cos-local-result">
      <div><img src={result} alt="Locally segmented artwork with transparent background"/><p>Transparent PNG concept · {quality.width}×{quality.height} pixels · Estimated foreground {quality.subjectPercent}%</p></div>
      <div><a href={result} download="skilled-crafting-local-background-removed.png" className="cos-download">Download transparent PNG</a><p>Verify internal white details, small features, halos and edge cleanup before printing. PNG export does not certify 300 PPI, CMYK or printer white-ink separations.</p><p><Link to="/dtf-studio">Finish in DTF Prep Studio →</Link></p></div>
    </div>}
    <p className="cos-note">This tool runs ONNX Runtime in browser WebAssembly and may require substantial RAM. No automatic cloud inference fallback is allowed. Models and software are open-source; local compute and normal hosting/storage costs may still apply.</p>
  </section>;
}
