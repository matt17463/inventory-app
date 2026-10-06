import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCalendarData } from './lib/clientOrdersApi';

const active=(status)=>!['completed','complete','cancelled','canceled','closed','received','done'].includes(String(status||'').toLowerCase());
const dateKey=(v)=>v?String(v).slice(0,10):'';

export default function HomeUpcomingCommitments(){
  const [data,setData]=useState(null);
  useEffect(()=>{listCalendarData().then(setData).catch(()=>setData({jobs:[],purchaseOrders:[],artwork:[],clientOrders:[],tasks:[]}));},[]);
  const items=useMemo(()=>{
    if(!data) return [];
    const out=[];
    (data.jobs||[]).forEach((r)=>{if(r.due_date&&active(r.status))out.push({date:dateKey(r.due_date),type:'Order due',title:r.customer_name||r.job_name||('Job #'+r.id),href:'/pullsheets/'+r.id});});
    (data.clientOrders||[]).forEach((r)=>{if(r.desired_completion_date&&active(r.status))out.push({date:dateKey(r.desired_completion_date),type:'Client request',title:r.order_number+' · '+r.organization,href:'/client-orders'});});
    (data.purchaseOrders||[]).forEach((r)=>{if(r.expected_at&&active(r.status))out.push({date:dateKey(r.expected_at),type:'PO expected',title:(r.po_number||'Purchase order')+' · '+(r.supplier_name||r.supplier||'Supplier'),href:'/purchase-orders'});});
    (data.artwork||[]).forEach((r)=>{const d=r.deadline_date||r.deadline;if(d&&active(r.app_status||r.status))out.push({date:dateKey(d),type:'Artwork',title:r.organization||r.main_subject||r.project_type||'Artwork request',href:'/artwork-requests'});});
    const today=new Date().toISOString().slice(0,10), horizon=new Date(); horizon.setDate(horizon.getDate()+14); const end=horizon.toISOString().slice(0,10);
    return out.filter((x)=>x.date>=today&&x.date<=end).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8);
  },[data]);
  if(!items.length) return null;
  return <section className="sc-panel sc-panel-color-left">
    <div className="sc-panel-header"><div><div className="sc-kicker">Upcoming Commitments</div><h3>{items.length} scheduled item{items.length===1?'':'s'} in the next 14 days</h3><p>Customer due dates, client requests, purchase arrivals, and artwork deadlines from the operations calendar.</p></div><div className="sc-hero-actions"><Link className="sc-btn" to="/operations-calendar">Open Operations Calendar</Link></div></div>
    <div className="sc-workflow-list sc-workflow-list-colored">{items.map((item,index)=><Link key={item.type+item.date+index} to={item.href} style={{display:'block',padding:'10px 0',textDecoration:'none',color:'inherit'}}><strong>{new Date(item.date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})} · {item.type}</strong><span style={{display:'block'}}>{item.title}</span></Link>)}</div>
  </section>;
}
