import { useContext, useState } from 'react';
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
  const [form,setForm] = useState({ organization:'',campaign:'',coordinator:'',deadline:'',delivery:'Team pickup',fundraiser:'None',terms:'' });
  const [copied,setCopied] = useState('');
  const update=(name,value)=>setForm(current=>({...current,[name]:value}));
  const brief = [
    'Skilled Crafting — team store / group order campaign brief',
    'Organization: ' + (form.organization||'Not supplied'),
    'Campaign: ' + (form.campaign||'Not supplied'),
    'Coordinator: ' + (form.coordinator||'Not supplied'),
    'Proposed ordering deadline: ' + (form.deadline||'Not supplied'),
    'Fulfillment: ' + form.delivery,
    'Fundraiser model: ' + form.fundraiser,
    'Terms to approve: ' + (form.terms||'Not supplied'),
    'Required approvals: products, prices, customer artwork, ordering deadline, payment/refund terms, pickup, and fundraising statement.',
    'Status: DRAFT / NOT LIVE — record finalized terms in Marketing CRM.',
  ].join('\n');
  async function copy() {
    try { await navigator.clipboard.writeText(brief); setCopied('Campaign brief copied. Paste it into your Marketing customer record.'); }
    catch { setCopied('Clipboard access unavailable; select and copy the brief below.'); }
  }
  return <main className="page sc-team-launch">
    <section className="page-header"><div><p className="eyebrow">Growth · Team stores and fundraising</p>
      <h1>Team store campaign launchpad</h1>
      <p>Plan a school, club or fundraising campaign step-by-step. Use the existing Marketing, Client Orders, WooCommerce and production tools without guessing where to go next.</p>
    </div></section>
    <section className="card elevated-card">
      <h2>Start with the campaign brief</h2>
      <div className="sc-team-fields">
        <label>Organization<input value={form.organization} onChange={e=>update('organization',e.target.value)} placeholder="School, team or club" /></label>
        <label>Campaign / season<input value={form.campaign} onChange={e=>update('campaign',e.target.value)} placeholder="Winter spirit wear 2026" /></label>
        <label>Coordinator name / reference<input value={form.coordinator} onChange={e=>update('coordinator',e.target.value)} placeholder="Client contact" /></label>
        <label>Target order close date<input type="date" value={form.deadline} onChange={e=>update('deadline',e.target.value)} /></label>
        <label>Fulfillment<select value={form.delivery} onChange={e=>update('delivery',e.target.value)}><option>Team pickup</option><option>Individual pickup</option><option>Ship to customers</option><option>Deliver to coordinator</option></select></label>
        <label>Fundraising approach<select value={form.fundraiser} onChange={e=>update('fundraiser',e.target.value)}>
          <option>None</option><option>Fixed amount per eligible item</option><option>Percentage of eligible sales</option><option>Custom agreement</option></select></label>
      </div>
      <label className="sc-team-long">Fundraising / approval terms<textarea rows="3" value={form.terms} onChange={e=>update('terms',e.target.value)}
        placeholder="Enter agreed payout, eligibility, refund rules, shipping and sales tax treatment. Confirm with client before publishing." /></label>
      <div className="sc-team-controls">
        <button type="button" onClick={copy}>Copy campaign brief</button>
        <Link to="/marketing">Open Marketing CRM to save details →</Link>
      </div>
      {copied ? <p role="status">{copied}</p> : null}
      <details><summary>Preview the draft brief before copying</summary><pre className="sc-team-brief">{brief}</pre></details>
      <p className="helper-text">This draft is only in this browser tab. Copy the brief into the existing CRM to retain it; this page does not create a live store or financial payout record.</p>
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
