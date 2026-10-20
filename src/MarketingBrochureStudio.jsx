import {useState} from "react";
import {marketingTemplates} from "./lib/marketingCatalogPolicy";
import {escapeGrowthHtml} from "./lib/growthPricing";
import {growthWriteAllowed} from "./lib/marketingApi";
import {supabase} from "./supabaseClient";

const segments={
 "brochure-sports":{intro:"One team. One identity. Custom uniforms, training apparel, and supportive fan wear.",categories:["Team uniforms","Practice wear","Coach apparel","Spirit wear","Personalized team gifts"],benefit:"Coordinated gear for players, coaches and supporters."},
 "brochure-schools":{intro:"Build school spirit with clothing and merchandise designed for your community.",categories:["Student spirit wear","Staff apparel","Club merchandise","Fundraiser shops","Graduation gifts"],benefit:"A coordinated identity from classroom to game day."},
 "brochure-business":{intro:"Consistent branded apparel and merchandise for teams who represent your business.",categories:["Embroidered polos","Workwear","Branded hats","Event giveaways","Employee recognition"],benefit:"Professional branding across everyday work and special events."},
 "brochure-nonprofit":{intro:"Fundraise, thank volunteers, and rally your supporters with products that tell your story.",categories:["Fundraiser apparel","Volunteer shirts","Event goods","Appreciation gifts","Supporter stores"],benefit:"Community engagement with flexible merchandise programs."},
};
function makeBrochureHtml({name,kind,headline,description,chosen,colors,cta,logo}){
 const e=escapeGrowthHtml;const profile=segments[kind];const primary=/^#[a-f0-9]{6}$/i.test(colors)?colors:"#184D47";
 const safeLogo=/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo||"")?'<img style="max-height:105px;max-width:190px;object-fit:contain" alt="Client supplied logo" src="'+logo+'">':"";
 const cards=chosen.map((name,i)=>'<article><small>0'+(i+1)+'</small><h3>'+e(name)+'</h3><p>Product selection, decoration method, sizes and availability confirmed during quoting.</p></article>').join("");
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+e(name)+' · Skilled Crafting brochure</title><style>*{box-sizing:border-box}body{margin:0;font:16px system-ui,Arial;color:#182935;background:#f6f8f8}.cover{padding:58px 42px;background:'+primary+';color:white}.mark{font-size:12px;letter-spacing:2px;font-weight:bold}.cover h1{font-size:40px;line-height:1.12;max-width:650px}.cover p{font-size:19px;max-width:650px}.page{max-width:1050px;margin:auto;background:white;padding:34px 42px}.intro{font-size:20px;max-width:780px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin:24px 0}.grid article{padding:22px;border:1px solid #cad5d5;border-radius:12px;min-height:158px}.grid h3{margin:12px 0 6px}.grid small{color:'+primary+';font-weight:bold}.cta{background:#e8f1ed;padding:23px;border-left:5px solid '+primary+';margin-top:18px}.fine{color:#5a6570;font-size:12px;margin-top:28px}@media print{body{background:white}.cover{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{padding:22px}.grid{break-inside:avoid}a{color:inherit}}</style></head><body><header class="cover"><div class="mark">SKILLED CRAFTING · CONCEPT BROCHURE</div>'+safeLogo+'<h1>'+e(name)+'</h1><h2>'+e(headline||profile.benefit)+'</h2><p>'+e(description||profile.intro)+'</p></header><main class="page"><p class="intro">'+e(profile.benefit)+'</p><h2>Products and programs</h2><div class="grid">'+cards+'</div><div class="cta"><h2>Plan your next apparel program</h2><p>'+e(cta)+'</p></div><p class="fine">Concept brochure only. Product photos, trademarks, prices, sizes and lead times require written confirmation. Printing method, artwork usage and final proofs require approval. No order is placed by viewing this document.</p></main></body></html>';
}
export default function MarketingBrochureStudio({organizations=[]}){
 const [account,setAccount]=useState(""),[kind,setKind]=useState("brochure-sports"),[headline,setHeadline]=useState(""),[description,setDescription]=useState(""),[color,setColor]=useState("#184D47"),[logo,setLogo]=useState(""),[selected,setSelected]=useState([]),[cta,setCta]=useState("Contact Skilled Crafting to discuss products, artwork, quantities, delivery and a custom quote."),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const client=organizations.find(a=>a.id===account),profile=segments[kind];
 const chosen=selected.length?selected:[...profile.categories];
 function updateLogo(file){
  if(!file)return;if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>2_500_000){setMessage("Choose a PNG/JPG/WebP under 2.5 MB.");return;}
  const reader=new FileReader();reader.onload=()=>setLogo(String(reader.result));reader.readAsDataURL(file);
 }
 function download(){
  if(!client){setMessage("Select a CRM organization first.");return;}
  const html=makeBrochureHtml({name:client.organization,kind,headline,description,chosen,colors:color,cta,logo});
  const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="skilled-crafting-"+kind+".html";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  setMessage("Brochure exported as printable HTML. Open the file to print or save as PDF.");
 }
 async function save(){
  if(!client){setMessage("Select a CRM organization first.");return;}
  setBusy(true);setMessage("");
  try{
   if(!growthWriteAllowed()){setMessage("Training mode: no client brochure saved.");return;}
   const productDescription=[description||profile.intro,"Featured programs: "+chosen.join(", "),"Call to action: "+cta].join("\n\n");
   const {error}=await supabase.from("sc_growth_documents").insert({
    account_id:client.id,template_id:kind,title:(client.organization+" — "+marketingTemplates.find(t=>t.id===kind)?.label).slice(0,200),
    content:{organization:client.organization,template:kind,description:productDescription,
     branding:{profile:kind,colors:[color],placements:[]},style:chosen.join(", "),sizes:"To confirm",productColors:"To confirm",brochure_headline:headline||profile.benefit,logo_upload_required:Boolean(logo)}
   });
   if(error)throw error;
   setMessage("Brochure saved as a client-linked draft. Manager approval is available in Marketing Document Builder. Uploaded local logo is not saved: attach final artwork there before client review.");
  }catch(err){setMessage(err.message);}finally{setBusy(false);}
 }
 return <section className="sc-panel"><h2>Branded brochure builder</h2>
  <p>Create a professionally formatted, industry-specific concept brochure. Review product claims and artwork licensing before sending. Nothing is published or priced automatically.</p>
  <div className="growth-grid">
   <label className="growth-field"><span>CRM client</span><select value={account} onChange={e=>setAccount(e.target.value)}><option value="">Select client</option>{organizations.map(a=><option key={a.id} value={a.id}>{a.organization}</option>)}</select></label>
   <label className="growth-field"><span>Audience</span><select value={kind} onChange={e=>{setKind(e.target.value);setSelected([]);}}>{marketingTemplates.filter(t=>t.kind==="brochure").map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
   <label className="growth-field"><span>Headline</span><input value={headline} onChange={e=>setHeadline(e.target.value)} placeholder={profile.benefit}/></label>
   <label className="growth-field"><span>Brand accent</span><input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label>
   <label className="growth-field"><span>Local logo (export only)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>updateLogo(e.target.files?.[0])}/></label>
  </div>
  <label className="growth-field"><span>Overview / benefits</span><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder={profile.intro}/></label>
  <h3>Product categories to feature</h3><div className="growth-grid">{profile.categories.map(p=><label key={p}><input type="checkbox" checked={!selected.length||selected.includes(p)} onChange={e=>{const current=selected.length?selected:profile.categories;setSelected(e.target.checked?[...new Set([...current,p])]:current.filter(x=>x!==p));}}/> {p}</label>)}</div>
  <label className="growth-field"><span>Call to action</span><textarea value={cta} rows={2} onChange={e=>setCta(e.target.value)}/></label>
  <div className="growth-actions"><button className="sc-btn" type="button" disabled={!client} onClick={download}>Download printable brochure</button><button className="sc-btn sc-btn-primary" type="button" disabled={!client||busy} onClick={save}>{busy?"Saving…":"Save approval draft"}</button></div>
  {message&&<p role="status">{message}</p>}
 </section>;
}
