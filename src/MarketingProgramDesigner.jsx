import { useEffect, useState } from "react";
import MarketingSupplierCompare from "./MarketingSupplierCompare";
import { exportClientCatalogPdf,buildSchoolProgramPdf } from "./lib/marketingProgramPdf";
const fresh=(type="tee")=>({id:Math.random().toString(36).slice(2),type,name:type==="hoodie"?"School hoodie":"School tee",sku:"",sizes:"",colors:"",photo:"",mockup:"",x:50,y:42,scale:30,tiers:[{min:1,wholesale:"",retail:""}]});
async function fileImage(file){
 if(!file)return "";
 if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>2500000)throw Error("Use a PNG/JPG/WebP under 2.5 MB.");
 return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error("Could not read image."));r.readAsDataURL(file);});
}
const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
async function compose(photo,logo,p){
 const [base,art]=await Promise.all([load(photo),load(logo)]);
 const c=document.createElement("canvas"),f=Math.min(1,1000/Math.max(base.naturalWidth,base.naturalHeight));
 c.width=Math.round(base.naturalWidth*f);c.height=Math.round(base.naturalHeight*f);
 const ctx=c.getContext("2d");ctx.drawImage(base,0,0,c.width,c.height);
 const w=c.width*p.scale/100,h=w*art.naturalHeight/art.naturalWidth;
 ctx.drawImage(art,c.width*p.x/100-w/2,c.height*p.y/100-h/2,w,h);
 return c.toDataURL("image/png");
}
export default function MarketingProgramDesigner({mode,organization="",schoolLogo="",selectedProductImage="",confirmedColors=[],description=""}){
 const brochure=mode==="brochure-schools";
 const [businessLogo,setBusinessLogo]=useState(""),[mascotArtwork,setMascotArtwork]=useState(""),[backgroundArtwork,setBackgroundArtwork]=useState("");
 const [previewBlob,setPreviewBlob]=useState(null),[previewUrl,setPreviewUrl]=useState("");
 const [contact,setContact]=useState({phone:"",email:"",website:"https://skilledcrafting.com",address:""});
 const [products,setProducts]=useState(()=>brochure?[fresh("tee"),fresh("hoodie")]:[fresh()]);
 const [notes,setNotes]=useState(""),[headline,setHeadline]=useState("WEAR YOUR SCHOOL PRIDE"),[tagline,setTagline]=useState("Spirit wear for students, families, staff and supporters");
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{
  let active=true;
  const img=new Image();
  img.onload=()=>{if(!active)return;try{
   const canvas=document.createElement("canvas");canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
   canvas.getContext("2d").drawImage(img,0,0);
   setBusinessLogo(previous=>previous||canvas.toDataURL("image/png"));
  }catch{ /* Manual upload remains available if the site logo cannot be read. */ }};
  img.src="/skilled-crafting-logo.png";
  return ()=>{active=false;};
 },[]);
 useEffect(() => {
  if (!selectedProductImage) return;
  setProducts(previous => previous.map((product,index) => index === 0 ? { ...product, photo: selectedProductImage, mockup: "" } : product));
 }, [selectedProductImage]);
 const logo=schoolLogo;
 const artwork=mascotArtwork||schoolLogo;
 const colorSignature=confirmedColors.join(",");
 useEffect(()=>{setPreviewBlob(null);},[organization,logo,mascotArtwork,backgroundArtwork,businessLogo,products,contact,notes,headline,tagline,description,colorSignature]);
 useEffect(()=>{
   if(!previewBlob){setPreviewUrl("");return;}
   const url=URL.createObjectURL(previewBlob);
   setPreviewUrl(url);
   return ()=>URL.revokeObjectURL(url);
 },[previewBlob]);
 const brochureData=()=>({organization,contact,businessLogo,schoolLogo:logo,heroArtwork:artwork,backgroundArtwork,notes,headline,tagline,programDescription:description,colors:confirmedColors,products});
 const patch=(id,changes)=>setProducts(list=>list.map(p=>p.id===id?{...p,...changes,mockup:changes.mockup??(changes.photo!==undefined||changes.x!==undefined||changes.y!==undefined||changes.scale!==undefined?"":p.mockup)}:p));
 const upload=async(file,callback)=>{try{const v=await fileImage(file);if(v){callback(v);setError("");}}catch(e){setError(e.message);}};
 const tier=(id,index,key,value)=>setProducts(list=>list.map(p=>p.id===id?{...p,tiers:p.tiers.map((t,i)=>i===index?{...t,[key]:value}:t)}:p));
 async function render(p){try{if(!p.photo||!logo)throw Error("Upload a licensed product photo and school logo first.");patch(p.id,{mockup:await compose(p.photo,logo,p)});setError("");}catch(e){setError(e.message);}}
 function preview(){
  try{
   setBusy(true);setError("");
   if(!logo)throw Error("Select the school\'s approved logo in Step 1 before creating a flyer.");
   if(!confirmedColors.length)throw Error("Confirm at least one approved school color in Step 1 before creating the flyer.");
   const file=buildSchoolProgramPdf(brochureData());
   setPreviewBlob(file.output("blob"));
  }catch(e){setPreviewBlob(null);setError(e.message||"Could not preview flyer.");}
  finally{setBusy(false);}
 }
 function download(){
  try{
   setBusy(true);setError("");
   if(brochure){
    if(!previewBlob)throw Error("Preview the current two-page flyer before downloading.");
    const url=URL.createObjectURL(previewBlob);
    const anchor=document.createElement("a");anchor.href=url;
    anchor.download="skilled-crafting-school-spirit-wear.pdf";anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
   }else exportClientCatalogPdf(brochureData());
  }catch(e){setError(e.message||"Document download failed.");}
  finally{setBusy(false);}
 }
 return <section className="growth-subcard">
  <h3>{brochure?"School spirit-wear flyer — guided two-page design":"Client product catalog — multi-page full-color PDF"}</h3>
  <p>{brochure?"One creation path: provide your approved school branding, position artwork on apparel, review the two-page flyer and download the PDF.":"Use real product photographs and approved client artwork with editable placement."} Enter agreed decorated wholesale and client retail prices; supplier purchase costs remain private.</p>
  {brochure&&<h4>Step 2 — Flyer message and visual identity</h4>}
  {brochure&&<div className="growth-grid">
   <label className="growth-field"><span>Flyer headline</span><input value={headline} maxLength={55} onChange={e=>setHeadline(e.target.value)}/></label>
   <label className="growth-field"><span>Flyer tagline</span><input value={tagline} maxLength={140} onChange={e=>setTagline(e.target.value)}/></label>
   <p><strong>School design colors:</strong> {confirmedColors.length?confirmedColors.join(", "):"Using the school-spirit design defaults until approved colors are entered above."}</p>
  </div>}
  <div className="growth-grid">
   <label className="growth-field"><span>Skilled Crafting logo (required)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e.target.files?.[0],setBusinessLogo)}/></label>
   {brochure&&<label className="growth-field"><span>Mascot / hero artwork (optional; otherwise uses the selected school logo)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e.target.files?.[0],setMascotArtwork)}/></label>}
   {brochure&&<details className="growth-field"><summary>Optional scenic school background</summary><p>Upload a licensed landscape image without baked-in wording. The flyer adds editable school text and artwork over the design.</p><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e.target.files?.[0],setBackgroundArtwork)}/></details>}
   {Object.entries({phone:"Business phone",email:"Business email",website:"Business website",address:"Business address"}).map(([k,label])=><label className="growth-field" key={k}><span>{label}</span><input value={contact[k]} onChange={e=>setContact({...contact,[k]:e.target.value})}/></label>)}
   <label className="growth-field"><span>Program benefits / next steps</span><textarea rows="3" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
  </div>
  {businessLogo&&<img src={businessLogo} alt="Business logo preview" style={{maxWidth:120,maxHeight:90,objectFit:"contain"}}/>}
  {logo&&<img src={logo} alt="School logo preview" style={{maxWidth:120,maxHeight:90,objectFit:"contain"}}/>}
  {brochure&&mascotArtwork&&<img src={mascotArtwork} alt="Selected hero mascot artwork" style={{maxWidth:120,maxHeight:90,objectFit:"contain"}}/>}
  {!brochure&&<MarketingSupplierCompare onChoose={item=>{
   setProducts(ps=>ps.length>=25?ps:[...ps,{...fresh("other"),name:item.name||"Product",sku:item.sku||"",sizes:(item.sizes||[]).join(", "),colors:(item.colors||[]).join(", ")}]);
   setError("Supplier selection added. Verify product availability and enter your approved wholesale/retail prices; supplier costs are not exported.");
  }}/>}
  {brochure&&<h4>Step 3 — Apparel mockups and verified pricing</h4>}
  {products.map((p,index)=><article className="growth-subcard" key={p.id}>
   <h4>Product {index+1}: {p.name}</h4>
   <div className="growth-grid">
    <label className="growth-field"><span>Type</span><select value={p.type} onChange={e=>patch(p.id,{type:e.target.value})}>{["tee","hoodie","polo","hat","tote","other"].map(t=><option key={t}>{t}</option>)}</select></label>
    {Object.entries({name:"Product name",sku:"Verified SKU",sizes:"Verified sizes",colors:"Verified colors"}).map(([k,label])=><label className="growth-field" key={k}><span>{label}</span><input value={p[k]} onChange={e=>patch(p.id,{[k]:e.target.value})}/></label>)}
    <label className="growth-field"><span>Licensed blank product photo</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e.target.files?.[0],v=>patch(p.id,{photo:v}))}/></label>
    {Object.entries({x:"Horizontal placement",y:"Vertical placement",scale:"Logo width"}).map(([k,label])=><label className="growth-field" key={k}><span>{label}: {p[k]}%</span><input type="range" min={k==="scale"?5:10} max={k==="scale"?75:90} value={p[k]} onChange={e=>patch(p.id,{[k]:Number(e.target.value)})}/></label>)}
   </div>
   {p.photo&&<div style={{position:"relative",width:240,maxWidth:"100%",margin:"12px 0"}}>
    <img src={p.photo} alt="Blank garment" style={{width:"100%",display:"block"}}/>
    {logo&&<img src={logo} alt="School logo placement" style={{position:"absolute",left:p.x+"%",top:p.y+"%",width:p.scale+"%",transform:"translate(-50%,-50%)",pointerEvents:"none"}}/>}
   </div>}
   <button type="button" className="sc-btn" disabled={!p.photo||!logo} onClick={()=>render(p)}>Render exact-artwork mockup</button>
   {p.mockup&&<img src={p.mockup} alt={p.name+" mockup"} style={{width:150,maxHeight:190,objectFit:"contain",marginLeft:12}}/>}
   <h4>Wholesale → retail pricing matrix</h4>
   <div style={{overflowX:"auto"}}><table><thead><tr><th>Minimum qty</th><th>Wholesale</th><th>Retail</th><th>School / club keeps</th><th/></tr></thead><tbody>{p.tiers.map((t,i)=><tr key={i}>
    <td><input aria-label="Minimum quantity" type="number" min="1" value={t.min} onChange={e=>tier(p.id,i,"min",e.target.value)}/></td>
    {["wholesale","retail"].map(k=><td key={k}><input aria-label={k+" price"} type="number" min="0" step="0.01" value={t[k]} onChange={e=>tier(p.id,i,k,e.target.value)}/></td>)}
    <td>{t.wholesale!==""&&t.retail!==""&&Number(t.retail)>=Number(t.wholesale)?"$"+(Number(t.retail)-Number(t.wholesale)).toFixed(2):"—"}</td>
    <td><button type="button" disabled={p.tiers.length===1} onClick={()=>patch(p.id,{tiers:p.tiers.filter((_,j)=>j!==i)})}>Remove</button></td>
   </tr>)}</tbody></table></div>
   <button type="button" className="sc-btn" disabled={p.tiers.length>=7} onClick={()=>patch(p.id,{tiers:[...p.tiers,{min:24,wholesale:"",retail:""}]})}>Add quantity tier</button>
   <button type="button" className="sc-btn" disabled={products.length===1} onClick={()=>setProducts(ps=>ps.filter(x=>x.id!==p.id))}>Remove product</button>
  </article>)}
  <button type="button" className="sc-btn" disabled={products.length>=25} onClick={()=>setProducts(ps=>[...ps,fresh("other")])}>Add product</button>
  <p><small>Mockups are conceptual and require artwork approval. School earnings are retail minus agreed decorated wholesale price, not Skilled Crafting's internal supplier cost. Tax, shipping, returns, payment collection, payout and fulfillment must be confirmed in writing.</small></p>
  {brochure&&<h4>Step 4 — Preview the actual PDF, then download</h4>}
  {brochure&&<div className="growth-actions">
   <button type="button" className="sc-btn sc-btn-primary" disabled={busy} onClick={preview}>{busy?"Rendering flyer…":"Preview finished two-page flyer"}</button>
   <button type="button" className="sc-btn" disabled={busy||!previewBlob} onClick={download}>Download this PDF</button>
  </div>}
  {brochure&&previewUrl&&<div className="growth-subcard">
   <h4>Actual PDF preview — both pages</h4>
   <p>This is the same PDF that will download. Editing products or branding requires a new preview.</p>
   <iframe title="Branded school spirit wear PDF preview" src={previewUrl+"#toolbar=1&view=FitH"} style={{width:"100%",height:920,border:"1px solid #9aaabc",background:"#fff"}}/>
  </div>}
  {!brochure&&<button type="button" className="sc-btn sc-btn-primary" disabled={busy} onClick={download}>{busy?"Preparing…":"Download multi-page catalog PDF"}</button>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
