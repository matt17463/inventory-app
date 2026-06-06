import { useEffect, useState } from 'react';
import { createQuoteOrderHandoff, getQuoteOrderHandoffs, markQuoteConverted } from './lib/phase6Api';

const initial = { quote_number:'', customer_name:'', customer_email:'', organization:'', estimated_revenue:'', estimated_cost:'', target_margin_percent:'45' };

export default function QuoteToOrder() {
  const [rows, setRows] = useState([]); const [form,setForm]=useState(initial); const [error,setError]=useState('');
  async function load(){ setError(''); try{ setRows(await getQuoteOrderHandoffs()); }catch(e){ setError(e.message); }}
  useEffect(()=>{load();},[]);
  async function submit(e){ e.preventDefault(); await createQuoteOrderHandoff(form); setForm(initial); await load(); }
  async function convert(row){ const orderId=prompt('WooCommerce/order ID:', row.converted_order_id||''); const jobId=prompt('Job ID:', row.converted_job_id||''); const note=prompt('Conversion note:', row.conversion_note||''); await markQuoteConverted(row.id, orderId||'', jobId||'', note||''); await load(); }
  return <main className="page phase6-page"><h1>Quote-to-Order Workflow</h1><p className="muted">Track approved quotes and convert them into orders/jobs with audit trail visibility.</p>{error&&<div className="error-card">{error}</div>}
    <form className="phase6-panel phase6-grid-form" onSubmit={submit}><h2>Add Quote Handoff</h2>{Object.keys(initial).map(k=><input key={k} placeholder={k.replaceAll('_',' ')} value={form[k]} onChange={(e)=>setForm({...form,[k]:e.target.value})}/>) }<button className="button button-primary">Save Quote</button></form>
    <div className="table-wrap"><table className="data-table compact-table"><thead><tr><th>Quote</th><th>Customer</th><th>Status</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Action</th></tr></thead><tbody>
      {rows.map(r=><tr key={r.id}><td>{r.quote_number||r.quote_id}</td><td>{r.customer_name}<br/><small>{r.organization}</small></td><td>{r.status}</td><td>${Number(r.estimated_revenue||0).toFixed(2)}</td><td>${Number(r.estimated_cost||0).toFixed(2)}</td><td>${Number(r.estimated_profit||0).toFixed(2)}</td><td>{r.status!=='converted'?<button className="button small" onClick={()=>convert(r)}>Mark Converted</button>:<span>Converted</span>}</td></tr>)}
      {!rows.length&&<tr><td colSpan="7">No quote handoffs yet.</td></tr>}
    </tbody></table></div>
  </main>;
}
