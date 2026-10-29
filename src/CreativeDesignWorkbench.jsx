import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createMockupProject, addArtworkAsset } from './lib/mockupStudioApi';

const ITEMS=[
  {id:'tee',label:'T-shirt',x:225,y:160,w:310,h:430},
  {id:'hoodie',label:'Hoodie',x:217,y:175,w:326,h:445},
  {id:'tote',label:'Tote bag',x:224,y:205,w:312,h:350},
  {id:'tumbler',label:'Tumbler',x:271,y:165,w:218,h:435},
];
const COLORS=[['Black','#1c222b'],['White','#f5f5f3'],['Navy','#142f54'],['Kelly green','#13884c'],['Red','#b92334'],['Purple','#63398c'],['Heather gray','#abb3b9'],['Cream','#e8dbc4']];
const PREVIEW_W=760,PREVIEW_H=700;
function silhouette(ctx,id,color){
  ctx.save();ctx.fillStyle=color;ctx.strokeStyle='#687383';ctx.lineWidth=2;
  const shape=()=>{
    ctx.beginPath();
    if(id==='tumbler'){
      ctx.moveTo(289,155);ctx.lineTo(470,155);ctx.lineTo(453,592);ctx.quadraticCurveTo(380,620,306,592);ctx.closePath();
    }else if(id==='tote'){
      ctx.moveTo(235,248);ctx.lineTo(525,248);ctx.lineTo(498,555);ctx.lineTo(260,555);ctx.closePath();
    }else{
      const hoodie=id==='hoodie';
      ctx.moveTo(292,185);ctx.lineTo(235,202);ctx.lineTo(141,337);ctx.lineTo(201,376);ctx.lineTo(249,306);
      ctx.lineTo(243,565);ctx.lineTo(518,565);ctx.lineTo(510,306);ctx.lineTo(557,376);ctx.lineTo(619,337);ctx.lineTo(521,202);ctx.lineTo(463,185);
      if(hoodie){ctx.quadraticCurveTo(450,126,380,105);ctx.quadraticCurveTo(307,128,292,185);}
      else{ctx.quadraticCurveTo(381,260,292,185);}
      ctx.closePath();
    }
  };
  shape();ctx.fill();ctx.stroke();
  ctx.strokeStyle='rgba(40,55,70,.32)';ctx.lineWidth=3;
  if(id==='tote'){ctx.beginPath();ctx.moveTo(298,248);ctx.lineTo(298,186);ctx.quadraticCurveTo(380,118,462,186);ctx.lineTo(462,248);ctx.stroke();}
  if(id==='hoodie'){ctx.beginPath();ctx.arc(380,205,54,.14,Math.PI-.14);ctx.stroke();ctx.beginPath();ctx.moveTo(320,477);ctx.lineTo(440,477);ctx.lineTo(461,538);ctx.lineTo(299,538);ctx.closePath();ctx.stroke();}
  if(id==='tumbler'){ctx.beginPath();ctx.ellipse(380,155,91,18,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
  ctx.restore();
}
function draw(ctx,bitmap,values){
  ctx.clearRect(0,0,PREVIEW_W,PREVIEW_H);
  ctx.fillStyle='#ecf1f5';ctx.fillRect(0,0,PREVIEW_W,PREVIEW_H);
  ctx.strokeStyle='#d6e1ea';ctx.lineWidth=1;
  for(let i=0;i<PREVIEW_W;i+=28){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,PREVIEW_H);ctx.stroke();}
  for(let i=0;i<PREVIEW_H;i+=28){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(PREVIEW_W,i);ctx.stroke();}
  silhouette(ctx,values.item,values.color);
  if(bitmap){
    const maxWidth=values.item==='tumbler'?155:values.item==='tote'?210:230;
    const maxHeight=values.item==='tumbler'?300:210;
    const factor=Math.min(maxWidth/bitmap.width,maxHeight/bitmap.height);
    const w=bitmap.width*factor*values.scale,h=bitmap.height*factor*values.scale;
    ctx.drawImage(bitmap,values.x*PREVIEW_W-w/2,values.y*PREVIEW_H-h/2,w,h);
  }
  if(values.caption.trim()){
    ctx.fillStyle=values.color.toLowerCase()==='#f5f5f3'?'#213246':'#f7f7f7';ctx.textAlign='center';
    ctx.font='bold 23px system-ui';ctx.fillText(values.caption.trim().slice(0,48),380,615,380);
  }
  ctx.fillStyle='#5c6c78';ctx.textAlign='left';ctx.font='14px system-ui';
  ctx.fillText('CONCEPT PREVIEW — NOT AN APPROVED PRODUCTION PROOF',18,680);
}
export default function CreativeDesignWorkbench(){
  const canvas=useRef(null),fileRef=useRef(null),bitmapRef=useRef(null),imageUrl=useRef('');
  const [values,setValues]=useState({item:'tee',color:'#1c222b',scale:1,x:.5,y:.49,caption:''});
  const [fileName,setFileName]=useState(''),[error,setError]=useState(''),[pointer,setPointer]=useState(false);
  const [projectName,setProjectName]=useState(''),[customerName,setCustomerName]=useState('');
  const [saving,setSaving]=useState(false),[savedProject,setSavedProject]=useState('');
  useEffect(()=>{const ctx=canvas.current?.getContext('2d');if(ctx)draw(ctx,bitmapRef.current,values);},[values,fileName]);
  useEffect(()=>()=>{if(imageUrl.current)URL.revokeObjectURL(imageUrl.current);},[]);
  function change(key,value){setValues(v=>({...v,[key]:value}));}
  async function loadImage(event){
    const file=event.target.files?.[0];if(!file)return;
    setError('');
    if(!['image/png','image/webp','image/jpeg'].includes(file.type)||file.size>12*1024*1024){setError('Choose a PNG, JPEG or WebP image under 12 MB.');return;}
    setSavedProject('');
    const next=URL.createObjectURL(file);
    try{const img=new Image();img.src=next;await img.decode();
      if(img.width*img.height>24000000)throw Error('Maximum source resolution is 24 megapixels.');
      if(imageUrl.current)URL.revokeObjectURL(imageUrl.current);
      imageUrl.current=next;bitmapRef.current=img;setFileName(file.name);
    }catch(err){URL.revokeObjectURL(next);setError(err.message||'Could not decode artwork.');}
  }
  function point(event){
    const rect=canvas.current.getBoundingClientRect();
    const x=Math.max(.2,Math.min(.8,(event.clientX-rect.left)/rect.width));
    const y=Math.max(.25,Math.min(.77,(event.clientY-rect.top)/rect.height));
    setValues(v=>({...v,x,y}));
  }
  function exportProof(){
    if(!bitmapRef.current){setError('Upload artwork before exporting a proof.');return;}
    const anchor=document.createElement('a');
    anchor.href=canvas.current.toDataURL('image/png');anchor.download='skilled-crafting-concept-proof.png';anchor.click();
  }
  async function saveToMockup(){
    if(!file){setError('Choose source artwork before creating a saved mockup project.');return;}
    setSaving(true);setError('');setSavedProject('');
    let project=null;
    try {
      const itemName=ITEMS.find(x=>x.id===values.item)?.label||values.item;
      project=await createMockupProject({
        project_name:projectName.trim()||'Concept · '+itemName+' · '+new Date().toISOString().slice(0,10),
        customer_name:customerName.trim(),
        project_type:'client_order',
        output_style:'clean_catalog',
        background_preference:'preserve_source',
        exact_artwork_required:true,
        notes:'Unapproved Creative Operations concept. Product: '+itemName+
          '; color: '+values.color+'; normalized artwork position: '+values.x+','+values.y+
          '; preview scale: '+values.scale+'; personalization: '+values.caption+
          '. These are conceptual proportions, not physical placement measurements.',
      });
      await addArtworkAsset({projectId:project.id,file,values:{
        artwork_name:file.name,
        exact_artwork_locked:false,
        preflight_status:'pending',
        preflight_notes:'Source imported from Creative Operations concept designer. Run technical preflight, exact mockup, and approval before production.',
        metadata:{origin:'creative-operations-concept',status:'draft',design:{...values}},
      }});
      setSavedProject(project.id);
    }catch(err){
      setError((err.message||'Could not save the project.')+(project?.id?' The project was created but artwork upload was incomplete; check Mockup Studio.':''));
      if(project?.id)setSavedProject(project.id);
    }finally{setSaving(false);}
  }
  function copySpec(){
    const item=ITEMS.find(x=>x.id===values.item)?.label||values.item;
    const summary=`CONCEPT / NOT APPROVED\nProduct: ${item}\nGarment color: ${COLORS.find(x=>x[1]===values.color)?.[0]||values.color}\nArtwork source: ${fileName||'not uploaded'}\nPreview position: ${Math.round(values.x*100)}% x / ${Math.round(values.y*100)}% y\nArtwork scale: ${Math.round(values.scale*100)}%\nPersonalization: ${values.caption||'none'}\nNext: create saved Mockup Studio project, verify physical dimensions/placement, obtain customer approval and certify product before sale.`;
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(summary).catch(()=>setError('Clipboard unavailable.'));else setError('Clipboard unavailable.');
  }
  return <section className="cos-card">
    <h3>Interactive product concept designer</h3>
    <p>Upload a logo, choose a product and garment color, drag artwork into position and download a concept preview. Everything stays in this browser until you deliberately export it.</p>
    <div className="cos-designer">
      <div className="cos-designer-controls">
        <label className="cos-field">Product<select value={values.item} onChange={e=>change('item',e.target.value)}>{ITEMS.map(i=><option key={i.id} value={i.id}>{i.label}</option>)}</select></label>
        <label className="cos-field">Product color<select value={values.color} onChange={e=>change('color',e.target.value)}>{COLORS.map(([name,color])=><option key={color} value={color}>{name}</option>)}</select></label>
        <label className="cos-field">Artwork<input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp" onChange={loadImage}/></label>
        {fileName&&<small>Selected: {fileName}</small>}
        <label className="cos-field">Artwork size ({Math.round(values.scale*100)}%)<input type="range" min=".3" max="2" step=".05" value={values.scale} onChange={e=>change('scale',Number(e.target.value))}/></label>
        <label className="cos-field">Horizontal position<input type="range" min=".2" max=".8" step=".01" value={values.x} onChange={e=>change('x',Number(e.target.value))}/></label>
        <label className="cos-field">Vertical position<input type="range" min=".25" max=".77" step=".01" value={values.y} onChange={e=>change('y',Number(e.target.value))}/></label>
        <label className="cos-field">Personalization caption (optional)<input maxLength={48} value={values.caption} onChange={e=>change('caption',e.target.value)}/></label>
        <label className="cos-field">Mockup project name<input value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="Customer · Product concept"/></label>
        <label className="cos-field">Customer name (optional)<input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Customer or organization"/></label>
        <div className="cos-designer-actions"><button type="button" disabled={saving||!file} onClick={saveToMockup}>{saving?'Saving source to Mockup Studio…':'Save artwork to Mockup Studio'}</button></div>
        {savedProject&&<p role="status">Draft project created. <Link to={'/mockup-studio?project='+encodeURIComponent(savedProject)}>Open saved project →</Link></p>}
        <div className="cos-designer-actions"><button type="button" onClick={exportProof}>Download concept PNG</button><button type="button" onClick={copySpec}>Copy specifications</button></div>
        {error&&<p role="alert" className="cos-warning">{error}</p>}
        <p className="cos-warning">This is a conceptual garment illustration, not a scale-calibrated production mockup. Use the saved Mockup Studio for exact placements, approval, and artwork versioning.</p>
      </div>
      <div><canvas ref={canvas} width={PREVIEW_W} height={PREVIEW_H}
          aria-label="Draggable product concept artwork preview"
          onPointerDown={e=>{setPointer(true);e.currentTarget.setPointerCapture(e.pointerId);point(e);}}
          onPointerMove={e=>{if(pointer)point(e);}}
          onPointerUp={()=>setPointer(false)}
          onPointerCancel={()=>setPointer(false)}
          className="cos-designer-canvas"/>
        <p className="cos-note">Drag on the preview to move the artwork. Keyboard-accessible position sliders are also provided.</p>
      </div>
    </div>
    <div className="cos-links"><Link to="/mockup-studio">Continue in saved Mockup Studio →</Link><Link to="/client-orders">Customer intake →</Link><Link to="/quote-builder">Create a verified quote →</Link><Link to="/catalog-production-readiness">Product readiness →</Link></div>
  </section>;
}
