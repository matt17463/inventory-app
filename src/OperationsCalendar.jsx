import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCalendarData } from './lib/clientOrdersApi';
import './operationsFeatures.css';

const todayKey=()=>new Date().toISOString().slice(0,10);
const dayKey=(value)=>{if(!value)return''; const d=new Date(value.length===10?value+'T12:00:00':value); return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);};
const active=(status)=>!['completed','complete','cancelled','canceled','closed','received','done'].includes(String(status||'').toLowerCase());
const typeMeta={
  order:{label:'Order due',className:'order'},
  client:{label:'Client request',className:'client'},
  purchase:{label:'PO expected',className:'purchase'},
  artwork:{label:'Artwork',className:'artwork'},
  task:{label:'Task',className:'task'}
};

function buildEvents(data){
  const events=[];
  for(const row of data.jobs||[]){ if(row.due_date&&active(row.status)) events.push({id:'job-'+row.id,type:'order',date:dayKey(row.due_date),title:`Order ${row.woocommerce_order_id?'#'+row.woocommerce_order_id:'Job #'+row.id} · ${row.customer_name||row.job_name||'Customer'}`,status:row.status,href:'/pullsheets/'+row.id});}
  for(const row of data.clientOrders||[]){ if(row.desired_completion_date&&active(row.status)) events.push({id:'client-'+row.id,type:'client',date:dayKey(row.desired_completion_date),title:`${row.order_number} · ${row.organization}`,status:row.status,detail:`${row.total_quantity||0} requested units`,href:'/client-orders'});}
  for(const row of data.purchaseOrders||[]){ if(row.expected_at&&active(row.status)) events.push({id:'po-'+(row.id||row.purchase_order_id),type:'purchase',date:dayKey(row.expected_at),title:`PO ${row.po_number||row.id} · ${row.supplier_name||row.supplier||'Supplier'}`,status:row.status,detail:row.total_units_open!=null?`${row.total_units_open} units open`:'',href:'/purchase-orders/'+(row.id||row.purchase_order_id)+'/receive'});}
  for(const row of data.artwork||[]){ const due=row.deadline_date||row.deadline; if(due&&active(row.app_status||row.status)) events.push({id:'art-'+row.id,type:'artwork',date:dayKey(due),title:`Artwork · ${row.organization||row.main_subject||row.project_type||'Request'}`,status:row.app_status||row.status,href:'/artwork-requests'});}
  for(const row of data.tasks||[]){ if(row.due_at&&active(row.status)) events.push({id:'task-'+row.id,type:'task',date:dayKey(row.due_at),title:`Task · ${row.title||row.task_type||'Work item'}`,status:row.status,detail:row.priority!=null?`Priority ${row.priority}`:'',href:'/employee-tasks'});}
  return events.sort((a,b)=>a.date.localeCompare(b.date));
}

function monthCells(cursor){
  const first=new Date(cursor.getFullYear(),cursor.getMonth(),1);
  const start=new Date(first); start.setDate(1-first.getDay());
  return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});
}

export default function OperationsCalendar(){
  const [data,setData]=useState({jobs:[],purchaseOrders:[],artwork:[],clientOrders:[],tasks:[]});
  const [cursor,setCursor]=useState(()=>new Date());
  const [view,setView]=useState('month');
  const [filters,setFilters]=useState({order:true,client:true,purchase:true,artwork:true,task:true});
  const [message,setMessage]=useState('');
  async function load(){try{setMessage('');setData(await listCalendarData());}catch(e){setMessage(e.message||String(e));}}
  useEffect(()=>{load();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  const all=useMemo(()=>buildEvents(data),[data]);
  const events=useMemo(()=>all.filter((e)=>filters[e.type]),[all,filters]);
  const cells=useMemo(()=>monthCells(cursor),[cursor]);
  const monthLabel=cursor.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  const upcoming=events.filter((e)=>e.date>=todayKey()).slice(0,40);
  const overdue=events.filter((e)=>e.date<todayKey()).length;
  const next14=new Date(); next14.setDate(next14.getDate()+14); const next14key=next14.toISOString().slice(0,10);
  const due14=events.filter((e)=>e.date>=todayKey()&&e.date<=next14key).length;

  function shift(delta){const d=new Date(cursor);d.setMonth(d.getMonth()+delta);setCursor(d);}
  const toggle=(key)=>setFilters((prev)=>({...prev,[key]:!prev[key]}));

  return <main className="page sc-page-stack">
    <section className="page-header"><div><p className="eyebrow">Operations</p><h1>Operations Calendar</h1><p>One operational view of customer commitments, purchasing arrivals, artwork deadlines, and tasks. Google Calendar remains the synchronized external calendar; Skilled Crafting remains the source of truth.</p></div><div className="button-row"><Link className="secondary-button" to="/google-calendar">Google Calendar settings</Link><button onClick={load}>Refresh</button></div></section>
    {message&&<p className="message">{message}</p>}
    <section className="metric-grid"><article className="metric-card"><strong>{due14}</strong><span>Commitments next 14 days</span></article><article className="metric-card"><strong>{overdue}</strong><span>Past-due open items</span></article><article className="metric-card"><strong>{data.clientOrders.filter((r)=>r.status==='submitted').length}</strong><span>New client requests</span></article><article className="metric-card"><strong>{events.length}</strong><span>Visible calendar items</span></article></section>
    <section className="card elevated-card sc-calendar-toolbar"><div className="button-row"><button className={view==='month'?'':'secondary-button'} onClick={()=>setView('month')}>Month</button><button className={view==='agenda'?'':'secondary-button'} onClick={()=>setView('agenda')}>Agenda</button></div><div className="sc-calendar-filters">{Object.keys(typeMeta).map((key)=><label key={key}><input type="checkbox" checked={filters[key]} onChange={()=>toggle(key)}/><span className={'sc-calendar-dot '+typeMeta[key].className}></span>{typeMeta[key].label}</label>)}</div></section>
    {view==='month'?<section className="card elevated-card sc-calendar-card">
      <div className="sc-calendar-heading"><button className="secondary-button" onClick={()=>shift(-1)}>‹</button><h2>{monthLabel}</h2><div className="button-row"><button className="secondary-button" onClick={()=>setCursor(new Date())}>Today</button><button className="secondary-button" onClick={()=>shift(1)}>›</button></div></div>
      <div className="sc-calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d)=><strong key={d}>{d}</strong>)}</div>
      <div className="sc-calendar-grid">{cells.map((dateObj)=>{const key=dateObj.toISOString().slice(0,10);const dayEvents=events.filter((e)=>e.date===key);const outside=dateObj.getMonth()!==cursor.getMonth();return <div key={key} className={'sc-calendar-day '+(outside?'outside ':'')+(key===todayKey()?'today':'')}><span className="sc-calendar-day-number">{dateObj.getDate()}</span><div className="sc-calendar-day-events">{dayEvents.slice(0,4).map((e)=><Link key={e.id} to={e.href} className={'sc-calendar-event '+typeMeta[e.type].className} title={e.title}><strong>{e.title}</strong>{e.detail&&<small>{e.detail}</small>}</Link>)}{dayEvents.length>4&&<small>+ {dayEvents.length-4} more</small>}</div></div>;})}</div>
    </section>:<section className="card elevated-card">
      <div className="section-heading-row"><div><h2>Upcoming agenda</h2><p className="muted">Sorted by operational date.</p></div></div>
      <div className="sc-agenda-list">{upcoming.length===0?<div className="sc-empty-state">No upcoming items match the current filters.</div>:upcoming.map((e)=><Link key={e.id} to={e.href} className="sc-agenda-row"><span className={'sc-calendar-dot '+typeMeta[e.type].className}></span><time>{new Date(e.date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</time><div><strong>{e.title}</strong><small>{[typeMeta[e.type].label,e.status,e.detail].filter(Boolean).join(' · ')}</small></div></Link>)}</div>
    </section>}
  </main>;
}
