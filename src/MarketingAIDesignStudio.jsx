import {useEffect,useState} from "react";
import {authenticatedFunctionFetch} from "./lib/netlifyFunctionClient";
import {DESIGN_CATEGORIES,DESIGN_STYLES,designCategory,designStudioPrompt,studioPrintHtml} from "./lib/marketingDesignStudio";

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
 const visualPrompt=prompt||designStudioPrompt({category,style,client:organization,colors,instructions:description});
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
  <label className="growth-field"><span>Editable creative direction (up to 6,000 characters)</span><textarea rows={9} maxLength={6000} value={visualPrompt} onChange={e=>setPrompt(e.target.value)} /></label>
  <button type="button" className="sc-btn" onClick={()=>setPrompt("")}>Reset to category prompt</button>
  <button type="button" className="sc-btn" disabled={busy||!accountId} onClick={generate}>{busy?progress:"Generate 3 design concepts"}</button>
  {progress&&<p role="status">{progress}</p>}
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
  <button type="button" className="sc-btn" disabled={!concepts.length||busy} onClick={print}>Export selected print layout (HTML → Print to PDF)</button>
  <p>Generated images are not automatically approved. Review logo fidelity, product imagery and any visual artifacts. The printable layout keeps business claims separate from AI-generated pixels.</p>
  {onUseLegacy&&<button type="button" className="sc-btn" onClick={onUseLegacy}>Open classic document builder</button>}
 </section>;
}
