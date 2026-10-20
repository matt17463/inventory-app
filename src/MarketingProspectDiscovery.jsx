import { useState } from "react";
import { authenticatedFunctionFetch } from "./lib/netlifyFunctionClient";
export default function MarketingProspectDiscovery(){
 const [industry,setIndustry]=useState("soccer clubs"),[region,setRegion]=useState("Kitsap County, Washington");
 const [query,setQuery]=useState(""),[results,setResults]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
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
  <div className="growth-card-grid">{results.map((p,i)=><article className="growth-subcard" key={p.website+i}><h3>{p.name}</h3><p>{p.reason}</p><a href={p.website} target="_blank" rel="noreferrer noopener">Open organization source</a><p><small>{p.location||region} · Public organization website, not a verified contact</small></p></article>)}</div>
 </section>;
}
