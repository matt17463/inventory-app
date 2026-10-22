import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import './TeamCampaignCommerce.css';

export default function GroupInvoiceWorkflow({campaign}){
  const [orders,setOrders]=useState([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const code=campaign.public_order_code;
  const formUrl=code?window.location.origin+'/team-order?campaign_code='+encodeURIComponent(code):'';
  const load=useCallback(async()=>{
    if(!campaign.id)return;
    const {data,error:dbError}=await supabase.rpc('sc_group_campaign_requests',{p_campaign_id:campaign.id});
    if(dbError)throw dbError;setOrders(data||[]);
  },[campaign.id]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  async function copyLink(){
    try{await navigator.clipboard.writeText(formUrl);setError('Group order form link copied.');}
    catch{setError('Copy the link from the field below.');}
  }
  return <section className="card elevated-card sc-team-commerce">
    <p className="eyebrow">Occasional group order · QuickBooks invoicing</p>
    <h2>{campaign.workflow_name}</h2>
    <p>This campaign does not need a WooCommerce store. Send the existing team-order form, review the request, generate your QuickBooks invoice CSV, record payment, then deliberately convert the order to production.</p>
    <div className="sc-team-commerce-section">
      <h3>1. Share the client intake form</h3>
      {formUrl?<><label>Group-specific order form URL<input readOnly value={formUrl} onFocus={e=>e.target.select()}/></label>
        <div className="sc-team-controls"><button type="button" onClick={copyLink}>Copy form link</button>
          <a href={formUrl} rel="noreferrer" target="_blank">Open public form ↗</a></div>
        <p><small>The link carries only a campaign code. It does not expose internal prices, staff records or WooCommerce credentials.</small></p></>:<p>Save the campaign to generate its individual client order link.</p>}
      {error&&<p role="status">{error}</p>}
    </div>
    <div className="sc-team-commerce-section">
      <h3>2. Track submitted group orders</h3>
      <p><Link to="/client-orders">Open Client Orders →</Link> to map products, prepare quotes, generate QuickBooks CSV, and record invoice/payment approvals. No order is converted to production automatically.</p>
      <button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{await load();setError('Updated order request list.');}catch(e){setError(e.message);}finally{setBusy(false);}}}>Refresh group requests</button>
      {orders.length?<div className="sc-team-roster-scroll"><table><thead><tr><th>Request</th><th>Submitted</th><th>Contact</th><th>Stage</th><th>QBO invoice</th><th>Production</th></tr></thead><tbody>
      {orders.map(row=><tr key={row.id}>
        <td>{row.order_number}</td>
        <td>{row.submitted_at?new Date(row.submitted_at).toLocaleDateString():'—'}</td>
        <td>{row.contact_name||'—'}</td>
        <td>{row.status}</td>
        <td>{row.external_invoice_number||'Not assigned'}</td>
        <td>{row.generated_job_id?'Job #'+row.generated_job_id:row.payment_received_at?'Paid / ready for manual conversion':'Awaiting approval & payment'}</td>
      </tr>)}</tbody></table></div>:<p>No linked submissions yet. Existing general Client Orders remain unaffected.</p>}
    </div>
    <div className="sc-team-commerce-section">
      <h3>3. Existing production handoff</h3>
      <p>After a QuickBooks invoice is paid and confirmed, the existing Client Orders conversion creates the manual order and production job. Use the production Work Hub and QR manufacturing traveler to complete the work.</p>
      <p><Link to="/work-hub">Open Work Hub →</Link></p>
    </div>
  </section>;
}
