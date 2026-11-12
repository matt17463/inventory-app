import {useEffect,useRef,useState} from "react";
import {authenticatedFunctionFetch} from "./lib/netlifyFunctionClient";
import {supabase} from "./supabaseClient";
import {loadLocalAiConnection,localAiCall} from "./lib/localAiGateway";
import {marketingLogoImage,marketingLogoBlob,marketingImageDataUrl,marketingSharedImageUrl} from "./lib/marketingArtwork";
import MarketingApparelComposer from "./MarketingApparelComposer";
import {approvedMarketingPhotoCandidates} from "./lib/marketingApprovedPhotoAssets";
import {growthWriteAllowed} from "./lib/marketingApi";
import {DEFAULT_STUDIO_LAYOUT,normalizeStudioLayout} from "./lib/marketingStudioLayoutControls";
import {DESIGN_CATEGORIES,DESIGN_STYLES,designCategory,designStudioPrompt,resolveDesignTokens,studioPrintHtml,offlineStudioArtwork,studioLayoutSections,studioExportReadiness,inspectStudioPrintDom} from "./lib/marketingDesignStudio";

const defaults={
 school:{headline:"SCHOOL SPIRIT WEAR PROGRAM",description:"Build school pride. Support your programs. Make ordering easier.",benefits:"SCHOOL PRIDE — Quality school-branded apparel\nPROGRAM FUNDING — Support school activities\nEASY ONLINE ORDERS — Dedicated storefront\nLOCAL SUPPORT — Artwork and fulfillment",steps:"Plan together\nWe build your store\nSupporters order\nYour program benefits"},
 business:{headline:"CUSTOM APPAREL & BRANDED MERCHANDISE",description:"Make your business stand out with professional custom products.",benefits:"Professional brand presentation\nUniform and workwear options\nCustom promotional gifts\nLocal production support",steps:"Choose products\nApprove artwork\nConfirm pricing\nProduce and deliver"},
 team:{headline:"TEAM PRIDE STARTS HERE",description:"Custom gear for players, coaches and fans.",benefits:"Coordinated team apparel\nFan merchandise\nCoach recognition\nFundraising opportunities",steps:"Choose your gear\nApprove the design\nOpen ordering\nCelebrate your team"},
 nonprofit:{headline:"MERCHANDISE WITH A MISSION",description:"Build awareness and support your community.",benefits:"Mission-driven designs\nSupporter merchandise\nFlexible fundraising\nLocal fulfillment",steps:"Plan your campaign\nApprove artwork\nInvite supporters\nReview results"},
 wedding:{headline:"PERSONALIZED MOMENTS",description:"Custom gifts, keepsakes and event details.",benefits:"Personalized glassware\nEngraved keepsakes\nCustom signage\nCoordinated gifts",steps:"Share your vision\nSelect products\nApprove proofs\nCelebrate"},
 general:{headline:"BRING YOUR BRAND TO LIFE",description:"Distinctive custom merchandise and promotional products.",benefits:"Personalized products\nProfessional artwork\nFlexible ordering\nLocal support",steps:"Plan\nDesign\nApprove\nProduce"}
};
async function renderOfflineArtwork(svg){
 const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));
 try{
  const img=new Image();img.src=url;await img.decode();
  const canvas=document.createElement("canvas");canvas.width=960;canvas.height=1200;
  const context=canvas.getContext("2d");if(!context)throw Error("Canvas rendering is unavailable.");
  context.drawImage(img,0,0,960,1200);
  return canvas.toDataURL("image/jpeg",0.86);
 }finally{URL.revokeObjectURL(url);}
}
function FlyerFrame({html,label}){
 const ref=useRef(null);
 const [scale,setScale]=useState(0.35);
 useEffect(()=>{
  if(!ref.current)return;
  const update=()=>setScale(Math.max(0.1,ref.current.clientWidth/816));
  update();
  const observer=new ResizeObserver(update);
  observer.observe(ref.current);
  return ()=>observer.disconnect();
 },[]);
 return <div ref={ref} style={{width:"100%",aspectRatio:"816 / 1056",position:"relative",overflow:"hidden",background:"#fff",boxShadow:"0 5px 20px #1b3e591f",border:"1px solid #d4dee7"}}>
  <iframe title={label} srcDoc={html} sandbox="" tabIndex={-1} loading="lazy" style={{width:816,height:1056,transform:`scale(${scale})`,transformOrigin:"top left",pointerEvents:"none",border:0,display:"block"}}/>
 </div>;
}
export default function MarketingAIDesignStudio({accountId="",organization="",template="",segment="",logo="",colors=[],description="",contact="",approvedProductImages=[],onUseLegacy}){
 const category=designCategory(template,segment);
 const [style,setStyle]=useState("athletic");
 const [mode,setMode]=useState("hybrid");
 const [prompt,setPrompt]=useState("");
 const [concepts,setConcepts]=useState([]);
 const [plans,setPlans]=useState([]);
 const [layoutAdjustments,setLayoutAdjustments]=useState({});
 const [lockedSections,setLockedSections]=useState([]);
 const [releaseConfirmed,setReleaseConfirmed]=useState(false);
 const [savedDesigns,setSavedDesigns]=useState([]);
 const [draftBusy,setDraftBusy]=useState(false);
 const [draftMessage,setDraftMessage]=useState("");
 const [selected,setSelected]=useState(0);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [progress,setProgress]=useState("");
 const [headline,setHeadline]=useState("");
 const [body,setBody]=useState("");
 const [benefits,setBenefits]=useState("");
 const [steps,setSteps]=useState("");
 const [cta,setCta]=useState("");
 const [contactText,setContactText]=useState("");
 const [productImages,setProductImages]=useState([]);
 const [approvedPhotoCandidates,setApprovedPhotoCandidates]=useState([]);
 const [approvedStoreProducts,setApprovedStoreProducts]=useState([]);
 const [approvedPhotoBusy,setApprovedPhotoBusy]=useState(false);
 const [approvedPhotoStatus,setApprovedPhotoStatus]=useState("");
 useEffect(()=>{
  const d=defaults[category]||defaults.general;
  setHeadline(d.headline);setBody(description||d.description);setBenefits(d.benefits);setSteps(d.steps);
  setCta("LET'S BUILD YOUR "+(organization||"CUSTOM")+" PROGRAM!");
  setContactText(contact);setConcepts([]);setPlans([]);setLayoutAdjustments({});setSelected(0);setPrompt("");setProductImages([]);setLockedSections([]);setReleaseConfirmed(false);setApprovedPhotoCandidates([]);setApprovedStoreProducts([]);setApprovedPhotoStatus("");
 },[accountId,category,organization]);
 useEffect(()=>{let active=true;if(!accountId)return;supabase.from("sc_growth_documents").select("id,title,updated_at,content").eq("account_id",accountId).eq("template_id","ai-design-studio").eq("status","draft").order("updated_at",{ascending:false}).limit(15).then(({data,error})=>{if(active&&!error)setSavedDesigns(data||[]);});return()=>{active=false};},[accountId]);
 async function findApprovedPhotos(){
  if(!accountId)return;
  setApprovedPhotoBusy(true);setApprovedPhotoStatus("");
  try{
   const {data,error}=await supabase.from("sc_growth_documents")
    .select("id,title,status,content").eq("account_id",accountId)
    .eq("status","approved").order("updated_at",{ascending:false}).limit(30);
   if(error)throw Error(error.message);
   const results=approvedMarketingPhotoCandidates(data,20);
   setApprovedPhotoCandidates(results);
   setApprovedPhotoStatus(results.length?results.length+" approved document image(s) found. Review and select only the applicable merchandise.":"No reusable approved merchandise images were found for this client.");
  }catch(e){setApprovedPhotoStatus("Could not load approved client imagery: "+e.message);}
  finally{setApprovedPhotoBusy(false);}
 }
 async function importApprovedPhoto(item){
  if(mergedProductImages.length>=4)return;
  setApprovedPhotoBusy(true);setApprovedPhotoStatus("");
  try{
   let blob;
   if(item.reference.key)blob=await marketingLogoBlob(accountId,item.reference.key);
   else{
    const url=await marketingSharedImageUrl(accountId,item.reference);
    const response=await fetch(url,{cache:"no-store",referrerPolicy:"no-referrer"});
    if(!response.ok)throw Error("Approved image download failed.");
    blob=await response.blob();
   }
   if(!["image/png","image/jpeg","image/webp"].includes(blob.type)||!blob.size||blob.size>2500000)throw Error("Approved image must be PNG, JPEG or WebP under 2.5 MB.");
   const image=await marketingImageDataUrl(blob);
   setProductImages(current=>[...current,image].slice(0,4));
   setApprovedPhotoCandidates(current=>current.filter(x=>x.id!==item.id));
   setApprovedPhotoStatus("Approved client image added. Verify the product and decoration before sharing.");
  }catch(e){setApprovedPhotoStatus("Could not import image: "+e.message);}
  finally{setApprovedPhotoBusy(false);}
 }
 async function addProductPhotos(event){
  const files=Array.from(event.target.files||[]).slice(0,4-mergedProductImages.length);
  try{
   const images=await Promise.all(files.map(file=>new Promise((resolve,reject)=>{
    if(!file.type.match(/^image\/(png|jpeg|webp)$/)||file.size>5000000)return reject(Error("Use PNG, JPEG or WebP images under 5 MB."));
    const img=new Image();const url=URL.createObjectURL(file);
    img.onload=()=>{try{const canvas=document.createElement("canvas");const scale=Math.min(1,900/Math.max(img.width,img.height));canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.85));}catch(e){reject(e)}finally{URL.revokeObjectURL(url)}};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(Error("Image could not be opened."))};img.src=url;
   })));
   setProductImages(v=>[...v,...images].slice(0,4));setError("");
  }catch(e){setError(e.message||"Unable to add product images.")}
  event.target.value="";
 }
 const previewHtml=(i)=>studioPrintHtml({client:organization,category,style,concept:i,mode,plan:plans[i],layoutAdjustments:layoutAdjustments[i]||DEFAULT_STUDIO_LAYOUT,image:concepts[i]||"",logo,headline,description:body,benefits:benefits.split("\n").filter(Boolean),steps:steps.split("\n").filter(Boolean),cta,contact:contactText,productImages:mergedProductImages,colors});
 async function storeImage(image){
  if(!image)return null;
  const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if(!match)throw Error("Generated artwork is not a valid image.");
  const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-artwork-asset",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({account_id:accountId,mime_type:match[1],base64:match[2]})});
  const data=await response.json();
  if(!response.ok||!data.asset)throw Error(data.message||"Private image storage failed.");
  return data.asset;
 }
 async function saveDesign(){
  if(!growthWriteAllowed()){setError("Saving is unavailable in training mode.");return;}
  if(!accountId||!concepts.length){setError("Select a client and generate concepts before saving.");return;}
  setDraftBusy(true);setError("");setDraftMessage("");
  try{
   const references=[];
   for(const image of concepts)references.push(await storeImage(image));
   const productReferences=[];
   for(const image of mergedProductImages)productReferences.push(await storeImage(image));
   const content={studioVersion:4,lockedSections,layoutAdjustments,organization,category,style,mode,prompt:visualPrompt,selected,plans,references,productReferences,headline,body,benefits,steps,cta,contactText};
   const {data,error}=await supabase.from("sc_growth_documents").insert({account_id:accountId,template_id:"ai-design-studio",title:(organization+" — AI Design Studio").slice(0,200),content}).select("id,title,updated_at,content").single();
   if(error)throw error;
   setSavedDesigns(v=>[data,...v]);setDraftMessage("Three concepts and your edits saved privately to this client.");
  }catch(e){setError(e.message||"Could not save design.");}
  finally{setDraftBusy(false);}
 }
 async function reopenDesign(draft){
  setDraftBusy(true);setError("");setDraftMessage("");
  try{
   const {data,error}=await supabase.from("sc_growth_documents").select("id,content").eq("id",draft.id).eq("account_id",accountId).eq("status","draft").single();
   if(error||!data?.content)throw Error("Design draft not available.");
   const d=data.content;
   if(!Array.isArray(d.references)||d.references.length>3)throw Error("Invalid saved design.");
   const images=[];
   for(const ref of d.references){if(!ref?.key)throw Error("Missing private image reference.");images.push(await marketingLogoImage(accountId,ref.key));}
   setConcepts(images);setPlans(Array.isArray(d.plans)?d.plans:[]);setLayoutAdjustments(d.layoutAdjustments&&typeof d.layoutAdjustments==="object"?Object.fromEntries(Object.entries(d.layoutAdjustments).filter(([key])=>/^[012]$/.test(key)).map(([key,value])=>[key,normalizeStudioLayout(value)])):{});setLockedSections(Array.isArray(d.lockedSections)?d.lockedSections.filter(x=>["products","benefits","steps"].includes(x)):[]);setSelected(Math.min(images.length-1,Math.max(0,d.selected||0)));
   const products=[];
   if(Array.isArray(d.productReferences))for(const ref of d.productReferences.slice(0,4)){if(!ref?.key)throw Error("Invalid product asset reference.");products.push(await marketingLogoImage(accountId,ref.key));}
   else if(Array.isArray(d.productImages))products.push(...d.productImages.slice(0,4).filter(value=>/^data:image\/(png|jpeg|webp);base64,/i.test(value||"")));
   setStyle(d.style||"athletic");setMode(d.mode||"hybrid");setPrompt(d.prompt||"");setHeadline(d.headline||"");setBody(d.body||"");setBenefits(d.benefits||"");setSteps(d.steps||"");setCta(d.cta||"");setContactText(d.contactText||"");setProductImages(products);
   setReleaseConfirmed(false);
   setDraftMessage("Saved concepts and design instructions restored. Confirm artwork and copy again before export.");
  }catch(e){setError(e.message||"Could not reopen design.");}
  finally{setDraftBusy(false);}
 }
 const mergedProductImages=[...productImages,...(Array.isArray(approvedProductImages)?approvedProductImages:[])].filter(x=>/^data:image\/(png|jpeg|webp);base64,/i.test(x||"")).slice(0,4);
 useEffect(()=>{setReleaseConfirmed(false);},[selected,headline,body,benefits,steps,cta,contactText,productImages,approvedProductImages,plans,concepts,layoutAdjustments,logo,style,mode,category,colors.join(",")]);
 const visualPrompt=resolveDesignTokens(prompt||designStudioPrompt({category,style,client:organization,colors,instructions:description}),{school_name:organization,client_name:organization,school_logo:logo?"Approved client logo supplied as image reference":"",client_logo:logo?"Approved client logo supplied as image reference":"",primary_color:colors[0],secondary_color:colors[1],accent_color:colors[2],business_website:"skilledcrafting.com"});
 async function generate(){
  if(!accountId){setError("Select a saved client first.");return;}
  setBusy(true);setError("");setConcepts([]);setPlans([]);setLayoutAdjustments({});setSelected(0);
  const created=[],layouts=[];
  try{
   let localEnabled=false;
   try{const connection=await loadLocalAiConnection();localEnabled=connection.configured;}catch{localEnabled=false;}
   for(let i=0;i<3;i++){
    setProgress("Creating design concept "+(i+1)+" of 3…");
    let localPlan=null;
    if(localEnabled){try{const result=await localAiCall("/layout",{organization,category,colors,concept:i+1,prompt:visualPrompt});if(result?.plan&&Array.isArray(result.plan.sections))localPlan=result.plan;}catch{localEnabled=false;}}
    if(localPlan){layouts.push(localPlan);const image=await renderOfflineArtwork(offlineStudioArtwork({concept:i+1,colors,style,category}));created.push(image);setPlans([...layouts]);setConcepts([...created]);continue;}
    const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-ai-layout",{
     method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({account_id:accountId,organization,category,colors,concept:i+1,prompt:visualPrompt,offline:true})
    });
    const data=await response.json();
    if(!response.ok||!data.plan)throw Error(data.message||"Unable to prepare layout.");
    layouts.push(data.plan);
    const image=await renderOfflineArtwork(offlineStudioArtwork({concept:i+1,colors,style,category}));
    created.push(image);setPlans([...layouts]);setConcepts([...created]);
   }
   setProgress("Three branded concepts ready without paid APIs. Local Ollama was used for layout planning when available; otherwise the offline fallback was used.");
  }catch(e){setError(e.message||"Unable to create layouts.");setProgress(created.length+" concept(s) ready.");}
  finally{setBusy(false);}
 }
 async function findApprovedStoreMockups(){
  if(!accountId)return;
  setApprovedPhotoBusy(true);setApprovedPhotoStatus("");
  try{
   const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-store-assortment?account_id="+encodeURIComponent(accountId));
   const result=await response.json();
   if(!response.ok)throw Error(result.message||"No verified store assortment is available.");
   const products=(Array.isArray(result.products)?result.products:[]).slice(0,30);
   setApprovedStoreProducts(products);
   setApprovedPhotoStatus(products.length?"Select a verified, approved decorated mockup from this client's active storefront.":"No eligible published storefront products were found.");
  }catch(e){setApprovedStoreProducts([]);setApprovedPhotoStatus("Approved store mockups unavailable: "+e.message);}
  finally{setApprovedPhotoBusy(false);}
 }
 async function importStoreMockup(assetId){
  if(!accountId||mergedProductImages.length>=4)return;
  setApprovedPhotoBusy(true);setApprovedPhotoStatus("");
  try{
   const url=await marketingSharedImageUrl(accountId,{source:"mockup_outputs",asset_id:assetId});
   const response=await fetch(url,{cache:"no-store",referrerPolicy:"no-referrer"});
   if(!response.ok)throw Error("Selected approved mockup download failed.");
   const blob=await response.blob();
   if(!["image/png","image/jpeg","image/webp"].includes(blob.type)||blob.size>5_000_000||!blob.size)throw Error("Approved mockup must be PNG, JPEG or WebP under 5 MB.");
   const image=await marketingImageDataUrl(blob);
   setProductImages(previous=>[...previous,image].slice(0,4));
   setApprovedPhotoStatus("Approved decorated mockup added. Confirm product and color before export.");
  }catch(e){setApprovedPhotoStatus("Approved mockup could not be loaded: "+e.message);}
  finally{setApprovedPhotoBusy(false);}
 }
 function checkPrintReady(){
  const readiness=studioExportReadiness({client:organization,category,logo,headline,description:body,benefits:benefits.split("\n").filter(Boolean),steps:steps.split("\n").filter(Boolean),cta,contact:contactText,productImages:mergedProductImages});
  if(!readiness.ready){setError("Client-ready export blocked: "+readiness.errors.join(" "));return false;}
  if(!releaseConfirmed){setError("Confirm client artwork, factual copy and merchandise approval before exporting.");return false;}
  return true;
 }
 function updateSelectedLayout(name,value){
  if(lockedSections.length){setError("Unlock placements before changing page geometry.");return;}
  setLayoutAdjustments(previous=>({...previous,[selected]:normalizeStudioLayout({...previous[selected],[name]:value})}));
 }
 function moveSectionFirst(section){
  if(lockedSections.length){setError("Unlock section placements before rearranging the page.");return;}
  setPlans(current=>current.map((plan,i)=>i!==selected?plan:{...plan,sections:["hero",section,...studioLayoutSections(plan,selected).filter(k=>k!==section),"cta"]}));
 }
 async function regenerateSelected(){
  if(!concepts[selected]||busy)return;
  if(lockedSections.length){setError("Unlock layout sections before regenerating the selected concept.");return;}
  setBusy(true);setError("");
  try{
   const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-ai-layout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({account_id:accountId,organization,category,colors,concept:selected+1,prompt:visualPrompt,offline:true})});
   const result=await response.json();if(!response.ok||!result.plan)throw Error(result.message||"Unable to regenerate selected layout.");
   const artwork=await renderOfflineArtwork(offlineStudioArtwork({concept:selected+1,colors,style,category}));
   setPlans(old=>old.map((v,i)=>i===selected?result.plan:v));setConcepts(old=>old.map((v,i)=>i===selected?artwork:v));
   setProgress("Only concept "+(selected+1)+" was regenerated. Approved copy and other concepts are unchanged.");
  }catch(e){setError(e.message||"Could not regenerate selected concept.");}finally{setBusy(false);}
 }
 function printFlyer(){
  if(!concepts[selected]){setError("Generate and select a concept first.");return;}
  if(!checkPrintReady())return;
  // The HTML is created by the same safe compositor as the live proof.
  const html=previewHtml(selected);
  const popup=window.open("","_blank");
  if(!popup){
   setError("The browser blocked the print window. Enable pop-ups for Skilled Crafting and retry.");
   return;
  }
  popup.addEventListener("load",()=>{
   const fonts=popup.document.fonts?.ready||Promise.resolve();
   const images=Array.from(popup.document.images).map(img=>img.decode().catch(()=>{}));
   const backdrop=concepts[selected] ? new Promise((resolve,reject)=>{
    const img=new Image();img.onload=resolve;img.onerror=()=>reject(Error("The concept background could not be loaded for printing."));img.src=concepts[selected];
   }):Promise.resolve();
   Promise.all([fonts,backdrop,...images]).then(()=>{
    if(popup.closed)return;
    const issues=inspectStudioPrintDom(popup.document);
    if(issues.length){setError("Print blocked: "+issues.join(" "));popup.close();return;}
    popup.focus();popup.print();
   }).catch(e=>{setError(e.message||"Print assets could not be prepared.");if(!popup.closed)popup.close();});
  },{once:true});
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  setProgress("Choose Save as PDF in the browser's print dialog. US Letter, scale 100%, no margins, background graphics enabled.");
 }
 function exportHtml(){
  if(!concepts[selected]){setError("Generate and select a concept first.");return;}
  if(!checkPrintReady())return;
  const html=previewHtml(selected);
  const blob=new Blob([html],{type:"text/html;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="skilled-crafting-"+category+"-flyer.html";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
 }

 return <section className="growth-subcard" aria-label="AI Document Design Studio">
  <h3>AI Document Design Studio</h3>
  <p>Primary creative workflow · {DESIGN_CATEGORIES[category].label}. Generate three branded concepts without paid image APIs, choose your favorite, and review verified text before export. The classic document builder remains available below.</p>
  <div className="growth-grid">
   <label className="growth-field"><span>Creative style</span><select value={style} onChange={e=>setStyle(e.target.value)}>{DESIGN_STYLES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
   <label className="growth-field"><span>Document editing mode</span><select value={mode} onChange={e=>setMode(e.target.value)}><option value="hybrid">Hybrid — editable text and AI artwork</option><option value="artwork">Artwork-first — AI illustration with verified overlays</option></select></label>
  </div>
  <label className="growth-field"><span>Editable creative direction (up to 12,000 characters)</span><textarea rows={9} maxLength={12000} value={visualPrompt} onChange={e=>setPrompt(e.target.value)} /></label>
  <button type="button" className="sc-btn" onClick={()=>setPrompt("")}>Reset to category prompt</button>
  <button type="button" className="sc-btn" disabled={busy||!accountId} onClick={generate}>{busy?progress:"Generate 3 design concepts — no API credits"}</button>
  {progress&&<p role="status">{progress}</p>}
  {draftMessage&&<p role="status">{draftMessage}</p>}
  {error&&<p role="alert">{error}</p>}
  <div className="growth-subcard">
   <h4>Approved product photography — up to four</h4>
   <p>Use approved decorated mockups, choose imagery from this client\u0027s approved documents, or create a garment proof with the composer below. No fabricated products or pricing.</p>
   {!mergedProductImages.length&&<p role="status"><strong>Draft preview only:</strong> add approved merchandise images before sharing a client-ready flyer.</p>}
   {!!approvedProductImages.length&&<p>{Math.min(4,approvedProductImages.length)} previously uploaded image(s) are available from the classic builder. They are used after any images added here.</p>}
   <button type="button" className="sc-btn" disabled={!accountId||approvedPhotoBusy||mergedProductImages.length>=4} onClick={findApprovedPhotos}>{approvedPhotoBusy?"Loading approved images…":"Find images from this client's approved documents"}</button>
   {!!approvedPhotoStatus&&<p role="status">{approvedPhotoStatus}</p>}
   <button type="button" className="sc-btn" disabled={!accountId||approvedPhotoBusy||mergedProductImages.length>=4} onClick={findApprovedStoreMockups}>Find approved decorated mockups from this client's active store</button>
   {!!approvedStoreProducts.length&&<div className="growth-grid">{approvedStoreProducts.flatMap(product=>(product.images||[]).map(image=>({key:product.name+":"+image.assetId,name:product.name,color:image.color,assetId:image.assetId}))).map(item=><div className="growth-field" key={item.key}><strong>{item.name}</strong><small>Approved color: {item.color||"Not specified"}</small><button type="button" className="sc-btn" disabled={approvedPhotoBusy||mergedProductImages.length>=4} onClick={()=>importStoreMockup(item.assetId)}>Use approved store mockup</button></div>)}</div>}
   {!!approvedPhotoCandidates.length&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8}}>{approvedPhotoCandidates.map(item=><div className="growth-subcard" key={item.id}><small>{item.title}</small><button type="button" className="sc-btn" disabled={approvedPhotoBusy||mergedProductImages.length>=4} onClick={()=>importApprovedPhoto(item)}>Use approved image</button></div>)}</div>}
   <input aria-label="Add approved product images" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={mergedProductImages.length>=4} onChange={addProductPhotos}/>
   {!!productImages.length&&<div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{productImages.map((src,i)=><div key={i}><img src={src} alt={"Approved product "+(i+1)} style={{width:110,height:110,objectFit:"contain"}}/><button type="button" onClick={()=>setProductImages(v=>v.filter((_,j)=>j!==i))}>Remove</button></div>)}</div>}
  </div>
  <MarketingApparelComposer key={accountId} accountId={accountId} logo={logo} disabled={busy||draftBusy||mergedProductImages.length>=4} onAdd={image=>setProductImages(current=>[...current,image].slice(0,4))}/>
  {!!concepts.length&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16}}>{concepts.map((src,i)=><button type="button" key={i} className="growth-subcard" aria-pressed={selected===i} onClick={()=>setSelected(i)} style={{border:selected===i?"3px solid #3988dd":"1px solid #64748b",textAlign:"left"}}>
   <FlyerFrame html={previewHtml(i)} label={"Complete flyer concept "+(i+1)}/>
   <strong style={{display:"block",marginTop:12}}>Concept {i+1}{selected===i?" — selected":""} · {["Athletic campaign","Modern editorial","Bold school pride"][i]}</strong>
  </button>)}</div>}
  {!!concepts.length&&<section className="growth-subcard" aria-label="Selective layout editor">
   <h4>Selected concept layout and section locks</h4>
   <p>Reorder the merchandise, benefits and process sections without replacing approved artwork or text. Lock a section to protect its position.</p>
   <div className="growth-grid">
    <label className="growth-field"><span>Hero area height (inches)</span><input type="range" min="2.8" max="3.65" step=".05" value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).heroHeight} disabled={lockedSections.length>0} onChange={e=>updateSelectedLayout("heroHeight",Number(e.target.value))}/><small>{(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).heroHeight.toFixed(2)} in</small></label>
    <label className="growth-field"><span>Merchandise display height (inches)</span><input type="range" min="1.5" max="2.5" step=".05" value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).galleryHeight} disabled={lockedSections.length>0} onChange={e=>updateSelectedLayout("galleryHeight",Number(e.target.value))}/><small>{(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).galleryHeight.toFixed(2)} in</small></label>
    <label className="growth-field"><span>Section spacing (inches)</span><input type="range" min=".06" max=".22" step=".01" value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).spacing} disabled={lockedSections.length>0} onChange={e=>updateSelectedLayout("spacing",Number(e.target.value))}/><small>{(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).spacing.toFixed(2)} in</small></label>
    <label className="growth-field"><span>Merchandise arrangement</span><select value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).presentation} disabled={lockedSections.length>0} onChange={e=>updateSelectedLayout("presentation",e.target.value)}><option value="overlap">Layered merchandise</option><option value="grid">Clean catalog grid</option></select></label>
    {studioLayoutSections(plans[selected],selected).map(section=><div key={section} className="growth-field">
     <strong style={{textTransform:"capitalize"}}>{section}</strong>
     <label><input type="checkbox" checked={lockedSections.includes(section)} onChange={e=>setLockedSections(v=>e.target.checked?[...v,section]:v.filter(x=>x!==section))}/> Lock placement</label>
     <button type="button" className="sc-btn" disabled={lockedSections.length>0} onClick={()=>moveSectionFirst(section)}>Move first</button>
    </div>)}
   </div>
   <button type="button" className="sc-btn" disabled={busy||draftBusy||lockedSections.length>0} onClick={regenerateSelected}>Regenerate selected concept only</button>
  </section>}
  {!!concepts.length&&<section className="growth-subcard" aria-label="Selected flyer proof"><h4>Selected full-page flyer proof — Concept {selected+1}</h4><p>Preview uses the same HTML, branding and approved merchandise images as the print export. The product-image placeholder means the flyer is not ready for client sharing.</p><div style={{maxWidth:640,margin:"0 auto"}}><FlyerFrame html={previewHtml(selected)} label="Large selected flyer proof"/></div></section>}

  {mode==="hybrid"&&<div className="growth-grid">
   <label className="growth-field"><span>Verified headline</span><input value={headline} onChange={e=>setHeadline(e.target.value)}/></label>
   <label className="growth-field"><span>Verified description</span><textarea value={body} onChange={e=>setBody(e.target.value)}/></label>
   <label className="growth-field"><span>Benefits — one per line</span><textarea rows={5} value={benefits} onChange={e=>setBenefits(e.target.value)}/></label>
   <label className="growth-field"><span>How it works — one per line</span><textarea rows={5} value={steps} onChange={e=>setSteps(e.target.value)}/></label>
   <label className="growth-field"><span>Call to action</span><input value={cta} onChange={e=>setCta(e.target.value)}/></label>
   <label className="growth-field"><span>Verified business contact details</span><textarea value={contactText} onChange={e=>setContactText(e.target.value)}/></label>
  </div>}
  {mode==="artwork"&&<p>Artwork-first mode uses a full-bleed image-led layout; the approved logo and factual text remain separately overlaid. Switch to Hybrid to edit each text section.</p>}
  <button type="button" className="sc-btn" disabled={!concepts.length||busy||draftBusy} onClick={saveDesign}>{draftBusy?"Saving or restoring…":"Save all concepts to client draft"}</button>
  {!!savedDesigns.length&&<label className="growth-field"><span>Reopen saved AI design</span><select defaultValue="" onChange={e=>{const draft=savedDesigns.find(x=>x.id===e.target.value);if(draft)reopenDesign(draft);}}><option value="">Select saved draft</option>{savedDesigns.map(d=><option key={d.id} value={d.id}>{d.title} · {new Date(d.updated_at).toLocaleDateString()}</option>)}</select></label>}
  {!!concepts.length&&<label className="growth-field"><input type="checkbox" checked={releaseConfirmed} onChange={e=>setReleaseConfirmed(e.target.checked)}/> I have verified the client identity and rights to use the logo, approved all merchandise images, and checked the factual copy and contact information for this export.</label>}
  <button type="button" className="sc-btn" disabled={!concepts.length||busy} onClick={printFlyer}>Print selected flyer / Save as PDF</button>
  <button type="button" className="sc-btn" disabled={!concepts.length||busy} onClick={exportHtml}>Download editable print HTML</button>
  <p>Complete previews use editable approved copy, your approved logo and optional verified merchandise photography. The Print / Save as PDF button opens the browser print dialog using the exact preview layout. For high-quality results, choose US Letter, 100% scale, no margins and background graphics. When your private Tailscale Ollama gateway is configured, layout plans are generated on your Mac; otherwise deterministic offline plans are used. Backgrounds remain original abstract artwork, not fabricated product photos. Approved logos and verified copy remain editable overlays. Local ComfyUI image generation and real product mockups are planned enhancements.</p>
  {onUseLegacy&&<button type="button" className="sc-btn" onClick={onUseLegacy}>Open classic document builder</button>}
 </section>;
}
