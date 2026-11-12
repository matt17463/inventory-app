import {useEffect,useRef,useState} from "react";
import {authenticatedFunctionFetch} from "./lib/netlifyFunctionClient";
import {supabase} from "./supabaseClient";
import {loadLocalAiConnection,localAiCall} from "./lib/localAiGateway";
import {marketingLogoImage,marketingLogoBlob,marketingImageDataUrl,marketingSharedImageUrl} from "./lib/marketingArtwork";
import MarketingApparelComposer from "./MarketingApparelComposer";
import {approvedMarketingPhotoCandidates} from "./lib/marketingApprovedPhotoAssets";
import {growthWriteAllowed} from "./lib/marketingApi";
import {DEFAULT_STUDIO_LAYOUT,normalizeStudioLayout} from "./lib/marketingStudioLayoutControls";
import {schoolFundraisingExample,defaultSchoolFundraising,normalizeSchoolFundraising,blankFundraisingProduct,MAX_FUNDRAISING_PRODUCTS} from "./lib/marketingSchoolFundraising";
import {defaultStudioServices,normalizeStudioServices,validateStudioServices} from "./lib/marketingStudioServices";
import {checkStudioPrintImages} from "./lib/marketingStudioPrintImages";
import {DESIGN_CATEGORIES,DESIGN_STYLES,designCategory,designStudioPrompt,resolveDesignTokens,studioPrintHtml,offlineStudioHeroArtwork,studioLayoutSections,studioMoveSectionFirst,studioMergeLockedSections,studioExportReadiness,inspectStudioPrintDom} from "./lib/marketingDesignStudio";

const defaults={
 school:{headline:"SCHOOL SPIRIT WEAR PROGRAM",description:"Build school pride. Support your programs. Make ordering easier.",benefits:"SCHOOL PRIDE — Quality school-branded apparel\nPROGRAM FUNDING — Support school activities\nEASY ONLINE ORDERS — Dedicated storefront\nLOCAL SUPPORT — Artwork and fulfillment",steps:"Plan together\nWe build your store\nSupporters order\nYour program benefits"},
 business:{headline:"CUSTOM APPAREL & BRANDED MERCHANDISE",description:"Make your business stand out with professional custom products.",benefits:"Professional brand presentation\nUniform and workwear options\nCustom promotional gifts\nLocal production support",steps:"Choose products\nApprove artwork\nConfirm pricing\nProduce and deliver"},
 team:{headline:"TEAM PRIDE STARTS HERE",description:"Custom gear for players, coaches and fans.",benefits:"Coordinated team apparel\nFan merchandise\nCoach recognition\nFundraising opportunities",steps:"Choose your gear\nApprove the design\nOpen ordering\nCelebrate your team"},
 nonprofit:{headline:"MERCHANDISE WITH A MISSION",description:"Build awareness and support your community.",benefits:"Mission-driven designs\nSupporter merchandise\nFlexible fundraising\nLocal fulfillment",steps:"Plan your campaign\nApprove artwork\nInvite supporters\nReview results"},
 wedding:{headline:"PERSONALIZED MOMENTS",description:"Custom gifts, keepsakes and event details.",benefits:"Personalized glassware\nEngraved keepsakes\nCustom signage\nCoordinated gifts",steps:"Share your vision\nSelect products\nApprove proofs\nCelebrate"},
 event:{headline:"MAKE YOUR EVENT UNFORGETTABLE",description:"Custom merchandise and meaningful details for your next gathering.",benefits:"Event-branded apparel\nPersonalized keepsakes\nSigns and giveaways\nPlanning and production support",steps:"Plan the event\nSelect products\nApprove proof\nCoordinate delivery"},
 general:{headline:"BRING YOUR BRAND TO LIFE",description:"Distinctive custom merchandise and promotional products.",benefits:"Personalized products\nProfessional artwork\nFlexible ordering\nLocal support",steps:"Plan\nDesign\nApprove\nProduce"}
};
async function renderOfflineArtwork(svg){
 const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));
 try{
  const img=new Image();img.src=url;await img.decode();
  const canvas=document.createElement("canvas");canvas.width=2550;canvas.height=1150;
  const context=canvas.getContext("2d");if(!context)throw Error("Canvas rendering is unavailable.");
  context.drawImage(img,0,0,2550,1150);
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
 const detectedCategory=designCategory(template,segment);
 const [categoryOverride,setCategoryOverride]=useState("");
 const category=categoryOverride||detectedCategory;
 const [style,setStyle]=useState("athletic");
 useEffect(()=>setCategoryOverride(""),[accountId,template,segment]);
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
 const [schoolFundraising,setSchoolFundraising]=useState(defaultSchoolFundraising);
 const [studioServices,setStudioServices]=useState(()=>defaultStudioServices(category));
 const [productImages,setProductImages]=useState([]);
 const [productLabels,setProductLabels]=useState(["","","",""]);
 const [approvedPhotoCandidates,setApprovedPhotoCandidates]=useState([]);
 const [approvedStoreProducts,setApprovedStoreProducts]=useState([]);
 const [approvedPhotoBusy,setApprovedPhotoBusy]=useState(false);
 const [approvedPhotoStatus,setApprovedPhotoStatus]=useState("");
 useEffect(()=>{
  const d=defaults[category]||defaults.general;
  setHeadline(d.headline);setBody(description||d.description);setBenefits(d.benefits);setSteps(d.steps);
  setCta("LET'S BUILD YOUR "+(organization||"CUSTOM")+" PROGRAM!");
  setContactText(contact);setSchoolFundraising(defaultSchoolFundraising());setStudioServices(defaultStudioServices(category));setConcepts([]);setPlans([]);setLayoutAdjustments({});setSelected(0);setPrompt("");setProductImages([]);setProductLabels(["","","",""]);setLockedSections([]);setReleaseConfirmed(false);setApprovedPhotoCandidates([]);setApprovedStoreProducts([]);setApprovedPhotoStatus("");
 },[accountId,detectedCategory,organization]);
 useEffect(()=>{let active=true;if(!accountId)return;supabase.from("sc_growth_documents").select("id,title,updated_at,content").eq("account_id",accountId).eq("template_id","ai-design-studio").eq("status","draft").order("updated_at",{ascending:false}).limit(15).then(({data,error})=>{if(active&&!error)setSavedDesigns(data||[]);});return()=>{active=false};},[accountId]);
 function changeCampaignCategory(next){
  if(!Object.hasOwn(DESIGN_CATEGORIES,next))return;
  setCategoryOverride(next);
  const d=defaults[next]||defaults.general;
  setHeadline(d.headline);setBody(d.description);setBenefits(d.benefits);setSteps(d.steps);
  setConcepts([]);setPlans([]);setLayoutAdjustments({});setSelected(0);setLockedSections([]);
  setSchoolFundraising(defaultSchoolFundraising());setStudioServices(defaultStudioServices(next));
  setReleaseConfirmed(false);setProgress("");
 }
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
 function removeProductImage(index){
  setProductImages(previous=>previous.filter((_,i)=>i!==index));
  setProductLabels(previous=>[...previous.filter((_,i)=>i!==index),""].slice(0,4));
  setReleaseConfirmed(false);
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
 const previewHtml=(i)=>studioPrintHtml({client:organization,category,style,concept:i,mode,plan:plans[i],layoutAdjustments:layoutAdjustments[i]||DEFAULT_STUDIO_LAYOUT,image:concepts[i]||"",logo,headline,description:body,benefits:benefits.split("\n").filter(Boolean),steps:steps.split("\n").filter(Boolean),cta,contact:contactText,productImages:mergedProductImages,productLabels,colors,schoolFundraising,studioServices});
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
   const content={studioVersion:7,lockedSections,layoutAdjustments,schoolFundraising,studioServices,productLabels,organization,category,style,mode,prompt:visualPrompt,selected,plans,references,productReferences,headline,body,benefits,steps,cta,contactText};
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
   setConcepts(images);setPlans(Array.isArray(d.plans)?d.plans:[]);setLayoutAdjustments(d.layoutAdjustments&&typeof d.layoutAdjustments==="object"?Object.fromEntries(Object.entries(d.layoutAdjustments).filter(([key])=>/^[012]$/.test(key)).map(([key,value])=>[key,normalizeStudioLayout(value)])):{});setLockedSections(Array.isArray(d.lockedSections)?d.lockedSections.filter(x=>["hero","products","benefits","steps"].includes(x)):[]);setSelected(Math.min(images.length-1,Math.max(0,d.selected||0)));
   const products=[];
   if(Array.isArray(d.productReferences))for(const ref of d.productReferences.slice(0,4)){if(!ref?.key)throw Error("Invalid product asset reference.");products.push(await marketingLogoImage(accountId,ref.key));}
   else if(Array.isArray(d.productImages))products.push(...d.productImages.slice(0,4).filter(value=>/^data:image\/(png|jpeg|webp);base64,/i.test(value||"")));
   setCategoryOverride(d.category&&Object.hasOwn(DESIGN_CATEGORIES,d.category)?d.category:detectedCategory);
   setStyle(d.style||"athletic");setMode(d.mode||"hybrid");setPrompt(d.prompt||"");setHeadline(d.headline||"");setBody(d.body||"");setBenefits(d.benefits||"");setSteps(d.steps||"");setCta(d.cta||"");setContactText(d.contactText||"");setProductLabels(Array.isArray(d.productLabels)?[...d.productLabels.slice(0,4).map(x=>String(x||"").slice(0,60)),"","","",""].slice(0,4):["","","",""]);setSchoolFundraising(normalizeSchoolFundraising(d.schoolFundraising));setStudioServices(normalizeStudioServices(d.studioServices,d.category||detectedCategory));setProductImages(products);
   setReleaseConfirmed(false);
   setDraftMessage("Saved concepts and design instructions restored. Confirm artwork and copy again before export.");
  }catch(e){setError(e.message||"Could not reopen design.");}
  finally{setDraftBusy(false);}
 }
 const mergedProductImages=[...new Set([...productImages,...(Array.isArray(approvedProductImages)?approvedProductImages:[])].filter(x=>/^data:image\/(png|jpeg|webp);base64,/i.test(x||"")))].slice(0,4);
 useEffect(()=>{setReleaseConfirmed(false);},[selected,headline,body,benefits,steps,cta,contactText,productImages,productLabels,approvedProductImages,plans,concepts,layoutAdjustments,schoolFundraising,studioServices,logo,style,mode,category,colors.join(",")]);
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
    if(localPlan){layouts.push(localPlan);const image=await renderOfflineArtwork(offlineStudioHeroArtwork({concept:i+1,colors,style,category}));created.push(image);setPlans([...layouts]);setConcepts([...created]);continue;}
    const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-ai-layout",{
     method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({account_id:accountId,organization,category,colors,concept:i+1,prompt:visualPrompt,offline:true})
    });
    const data=await response.json();
    if(!response.ok||!data.plan)throw Error(data.message||"Unable to prepare layout.");
    layouts.push(data.plan);
    const image=await renderOfflineArtwork(offlineStudioHeroArtwork({concept:i+1,colors,style,category}));
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
 async function importStoreMockup(assetId,displayName=""){
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
   setProductLabels(previous=>previous.map((text,i)=>i===productImages.length?String(displayName).slice(0,60):text));
   setApprovedPhotoStatus("Approved decorated mockup added. Confirm product and color before export.");
  }catch(e){setApprovedPhotoStatus("Approved mockup could not be loaded: "+e.message);}
  finally{setApprovedPhotoBusy(false);}
 }
 function checkPrintReady(){
  const readiness=studioExportReadiness({client:organization,category,logo,headline,description:body,benefits:benefits.split("\n").filter(Boolean),steps:steps.split("\n").filter(Boolean),cta,contact:contactText,productImages:mergedProductImages});
  if(!readiness.ready){setError("Client-ready export blocked: "+readiness.errors.join(" "));return false;}
  const services=validateStudioServices(studioServices,category);
  if(!services.ready){setError("Artwork services need review: "+services.errors.join(" "));return false;}
  const funding=["school","team","nonprofit"].includes(category)?schoolFundraisingExample(schoolFundraising):{ready:true};
  if(!funding.ready){setError("Fundraising example needs verification: "+funding.errors.join(" "));return false;}
  if(!releaseConfirmed){setError("Confirm client artwork, factual copy and merchandise approval before exporting.");return false;}
  return true;
 }
 function updateFundraisingProduct(index,key,value){
  setSchoolFundraising(current=>({...current,products:normalizeSchoolFundraising(current).products.map((row,i)=>i===index?{...row,[key]:value}:row)}));
 }
 function addFundraisingProduct(){
  setSchoolFundraising(current=>{
   const products=normalizeSchoolFundraising(current).products;
   return {...current,products:products.length>=MAX_FUNDRAISING_PRODUCTS?products:[...products,blankFundraisingProduct()]};
  });
 }
 function removeFundraisingProduct(index){
  setSchoolFundraising(current=>{
   const products=normalizeSchoolFundraising(current).products.filter((_,i)=>i!==index);
   return {...current,products:products.length?products:[blankFundraisingProduct()]};
  });
 }
 function updateSelectedLayout(name,value){
  const lockedProperty=lockedSections.includes("hero")&&["headlineX","headlineY","heroHeight","mascotSide","mascotSize","mascotOpacity","sceneOpacity"].includes(name)||lockedSections.includes("products")&&["galleryX","galleryY","galleryHeight","presentation"].includes(name);
  if(lockedProperty){setError("Unlock this element before changing its position or appearance.");return;}
  setLayoutAdjustments(previous=>({...previous,[selected]:normalizeStudioLayout({...previous[selected],[name]:value})}));
 }
 function moveSectionFirst(section){
  if(lockedSections.includes(section)){setError("Unlock this section before changing its position.");return;}
  setPlans(current=>current.map((plan,i)=>i!==selected?plan:{...plan,sections:["hero",...studioMoveSectionFirst(plan,section,lockedSections,selected),"cta"]}));
 }
 async function regenerateSelected(){
  if(!concepts[selected]||busy)return;
  // Locked positions survive regeneration. A locked hero also retains its artwork.
  setBusy(true);setError("");
  try{
   const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-ai-layout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({account_id:accountId,organization,category,colors,concept:selected+1,prompt:visualPrompt,offline:true})});
   const result=await response.json();if(!response.ok||!result.plan)throw Error(result.message||"Unable to regenerate selected layout.");
   const artwork=await renderOfflineArtwork(offlineStudioHeroArtwork({concept:selected+1,colors,style,category}));
   setPlans(old=>old.map((v,i)=>i===selected?{...result.plan,sections:["hero",...studioMergeLockedSections(v,result.plan,lockedSections,selected),"cta"]}:v));
   if(!lockedSections.includes("hero"))setConcepts(old=>old.map((v,i)=>i===selected?artwork:v));
   setProgress("Only concept "+(selected+1)+" was regenerated. Approved copy and other concepts are unchanged.");
  }catch(e){setError(e.message||"Could not regenerate selected concept.");}finally{setBusy(false);}
 }
 async function generatePremiumSelected(){
  if(!accountId||!concepts[selected]||busy){setError("Select a saved client and a design concept first.");return;}
  setBusy(true);setError("");setProgress("Generating a premium background for the selected concept using the configured paid image API…");
  try{
   const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-ai-visual",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
     account_id:accountId,
     organization,segment:category,template_id:category+"-studio-flyer",
     template_label:"AI Studio "+category+" visual background",
     aspect_ratio:"landscape",colors,style,description:body,
     purpose:"Create a text-free scene for the selected Skilled Crafting marketing flyer. All logos, merchandise mockups, and verified copy are separate editable overlays.",
     visual_prompt:visualPrompt
    })
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.message||"Premium artwork generation failed.");
   if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(result.image||""))throw Error("Image service returned an invalid background image.");
   setConcepts(current=>current.map((old,i)=>i===selected?result.image:old));
   setReleaseConfirmed(false);
   setProgress("Premium scene added to concept "+(selected+1)+". Review generated scenery before sharing; approved client identity and products remain independent.");
  }catch(e){setError(e.message||"Premium background unavailable. Offline concepts remain usable.");setProgress("");}
  finally{setBusy(false);}
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
   Promise.all([fonts,backdrop,...images]).then(async()=>{
    if(popup.closed)return;
    const layoutIssues=inspectStudioPrintDom(popup.document);
    const photoChecks=await checkStudioPrintImages(popup.document,{scene:concepts[selected]||""});
    const issues=[...layoutIssues,...photoChecks.errors];
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
   <label className="growth-field"><span>Campaign audience</span><select aria-label="Campaign audience" value={category} onChange={e=>changeCampaignCategory(e.target.value)}>{Object.entries(DESIGN_CATEGORIES).map(([key,info])=><option key={key} value={key}>{info.label}</option>)}</select></label>
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
   {!!approvedStoreProducts.length&&<div className="growth-grid">{approvedStoreProducts.flatMap(product=>(product.images||[]).map(image=>({key:product.name+":"+image.assetId,name:product.name,color:image.color,assetId:image.assetId}))).map(item=><div className="growth-field" key={item.key}><strong>{item.name}</strong><small>Approved color: {item.color||"Not specified"}</small><button type="button" className="sc-btn" disabled={approvedPhotoBusy||mergedProductImages.length>=4} onClick={()=>importStoreMockup(item.assetId,item.name+(item.color?" · "+item.color:""))}>Use approved store mockup</button></div>)}</div>}
   {!!approvedPhotoCandidates.length&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8}}>{approvedPhotoCandidates.map(item=><div className="growth-subcard" key={item.id}><small>{item.title}</small><button type="button" className="sc-btn" disabled={approvedPhotoBusy||mergedProductImages.length>=4} onClick={()=>importApprovedPhoto(item)}>Use approved image</button></div>)}</div>}
   <input aria-label="Add approved product images" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={mergedProductImages.length>=4} onChange={addProductPhotos}/>
   <div className="growth-grid">{mergedProductImages.map((src,i)=><label className="growth-field" key={"caption-"+i}><span>Verified caption for merchandise {i+1}</span><input maxLength={60} placeholder="e.g., School hoodie · Heather Grey" value={productLabels[i]||""} onChange={e=>setProductLabels(v=>v.map((text,j)=>j===i?e.target.value:text))}/></label>)}</div>
   {!!productImages.length&&<div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{productImages.map((src,i)=><div key={i}><img src={src} alt={"Approved product "+(i+1)} style={{width:110,height:110,objectFit:"contain"}}/><button type="button" onClick={()=>removeProductImage(i)}>Remove</button></div>)}</div>}
  </div>
  <MarketingApparelComposer key={accountId} accountId={accountId} logo={logo} disabled={busy||draftBusy||mergedProductImages.length>=4} onAdd={image=>setProductImages(current=>[...current,image].slice(0,4))}/>
  {!!concepts.length&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16}}>{concepts.map((src,i)=><button type="button" key={i} className="growth-subcard" aria-pressed={selected===i} onClick={()=>setSelected(i)} style={{border:selected===i?"3px solid #3988dd":"1px solid #64748b",textAlign:"left"}}>
   <FlyerFrame html={previewHtml(i)} label={"Complete flyer concept "+(i+1)}/>
   <strong style={{display:"block",marginTop:12}}>Concept {i+1}{selected===i?" — selected":""} · {["Athletic campaign","Modern editorial","Bold school pride"][i]}</strong>
  </button>)}</div>}
  {!!concepts.length&&<section className="growth-subcard" aria-label="Selective layout editor">
   <h4>Selected concept layout and section locks</h4>
   <p>Reorder the merchandise, benefits and process sections without replacing approved artwork or text. Lock a section to protect its position.</p>
   <label className="growth-field"><input type="checkbox" checked={lockedSections.includes("hero")} onChange={e=>setLockedSections(v=>e.target.checked?[...v,"hero"]:v.filter(x=>x!=="hero"))}/> Lock hero headline placement</label>
   <div className="growth-grid">
    <label className="growth-field"><span>Hero area height (inches)</span><input type="range" min="2.8" max="3.65" step=".05" value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).heroHeight} disabled={lockedSections.includes("hero")} onChange={e=>updateSelectedLayout("heroHeight",Number(e.target.value))}/><small>{(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).heroHeight.toFixed(2)} in</small></label>
    <label className="growth-field"><span>Merchandise display height (inches)</span><input type="range" min="1.5" max="2.5" step=".05" value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).galleryHeight} disabled={lockedSections.includes("products")} onChange={e=>updateSelectedLayout("galleryHeight",Number(e.target.value))}/><small>{(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).galleryHeight.toFixed(2)} in</small></label>
    <label className="growth-field"><span>Section spacing (inches)</span><input type="range" min=".06" max=".22" step=".01" value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).spacing} disabled={false} onChange={e=>updateSelectedLayout("spacing",Number(e.target.value))}/><small>{(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).spacing.toFixed(2)} in</small></label>
    <label className="growth-field"><span>Merchandise arrangement</span><select value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).presentation} disabled={lockedSections.includes("products")} onChange={e=>updateSelectedLayout("presentation",e.target.value)}><option value="overlap">Layered merchandise</option><option value="grid">Clean catalog grid</option></select></label>
    <label className="growth-field"><span>Headline position: horizontal</span><input type="range" min="-.2" max=".2" step=".05" value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).headlineX} disabled={lockedSections.includes("hero")} onChange={e=>updateSelectedLayout("headlineX",Number(e.target.value))}/><small>{(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).headlineX.toFixed(2)} in</small></label>
    <label className="growth-field"><span>Headline position: vertical</span><input type="range" min="-.2" max=".2" step=".05" value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).headlineY} disabled={lockedSections.includes("hero")} onChange={e=>updateSelectedLayout("headlineY",Number(e.target.value))}/><small>{(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).headlineY.toFixed(2)} in</small></label>
    <label className="growth-field"><span>Merchandise position: horizontal</span><input type="range" min="-.15" max=".15" step=".05" value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).galleryX} disabled={lockedSections.includes("products")} onChange={e=>updateSelectedLayout("galleryX",Number(e.target.value))}/><small>{(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).galleryX.toFixed(2)} in</small></label>
    <label className="growth-field"><span>Merchandise position: vertical</span><input type="range" min="-.15" max=".15" step=".05" value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).galleryY} disabled={lockedSections.includes("products")} onChange={e=>updateSelectedLayout("galleryY",Number(e.target.value))}/><small>{(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).galleryY.toFixed(2)} in</small></label>
    <label className="growth-field"><span>Scenery visibility</span><input type="range" min=".08" max=".5" step=".02" value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).sceneOpacity} onChange={e=>updateSelectedLayout("sceneOpacity",Number(e.target.value))}/><small>{Math.round((layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).sceneOpacity*100)}% opacity</small></label>
    {category==="school"&&<label className="growth-field"><span>Decorative approved crest position</span><select value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).mascotSide} onChange={e=>updateSelectedLayout("mascotSide",e.target.value)}><option value="right">Right side</option><option value="left">Left side</option></select></label>}
    {category==="school"&&<label className="growth-field"><span>Decorative approved crest size</span><input type="range" min="1.5" max="3.1" step=".1" value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).mascotSize} onChange={e=>updateSelectedLayout("mascotSize",Number(e.target.value))}/><small>{(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).mascotSize.toFixed(1)} in</small></label>}
    {category==="school"&&<label className="growth-field"><span>Decorative approved crest visibility</span><input type="range" min=".08" max=".25" step=".01" value={(layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).mascotOpacity} onChange={e=>updateSelectedLayout("mascotOpacity",Number(e.target.value))}/><small>{Math.round((layoutAdjustments[selected]||DEFAULT_STUDIO_LAYOUT).mascotOpacity*100)}% opacity</small></label>}
    {studioLayoutSections(plans[selected],selected).map(section=><div key={section} className="growth-field">
     <strong style={{textTransform:"capitalize"}}>{section}</strong>
     <label><input type="checkbox" checked={lockedSections.includes(section)} onChange={e=>setLockedSections(v=>e.target.checked?[...v,section]:v.filter(x=>x!==section))}/> Lock placement</label>
     <button type="button" className="sc-btn" disabled={lockedSections.includes(section)} onClick={()=>moveSectionFirst(section)}>Move first</button>
    </div>)}
   </div>
   <button type="button" className="sc-btn" disabled={busy||draftBusy} onClick={regenerateSelected}>Regenerate selected concept only</button>
   <button type="button" className="sc-btn" disabled={busy||draftBusy||!accountId} onClick={generatePremiumSelected}>Generate premium AI scenery for selected concept — paid API credits</button>
   <p><small>Optional. Uses the configured OpenAI image-generation API and may incur charges. Only the decorative background is generated; the app does not send logos or product mockup imagery to this request. Review the result before sharing.</small></p>
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
  <section className="growth-subcard" aria-label="Artwork services and optional pricing" id="studio-services">
   <h4>Step 3 — Tailor artwork services for this {DESIGN_CATEGORIES[category].label.toLowerCase()} campaign</h4>
   <p>Customize exactly what Skilled Crafting offers this client. These descriptions appear on the finished flyer; no claims, designs, prices or services are generated as verified facts.</p>
   <label className="growth-field"><input type="checkbox" checked={studioServices.enabled} onChange={e=>setStudioServices(old=>({...old,enabled:e.target.checked}))}/> Show an artwork and special-design services section</label>
   {studioServices.enabled&&<div className="growth-grid">
    <label className="growth-field"><span>Section title</span><input maxLength={92} value={studioServices.heading} onChange={e=>setStudioServices(old=>({...old,heading:e.target.value}))}/></label>
    <label className="growth-field"><span>Description of available services</span><textarea maxLength={280} rows={3} value={studioServices.description} onChange={e=>setStudioServices(old=>({...old,description:e.target.value}))}/></label>
    <label className="growth-field"><span>Examples or seasonal / sport-specific options (optional)</span><textarea maxLength={125} rows={2} value={studioServices.examples} onChange={e=>setStudioServices(old=>({...old,examples:e.target.value}))}/></label>
    <button className="sc-btn" type="button" onClick={()=>setStudioServices(defaultStudioServices(category))}>Restore {DESIGN_CATEGORIES[category].label.toLowerCase()} service suggestions</button>
   </div>}
   {["school","team","nonprofit"].includes(category)&&<div className="growth-subcard">
    <h4>{category==="school"?"School":category==="team"?"Team / club":"Nonprofit"} fundraising examples — up to four products</h4>
    <p>Use approved <strong>decorated wholesale</strong> and retail prices, not internal supplier costs. The calculation shows illustrative gross proceeds before taxes, payment fees, shipping, refunds, and other expenses.</p>
    <label className="growth-field"><input type="checkbox" checked={schoolFundraising.enabled} onChange={e=>setSchoolFundraising(old=>({...old,enabled:e.target.checked}))}/> Include itemized illustrative fundraising figures in this flyer</label>
    {schoolFundraising.enabled&&<>
     {normalizeSchoolFundraising(schoolFundraising).products.map((product,i)=><fieldset key={i} className="growth-subcard" style={{border:"1px solid #bccbd8",padding:12,borderRadius:8}}>
      <legend><strong>Product {i+1} of {normalizeSchoolFundraising(schoolFundraising).products.length}</strong></legend>
      <div className="growth-grid">
       <label className="growth-field"><span>Product title / style (required)</span><input maxLength={80} placeholder="Gildan 18500 hoodie" value={product.title} onChange={e=>updateFundraisingProduct(i,"title",e.target.value)}/></label>
       <label className="growth-field"><span>Decorated wholesale price ($)</span><input inputMode="decimal" placeholder="17.25" value={product.wholesale} onChange={e=>updateFundraisingProduct(i,"wholesale",e.target.value)}/></label>
       <label className="growth-field"><span>Approved retail price ($)</span><input inputMode="decimal" placeholder="28.50" value={product.retail} onChange={e=>updateFundraisingProduct(i,"retail",e.target.value)}/></label>
       <label className="growth-field"><span>Illustrative quantity</span><input inputMode="numeric" placeholder="75" value={product.quantity} onChange={e=>updateFundraisingProduct(i,"quantity",e.target.value)}/></label>
      </div>
      {normalizeSchoolFundraising(schoolFundraising).products.length>1&&<button type="button" className="sc-btn" onClick={()=>removeFundraisingProduct(i)}>Remove product {i+1}</button>}
     </fieldset>)}
     <button type="button" className="sc-btn" onClick={addFundraisingProduct} disabled={normalizeSchoolFundraising(schoolFundraising).products.length>=MAX_FUNDRAISING_PRODUCTS}>Add product pricing option ({normalizeSchoolFundraising(schoolFundraising).products.length}/{MAX_FUNDRAISING_PRODUCTS})</button>
     {(()=>{const result=schoolFundraisingExample(schoolFundraising);return result.ready?<div role="status"><strong>Illustrative gross proceeds: {result.grandTotal}</strong><p>{result.examples.map(row=>row.title+": "+row.quantity+" × "+row.perItem+" = "+row.total).join(" | ")}</p></div>:<p role="alert">Verify pricing: {result.errors.join(" ")}</p>})()}
    </>}
   </div>}
  </section>
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
