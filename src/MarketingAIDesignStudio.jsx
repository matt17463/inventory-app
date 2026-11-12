import {useEffect,useState} from "react";
import {authenticatedFunctionFetch} from "./lib/netlifyFunctionClient";
import {supabase} from "./supabaseClient";
import {marketingLogoImage} from "./lib/marketingArtwork";
import {growthWriteAllowed} from "./lib/marketingApi";
import {buildStudioPdf} from "./lib/marketingDesignStudioPdf";
import {DESIGN_CATEGORIES,DESIGN_STYLES,designCategory,designStudioPrompt,resolveDesignTokens,studioPrintHtml} from "./lib/marketingDesignStudio";

const defaults={
 school:{headline:"SCHOOL SPIRIT WEAR PROGRAM",description:"Build school pride. Support your programs. Make ordering easier.",benefits:"SCHOOL PRIDE — Quality school-branded apparel\nPROGRAM FUNDING — Support school activities\nEASY ONLINE ORDERS — Dedicated storefront\nLOCAL SUPPORT — Artwork and fulfillment",steps:"Plan together\nWe build your store\nSupporters order\nYour program benefits"},
 business:{headline:"CUSTOM APPAREL & BRANDED MERCHANDISE",description:"Make your business stand out with professional custom products.",benefits:"Professional brand presentation\nUniform and workwear options\nCustom promotional gifts\nLocal production support",steps:"Choose products\nApprove artwork\nConfirm pricing\nProduce and deliver"},
 team:{headline:"TEAM PRIDE STARTS HERE",description:"Custom gear for players, coaches and fans.",benefits:"Coordinated team apparel\nFan merchandise\nCoach recognition\nFundraising opportunities",steps:"Choose your gear\nApprove the design\nOpen ordering\nCelebrate your team"},
 nonprofit:{headline:"MERCHANDISE WITH A MISSION",description:"Build awareness and support your community.",benefits:"Mission-driven designs\nSupporter merchandise\nFlexible fundraising\nLocal fulfillment",steps:"Plan your campaign\nApprove artwork\nInvite supporters\nReview results"},
 wedding:{headline:"PERSONALIZED MOMENTS",description:"Custom gifts, keepsakes and event details.",benefits:"Personalized glassware\nEngraved keepsakes\nCustom signage\nCoordinated gifts",steps:"Share your vision\nSelect products\nApprove proofs\nCelebrate"},
 general:{headline:"BRING YOUR BRAND TO LIFE",description:"Distinctive custom merchandise and promotional products.",benefits:"Personalized products\nProfessional artwork\nFlexible ordering\nLocal support",steps:"Plan\nDesign\nApprove\nProduce"}
};
export default function MarketingAIDesignStudio({accountId="",organization="",template="",segment="",logo="",colors=[],description="",contact="",onUseLegacy}){
 const category=designCategory(template,segment);
 const [style,setStyle]=useState("athletic");
 const [mode,setMode]=useState("hybrid");
 const [prompt,setPrompt]=useState("");
 const [concepts,setConcepts]=useState([]);
 const [plans,setPlans]=useState([]);
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
 useEffect(()=>{
  const d=defaults[category]||defaults.general;
  setHeadline(d.headline);setBody(description||d.description);setBenefits(d.benefits);setSteps(d.steps);
  setCta("LET'S BUILD YOUR "+(organization||"CUSTOM")+" PROGRAM!");
  setContactText(contact);setConcepts([]);setPlans([]);setSelected(0);setPrompt("");
 },[accountId,category,organization]);
 useEffect(()=>{let active=true;if(!accountId)return;supabase.from("sc_growth_documents").select("id,title,updated_at,content").eq("account_id",accountId).eq("template_id","ai-design-studio").eq("status","draft").order("updated_at",{ascending:false}).limit(15).then(({data,error})=>{if(active&&!error)setSavedDesigns(data||[]);});return()=>{active=false};},[accountId]);
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
   const content={studioVersion:1,organization,category,style,mode,prompt:visualPrompt,selected,plans,references,headline,body,benefits,steps,cta,contactText};
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
   setStyle(d.style||"athletic");setMode(d.mode||"hybrid");setPrompt(d.prompt||"");setHeadline(d.headline||"");setBody(d.body||"");setBenefits(d.benefits||"");setSteps(d.steps||"");setCta(d.cta||"");setContactText(d.contactText||"");
   setDraftMessage("Saved concepts and design instructions restored.");
  }catch(e){setError(e.message||"Could not reopen design.");}
  finally{setDraftBusy(false);}
 }
 const visualPrompt=resolveDesignTokens(prompt||designStudioPrompt({category,style,client:organization,colors,instructions:description}),{school_name:organization,client_name:organization,school_logo:logo?"Approved client logo supplied as image reference":"",client_logo:logo?"Approved client logo supplied as image reference":"",primary_color:colors[0],secondary_color:colors[1],accent_color:colors[2],business_website:"skilledcrafting.com"});
 async function generate(){
  if(!accountId){setError("Select a saved client first.");return;}
  setBusy(true);setError("");setConcepts([]);setPlans([]);setSelected(0);
  const created=[];const layouts=[];
  try{
   for(let i=0;i<3;i++){
    setProgress("Generating concept "+(i+1)+" of 3…");
    const promptText=designStudioPrompt({category,style,client:organization,colors,instructions:visualPrompt,variation:i});
    const layoutResponse=await authenticatedFunctionFetch("/.netlify/functions/marketing-ai-layout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({account_id:accountId,organization,category,concept:i+1,prompt:visualPrompt})});
    const layoutData=await layoutResponse.json();
    if(!layoutResponse.ok||!layoutData.plan)throw Error(layoutData.message||"AI layout generation failed.");
    layouts.push(layoutData.plan);setPlans([...layouts]);
    const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-ai-visual",{
     method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({account_id:accountId,template_id:template,template_label:DESIGN_CATEGORIES[category].label,organization,segment,colors,description,visual_prompt:promptText,logo:logo.length<1000000?logo:""})
    });
    const data=await response.json();
    if(!response.ok||!data.image)throw Error(data.message||"Artwork generation failed.");
    created.push(data.image);setConcepts([...created]);
   }
   setProgress("Three concepts ready for review.");
  }catch(e){setError(e.message||"Unable to generate artwork.");setProgress(created.length+" concept(s) generated.");}
  finally{setBusy(false);}
 }
 async function pdfCompatibleLogo(value){
  if(!/^data:image\/webp;base64,/i.test(value||""))return value;
  const img=new Image();img.src=value;await img.decode();
  const canvas=document.createElement("canvas");canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  canvas.getContext("2d").drawImage(img,0,0);
  return canvas.toDataURL("image/png");
 }
 async function downloadPdf(){
  if(!concepts[selected]){setError("Generate a concept first.");return;}
  try{
   const bytes=await buildStudioPdf({image:concepts[selected],logo:await pdfCompatibleLogo(logo),headline,description:body,benefits:benefits.split("\\n").map(x=>x.trim()).filter(Boolean),steps:steps.split("\\n").map(x=>x.trim()).filter(Boolean),cta,contact:contactText,plan:plans[selected],mode});
   const url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
   const a=document.createElement("a");a.href=url;a.download="skilled-crafting-"+category+"-concept-"+(selected+1)+".pdf";a.click();
   setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(e){setError(e.message||"PDF export failed.");}
 }
 const print=()=>{
  if(!concepts[selected]){setError("Generate and select a concept first.");return;}
  const html=studioPrintHtml({client:organization,category,style,concept:selected,mode,plan:plans[selected],image:concepts[selected],logo,headline,description:body,
   benefits:benefits.split("\n").map(s=>s.trim()).filter(Boolean),steps:steps.split("\n").map(s=>s.trim()).filter(Boolean),cta,contact:contactText});
  const blob=new Blob([html],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="skilled-crafting-ai-"+category+"-flyer.html";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
 };
 return <section className="growth-subcard" aria-label="AI Document Design Studio">
  <h3>AI Document Design Studio</h3>
  <p>Primary creative workflow · {DESIGN_CATEGORIES[category].label}. Generate three distinct concepts, choose your favorite, and review verified text before export. The classic document builder remains available below.</p>
  <div className="growth-grid">
   <label className="growth-field"><span>Creative style</span><select value={style} onChange={e=>setStyle(e.target.value)}>{DESIGN_STYLES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
   <label className="growth-field"><span>Document editing mode</span><select value={mode} onChange={e=>setMode(e.target.value)}><option value="hybrid">Hybrid — editable text and AI artwork</option><option value="artwork">Artwork-first — AI illustration with verified overlays</option></select></label>
  </div>
  <label className="growth-field"><span>Editable creative direction (up to 12,000 characters)</span><textarea rows={9} maxLength={12000} value={visualPrompt} onChange={e=>setPrompt(e.target.value)} /></label>
  <button type="button" className="sc-btn" onClick={()=>setPrompt("")}>Reset to category prompt</button>
  <button type="button" className="sc-btn" disabled={busy||!accountId} onClick={generate}>{busy?progress:"Generate 3 design concepts"}</button>
  {progress&&<p role="status">{progress}</p>}
  {draftMessage&&<p role="status">{draftMessage}</p>}
  {error&&<p role="alert">{error}</p>}
  {!!concepts.length&&<div className="growth-grid">{concepts.map((src,i)=><button type="button" key={i} className="growth-subcard" aria-pressed={selected===i} onClick={()=>setSelected(i)} style={{border:selected===i?"3px solid #3988dd":"1px solid #64748b",textAlign:"left"}}><img src={src} alt={"AI concept "+(i+1)} style={{width:"100%",maxHeight:290,objectFit:"contain"}}/><strong>Concept {i+1}{selected===i?" — selected":""} · {plans[i]?.composition||"layout"}</strong></button>)}</div>}
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
  <button type="button" className="sc-btn" disabled={!concepts.length||busy} onClick={downloadPdf}>Download selected one-page PDF</button>
  <button type="button" className="sc-btn" disabled={!concepts.length||busy} onClick={print}>Export selected print layout (HTML → Print to PDF)</button>
  <p>Generated images are not automatically approved. Review logo fidelity, product imagery and any visual artifacts. The printable layout keeps business claims separate from AI-generated pixels.</p>
  {onUseLegacy&&<button type="button" className="sc-btn" onClick={onUseLegacy}>Open classic document builder</button>}
 </section>;
}
