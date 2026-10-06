import { useEffect, useMemo, useState } from 'react';
import { getClientOrderItems, listClientOrderAttachments, listClientOrders, openClientOrderAttachment, updateClientOrder } from './lib/clientOrdersApi';
import './operationsFeatures.css';

const statuses=['submitted','review','pricing','quote_sent','awaiting_approval','awaiting_payment','artwork','ready_for_production','production','ready_pickup','completed','cancelled'];
const label=(value)=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,(m)=>m.toUpperCase());
const date=(value)=>value?new Date(value+'T12:00:00').toLocaleDateString():'—';

export default function ClientOrders(){
  const [rows,setRows]=useState([]),[selected,setSelected]=useState(null),[items,setItems]=useState([]),[attachments,setAttachments]=useState([]);
  const [filter,setFilter]=useState('open'),[message,setMessage]=useState(''),[loading,setLoading]=useState(true);

  async function load(){
    setLoading(true); setMessage('');
    try{
      const data=await listClientOrders();
      setRows(data);
      if(selected){
        const fresh=data.find((r)=>r.id===selected.id);
        if(fresh) setSelected(fresh);
      }
    }catch(error){setMessage(error.message||String(error));}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]); // eslint-disable-line react-hooks/exhaustive-deps

  async function open(row){
    setSelected(row); setMessage('');
    try{
      const [lineRows,fileRows]=await Promise.all([getClientOrderItems(row.id),listClientOrderAttachments(row.id)]);
      setItems(lineRows); setAttachments(fileRows);
    }catch(error){setMessage(error.message||String(error));}
  }
  async function changeStatus(next){
    if(!selected) return;
    try{
      const updated=await updateClientOrder(selected.id,{status:next, reviewed_at:selected.reviewed_at||(next!=='submitted'?new Date().toISOString():null)});
      setSelected({...selected,...updated}); await load();
    }catch(error){setMessage(error.message||String(error));}
  }
  async function saveNotes(){
    try{ const updated=await updateClientOrder(selected.id,{internal_notes:selected.internal_notes||''}); setSelected({...selected,...updated}); setMessage('Internal notes saved.'); }
    catch(error){setMessage(error.message||String(error));}
  }

  const filtered=useMemo(()=>rows.filter((row)=>{
    if(filter==='all') return true;
    if(filter==='open') return !['completed','cancelled'].includes(row.status);
    return row.status===filter;
  }),[rows,filter]);
  const submitted=rows.filter((r)=>r.status==='submitted').length;

  return <main className="page sc-page-stack">
    <section className="page-header"><div><p className="eyebrow">Orders</p><h1>Client Orders</h1><p>Review online team/business requests before pricing, inventory commitment, or production.</p></div><div className="button-row"><a className="secondary-button" href="/team-order" target="_blank" rel="noreferrer">Open public form</a><button onClick={load}>Refresh</button></div></section>
    {message&&<p className="message">{message}</p>}
    <section className="metric-grid"><article className="metric-card"><strong>{submitted}</strong><span>New submissions</span></article><article className="metric-card"><strong>{rows.filter((r)=>!['completed','cancelled'].includes(r.status)).length}</strong><span>Open requests</span></article><article className="metric-card"><strong>{rows.reduce((sum,r)=>sum+Number(r.total_quantity||0),0)}</strong><span>Requested units</span></article></section>
    <section className="card elevated-card"><div className="section-heading-row wrap-row"><div><h2>Request queue</h2><p className="muted">These records do not reserve inventory or create Purchasing demand until a later conversion phase.</p></div><select value={filter} onChange={(e)=>setFilter(e.target.value)}><option value="open">Open</option><option value="all">All</option>{statuses.map((s)=><option key={s} value={s}>{label(s)}</option>)}</select></div></section>
    <section className="sc-client-orders-layout">
      <section className="card elevated-card table-card">
        <div className="responsive-table"><table className="data-table"><thead><tr><th>Request</th><th>Customer</th><th>Qty</th><th>Status</th><th>Requested</th><th></th></tr></thead>
        <tbody>{loading?<tr><td colSpan="6">Loading…</td></tr>:filtered.length===0?<tr><td colSpan="6">No requests found.</td></tr>:filtered.map((row)=><tr key={row.id} className={selected?.id===row.id?'selected-row':''}><td><strong>{row.order_number}</strong><br/><small>{new Date(row.submitted_at).toLocaleString()}</small></td><td>{row.organization}<br/><small>{row.contact_name}</small></td><td>{row.total_quantity}</td><td><span className={'sc-status-pill sc-status-'+row.status}>{label(row.status)}</span></td><td>{date(row.desired_completion_date)}</td><td><button className="secondary-button" onClick={()=>open(row)}>Open</button></td></tr>)}</tbody></table></div>
      </section>
      <aside className="card elevated-card sc-client-order-detail">
        {!selected?<div className="sc-empty-state">Select a request to review the submitted details.</div>:<>
          <div className="section-heading-row wrap-row"><div><p className="eyebrow">{selected.order_number}</p><h2>{selected.organization}</h2><p>{selected.contact_name} · <a href={'mailto:'+selected.contact_email}>{selected.contact_email}</a>{selected.contact_phone?' · '+selected.contact_phone:''}</p></div><select value={selected.status} onChange={(e)=>changeStatus(e.target.value)}>{statuses.map((s)=><option key={s} value={s}>{label(s)}</option>)}</select></div>
          <div className="sc-detail-grid"><p><strong>Order type</strong><br/>{selected.order_type||'—'}</p><p><strong>Requested completion</strong><br/>{date(selected.desired_completion_date)}</p><p><strong>Event date</strong><br/>{date(selected.event_date)}</p><p><strong>Fulfillment</strong><br/>{selected.delivery_method||'—'}</p><p><strong>Artwork</strong><br/>{selected.artwork_choice||'—'}</p><p><strong>Preferred contact</strong><br/>{selected.preferred_contact_method||'—'}</p></div>
          {selected.artwork_reference_url&&<p><a href={selected.artwork_reference_url} target="_blank" rel="noreferrer">Open customer artwork/reference link</a></p>}
          {selected.customization_notes&&<div className="sc-note-block"><strong>Customization / artwork notes</strong><p>{selected.customization_notes}</p></div>}
          {selected.customer_notes&&<div className="sc-note-block"><strong>Customer notes</strong><p>{selected.customer_notes}</p></div>}
          <h3>Submitted items</h3>
          <div className="responsive-table"><table className="data-table compact-table"><thead><tr><th>#</th><th>Recipient</th><th>Garment</th><th>Size</th><th>Color</th><th>Personalization</th><th>Qty</th></tr></thead><tbody>{items.map((item)=><tr key={item.id}><td>{item.line_number}</td><td>{item.recipient_name||'—'}</td><td>{item.garment_type||'—'}</td><td>{item.size||'—'}</td><td>{item.garment_color||'—'}</td><td>{[item.name_on_back,item.jersey_number&&'#'+item.jersey_number,item.name_text_color].filter(Boolean).join(' · ')||'—'}</td><td>{item.quantity}</td></tr>)}</tbody></table></div>
          {attachments.length>0&&<><h3>Attachments</h3><div className="sc-attachment-list">{attachments.map((file)=><button key={file.id} type="button" className="secondary-button" onClick={()=>openClientOrderAttachment(file.id)}>{file.file_name}</button>)}</div></>}
          <label>Internal review notes<textarea rows="5" value={selected.internal_notes||''} onChange={(e)=>setSelected({...selected,internal_notes:e.target.value})}/></label>
          <div className="button-row"><button onClick={saveNotes}>Save notes</button><a className="secondary-button" href={'mailto:'+selected.contact_email+'?subject='+encodeURIComponent('Skilled Crafting '+selected.order_number)} >Email customer</a></div>
          <div className="sc-next-stage"><strong>Phase 2 boundary</strong><p>Use Review/Pricing statuses now. Product mapping, pricing, QuickBooks invoice creation, and conversion into the existing manual-order/job/reservation workflow are intentionally reserved for the next phase so a submitted request cannot create premature inventory demand.</p></div>
        </>}
      </aside>
    </section>
  </main>;
}
