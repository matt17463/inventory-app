import { useState } from "react";
import { authenticatedFunctionFetch } from "./lib/netlifyFunctionClient";
import { saveGrowthRecord } from "./lib/marketingApi";
import { supabase } from "./supabaseClient";
import { generateMarketingDraft } from "./lib/marketingAI";
import { scoreMarketingProspect } from "./lib/marketingProspectScoring";
export default function MarketingProspectDiscovery(){
 const [contactOrg,setContactOrg]=useState(null),[contacts,setContacts]=useState([]),[contactBusy,setContactBusy]=useState(false),[reviewedContacts,setReviewedContacts]=useState({}),[storedContacts,setStoredContacts]=useState({});
 const [outreach,setOutreach]=useState(""),[selectedSource,setSelectedSource]=useState(""),[drafting,setDrafting]=useState(false);
 const [industry,setIndustry]=useState("soccer clubs"),[region,setRegion]=useState("Kitsap County, Washington");
 const [saved,setSaved]=useState({});const [followUpDate,setFollowUpDate]=useState("");const [taskBusy,setTaskBusy]=useState(false);const [query,setQuery]=useState(""),[results,setResults]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function draftOutreach(p){
  setDrafting(true);setMessage("");setOutreach("");setSelectedSource(p.website);
  try{setOutreach(await generateMarketingDraft({kind:"outreach",organization:p.name,segment:industry,brief:"Public website: "+p.website+"; Research finding (unverified until source review): "+p.reason+". Area: "+(p.location||region)+". Offer an opt-in conversation about Skilled Crafting custom team apparel and branded products. Never claim an existing relationship or name unknown people. Human review required before sending."}));}
  catch(e){setMessage(e.message);}finally{setDrafting(false);}
 }
 async function researchContacts(p){
  setContactBusy(true);setContactOrg(p);setContacts([]);setMessage("");setReviewedContacts({});
  try{
   const r=await authenticatedFunctionFetch("/.netlify/functions/marketing-public-contacts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organization:p.name,website:p.website})});
   const result=await r.json();if(!r.ok)throw Error(result.message||"Contact research failed.");
   setContacts(result.contacts||[]);if(!result.contacts?.length)setMessage("No publicly sourced business contact identified. Use the organization's official contact page manually.");
  }catch(e){setMessage(e.message);}finally{setContactBusy(false);}
 }
 async function saveContact(p,c){
  if(!saved[p.website]){setMessage("Save the organization to CRM before adding a contact.");return;}
  if(!reviewedContacts[c.source_url]){setMessage("Open and confirm the official source before saving contact details.");return;}
  try{
   const {data,error}=await supabase.from("sc_growth_contacts").select("id,name,email").eq("account_id",saved[p.website]).limit(200);
   if(error)throw error;
   const name=c.name||c.job_title||"Public business contact";
   if((data||[]).some(x=>(c.email&&x.email?.toLowerCase()===c.email.toLowerCase())||(x.name.toLowerCase()===name.toLowerCase()&&!c.email))){setMessage("A matching contact already exists for this CRM organization.");return;}
   const result=await saveGrowthRecord("contacts",{account_id:saved[p.website],name,
    job_title:c.job_title||"Public business channel",email:c.email||null,contact_permission:"unknown",is_primary:false,
    notes:"Public business contact candidate; staff reviewed source URL: "+c.source_url+". Contact permission NOT established. "+c.notes});
   if(result?.simulated){setMessage("Training mode: no business contact saved.");return;}
   setStoredContacts(prev=>({...prev,[c.source_url]:true}));setMessage("Public-source business contact saved. Outreach preference remains unknown.");
  }catch(e){setMessage(e.message);}
 }
 async function saveProspect(p){
  setMessage("");
  try{
   const {data,error}=await supabase.from("sc_growth_accounts").select("id,organization,website").ilike("organization",p.name).limit(10);
   if(error)throw error;
   const normalized=u=>{try{return new URL(u).hostname.replace(/^www\\./,"").toLowerCase();}catch{return "";}}
   if((data||[]).some(row=>row.organization.toLowerCase()===p.name.toLowerCase()||(normalized(row.website)&&normalized(row.website)===normalized(p.website)))){setMessage("This organization appears to already exist in the CRM. Review the Clients tab before adding a duplicate.");return;}
   const record=await saveGrowthRecord("accounts",{organization:p.name,city:p.location||region,website:p.website,segment:"business",source:"AI-assisted public organization research",notes:"Research suggestion only; verify organization details and contact permission before outreach. Potential fit: "+p.reason});
   if(record?.simulated){setMessage("Training mode: no CRM record was saved.");return;}
   setSaved(prev=>({...prev,[p.website]:record.id}));setMessage("Organization saved to CRM. Verify it before contacting anyone.");
  }catch(e){setMessage(e.message);}
 }
 async function scheduleFollowUp(p){
  if(!saved[p.website]){setMessage("Save this organization to CRM first.");return;}
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(followUpDate)){setMessage("Choose a follow-up date.");return;}
  setTaskBusy(true);setMessage("");
  try{
   const {data:matches,error:loadError}=await supabase.from("sc_growth_opportunities").select("id,title").eq("account_id",saved[p.website]).eq("source","AI-assisted public organization research").limit(1);
   if(loadError)throw loadError;
   let opportunity=matches?.[0];
   if(!opportunity)opportunity=await saveGrowthRecord("opportunities",{
    account_id:saved[p.website],title:("Introduction — "+p.name).slice(0,200),
    source:"AI-assisted public organization research",next_action:"Verify source, find publicly listed business contact channel, and plan optional outreach",
    next_action_date:followUpDate,brief:"Official website to review: "+p.website+". Research fit hypothesis: "+p.reason
   });
   if(opportunity?.simulated){setMessage("Training mode: no task or opportunity created.");return;}
   const {data:tasks,error:taskError}=await supabase.from("sc_growth_tasks").select("id").eq("opportunity_id",opportunity.id).eq("task_key","ai-prospect-review").limit(1);
   if(taskError)throw taskError;
   if(tasks?.length){setMessage("A research follow-up already exists. Edit its due date in the campaign Tasks tab.");return;}
   const created=await saveGrowthRecord("tasks",{opportunity_id:opportunity.id,task_key:"ai-prospect-review",
    title:"Verify public sources and plan opt-in introduction",department:"marketing",status:"open",due_date:followUpDate,
    notes:"Research summary is unverified. Do not contact without checking business details and contact preference. Source: "+p.website});
   setMessage(created?.simulated?"Training mode: no follow-up saved.":"Review follow-up scheduled in the marketing task queue.");
  }catch(e){setMessage(e.message);}finally{setTaskBusy(false);}
 }
 async function search(e){e.preventDefault();setBusy(true);setMessage("");setResults([]);
  try{
   const r=await authenticatedFunctionFetch("/.netlify/functions/marketing-prospect-research",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({industry,region,query})});
   const data=await r.json();if(!r.ok)throw Error(data.message||"Research failed");setResults(data.prospects||[]);if(!data.prospects?.length)setMessage("No source-backed suggestions returned. Adjust the area or industry.");
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
  <div className="growth-card-grid">{[...results].sort((a,b)=>scoreMarketingProspect(b,{industry,region,query}).score-scoreMarketingProspect(a,{industry,region,query}).score).map((p,i)=><article className="growth-subcard" key={p.website+i}><h3>{p.name}</h3><p><strong>Provisional fit: {scoreMarketingProspect(p,{industry,region,query}).score}/100 — {scoreMarketingProspect(p,{industry,region,query}).priority}</strong></p><details><summary>How this fit score was estimated</summary><ul>{scoreMarketingProspect(p,{industry,region,query}).reasons.map(r=><li key={r}>{r}</li>)}</ul><small>Heuristic match, not proof of intent or verified client facts.</small></details><p>{p.reason}</p><a href={p.website} target="_blank" rel="noreferrer noopener">Open organization source</a> <button type="button" className="sc-btn" disabled={drafting} onClick={()=>draftOutreach(p)}>Draft outreach</button> <button type="button" className="sc-btn" disabled={contactBusy} onClick={()=>researchContacts(p)}>Research official contact channels</button> <button type="button" className="sc-btn" disabled={Boolean(saved[p.website])} onClick={()=>saveProspect(p)}>{saved[p.website]?"Saved":"Save prospect to CRM"}</button><p><small>{p.location||region} · Public organization website, not a verified contact</small></p>{saved[p.website]&&<div className="growth-grid"><label className="growth-field"><span>Follow-up due date</span><input type="date" value={followUpDate} onChange={e=>setFollowUpDate(e.target.value)}/></label><button type="button" className="sc-btn" disabled={taskBusy||!followUpDate} onClick={()=>scheduleFollowUp(p)}>Schedule CRM follow-up</button></div>}</article>)}</div>
  {contactOrg&&<div className="growth-subcard"><h3>Official business contact research · {contactOrg.name}</h3><p>These are suggestions from web research, not independently verified contacts. Open each original source and confirm before saving. No outreach permission is implied.</p>{contacts.map(c=><article key={c.source_url+c.email+c.name} className="growth-subcard"><strong>{c.name||c.job_title||"General contact"}</strong><p>{c.job_title} {c.email&&" · "+c.email}</p><a href={c.source_url} target="_blank" rel="noreferrer noopener">Verify on official organization website</a><p>{c.notes}</p><label><input type="checkbox" checked={Boolean(reviewedContacts[c.source_url])} onChange={e=>setReviewedContacts(old=>({...old,[c.source_url]:e.target.checked}))}/> I inspected the official source and confirmed these details</label><p><button type="button" className="sc-btn" disabled={!saved[contactOrg.website]||!reviewedContacts[c.source_url]||Boolean(storedContacts[c.source_url])} onClick={()=>saveContact(contactOrg,c)}>{storedContacts[c.source_url]?"Saved to CRM":"Save business contact"}</button></p></article>)}</div>}
  {selectedSource&&<div className="growth-subcard"><h3>Research-informed outreach draft</h3><p><small>Source to verify: <a href={selectedSource} rel="noreferrer noopener" target="_blank">{selectedSource}</a>. Review claims and contact permission before sending.</small></p><textarea rows={10} style={{width:"100%"}} value={outreach} onChange={e=>setOutreach(e.target.value)} placeholder={drafting?"Generating draft…":"Draft will appear here"}/><button type="button" className="sc-btn" disabled={!outreach} onClick={()=>navigator.clipboard.writeText(outreach).then(()=>setMessage("Draft copied for review. No message was sent."))}>Copy draft</button></div>}
 </section>;
}
