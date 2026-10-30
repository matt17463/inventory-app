import {useEffect,useRef,useState} from 'react';
import './PublicDesignConfigurator.css';

const PRODUCTS=[
  {id:'tee',name:'T-shirt',garment:'T-shirt',sizes:['YXS','YS','YM','YL','AS','AM','AL','AXL','A2XL','A3XL']},
  {id:'hoodie',name:'Hoodie',garment:'Hoodie',sizes:['YS','YM','YL','AS','AM','AL','AXL','A2XL','A3XL']},
  {id:'tote',name:'Tote Bag',garment:'Tote Bag',sizes:['One Size']},
  {id:'tumbler',name:'Tumbler',garment:'Tumbler',sizes:['One Size']},
];
const COLORS={Black:'#1c2530',White:'#f1f2f1',Navy:'#143152','Kelly_Green':'#147a43',Purple:'#66338e',Gray:'#a9b2ba',Cream:'#e9ddc7',Red:'#b22d35'};
const MAX_ART_BYTES=3*1024*1024;
function readAsDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(Error('Could not read artwork'));reader.readAsDataURL(file);});}
function drawPreview(ctx,values,image){
  const W=800,H=700;
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#e7ecf2';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#fff';ctx.fillRect(24,24,W-48,H-48);
  const {product,color,x,y,scale}=values;
  ctx.strokeStyle='#667589';ctx.lineWidth=2;ctx.fillStyle=COLORS[color]||COLORS.Black;
  ctx.beginPath();
  if(product==='tumbler'){ctx.roundRect(298,156,204,425,24);}
  else if(product==='tote'){ctx.rect(250,235,300,350);}
  else{
    ctx.moveTo(322,174);ctx.lineTo(260,196);ctx.lineTo(160,337);ctx.lineTo(224,382);ctx.lineTo(266,302);
    ctx.lineTo(260,575);ctx.lineTo(540,575);ctx.lineTo(534,302);ctx.lineTo(576,382);ctx.lineTo(640,337);
    ctx.lineTo(540,196);ctx.lineTo(478,174);ctx.quadraticCurveTo(400,246,322,174);ctx.closePath();
  }
  ctx.fill();ctx.stroke();
  if(product==='tote'){ctx.beginPath();ctx.moveTo(315,235);ctx.lineTo(315,170);ctx.quadraticCurveTo(400,116,485,170);ctx.lineTo(485,235);ctx.stroke();}
  if(product==='hoodie'){ctx.beginPath();ctx.arc(400,205,52,.1,Math.PI-.1);ctx.stroke();ctx.strokeRect(320,485,160,48);}
  if(image){
    const maxW=product==='tumbler'?145:product==='tote'?220:240;
    const maxH=product==='tumbler'?260:200;
    const k=Math.min(maxW/image.width,maxH/image.height)*scale;
    const w=image.width*k,h=image.height*k;
    ctx.drawImage(image,x*W-w/2,y*H-h/2,w,h);
  }
  ctx.fillStyle='#4c5867';ctx.font='bold 15px system-ui';ctx.textAlign='left';
  ctx.fillText('SKILLED CRAFTING  /  CUSTOMER DESIGN CONCEPT',48,62);
  ctx.font='14px system-ui';ctx.fillText('NOT AN APPROVED PRODUCTION PROOF · PLACEMENT NOT TO SCALE',48,626);
}
const initial={product:'tee',color:'Black',size:'AM',quantity:1,x:.5,y:.53,scale:1,customer:'',organization:'',email:'',phone:'',needBy:'',notes:'',website:'',confirmed:false};
export default function PublicDesignConfigurator(){
  const canvas=useRef(null),imageRef=useRef(null),moving=useRef(false);
  const [form,setForm]=useState(initial);
  const [artwork,setArtwork]=useState(null),[filename,setFilename]=useState('');
  const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),[complete,setComplete]=useState('');
  const product=PRODUCTS.find(p=>p.id===form.product)||PRODUCTS[0];
  const set=(key,value)=>setForm(old=>({...old,[key]:value,...(key==='product'?{size:(PRODUCTS.find(p=>p.id===value)?.sizes||[])[0]}:{})}));
  useEffect(()=>{const context=canvas.current?.getContext('2d');if(context)drawPreview(context,form,imageRef.current);},[form,artwork]);
  async function pick(event){
    const file=event.target.files?.[0];if(!file)return;
    setStatus('');
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>MAX_ART_BYTES){setStatus('Upload a PNG, JPEG or WebP file under 3 MB.');return;}
    try{const url=await readAsDataUrl(file);const img=new Image();img.src=url;await img.decode();
      if(img.width*img.height>16_000_000)throw Error('Image is too large to preview.');
      setArtwork({file,base64:url.split(',')[1]});imageRef.current=img;setFilename(file.name);
    }catch(e){setStatus(e.message||'Unable to read image');}
  }
  function pointer(event){
    if(!moving.current)return;const r=canvas.current.getBoundingClientRect();
    const x=Math.max(.23,Math.min(.77,(event.clientX-r.left)/r.width));
    const y=Math.max(.3,Math.min(.76,(event.clientY-r.top)/r.height));setForm(v=>({...v,x,y}));
  }
  function download(){
    const a=document.createElement('a');a.download='skilled-crafting-customer-concept.png';a.href=canvas.current.toDataURL('image/png');a.click();
  }
  async function submit(e){
    e.preventDefault();if(busy)return;
    setBusy(true);setStatus('');
    try{
      if(!form.confirmed)throw Error('Please confirm the design request details before submitting.');
      const request={
        organization:form.organization.trim()||form.customer.trim(),
        contact_name:form.customer.trim(),contact_email:form.email.trim().toLowerCase(),contact_phone:form.phone.trim(),
        order_type:'Customer Design Studio · Quote Request',desired_completion_date:form.needBy||null,
        delivery_method:'To be confirmed',preferred_contact_method:'Email',
        garment_types:[product.garment],preferred_colors:[form.color.replace(/_/g,' ')],
        artwork_choice:artwork?'Customer uploaded artwork':'Needs original artwork or design help',
        customization_notes:JSON.stringify({source:'public_configurator_v1',product:product.name,color:form.color,
          size:form.size,quantity:Math.trunc(Number(form.quantity)),placement:{x:form.x,y:form.y,scale:form.scale},notes:form.notes}).slice(0,3900),
        customer_notes:'Preview is conceptual and has not been approved for printing. '+form.notes,
        website:form.website,customer_confirmation:{approved:true},
        items:[{garment_type:product.garment,size:form.size,garment_color:form.color.replace(/_/g,' '),
          quantity:Math.trunc(Number(form.quantity)),notes:'Custom design inquiry, staff quote/approval required.'}],
        attachments:[...(artwork?[{name:artwork.file.name,type:artwork.file.type,data:artwork.base64}]:[]),
          {name:'customer-design-concept.png',type:'image/png',data:canvas.current.toDataURL('image/png').split(',')[1]}],
      };
      const response=await fetch('/.netlify/functions/client-order-submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error(data.error||'Could not submit your design request.');
      setComplete(String(data.order_number||'Your request'));setArtwork(null);
    }catch(err){setStatus(err.message||'Submission failed.');}
    finally{setBusy(false);}
  }
  return <main className="pdc-public">
    <header className="pdc-public-hero"><img src="/skilled-crafting-logo.png" alt="Skilled Crafting"/><div><p>SKILLED CRAFTING · DESIGN LAB</p><h1>Create your custom product</h1><p>Try a design, upload your artwork and request a personalized quote. Nothing is purchased or printed until Skilled Crafting confirms your specifications and pricing.</p></div></header>
    {complete?<section className="pdc-success" role="status"><h2>Design request received</h2><p>Reference: <strong>{complete}</strong></p><p>We will review your artwork, printing method, availability, placement and final pricing before contacting you. This is not a paid order.</p></section>:
    <form className="pdc-layout" onSubmit={submit}>
      <section className="pdc-controls">
        <h2>1. Customize</h2>
        <label>Choose a product<select value={form.product} onChange={e=>set('product',e.target.value)}>{PRODUCTS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Product color<select value={form.color} onChange={e=>set('color',e.target.value)}>{Object.keys(COLORS).map(c=><option key={c} value={c}>{c.replace('_',' ')}</option>)}</select></label>
        <div className="pdc-double"><label>Size<select value={form.size} onChange={e=>set('size',e.target.value)}>{product.sizes.map(v=><option key={v}>{v}</option>)}</select></label><label>Quantity<input type="number" min="1" max="250" step="1" required value={form.quantity} onChange={e=>set('quantity',e.target.value)}/></label></div>
        <label>Upload your artwork (optional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick}/></label>
        {filename&&<small>Selected: {filename}</small>}
        <label>Graphic size: {Math.round(form.scale*100)}%<input type="range" min=".3" max="1.8" step=".05" value={form.scale} onChange={e=>set('scale',Number(e.target.value))}/></label>
        <label>Horizontal position<input type="range" min=".23" max=".77" step=".01" value={form.x} onChange={e=>set('x',Number(e.target.value))}/></label>
        <label>Vertical position<input type="range" min=".3" max=".76" step=".01" value={form.y} onChange={e=>set('y',Number(e.target.value))}/></label>
        <button type="button" className="pdc-secondary" onClick={download}>Download concept preview</button>
        <h2>2. Request a quote</h2>
        <label>Name<input required maxLength={160} value={form.customer} onChange={e=>set('customer',e.target.value)}/></label>
        <label>Organization or team (optional)<input maxLength={160} value={form.organization} onChange={e=>set('organization',e.target.value)}/></label>
        <label>Email<input type="email" required maxLength={200} value={form.email} onChange={e=>set('email',e.target.value)}/></label>
        <label>Phone (optional)<input maxLength={80} value={form.phone} onChange={e=>set('phone',e.target.value)}/></label>
        <label>Requested completion date<input type="date" value={form.needBy} onChange={e=>set('needBy',e.target.value)}/></label>
        <label>Design notes<textarea maxLength={1500} rows={3} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Ink colors, placement, names, artwork instructions…"/></label>
        <label className="pdc-honey" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>set('website',e.target.value)}/></label>
        <label className="pdc-check"><input type="checkbox" required checked={form.confirmed} onChange={e=>set('confirmed',e.target.checked)}/>I reviewed my selections and understand this is only a quote request.</label>
        {status&&<p role="alert" className="pdc-error">{status}</p>}
        <button className="pdc-submit" disabled={busy} type="submit">{busy?'Submitting…':'Send design for review'}</button>
      </section>
      <section className="pdc-preview"><h2>Live concept preview</h2><p>Drag the artwork to move it. Use sliders for fine adjustment.</p><canvas ref={canvas} width={800} height={700} aria-label="Product design preview" onPointerDown={e=>{moving.current=true;e.currentTarget.setPointerCapture(e.pointerId);pointer(e);}} onPointerMove={pointer} onPointerUp={()=>{moving.current=false;}} onPointerCancel={()=>{moving.current=false;}}/><p>Illustration only. The actual product, decoration method, measurements, print colors and final price require staff verification.</p></section>
    </form>}
    <footer className="pdc-footer">Custom design concepts · Skilled Crafting · Request a quote, not a checkout</footer>
  </main>;
}
