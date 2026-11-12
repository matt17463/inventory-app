import {useEffect,useRef,useState} from "react";
import {authenticatedFunctionFetch} from "./lib/netlifyFunctionClient";
import {supabase} from "./supabaseClient";
import {loadLocalAiConnection,localAiCall} from "./lib/localAiGateway";
import {marketingLogoImage,marketingLogoBlob,marketingImageDataUrl,marketingSharedImageUrl} from "./lib/marketingArtwork";
import MarketingApparelComposer from "./MarketingApparelComposer";
import {marketingFlyerChecks} from "./lib/marketingFlyerChecks";
import {marketingPrintImageCheck,marketingPrintPreflightSummary} from "./lib/marketingPrintPreflight";
import {schoolArtworkServiceOptions,verifiedFundraisingRows} from "./lib/marketingSchoolProgram";
import {marketingCampaignProfile,marketingCampaignMood} from "./lib/marketingCampaignProfiles";
import {approvedMarketingPhotoCandidates} from "./lib/marketingApprovedPhotoAssets";
import {growthWriteAllowed} from "./lib/marketingApi";
import {DESIGN_CATEGORIES,DESIGN_STYLES,designCategory,designStudioPrompt,resolveDesignTokens,studioPrintHtml,offlineStudioArtwork} from "./lib/marketingDesignStudio";

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
 const campaign=marketingCampaignProfile(category);
 const [style,setStyle]=useState("athletic");
 const [brandMood,setBrandMood]=useState("auto");
 const [savedBrandLogo,setSavedBrandLogo]=useState("");
 const [savedBrandPalette,setSavedBrandPalette]=useState(null);
 const [brandReviewed,setBrandReviewed]=useState(false);
 const [assetsReviewed,setAssetsReviewed]=useState(false);
 const [imageQuality,setImageQuality]=useState({checked:false,passed:false,errors:[]});
 const [mode,setMode]=useState("hybrid");
 const [prompt,setPrompt]=useState("");
 const [concepts,setConcepts]=useState([]);
 const [plans,setPlans]=useState([]);
 const [savedDesigns,setSavedDesigns]=useState([]);
 const [draftBusy,setDraftBusy]=useState(false);
 const [copyBusy,setCopyBusy]=useState(false);
 const [copySuggestion,setCopySuggestion]=useState(null);
 const [copyMessage,setCopyMessage]=useState("");
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
 const [artworkMessage,setArtworkMessage]=useState("");
 const [artworkOptions,setArtworkOptions]=useState("");
 const [artworkVariantImage,setArtworkVariantImage]=useState("");
 const [fundraisingNote,setFundraisingNote]=useState("");
 const [fundraisingRows,setFundraisingRows]=useState([{product:"",wholesale:"",retail:"",quantity:"",verified:false}]);
 const [productImages,setProductImages]=useState([]);
 const [mockupRecipes,setMockupRecipes]=useState([]);
 const [recipeToEdit,setRecipeToEdit]=useState(null);
 const [heroImage,setHeroImage]=useState("");
 const [heroInfo,setHeroInfo]=useState("");
 const [approvedPhotoCandidates,setApprovedPhotoCandidates]=useState([]);
 const [candidatePreview,setCandidatePreview]=useState(null);
 const [approvedPhotoBusy,setApprovedPhotoBusy]=useState(false);
 const [approvedPhotoStatus,setApprovedPhotoStatus]=useState("");
 useEffect(()=>{
  const d=defaults[category]||defaults.general;
  setHeadline(d.headline);setBody(description||d.description);setBenefits(d.benefits);setSteps(d.steps);
  setCta("LET'S BUILD YOUR "+(organization||"CUSTOM")+" PROGRAM!");
  setSavedBrandLogo("");setSavedBrandPalette(null);
  setContactText(contact);setArtworkMessage(campaign.defaultMessage);setArtworkOptions((category==="school"?schoolArtworkServiceOptions():campaign.defaultOptions).join("\n"));setArtworkVariantImage("");setFundraisingNote(category==="school"?"A customizable school store can support fundraising for activities and programs; the actual return depends on agreed prices and costs.":"");setBrandMood("auto");setBrandReviewed(false);setAssetsReviewed(false);setCopySuggestion(null);setCopyMessage("");setFundraisingRows([{product:"",wholesale:"",retail:"",quantity:"",verified:false}]);setConcepts([]);setPlans([]);setSelected(0);setPrompt("");setProductImages([]);setMockupRecipes([]);setRecipeToEdit(null);setHeroImage("");setHeroInfo("");setApprovedPhotoCandidates([]);setCandidatePreview(null);setApprovedPhotoStatus("");
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
 async function loadApprovedCandidate(item){
  let blob;
  if(item.reference.key)blob=await marketingLogoBlob(accountId,item.reference.key);
  else{
   const url=await marketingSharedImageUrl(accountId,item.reference);
   const response=await fetch(url,{cache:"no-store",referrerPolicy:"no-referrer"});
   if(!response.ok)throw Error("Approved image download failed.");
   blob=await response.blob();
  }
  if(!["image/png","image/jpeg","image/webp"].includes(blob.type)||!blob.size||blob.size>2500000)throw Error("Approved image must be PNG, JPEG or WebP under 2.5 MB.");
  return marketingImageDataUrl(blob);
 }
 async function previewApprovedCandidate(item){
  setApprovedPhotoBusy(true);setApprovedPhotoStatus("");setCandidatePreview(null);
  try{
   const image=await loadApprovedCandidate(item);
   setCandidatePreview({id:item.id,image,title:item.title});
   setApprovedPhotoStatus("Review garment identity, decoration, and client before adding this image.");
  }catch(e){setApprovedPhotoStatus("Could not preview image: "+e.message);}
  finally{setApprovedPhotoBusy(false);}
 }
 function importApprovedPhoto(){
  if(!candidatePreview||mergedProductImages.length>=5)return;
  setProductImages(current=>[...current,candidatePreview.image].slice(0,5));
  setApprovedPhotoCandidates(current=>current.filter(x=>x.id!==candidatePreview.id));
  setCandidatePreview(null);
  setApprovedPhotoStatus("Approved client image added. Verify its product and decoration before sharing.");
 }
 async function addApprovedLogoVariant(event){
  const file=event.target.files?.[0];event.target.value="";
  if(!file)return;
  if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>2_500_000){setError("Select an approved alternate logo as PNG, JPEG or WebP under 2.5 MB.");return;}
  try{setArtworkVariantImage(await marketingImageDataUrl(file));setError("");}catch(e){setError(e.message||"Could not read alternate logo.");}
 }
 async function addHeroScene(event){
  const file=event.target.files?.[0];
  event.target.value="";
  if(!file)return;
  if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>5_000_000){setHeroInfo("Choose a licensed PNG, JPEG or WebP scene under 5 MB.");return;}
  try{
   const url=URL.createObjectURL(file);
   let img;
   try{img=await new Promise((resolve,reject)=>{const loaded=new Image();loaded.onload=()=>resolve(loaded);loaded.onerror=()=>reject(Error("The photo could not be opened."));loaded.src=url;});}
   finally{URL.revokeObjectURL(url);}
   if(img.naturalWidth<1000||img.naturalHeight<600)throw Error("Campaign scene must be at least 1000 × 600 pixels.");
   const canvas=document.createElement("canvas");
   const scale=Math.min(1,2700/Math.max(img.naturalWidth,img.naturalHeight));
   canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
   canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
   const result=canvas.toDataURL("image/jpeg",0.79);
   if(result.length>3_200_000)throw Error("Scene is too large for private storage. Choose a simpler photo.");
   setHeroImage(result);
   setHeroInfo("Approved scene added for the hero. Check that the school identity, location and license are accurate.");
  }catch(e){setHeroInfo(e.message||"Could not prepare campaign scene.");}
 }
 async function addProductPhotos(event){
  const files=Array.from(event.target.files||[]).slice(0,5-mergedProductImages.length);
  try{
   const images=await Promise.all(files.map(file=>new Promise((resolve,reject)=>{
    if(!file.type.match(/^image\/(png|jpeg|webp)$/)||file.size>5000000)return reject(Error("Use PNG, JPEG or WebP images under 5 MB."));
    const img=new Image();const url=URL.createObjectURL(file);
    img.onload=()=>{try{const canvas=document.createElement("canvas");const scale=Math.min(1,900/Math.max(img.width,img.height));canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.85));}catch(e){reject(e)}finally{URL.revokeObjectURL(url)}};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(Error("Image could not be opened."))};img.src=url;
   })));
   setProductImages(v=>[...v,...images].slice(0,5));setError("");
  }catch(e){setError(e.message||"Unable to add product images.")}
  event.target.value="";
 }
 const previewHtml=(i)=>studioPrintHtml({client:organization,category,style,concept:i,mode,plan:plans[i],image:"",logo,headline,description:body,benefits:benefits.split("\n").filter(Boolean),steps:steps.split("\n").filter(Boolean),cta,contact:contactText,productImages:mergedProductImages,colors,heroImage,artworkMessage,artworkOptions:artworkOptions.split("\n").map(v=>v.trim()).filter(Boolean),fundraisingNote,fundraisingRows,artworkVariantImage,brandMood});
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
   const mockupRecipeReferences=[];
   for(const recipe of mockupRecipes){
    if(!Number.isInteger(recipe.productIndex)||recipe.productIndex<0||recipe.productIndex>=productImages.length||!recipe.blank)continue;
    mockupRecipeReferences.push({productIndex:recipe.productIndex,blankReference:await storeImage(recipe.blank),blankLabel:String(recipe.blankLabel||"Product blank").slice(0,120),placement:recipe.placement});
   }
   const brandReference=effectiveLogo?await storeImage(effectiveLogo):null;
   const brandPalette=effectiveColors.filter(c=>/^#[0-9a-f]{6}$/i.test(c)).slice(0,5);
   const heroReference=heroImage?await storeImage(heroImage):null;
   const logoVariantReference=artworkVariantImage?await storeImage(artworkVariantImage):null;
   const content={studioVersion:5,organization,category,style,brandMood,mode,prompt:visualPrompt,selected,plans,references,productReferences,mockupRecipeReferences,brandReference,brandPalette,heroReference,logoVariantReference,headline,body,benefits,steps,cta,contactText,artworkMessage,artworkOptions,fundraisingNote,fundraisingRows};
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
   setConcepts(images);setPlans(Array.isArray(d.plans)?d.plans:[]);setSelected(Math.min(images.length-1,Math.max(0,d.selected||0)));
   const products=[];
   if(Array.isArray(d.productReferences))for(const ref of d.productReferences.slice(0,5)){if(!ref?.key)throw Error("Invalid product asset reference.");products.push(await marketingLogoImage(accountId,ref.key));}
   else if(Array.isArray(d.productImages))products.push(...d.productImages.slice(0,5).filter(value=>/^data:image\/(png|jpeg|webp);base64,/i.test(value||"")));
   const restoredHero=d.heroReference?.key?await marketingLogoImage(accountId,d.heroReference.key):"";
   setHeroImage(restoredHero);setHeroInfo(restoredHero?"Approved hero scene restored from private storage.":"");
   setArtworkVariantImage(d.logoVariantReference?.key?await marketingLogoImage(accountId,d.logoVariantReference.key):"");
   const restoredRecipes=[];
   if(Array.isArray(d.mockupRecipeReferences))for(const recipe of d.mockupRecipeReferences.slice(0,5)){
    if(Number.isInteger(recipe.productIndex)&&recipe.productIndex>=0&&recipe.productIndex<products.length&&recipe.blankReference?.key){
     restoredRecipes.push({productIndex:recipe.productIndex,blank:await marketingLogoImage(accountId,recipe.blankReference.key),blankLabel:recipe.blankLabel||"Saved blank",placement:recipe.placement});
    }
   }
   setMockupRecipes(restoredRecipes);setRecipeToEdit(null);
   setSavedBrandLogo(d.brandReference?.key?await marketingLogoImage(accountId,d.brandReference.key):"");
   setSavedBrandPalette(Array.isArray(d.brandPalette)&&d.brandPalette.every(c=>/^#[0-9a-f]{6}$/i.test(c))?d.brandPalette.slice(0,5):null);
   setStyle(d.style||"athletic");setBrandMood(d.brandMood||"auto");setBrandReviewed(false);setAssetsReviewed(false);setMode(d.mode||"hybrid");setPrompt(d.prompt||"");setHeadline(d.headline||"");setBody(d.body||"");setBenefits(d.benefits||"");setSteps(d.steps||"");setCta(d.cta||"");setContactText(d.contactText||"");setArtworkMessage(d.artworkMessage||"");setArtworkOptions(d.artworkOptions||"");setFundraisingNote(d.fundraisingNote||"");setFundraisingRows(Array.isArray(d.fundraisingRows)&&d.fundraisingRows.length?d.fundraisingRows.slice(0,3):[{product:"",wholesale:"",retail:"",quantity:"",verified:false}]);setProductImages(products);
   setDraftMessage("Saved concepts and design instructions restored.");
  }catch(e){setError(e.message||"Could not reopen design.");}
  finally{setDraftBusy(false);}
 }
 function removeProductImage(index){
  setProductImages(v=>v.filter((_,j)=>j!==index));
  setMockupRecipes(v=>v.filter(r=>r.productIndex!==index).map(r=>({...r,productIndex:r.productIndex>index?r.productIndex-1:r.productIndex})));
  setRecipeToEdit(null);setAssetsReviewed(false);
 }
 function addComposedProduct(image,recipe){
  if(Number.isInteger(recipe?.editIndex)&&recipe.editIndex>=0&&recipe.editIndex<productImages.length){
   const index=recipe.editIndex;
   setProductImages(v=>v.map((src,i)=>i===index?image:src));
   setMockupRecipes(v=>[...v.filter(r=>r.productIndex!==index),{productIndex:index,blank:recipe.blank,blankLabel:recipe.blankLabel,placement:recipe.placement}]);
   setRecipeToEdit(null);
  }else if(productImages.length<5){
   const productIndex=productImages.length;
   setProductImages(v=>[...v,image].slice(0,5));
   setMockupRecipes(v=>[...v,{productIndex,blank:recipe.blank,blankLabel:recipe.blankLabel,placement:recipe.placement}]);
  }
  setAssetsReviewed(false);
 }
 const effectiveLogo=savedBrandLogo||logo;
 const effectiveColors=savedBrandPalette||colors;
 const mergedProductImages=[...productImages,...(Array.isArray(approvedProductImages)?approvedProductImages:[])].filter(x=>/^data:image\/(png|jpeg|webp);base64,/i.test(x||"")).slice(0,5);
 useEffect(()=>{
  let active=true;
  setImageQuality({checked:false,passed:false,errors:[]});
  const images=[{src:logo,type:"logo",label:"Approved client logo"},
   ...[...productImages,...(Array.isArray(approvedProductImages)?approvedProductImages:[])].slice(0,5).map((src,i)=>({src,type:"product",label:"Merchandise mockup "+(i+1)})),
   ...(heroImage?[{src:heroImage,type:"hero",label:"Campaign scenic background"}]:[])
  ].filter(item=>/^data:image\/(?:png|jpeg|webp);base64,/i.test(item.src||""));
  Promise.all(images.map(item=>new Promise(resolve=>{
   const img=new Image();
   img.onload=()=>resolve(marketingPrintImageCheck({type:item.type,width:img.naturalWidth,height:img.naturalHeight,label:item.label}));
   img.onerror=()=>resolve({ok:false,message:item.label+" could not be decoded."});
   img.src=item.src;
  }))).then(results=>{if(active)setImageQuality({checked:true,...marketingPrintPreflightSummary(results)});});
  return()=>{active=false};
 },[logo,heroImage,productImages,approvedProductImages]);
 const flyerReview=marketingFlyerChecks({organization,logo,colors,productImages:mergedProductImages,headline,cta,contact:contactText,heroImage,category,artworkOptions:artworkOptions.split("\n").filter(Boolean)});
 const visualPrompt=resolveDesignTokens(prompt||designStudioPrompt({category,style,client:organization,colors,instructions:description}),{school_name:organization,client_name:organization,school_logo:logo?"Approved client logo supplied as image reference":"",client_logo:logo?"Approved client logo supplied as image reference":"",primary_color:colors[0],secondary_color:colors[1],accent_color:colors[2],business_website:"skilledcrafting.com"});
 async function suggestLocalCopy(){
  if(!accountId){setCopyMessage("Select a client before requesting suggestions.");return;}
  setCopyBusy(true);setCopySuggestion(null);setCopyMessage("");
  try{
   const result=await localAiCall("/copy",{organization,category,prompt:visualPrompt,current:{description:body}});
   const draft=result?.draft;
   if(!draft||typeof draft.headline!=="string"||!Array.isArray(draft.benefits)||!Array.isArray(draft.steps))throw Error("The local model did not return a usable copy draft.");
   setCopySuggestion(draft);
   setCopyMessage("Unverified wording suggestions from local Ollama. Check each statement before applying.");
  }catch(e){setCopyMessage("Local copy assistant unavailable. Your existing verified content was not changed: "+e.message);}
  finally{setCopyBusy(false);}
 }
 function useLocalCopy(){
  if(!copySuggestion)return;
  setHeadline(copySuggestion.headline.slice(0,160));
  setBody(String(copySuggestion.description||"").slice(0,500));
  setBenefits(copySuggestion.benefits.filter(v=>typeof v==="string").slice(0,4).join("\\n"));
  setSteps(copySuggestion.steps.filter(v=>typeof v==="string").slice(0,4).join("\\n"));
  setCta(String(copySuggestion.cta||"").slice(0,160));
  setBrandReviewed(false);
  setCopyMessage("Draft ideas applied. Review and verify every claim before printing.");
  setCopySuggestion(null);
 }
 async function generate(){
  if(!accountId){setError("Select a saved client first.");return;}
  setBusy(true);setError("");setConcepts([]);setPlans([]);setSelected(0);
  const created=[],layouts=[];
  try{
   let localEnabled=false;
   try{const connection=await loadLocalAiConnection();localEnabled=connection.configured;}catch{localEnabled=false;}
   for(let i=0;i<3;i++){
    setProgress("Creating design concept "+(i+1)+" of 3…");
    let localPlan=null;
    if(localEnabled){try{const result=await localAiCall("/layout",{organization,category,colors,concept:i+1,prompt:visualPrompt});if(result?.plan&&Array.isArray(result.plan.sections))localPlan=result.plan;}catch{localEnabled=false;}}
    if(localPlan){layouts.push(localPlan);const image=await renderOfflineArtwork(offlineStudioArtwork({concept:i+1,colors,style}));created.push(image);setPlans([...layouts]);setConcepts([...created]);continue;}
    const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-ai-layout",{
     method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({account_id:accountId,organization,category,colors,concept:i+1,prompt:visualPrompt,offline:true})
    });
    const data=await response.json();
    if(!response.ok||!data.plan)throw Error(data.message||"Unable to prepare layout.");
    layouts.push(data.plan);
    const image=await renderOfflineArtwork(offlineStudioArtwork({concept:i+1,colors,style}));
    created.push(image);setPlans([...layouts]);setConcepts([...created]);
   }
   setProgress("Three branded concepts ready without paid APIs. Local Ollama was used for layout planning when available; otherwise the offline fallback was used.");
  }catch(e){setError(e.message||"Unable to create layouts.");setProgress(created.length+" concept(s) ready.");}
  finally{setBusy(false);}
 }
 function printFlyer(){
  if(!concepts[selected]){setError("Generate and select a concept first.");return;}
  // The HTML is created by the same safe compositor as the live proof.
  const html=previewHtml(selected);
  const popup=window.open("","_blank");
  if(!popup){
   setError("The browser blocked the print window. Enable pop-ups for Skilled Crafting and retry.");
   return;
  }
  popup.addEventListener("load",()=>{
   Promise.all(Array.from(popup.document.images).map(img=>img.decode().catch(()=>{})))
    .then(()=>{if(!popup.closed){popup.focus();popup.print();}});
  },{once:true});
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  setProgress("Choose Save as PDF in the browser's print dialog. US Letter, scale 100%, no margins, background graphics enabled.");
 }
 function exportHtml(){
  if(!concepts[selected]){setError("Generate and select a concept first.");return;}
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
   <label className="growth-field"><span>Approved brand mood</span><select value={brandMood} onChange={e=>setBrandMood(e.target.value)}><option value="auto">Automatic — {marketingCampaignMood(category,organization)}</option><option value="collegiate">Collegiate</option><option value="playful">Playful and friendly</option><option value="professional">Professional</option><option value="athletic">Athletic</option><option value="welcoming">Community-focused</option><option value="elegant">Elegant</option><option value="expressive">Bold and expressive</option></select></label>
   <label className="growth-field"><span>Creative style</span><select value={style} onChange={e=>setStyle(e.target.value)}>{DESIGN_STYLES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
   <label className="growth-field"><span>Document editing mode</span><select value={mode} onChange={e=>setMode(e.target.value)}><option value="hybrid">Hybrid — editable text and AI artwork</option><option value="artwork">Artwork-first — AI illustration with verified overlays</option></select></label>
  </div>
  <label className="growth-field"><span>Editable creative direction (up to 12,000 characters)</span><textarea rows={9} maxLength={12000} value={visualPrompt} onChange={e=>setPrompt(e.target.value)} /></label>
  <button type="button" className="sc-btn" onClick={()=>setPrompt("")}>Reset to category prompt</button>
}
  {draftMessage&&<p role="status">{draftMessage}</p>}
  {error&&<p role="alert">{error}</p>}
  <div className="growth-subcard">
   <h4>Approved product photography — up to five</h4>
   <p>Use approved decorated mockups, choose imagery from this client\u0027s approved documents, or create a garment proof with the composer below. No fabricated products or pricing.</p>
   {!mergedProductImages.length&&<p role="status"><strong>Draft preview only:</strong> add approved merchandise images before sharing a client-ready flyer.</p>}
   {!!approvedProductImages.length&&<p>{Math.min(4,approvedProductImages.length)} previously uploaded image(s) are available from the classic builder. They are used after any images added here.</p>}
   <button type="button" className="sc-btn" disabled={!accountId||approvedPhotoBusy||mergedProductImages.length>=5} onClick={findApprovedPhotos}>{approvedPhotoBusy?"Loading approved images…":"Find images from this client's approved documents"}</button>
   {!!approvedPhotoStatus&&<p role="status">{approvedPhotoStatus}</p>}
   {!!approvedPhotoCandidates.length&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8}}>{approvedPhotoCandidates.map(item=><div className="growth-subcard" key={item.id}><small>{item.title}</small><button type="button" className="sc-btn" disabled={approvedPhotoBusy||mergedProductImages.length>=5} onClick={()=>previewApprovedCandidate(item)}>Preview image</button></div>)}</div>}
   {candidatePreview&&<div className="growth-subcard" style={{marginTop:8}}><h5>Preview from {candidatePreview.title}</h5><img src={candidatePreview.image} alt="Client-approved merchandise candidate — verify before use" style={{maxWidth:280,maxHeight:280,objectFit:"contain"}}/><p>This image must match the selected client, product and approved logo decoration.</p><button type="button" className="sc-btn" onClick={importApprovedPhoto} disabled={mergedProductImages.length>=5}>Confirm and add to flyer</button><button type="button" className="sc-btn" onClick={()=>setCandidatePreview(null)}>Cancel</button></div>}
   <input aria-label="Add approved product images" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={mergedProductImages.length>=5} onChange={addProductPhotos}/>
   {!!productImages.length&&<div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{productImages.map((src,i)=><div key={i}><img src={src} alt={"Approved product "+(i+1)} style={{width:110,height:110,objectFit:"contain"}}/>{mockupRecipes.some(r=>r.productIndex===i)&&<button type="button" onClick={()=>setRecipeToEdit({...mockupRecipes.find(r=>r.productIndex===i)})}>Edit placement</button>}<button type="button" onClick={()=>removeProductImage(i)}>Remove</button></div>)}</div>}
  </div>
  <section className="growth-subcard" aria-label="Approved campaign scenery">
   <h4>School-specific campaign scenery</h4>
   <p>Use an approved school or community landscape, licensed campus photograph, or background art. The scene stays separate from the school logo and editable text. No location or mascot is invented.</p>
   <input aria-label="Upload approved campaign hero scene" type="file" accept="image/png,image/jpeg,image/webp" onChange={addHeroScene} disabled={busy||draftBusy}/>
   {heroImage&&<div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:10}}><img src={heroImage} alt="Approved campaign background" style={{width:210,maxHeight:150,objectFit:"cover"}}/><button type="button" className="sc-btn" onClick={()=>{setHeroImage("");setHeroInfo("Campaign image removed.");}}>Remove scene</button></div>}
   {heroInfo&&<p role="status">{heroInfo}</p>}
  </section>
  <section className="growth-subcard" aria-label="Client-ready flyer checks">
   <h4>Client-ready review</h4>
   <p>{flyerReview.passed?"All required content fields are present. Verify the actual artwork, claims and print proof before sharing.":"This is a draft proof. Complete the missing details before distributing it to the client."}</p>
   <ul>{flyerReview.checks.map(check=><li key={check.id}>{check.pass?"✓ ":"• "}{check.message}</li>)}</ul>
   <p>Photo resolution, supplier garment identity, logo permissions and exact production placement require human verification; this checklist does not certify them.</p>
  </section>
  <section className="growth-subcard" aria-label="Client campaign and creative options">
   <h4>{campaign.artworkEyebrow} — {campaign.artwork}</h4>
   <p>{category==="school"?"As in the reference, include benefits, ordering steps, the optional fundraising illustration and seasonal or team-specific design options. The content is adapted to each selected school.":"Select category-appropriate artwork extensions and marketing messages for this client. These appear as a graphic section near the bottom of the flyer."}</p>
   <div className="growth-grid">
    {["school","team","nonprofit"].includes(category)&&<label className="growth-field"><span>Fundraising or campaign program explanation (without guaranteed returns)</span><textarea rows={3} value={fundraisingNote} onChange={e=>setFundraisingNote(e.target.value)}/></label>}
    <label className="growth-field"><span>Approved brand artwork and alternate versions</span><textarea rows={3} value={artworkMessage} onChange={e=>setArtworkMessage(e.target.value)}/></label>
    <label className="growth-field"><span>Customized collections and creative options — one per line</span><textarea rows={5} value={artworkOptions} onChange={e=>setArtworkOptions(e.target.value)}/></label>
   </div>
   <div className="growth-subcard" style={{marginTop:10}}>
    <h4>Optional example of alternate logo artwork</h4>
    <p>Upload an existing approved alternative identity treatment to demonstrate your creative services. Without a second approved image, the flyer describes the options without inventing a before-and-after image.</p>
    <input aria-label="Upload an approved alternate logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={addApprovedLogoVariant}/>
    {artworkVariantImage&&<div style={{display:"flex",gap:12,alignItems:"center",marginTop:8}}><img src={artworkVariantImage} alt="Approved alternate school logo example" style={{width:90,height:90,objectFit:"contain"}}/><button type="button" className="sc-btn" onClick={()=>setArtworkVariantImage("")}>Remove alternate version</button></div>}
   </div>
   {["school","team","nonprofit"].includes(category)&&<>
   <h4>Verified fundraising illustration (optional)</h4>
   <p>Enter actual, confirmed figures to display a wholesale/retail comparison like the reference. These are illustrative gross margins, not a profit guarantee or an invoice.</p>
   {fundraisingRows.map((row,i)=><div key={i} className="growth-grid" style={{marginBottom:9}}>
    <label className="growth-field"><span>Product</span><input placeholder="e.g., school hoodie" value={row.product} onChange={e=>setFundraisingRows(current=>current.map((entry,k)=>k===i?{...entry,product:e.target.value,verified:false}:entry))}/></label>
    {["wholesale","retail","quantity"].map(key=><label key={key} className="growth-field"><span>{key==="quantity"?"Example quantity":key==="wholesale"?"Confirmed unit cost ($)":"Confirmed retail ($)"}</span><input type="number" min={key==="quantity"?"1":"0"} step={key==="quantity"?"1":"0.01"} value={row[key]} onChange={e=>setFundraisingRows(current=>current.map((entry,k)=>k===i?{...entry,[key]:e.target.value,verified:false}:entry))}/></label>)}
    <label><input type="checkbox" checked={row.verified} onChange={e=>setFundraisingRows(current=>current.map((entry,k)=>k===i?{...entry,verified:e.target.checked}:entry))}/> I have verified these figures</label>
    <button type="button" className="sc-btn" onClick={()=>setFundraisingRows(current=>current.filter((_,k)=>k!==i))}>Remove row</button>
   </div>)}
   <button type="button" className="sc-btn" disabled={fundraisingRows.length>=3} onClick={()=>setFundraisingRows(rows=>[...rows,{product:"",wholesale:"",retail:"",quantity:"",verified:false}])}>Add fundraising product</button>
   {!!verifiedFundraisingRows(fundraisingRows).length&&<p role="status">{verifiedFundraisingRows(fundraisingRows).length} confirmed example row(s) will appear in the flyer with a clear illustrative-margin disclaimer.</p>}
   </>}
  </section>
  <MarketingApparelComposer key={accountId+"-composer-"+(recipeToEdit?recipeToEdit.productIndex:"new")} accountId={accountId} logo={logo} recipeToEdit={recipeToEdit} disabled={busy||draftBusy||(mergedProductImages.length>=5&&!recipeToEdit)} onAdd={addComposedProduct}/>
  <section className="growth-subcard" aria-label="Generate complete marketing concepts"><h4>Generate complete branded marketing concepts</h4><p>{mergedProductImages.length?"Your chosen approved merchandise images will appear in each flyer.":"Add approved decorated merchandise mockups above for a finished product-led design. Without them, this generates draft layout proofs only."} Confirm the selected logo, colors and category before generating three visual directions.</p><button type="button" className="sc-btn" disabled={busy||!accountId} onClick={generate}>{busy?progress:mergedProductImages.length?"Generate 3 complete design concepts — no API credits":"Generate 3 draft design concepts — merchandise still needed"}</button>{progress&&<p role="status">{progress}</p>}</section>
  {!!concepts.length&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16}}>{concepts.map((src,i)=><button type="button" key={i} className="growth-subcard" aria-pressed={selected===i} onClick={()=>setSelected(i)} style={{border:selected===i?"3px solid #3988dd":"1px solid #64748b",textAlign:"left"}}>
   <FlyerFrame html={previewHtml(i)} label={"Complete flyer concept "+(i+1)}/>
   <strong style={{display:"block",marginTop:12}}>Concept {i+1}{selected===i?" — selected":""} · {["Product showcase","Editorial story","Bold brand statement"][i]}</strong>
  </button>)}</div>}
  {!!concepts.length&&<section className="growth-subcard" aria-label="Selected flyer proof"><h4>Selected full-page flyer proof — Concept {selected+1}</h4><p>Preview uses the same HTML, branding and approved merchandise images as the print export. The product-image placeholder means the flyer is not ready for client sharing.</p><div style={{maxWidth:640,margin:"0 auto"}}><FlyerFrame html={previewHtml(selected)} label="Large selected flyer proof"/></div></section>}

  <section className="growth-subcard" aria-label="Private AI copy suggestions">
   <h4>Local Ollama copywriting assistant</h4>
   <p>Generate suggested headlines, program benefits, ordering steps and a call to action without paid APIs. Suggestions are never automatically approved or sent to customers.</p>
   <button type="button" className="sc-btn" onClick={suggestLocalCopy} disabled={copyBusy||busy||!accountId}>{copyBusy?"Consulting local Ollama…":"Suggest marketing copy (private Ollama)"}</button>
   {copyMessage&&<p role="status">{copyMessage}</p>}
   {copySuggestion&&<div className="growth-subcard"><h5>{copySuggestion.headline}</h5><p>{copySuggestion.description}</p><strong>Benefits</strong><ul>{copySuggestion.benefits.map((text,i)=><li key={i}>{text}</li>)}</ul><strong>Ordering steps</strong><ol>{copySuggestion.steps.map((text,i)=><li key={i}>{text}</li>)}</ol><p><strong>Suggested CTA:</strong> {copySuggestion.cta}</p><button type="button" className="sc-btn" onClick={useLocalCopy}>Use suggestions as unverified editable draft</button><button type="button" className="sc-btn" onClick={()=>setCopySuggestion(null)}>Discard</button></div>}
  </section>
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
  <section className="growth-subcard" aria-label="Client-ready verification"><h4>Final visual and factual review</h4><label><input type="checkbox" checked={brandReviewed} onChange={e=>setBrandReviewed(e.target.checked)}/> I have checked the selected client identity, logo, approved colors, contact details, and all factual copy.</label><label style={{display:"block",marginTop:8}}><input type="checkbox" checked={assetsReviewed} onChange={e=>setAssetsReviewed(e.target.checked)}/> I have reviewed merchandise identity, artwork permissions, photo quality, positioning, and any fundraising examples.</label><p>These are operator attestations, not an automated client approval or production certificate.</p><p><strong>Print image resolution check:</strong> {imageQuality.checked?(imageQuality.passed?"Passed for supplied raster assets.":"Needs attention"):"Checking supplied imagery…"}</p>{imageQuality.errors.length>0&&<ul>{imageQuality.errors.map((message,i)=><li key={i}>{message}</li>)}</ul>}<p>Raster size alone does not verify print colors, embedded profiles, subject licensing, or artwork correctness.</p></section>
  <button type="button" className="sc-btn" disabled={!concepts.length||busy||!flyerReview.passed||!imageQuality.checked||!imageQuality.passed||!brandReviewed||!assetsReviewed} onClick={printFlyer}>Print client-ready flyer / Save as PDF</button>
  {!flyerReview.passed&&<p role="status">Complete the client-ready checklist to enable print export. Saved drafts remain available.</p>}
  <button type="button" className="sc-btn" disabled={!concepts.length||busy} onClick={exportHtml}>Download editable print HTML</button>
  <p>Complete previews use editable approved copy, your approved logo and optional verified merchandise photography. Client-ready export requires verified branding and image inputs. The Print / Save as PDF button opens the browser print dialog using the exact preview layout. For high-quality results, choose US Letter, 100% scale, no margins and background graphics. When your private Tailscale Ollama gateway is configured, layout plans are generated on your Mac; otherwise deterministic offline plans are used. Backgrounds remain original abstract artwork, not fabricated product photos. Approved logos and verified copy remain editable overlays. Local ComfyUI image generation and real product mockups are planned enhancements.</p>
  {onUseLegacy&&<button type="button" className="sc-btn" onClick={onUseLegacy}>Open classic document builder</button>}
 </section>;
}
