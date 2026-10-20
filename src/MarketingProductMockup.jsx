import { useRef, useState } from "react";

/** Faithful client-side composite: source photos and original transparent artwork are never AI-redrawn. */
export default function MarketingProductMockup({ artwork = "" }) {
 const [photo,setPhoto]=useState("");
 const [customArt,setCustomArt]=useState("");
 const [x,setX]=useState(50),[y,setY]=useState(42),[scale,setScale]=useState(30);
 const [message,setMessage]=useState("");
 const canvas=useRef(null);
 const design=customArt||artwork;
 function readFile(file, setter) {
  if(!file)return;
  if(!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size>12*1024*1024) {
   setMessage("Use a PNG, JPG or WebP under 12 MB.");return;
  }
  const reader=new FileReader();
  reader.onload=()=>{setter(String(reader.result));setMessage("");};
  reader.readAsDataURL(file);
 }
 async function download() {
  if(!photo||!design){setMessage("Upload a licensed product photograph and transparent artwork first.");return;}
  const load=url=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});
  try{
   const [blank,logo]=await Promise.all([load(photo),load(design)]);
   const c=canvas.current;
   c.width=blank.naturalWidth;c.height=blank.naturalHeight;
   const ctx=c.getContext("2d");
   ctx.drawImage(blank,0,0);
   const w=c.width*scale/100,h=w*logo.naturalHeight/logo.naturalWidth;
   ctx.drawImage(logo,c.width*x/100-w/2,c.height*y/100-h/2,w,h);
   const a=document.createElement("a");a.download="skilled-crafting-product-mockup.png";a.href=c.toDataURL("image/png");a.click();
   setMessage("Composite saved. Confirm position, size, perspective and print specifications before customer approval.");
  }catch{setMessage("Unable to combine these images. Try locally uploaded PNG or JPG files.");}
 }
 return <section className="growth-subcard">
  <h3>Actual-product artwork mockup</h3>
  <p>Use a real, licensed blank-product photograph and the exact customer artwork. This overlay preserves artwork spelling and colors. It does not simulate garment folds or perspective; approve a final production mockup separately.</p>
  <div className="growth-grid">
   <label className="growth-field"><span>Licensed blank-product photo</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>readFile(e.target.files?.[0],setPhoto)}/></label>
   <label className="growth-field"><span>Transparent logo/artwork PNG (optional if logo selected above)</span><input type="file" accept="image/png,image/webp" onChange={e=>readFile(e.target.files?.[0],setCustomArt)}/></label>
   <label className="growth-field"><span>Horizontal position {x}%</span><input type="range" min="10" max="90" value={x} onChange={e=>setX(Number(e.target.value))}/></label>
   <label className="growth-field"><span>Vertical position {y}%</span><input type="range" min="10" max="90" value={y} onChange={e=>setY(Number(e.target.value))}/></label>
   <label className="growth-field"><span>Logo width {scale}%</span><input type="range" min="5" max="75" value={scale} onChange={e=>setScale(Number(e.target.value))}/></label>
  </div>
  <div style={{position:"relative",width:"min(100%,480px)",margin:"16px auto",overflow:"hidden",borderRadius:8,background:"#eee"}}>
   {photo?<img src={photo} alt="Actual source garment or product" style={{width:"100%",display:"block"}}/>:<div style={{padding:70,textAlign:"center"}}>Upload a blank-product photograph to preview</div>}
   {photo&&design&&<img src={design} alt="Original client decoration artwork" style={{position:"absolute",left:x+"%",top:y+"%",width:scale+"%",transform:"translate(-50%,-50%)",pointerEvents:"none"}}/>}
  </div>
  <canvas ref={canvas} style={{display:"none"}} aria-hidden="true"/>
  <button type="button" className="sc-btn" disabled={!photo||!design} onClick={download}>Export real-product PNG mockup</button>
  {message&&<p role="status">{message}</p>}
 </section>;
}
