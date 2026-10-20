import {useMemo,useState} from "react";
import {supabase} from "./supabaseClient";
import {growthWriteAllowed} from "./lib/marketingApi";
const daysFrom=(start,days)=>{const d=new Date(start+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
export const followUpSequences={
 introduction:[{days:0,label:"Verify organization and first introduction"},{days:7,label:"Review source and outreach response"},{days:21,label:"Plan samples or product options"},{days:45,label:"Review next steps or mark inactive"}],
 reorder:[{days:0,label:"Confirm last order and reorder eligibility"},{days:30,label:"Review stock, sizing and reorder windows"},{days:90,label:"Check upcoming seasons and promotional events"},{days:180,label:"Schedule next program review"}],
 seasonal:[{days:0,label:"Research upcoming event and decision timeline"},{days:30,label:"Plan artwork, sample and quote milestones"},{days:60,label:"Review production and delivery lead time"},{days:90,label:"Review launch and customer follow-up"}],
};
export default function MarketingFollowUpPlanner({opportunities=[],accounts=[]}){
 const [opportunityId,setOpportunityId]=useState(""),[sequence,setSequence]=useState("introduction"),[start,setStart]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const opp=opportunities.find(o=>o.id===opportunityId),client=accounts.find(a=>a.id===opp?.account_id);
 const planned=useMemo(()=>start?followUpSequences[sequence].map((task,i)=>({...task,due_date:daysFrom(start,task.days),key:"marketing-"+sequence+"-"+i})):[],[start,sequence]);
 async function create(){
  if(!opp||!planned.length){setMessage("Choose a campaign and first due date.");return;}
  setBusy(true);setMessage("");
  try{
   if(!growthWriteAllowed()){setMessage("Training mode: reminders were previewed only, nothing was saved.");return;}
   const keys=planned.map(p=>p.key);
   const {data,error}=await supabase.from("sc_growth_tasks").select("task_key").eq("opportunity_id",opp.id).in("task_key",keys);
   if(error)throw error;
   const existing=new Set((data||[]).map(t=>t.task_key)),remaining=planned.filter(p=>!existing.has(p.key));
   if(!remaining.length){setMessage("This sequence already exists for the campaign. Edit tasks in the campaign rather than creating duplicates.");return;}
   const rows=remaining.map(p=>({opportunity_id:opp.id,task_key:p.key,title:p.label,department:"marketing",status:"open",due_date:p.due_date,
    notes:"Planned internal reminder for "+(client?.organization||"client")+". Confirm current contact preference and source details before any outreach. No message is sent automatically."}));
   const {error:writeError}=await supabase.from("sc_growth_tasks").insert(rows);
   if(writeError)throw writeError;
   setMessage(remaining.length+" internal CRM reminders created. No emails or marketing messages were sent.");
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 return <section className="sc-panel"><h2>Follow-up campaign planner</h2><p>Prepare an idempotent schedule of internal tasks for prospect introductions, reorders or seasonal programs. Sending marketing messages is never automatic, and every contact preference requires review.</p>
  <div className="growth-grid">
   <label className="growth-field"><span>Client campaign</span><select value={opportunityId} onChange={e=>setOpportunityId(e.target.value)}><option value="">Select opportunity</option>{opportunities.filter(o=>!o.archived_at).map(o=><option key={o.id} value={o.id}>{accounts.find(a=>a.id===o.account_id)?.organization||"Client"} · {o.title}</option>)}</select></label>
   <label className="growth-field"><span>Follow-up pattern</span><select value={sequence} onChange={e=>setSequence(e.target.value)}><option value="introduction">New prospect introduction</option><option value="reorder">Reorder / repeat business</option><option value="seasonal">Seasonal program</option></select></label>
   <label className="growth-field"><span>First reminder date</span><input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
  </div>
  {planned.length>0&&<div className="growth-table-wrap"><table className="sc-table"><thead><tr><th>Due date</th><th>Task</th></tr></thead><tbody>{planned.map(p=><tr key={p.key}><td>{p.due_date}</td><td>{p.label}</td></tr>)}</tbody></table></div>}
  <button className="sc-btn sc-btn-primary" type="button" disabled={!opp||!planned.length||busy} onClick={create}>{busy?"Saving…":"Create CRM reminder sequence"}</button>
  {message&&<p role="status">{message}</p>}
 </section>;
}
