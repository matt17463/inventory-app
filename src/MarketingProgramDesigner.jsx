import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { authenticatedFunctionFetch } from "./lib/netlifyFunctionClient";
import { growthWriteAllowed } from "./lib/marketingApi";
import { marketingImageDataUrl, marketingLogoBlob } from "./lib/marketingArtwork";
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
export default function MarketingProgramDesigner({mode,organization="",schoolLogo="",selectedProductImage="",confirmedColors=[],description="",accountId="",onRestoreBranding}){
 const brochure=mode==="brochure-schools";
 const [businessLogo,setBusinessLogo]=useState(""),[mascotArtwork,setMascotArtwork]=useState(""),[backgroundArtwork,setBackgroundArtwork]=useState("");
 const [previewBlob,setPreviewBlob]=useState(null),[previewUrl,setPreviewUrl]=useState("");
 const [contact,setContact]=useState({phone:"",email:"",website:"https://skilledcrafting.com",address:""});
 const [products,setProducts]=useState(()=>brochure?[fresh("tee"),fresh("hoodie")]:[fresh()]);
 const [notes,setNotes]=useState(""),[headline,setHeadline]=useState("WEAR YOUR SCHOOL PRIDE"),[tagline,setTagline]=useState("Spirit wear for students, families, staff and supporters");
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 const artworkRefCache=useRef(new Map());
 const [savedFlyers,setSavedFlyers]=useState([]),[draftId,setDraftId]=useState(""),[draftUpdatedAt,setDraftUpdatedAt]=useState(""),[savingDraft,setSavingDraft]=useState(false),[saveMessage,setSaveMessage]=useState("");
 const [restoredBranding,setRestoredBranding]=useState(null);
 const actualOrganization=restoredBranding?.organization??organization;
 const actualSchoolLogo=restoredBranding?.schoolLogo??schoolLogo;
 const actualColors=restoredBranding?.colors??confirmedColors;
 const actualDescription=restoredBranding?.description??description;
 useEffect(()=>{if(!accountId||!brochure){setSavedFlyers([]);return;}
  let active=true;
  supabase.from("sc_growth_documents").select("id,title,status,updated_at,content").eq("account_id",accountId).eq("template_id","brochure-schools").eq("status","draft").order("updated_at",{ascending:false}).limit(30)
   .then(({data,error})=>{if(active){if(error)setError("Saved school flyers could not be loaded: "+error.message);else setSavedFlyers((data||[]).filter(row=>row.content?.kind==="school_flyer_v1"));}});
  return ()=>{active=false;};
 },[accountId,brochure]);
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
 const logo=actualSchoolLogo;
 const artwork=mascotArtwork||logo;
 const colorSignature=actualColors.join(",");
 useEffect(()=>{setRestoredBranding(null);},[organization,schoolLogo,description,confirmedColors.join(",")]);
 useEffect(()=>{setPreviewBlob(null);},[actualOrganization,logo,mascotArtwork,backgroundArtwork,businessLogo,products,contact,notes,headline,tagline,actualDescription,colorSignature]);
 useEffect(()=>{
   if(!previewBlob){setPreviewUrl("");return;}
   const url=URL.createObjectURL(previewBlob);
   setPreviewUrl(url);
   return ()=>URL.revokeObjectURL(url);
 },[previewBlob]);
 const brochureData=()=>({organization:actualOrganization,contact,businessLogo,schoolLogo:logo,heroArtwork:artwork,backgroundArtwork,notes,headline,tagline,programDescription:actualDescription,colors:actualColors,products});
 const patch=(id,changes)=>setProducts(list=>list.map(p=>p.id===id?{...p,...changes,mockup:changes.mockup??(changes.photo!==undefined||changes.x!==undefined||changes.y!==undefined||changes.scale!==undefined?"":p.mockup)}:p));
 const upload=async(file,callback)=>{try{const v=await fileImage(file);if(v){callback(v);setError("");}}catch(e){setError(e.message);}};
 const tier=(id,index,key,value)=>setProducts(list=>list.map(p=>p.id===id?{...p,tiers:p.tiers.map((t,i)=>i===index?{...t,[key]:value}:t)}:p));
 async function render(p){try{if(!p.photo||!logo)throw Error("Upload a licensed product photo and school logo first.");patch(p.id,{mockup:await compose(p.photo,logo,p)});setError("");}catch(e){setError(e.message);}}
 async function refreshSaved(){
  const {data,error}=await supabase.from("sc_growth_documents").select("id,title,status,updated_at,content")
   .eq("account_id",accountId).eq("template_id","brochure-schools").eq("status","draft")
   .order("updated_at",{ascending:false}).limit(30);
  if(error)throw Error(error.message);
  setSavedFlyers((data||[]).filter(row=>row.content?.kind==="school_flyer_v1"));
 }
 async function storeArtwork(value){
  if(!value)return null;
  if(artworkRefCache.current.has(value))return artworkRefCache.current.get(value);
  const match=/^data:(image\\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if(!match)throw Error("Only uploaded PNG, JPEG or WebP artwork can be saved.");
  const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-artwork-asset",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({account_id:accountId,mime_type:match[1],base64:match[2]})
  });
  const result=await response.json();
  if(!response.ok||!result.asset)throw Error(result.message||"Private R2 artwork upload failed.");
  artworkRefCache.current.set(value,result.asset);
  return result.asset;
 }
 async function restoreArtwork(reference){
  if(!reference)return "";
  if(!reference.key||reference.storage_provider!=="r2")throw Error("Invalid stored flyer artwork reference.");
  return marketingImageDataUrl(await marketingLogoBlob(accountId,reference.key));
 }
 async function saveFlyer(){
  try{
   if(!accountId)throw Error("Select an existing client in Step 1 to save this flyer.");
   if(!growthWriteAllowed())throw Error("Training mode: changes are not saved.");
   if(!logo||!actualColors.length)throw Error("Confirm the school logo and colors before saving.");
   setSavingDraft(true);setError("");setSaveMessage("");
   // Keep image bytes in private client-scoped R2; only references go in Supabase.
   const artworkValues=[businessLogo,logo,mascotArtwork,backgroundArtwork,...products.flatMap(p=>[p.photo,p.mockup])].filter(Boolean);
   const refs=new Map();
   for(const image of new Set(artworkValues))refs.set(image,await storeArtwork(image));
   const content={
    kind:"school_flyer_v1",organization:actualOrganization,colors:actualColors,description:actualDescription,
    contact,notes,headline,tagline,
    businessLogo:refs.get(businessLogo)||null,schoolLogo:refs.get(logo)||null,
    mascotArtwork:refs.get(mascotArtwork)||null,backgroundArtwork:refs.get(backgroundArtwork)||null,
    products:products.map(({photo,mockup,...rest})=>({...rest,photo:refs.get(photo)||null,mockup:refs.get(mockup)||null}))
   };
   const row={template_id:"brochure-schools",title:(actualOrganization+" — School spirit-wear flyer").slice(0,200),content};
   const query=supabase.from("sc_growth_documents");
   const mutation=draftId
    ?query.update(row).eq("id",draftId).eq("account_id",accountId).eq("status","draft").eq("updated_at",draftUpdatedAt)
    :query.insert({...row,account_id:accountId});
   const {data,error}=await mutation.select("id,updated_at").maybeSingle();
   if(error)throw Error(error.message);
   if(!data)throw Error("This draft was modified or approved elsewhere. Reload before saving.");
   setDraftId(data.id);setDraftUpdatedAt(data.updated_at);
   setSaveMessage("Editable school flyer saved privately under this client.");
   await refreshSaved();
  }catch(e){setError(e.message||"Could not save school flyer.");}
  finally{setSavingDraft(false);}
 }
 async function reopenFlyer(id){
  try{
   if(!accountId)throw Error("Select a client first.");
   setSavingDraft(true);setError("");setSaveMessage("");
   const {data,error}=await supabase.from("sc_growth_documents").select("id,updated_at,content")
    .eq("id",id).eq("account_id",accountId).eq("template_id","brochure-schools").eq("status","draft").single();
   if(error||data?.content?.kind!=="school_flyer_v1")throw Error("The editable school flyer draft is unavailable.");
   const c=data.content;
   const cache=new Map();
   const restore=async(ref)=>{
    if(!ref)return "";
    const key=ref.key;
    if(!cache.has(key))cache.set(key,await restoreArtwork(ref));
    const image=cache.get(key);artworkRefCache.current.set(image,ref);
    return image;
   };
   const restoredProducts=[];
   for(const p of c.products||[])restoredProducts.push({...p,photo:await restore(p.photo),mockup:await restore(p.mockup)});
   const restoredLogo=await restore(c.schoolLogo);
   setBusinessLogo(await restore(c.businessLogo));
   setMascotArtwork(await restore(c.mascotArtwork));
   setBackgroundArtwork(await restore(c.backgroundArtwork));
   setProducts(restoredProducts);
   setContact(c.contact||{phone:"",email:"",website:"https://skilledcrafting.com",address:""});
   setNotes(c.notes||"");setHeadline(c.headline||"WEAR YOUR SCHOOL PRIDE");setTagline(c.tagline||"");
   setRestoredBranding({organization:c.organization||"",schoolLogo:restoredLogo,colors:c.colors||[],description:c.description||""});
   onRestoreBranding?.({organization:c.organization||"",schoolLogo:restoredLogo,colors:c.colors||[],description:c.description||""});
   setDraftId(data.id);setDraftUpdatedAt(data.updated_at);setPreviewBlob(null);
   setSaveMessage("School flyer reopened. Review and preview again before downloading.");
  }catch(e){setError(e.message||"Could not reopen school flyer.");}
  finally{setSavingDraft(false);}
 }
 function preview(){
  try{
   setBusy(true);setError("");
   if(!logo)throw Error("Select the school\'s approved logo in Step 1 before creating a flyer.");
   if(!actualColors.length)throw Error("Confirm at least one approved school color in Step 1 before creating the flyer.");
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
   <p><strong>School design colors:</strong> {actualColors.length?actualColors.join(", "):"Using the school-spirit design defaults until approved colors are entered above."}</p>
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
  {brochure&&<div className="growth-subcard">
   <h4>Save or reopen this client's editable flyer</h4>
   <p>Artwork is stored privately in R2 and draft details in the client document library. Saving does not publish or approve the flyer.</p>
   <button type="button" className="sc-btn" disabled={!accountId||savingDraft} onClick={saveFlyer}>{savingDraft?"Saving…":draftId?"Save changes to flyer":"Save new flyer draft"}</button>
   {savedFlyers.length>0&&<label className="growth-field"><span>Reopen an existing school flyer draft</span><select value={draftId} disabled={savingDraft} onChange={e=>{if(e.target.value)reopenFlyer(e.target.value);}}>
    <option value="">Choose a saved draft</option>{savedFlyers.map(row=><option key={row.id} value={row.id}>{row.title} — {new Date(row.updated_at).toLocaleDateString()}</option>)}
   </select></label>}
   {saveMessage&&<p role="status">{saveMessage}</p>}
  </div>}
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
