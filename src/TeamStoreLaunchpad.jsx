import { useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { Link } from 'react-router-dom';
import { EmployeeAccessContext } from './lib/employeeAccessContext';
import './TeamStoreLaunchpad.css';

const STEPS = [
  { name:'Identify organization and coordinator', detail:'Record the club, school, business or fundraiser coordinator in Marketing & Client Growth.', ops:false, path:'/marketing', link:'Open Marketing CRM' },
  { name:'Select approved products', detail:'Use verified supplier catalog items, real sizes/colors and your normal pricing rules.', ops:false, path:'/marketing', link:'Review catalog & pricing' },
  { name:'Prepare and approve artwork', detail:'Confirm all logos, decorations, sample mockups and customer proof before selling.', ops:false, path:'/marketing', link:'Prepare client proof' },
  { name:'Agree on fundraiser terms', detail:'Document fixed/percent amount, eligible products, discounts/refunds, tax, shipping, statement date and responsible recipient.', ops:false, path:'/marketing', link:'Record deal terms' },
  { name:'Create the campaign/store', detail:'Existing Marketing store previews are concepts, not live WooCommerce transactional stores. Public team-order form currently collects order requests.', ops:false, path:'/team-order', link:'Preview order request form' },
  { name:'Consolidate orders and manufacture', detail:'Use existing Client Orders, purchasing and Production Board to fulfill approved paid or invoiced orders.', ops:true, path:'/work-hub', link:'Open Work Hub' },
  { name:'Pack by player / team and close out', detail:'Verify names/numbers, individual bag labels, pickup list and an independently reconciled fundraiser statement.', ops:true, path:'/qc-checklist', link:'Open QC' },
];

export default function TeamStoreLaunchpad() {
  const access = useContext(EmployeeAccessContext);
  const marketingOnly = access?.role === 'marketing';
  const [form,setForm] = useState({ organization:'',campaign:'',coordinator:'',deadline:'',delivery:'Team pickup',
    kind:'team_store',fundraiser:'none',flatAmount:'',percent:'',terms:'' });
  const [campaignId,setCampaignId]=useState('');
  const [savedCampaigns,setSavedCampaigns]=useState([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function loadCampaigns() {
    const {data,error}=await supabase.from('sc_team_store_workflows')
      .select('id,workflow_name,customer_name,store_name,stage,status,coordinator_name,campaign_kind,fulfillment_method,fundraiser_model,fundraiser_flat_amount,fundraiser_percent,fundraiser_terms,store_close_date')
      .order('updated_at',{ascending:false}).limit(150);
    if(error)throw error;
    setSavedCampaigns(data||[]);
  }
  useEffect(()=>{loadCampaigns().catch(e=>setMessage('Could not load saved campaigns: '+e.message));},[]);
  function openCampaign(id) {
    const row=savedCampaigns.find(c=>c.id===id);
    if(!row){setCampaignId('');setForm({organization:'',campaign:'',coordinator:'',deadline:'',delivery:'Team pickup',kind:'team_store',fundraiser:'none',flatAmount:'',percent:'',terms:''});return;}
    setCampaignId(row.id);
    setForm({organization:row.customer_name||'',campaign:row.workflow_name||row.store_name||'',
      coordinator:row.coordinator_name||'',deadline:row.store_close_date||'',
      delivery:row.fulfillment_method||'Team pickup',kind:row.campaign_kind||'team_store',
      fundraiser:row.fundraiser_model||'none',flatAmount:row.fundraiser_flat_amount??'',
      percent:row.fundraiser_percent??'',terms:row.fundraiser_terms||''});
    setMessage('Existing '+row.stage+' campaign opened. Changes remain draft until explicitly saved.');
  }
  async function saveCampaign() {
    setBusy(true);setMessage('');
    try {
      if(!form.organization.trim()||!form.campaign.trim())throw Error('Enter organization and campaign name.');
      const amount=form.fundraiser==='fixed_per_eligible_item'?Number(form.flatAmount):null;
      const percent=form.fundraiser==='percent_of_eligible_sales'?Number(form.percent):null;
      if(amount!==null&&(!Number.isFinite(amount)||amount<0))throw Error('Enter a valid fixed fundraising amount.');
      if(percent!==null&&(!Number.isFinite(percent)||percent<0||percent>100))throw Error('Enter a fundraiser percentage between 0 and 100.');
      const payload={workflow_name:form.campaign.trim(),customer_name:form.organization.trim(),
        store_name:form.campaign.trim(),coordinator_name:form.coordinator.trim(),
        campaign_kind:form.kind,fulfillment_method:form.delivery,
        fundraiser_model:form.fundraiser,fundraiser_flat_amount:amount,fundraiser_percent:percent,
        fundraiser_terms:form.terms.trim(),store_close_date:form.deadline||null,due_date:form.deadline||null};
      if(campaignId) {
        const {error}=await supabase.from('sc_team_store_workflows').update(payload).eq('id',campaignId);
        if(error)throw error;
      }else{
        const {data:auth,error:authError}=await supabase.auth.getUser();
        if(authError||!auth.user)throw Error('Sign in to save campaign.');
        const {data,error}=await supabase.from('sc_team_store_workflows')
          .insert({...payload,stage:'request',status:'active',created_by:auth.user.id}).select('id').single();
        if(error)throw error;
        setCampaignId(data.id);
      }
      await loadCampaigns();
      setMessage('Campaign planning saved in the existing team-store workflow. It is not a live WooCommerce storefront.');
    }catch(e){setMessage('Unable to save campaign: '+e.message);}
    finally{setBusy(false);}
  }
  const [copied,setCopied] = useState('');
  const update=(name,value)=>setForm(current=>({...current,[name]:value}));
  const brief = [
    'Skilled Crafting — team store / group order campaign brief',
    'Organization: ' + (form.organization||'Not supplied'),
    'Campaign: ' + (form.campaign||'Not supplied'),
    'Coordinator: ' + (form.coordinator||'Not supplied'),
    'Proposed ordering deadline: ' + (form.deadline||'Not supplied'),
    'Fulfillment: ' + form.delivery,
    'Campaign kind: ' + form.kind,
    'Fundraiser model: ' + form.fundraiser,
    'Fundraising amount / percent: ' + (form.flatAmount||'—') + ' / ' + (form.percent||'—'),
    'Terms to approve: ' + (form.terms||'Not supplied'),
    'Required approvals: products, prices, customer artwork, ordering deadline, payment/refund terms, pickup, and fundraising statement.',
    'Status: DRAFT / NOT LIVE — record finalized terms in Marketing CRM.',
  ].join('\n');
  async function copy() {
    try { await navigator.clipboard.writeText(brief); setCopied('Campaign brief copied. You can paste it into your Marketing customer record or client message.'); }
    catch { setCopied('Clipboard access unavailable; select and copy the brief below.'); }
  }
  return <main className="page sc-team-launch">
    <section className="page-header"><div><p className="eyebrow">Growth · Team stores and fundraising</p>
      <h1>Team store campaign launchpad</h1>
      <p>Plan a school, club or fundraising campaign step-by-step. Use the existing Marketing, Client Orders, WooCommerce and production tools without guessing where to go next.</p>
    </div></section>
    <section className="card elevated-card">
      <h2>Start or reopen a campaign</h2>
      <label className="sc-team-long">Previously saved campaigns<select value={campaignId} onChange={e=>openCampaign(e.target.value)}>
        <option value="">+ Start new campaign</option>
        {savedCampaigns.map(c=><option key={c.id} value={c.id}>{c.customer_name} — {c.workflow_name} ({c.stage})</option>)}
      </select></label>
      <p className="helper-text">Campaigns are saved to your existing internal team-store workflow, with the same login permissions as the rest of the application.</p>
      <div className="sc-team-fields">
        <label>Organization<input value={form.organization} onChange={e=>update('organization',e.target.value)} placeholder="School, team or club" /></label>
        <label>Campaign / season<input value={form.campaign} onChange={e=>update('campaign',e.target.value)} placeholder="Winter spirit wear 2026" /></label>
        <label>Campaign type<select value={form.kind} onChange={e=>update('kind',e.target.value)}>
          <option value="team_store">Team / school store</option><option value="group_order">Group order</option><option value="fundraiser">Fundraiser</option>
        </select></label>
        <label>Coordinator name / reference<input value={form.coordinator} onChange={e=>update('coordinator',e.target.value)} placeholder="Client contact" /></label>
        <label>Target order close date<input type="date" value={form.deadline} onChange={e=>update('deadline',e.target.value)} /></label>
        <label>Fulfillment<select value={form.delivery} onChange={e=>update('delivery',e.target.value)}><option>Team pickup</option><option>Individual pickup</option><option>Ship to customers</option><option>Deliver to coordinator</option></select></label>
        <label>Fundraising approach<select value={form.fundraiser} onChange={e=>update('fundraiser',e.target.value)}>
          <option value="none">None</option><option value="fixed_per_eligible_item">Fixed amount per eligible item</option>
          <option value="percent_of_eligible_sales">Percentage of eligible sales</option><option value="custom">Custom agreement</option>
          </select></label>
      </div>
      {form.fundraiser==='fixed_per_eligible_item'&&<label className="sc-team-long">Planned fundraiser amount per eligible item ($)<input type="number" min="0" step=".01" value={form.flatAmount} onChange={e=>update('flatAmount',e.target.value)}/></label>}
      {form.fundraiser==='percent_of_eligible_sales'&&<label className="sc-team-long">Planned eligible-sales percentage (%)<input type="number" min="0" max="100" step=".1" value={form.percent} onChange={e=>update('percent',e.target.value)}/></label>}
      <label className="sc-team-long">Fundraising / approval terms<textarea rows="3" value={form.terms} onChange={e=>update('terms',e.target.value)}
        placeholder="Enter agreed payout, eligibility, refund rules, shipping and sales tax treatment. Confirm with client before publishing." /></label>
      <div className="sc-team-controls">
        <button type="button" onClick={saveCampaign} disabled={busy}>{busy?'Saving…':campaignId?'Update campaign draft':'Save campaign draft'}</button>
        <button type="button" onClick={copy}>Copy campaign brief</button>
        <Link to="/marketing">Open Marketing CRM to save details →</Link>
      </div>
      {copied ? <p role="status">{copied}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      <details><summary>Preview the draft brief before copying</summary><pre className="sc-team-brief">{brief}</pre></details>
      <p className="helper-text">Use Save campaign draft to persist the plan. No payment collection, public store publication, roster processing or fundraiser disbursement is performed from this page.</p>
    </section>
    <section className="card elevated-card">
      <h2>Campaign launch checklist</h2>
      <ol className="sc-team-steps">{STEPS.map((step,i)=>
        <li key={step.name}>
          <div><strong>{i+1}. {step.name}</strong><p>{step.detail}</p></div>
          {marketingOnly && step.ops ? <span>Operations staff follow-up</span> : <Link to={step.path}>{step.link} →</Link>}
        </li>)}</ol>
      <p><strong>Next build:</strong> Real transactional Woo campaign publishing, roster-to-order import, order bundling, per-player packing, coordinator portal and auditable fundraiser ledger. These capabilities require new durable records and end-to-end financial tests; this launchpad does not claim they exist yet.</p>
    </section>
  </main>;
}
