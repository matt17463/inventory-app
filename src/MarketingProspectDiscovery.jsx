import { useState } from "react";
import { authenticatedFunctionFetch } from "./lib/netlifyFunctionClient";
import { saveGrowthRecord } from "./lib/marketingApi";
import { supabase } from "./supabaseClient";
import { generateMarketingDraft } from "./lib/marketingAI";
export default function MarketingProspectDiscovery(){
 const [outreach,setOutreach]=useState(""),[selectedSource,setSelectedSource]=useState(""),[drafting,setDrafting]=useState(false);
 const [industry,setIndustry]=useState("soccer clubs"),[region,setRegion]=useState("Kitsap County, Washington");
 const [saved,setSaved]=useState([]);const [query,setQuery]=useState(""),[results,setResults]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function draftOutreach(p){
  setDrafting(true);setMessage("");setOutreach("");setSelectedSource(p.website);
  try{setOutreach(await generateMarketingDraft({kind:"outreach",organization:p.name,segment:industry,brief:"Public website: "+p.website+"; Research finding (unverified until source review): "+p.reason+". Area: "+(p.location||region)+". Offer an opt-in conversation about Skilled Crafting custom team apparel and branded products. Never claim an existing relationship or name unknown people. Human review required before sending."}));}
  catch(e){setMessage(e.message);}finally{setDrafting(false);}
 }
 async function saveProspect(p){
  setMessage("");
  try{
   const {data,error}=await supabase.from("sc_growth_accounts").select("id,organization,website").ilike("organization",p.name).limit(10);
   if(error)throw error;
   const normalized=u=>{try{return new URL(u).hostname.replace(/^www\\./,"").toLowerCase();}catch{return "";}}
   if((data||[]).some(row=>row.organization.toLowerCase()===p.name.toLowerCase()||normalized(row.website)===normalized(p.website))){setMessage("This organization appears to already exist in the CRM. Review the Clients tab before adding a duplicate.");return;}
   const record=await saveGrowthRecord("accounts",{organization:p.name,city:p.location||region,website:p.website,segment:"business",source:"AI-assisted public organization research",notes:"Research suggestion only; verify organization details and contact permission before outreach. Potential fit: "+p.reason});
   if(record?.simulated){setMessage("Training mode: no CRM record was saved.");return;}
   setSaved(prev=>[...prev,p.website]);setMessage("Organization saved to CRM. Verify it before contacting anyone.");
  }catch(e){setMessage(e.message);}
 }
 async function search(e){e.preventDefault();setBusy(true);setMessage("");setResults([]);
  try{
   const r=await authenticatedFunctionFetch("/.netlify/functions/marketing-prospect-research",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({industry,region,query})});
   const data=await r.json();if(!r.ok)throw Error(data.message||"Research failed");setResults(data.prospects||[]);if(!data.prospects?.length)setMessage("No verified prospects found. Adjust the area or industry.");
  }catch(err){setMessage(err.message);}finally{setBusy(false);}
 }
 return <section className="growth-subcard">
  <h2>AI prospect discovery</h2><p>Research publicly listed organizations with source links. Results are suggestions—not confirmed buyers, verified contact permission, or live customer records. Review each source before outreach.</p>
  <form onSubmit={search}><div className="growth-grid">
   <label className="growth-field"><span>Business or organization category</span><input value={industry} onChange={e=>setIndustry(e.target.value)} required maxLength={100}/></label>
   <label className="growth-field"><span>Region</span><input value={region} onChange={e=>setRegion(e.target.value)} required maxLength={120}/></label>
   <label className="growth-field"><span>Additional criteria</span><input value={query} onChange={e=>setQuery(e.target.value)} maxLength={200} placeholder="e.g. youth teams and spirit wear"/></label>
  </div><button type="submit" className="sc-btn" disabled={busy}>{busy?"Researching…":"Find prospective clients"}</button></form>
  {message&&<p role="status">{message}</p>}
  <div className="growth-card-grid">{results.map((p,i)=><article className="growth-subcard" key={p.website+i}><h3>{p.name}</h3><p>{p.reason}</p><a href={p.website} target="_blank" rel="noreferrer noopener">Open organization source</a> <button type="button" className="sc-btn" disabled={drafting} onClick={()=>draftOutreach(p)}>Draft outreach</button> <button type="button" className="sc-btn" disabled={saved.includes(p.website)} onClick={()=>saveProspect(p)}>{saved.includes(p.website)?"Saved":"Save prospect to CRM"}</button><p><small>{p.location||region} · Public organization website, not a verified contact</small></p></article>)}</div>
 </section>;
}
