import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { boardColumnForRow, listProductionStatusBoard } from './lib/productionStatusApi';
import './WorkHub.css';

const STAGES = [
  { id:'new_order', label:'Review order', detail:'Confirm requirements & deadline', path:'/client-orders' },
  { id:'needs_attention', label:'Resolve blockers', detail:'Missing stock, mapping or approvals', path:'/exception-center' },
  { id:'on_hold', label:'On hold', detail:'Confirm what must change', path:'/production-board' },
  { id:'ready_to_produce', label:'Production ready', detail:'Verify artwork & material', path:'/pullsheets' },
  { id:'in_production', label:'Make it', detail:'Complete the production steps', path:'/production-board' },
  { id:'qc', label:'Check quality', detail:'Inspect and record results', path:'/qc-checklist' },
  { id:'ready_to_ship', label:'Pack & hand off', detail:'Confirm customer delivery details', path:'/production-board' },
  { id:'completed', label:'Finished', detail:'Confirm closeout', path:'/job-costing' },
];
const display = (s) => String(s || '').replace(/_/g, ' ');
function suggestedActions(stage, jobId) {
  const id = Number(jobId);
  const pull = Number.isInteger(id) && id > 0 ? '/pullsheets/' + id : '/pullsheets';
  const common = [
    { label:'Open production board', path:'/production-board' },
    { label:'Review pull sheet', path:pull },
  ];
  if (stage === 'new_order') return [
    { label:'Review client orders', path:'/client-orders' },
    { label:'Check artwork requests', path:'/artwork-requests' },
    ...common,
  ];
  if (stage === 'needs_attention' || stage === 'on_hold') return [
    { label:'Review blockers', path:'/exception-center' },
    { label:'Check purchasing', path:'/purchasing' },
    ...common,
  ];
  if (stage === 'ready_to_produce') return [
    { label:'Create / scan a job traveler', path:'/production-travelers' + (id>0?'?job='+id:'') },
    { label:'Verify garment production recipe', path:'/manufacturing-recipes' },
    { label:'Prepare approved artwork', path:'/mockup-studio' },
    { label:'Review material recipes', path:'/material-settings' },
    ...common,
  ];
  if (stage === 'in_production') return [
    { label:'Open production instructions / QR traveler', path:'/production-travelers' + (id>0?'?job='+id:'') },
    ...common,
    { label:'Log defects or misprints', path:'/spoilage' },
  ];
  if (stage === 'qc') return [
    { label:'Review traveler / packing instructions', path:'/production-travelers' + (id>0?'?job='+id:'') },
    { label:'Complete QC checklist', path:'/qc-checklist' },
    { label:'Photo proof', path:'/production-photo-proof' }, ...common,
  ];
  if (stage === 'ready_to_ship') return [
    { label:'Complete packing / status', path:'/production-board' },
    { label:'Review customer portal', path:'/customer-portal-admin' },
  ];
  return [{ label:'Review job costing', path:'/job-costing' }, { label:'Find a reorder', path:'/customer-reorders' }];
}
function formatDay(s) {
  if (!s) return 'No date';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleDateString();
}
function describeJob(row) {
  return row.woo_order_number
    ? 'Woo #' + row.woo_order_number
    : row.woocommerce_order_id ? 'Woo #' + row.woocommerce_order_id : row.job_id ? 'Job #' + row.job_id : 'Unlinked order';
}

export default function WorkHub() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('active');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true);setError('');
    try {
      const results = await listProductionStatusBoard({ limit: 350 });
      setRows(results);
    } catch (err) {
      setError(err.message || 'Could not load the production jobs.');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const counts = useMemo(() => rows.reduce((o, r) => {
    const stageId = boardColumnForRow(r);
    o[stageId] = (o[stageId] || 0) + 1;
    return o;
  }, {}), [rows]);
  const visible = useMemo(() => rows.filter((row) => {
    const status = boardColumnForRow(row);
    if (stage === 'active' && ['completed','cancelled'].includes(status)) return false;
    if (stage !== 'active' && stage !== 'all' && status !== stage) return false;
    const haystack = [row.customer_name, row.woo_order_number, row.woocommerce_order_id,
      row.job_id, row.production_status, row.woo_status].join(' ').toLowerCase();
    return haystack.includes(query.toLowerCase().trim());
  }), [rows, stage, query]);
  const selected = visible.find((row) => String(row.job_id || row.woocommerce_order_id || row.id) === selectedId) || visible[0];
  const selectedStage = selected ? boardColumnForRow(selected) : '';
  const issues = selected && Array.isArray(selected.blocking_issues) ? selected.blocking_issues : [];

  return <main className="page sc-work-hub">
    <section className="page-header">
      <div>
        <p className="eyebrow">Work Hub · Guided workflow</p>
        <h1>Move client work from order to delivery</h1>
        <p>Start with a client or job. Open the exact existing tool for the next action, without learning every page of the application.</p>
      </div>
      <button type="button" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh jobs'}</button>
    </section>
    <section className="card elevated-card sc-hub-entry">
      <h2>Where should I start?</h2>
      <div className="sc-hub-entry-grid">
        <Link to="/team-stores"><strong>Team store or fundraiser</strong><span>Organize campaign planning and group ordering</span></Link>
        <Link to="/marketing"><strong>New prospect or customer</strong><span>Research → quote → approval → order</span></Link>
        <Link to="/client-orders"><strong>New client order</strong><span>Review details and prepare a production handoff</span></Link>
        <Link to="/mockup-studio"><strong>Artwork or mockup</strong><span>Preflight artwork and prepare a production packet</span></Link>
        <Link to="/purchasing"><strong>Missing blanks</strong><span>Check shortages, supplier costs and receiving</span></Link>
        <Link to="/production-board"><strong>Ready to manufacture</strong><span>Work through active jobs and their blockers</span></Link>
        <Link to="/qc-checklist"><strong>Ready to complete</strong><span>QC, packing and order closeout</span></Link>
      </div>
    </section>
    <section className="card elevated-card">
      <h2>Active job tracker</h2>
      <p>This tracker reads from your existing Production Board. It does not duplicate orders or change stock, status or customer commitments.</p>
      <div className="sc-hub-filters">
        <label>Search a customer or job<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer, Woo number or job ID" /></label>
        <label>Progress / stage<select value={stage} onChange={(event) => setStage(event.target.value)}>
          <option value="active">All active jobs</option>
          <option value="all">All including completed</option>
          {STAGES.map((step) => <option key={step.id} value={step.id}>{step.label} ({counts[step.id] || 0})</option>)}
        </select></label>
      </div>
      {error ? <p role="alert" className="message">{error} Open the <Link to="/production-board">Production Board</Link> instead.</p> : null}
      <div className="sc-hub-layout">
        <div className="sc-hub-list" aria-label="Production jobs">
          {visible.map((row) => {
            const key = String(row.job_id || row.woocommerce_order_id || row.id);
            const rowStage = boardColumnForRow(row);
            return <button type="button" key={key} className={'sc-hub-job ' + (selected === row ? 'selected' : '')}
              onClick={() => setSelectedId(key)} aria-pressed={selected === row}>
              <span><strong>{row.customer_name || describeJob(row)}</strong><small>{describeJob(row)} · {display(rowStage)}</small></span>
              <small>Due {formatDay(row.due_date || row.order_due_date)}</small>
            </button>;
          })}
          {!loading && !visible.length && <p>No matching jobs. Use the shortcuts above to start new work.</p>}
        </div>
        <div className="sc-hub-next">
          {selected ? <>
            <p className="eyebrow">Selected job</p>
            <h3>{selected.customer_name || describeJob(selected)}</h3>
            <p>{describeJob(selected)} · Due {formatDay(selected.due_date || selected.order_due_date)}</p>
            <div className="sc-hub-stage"><strong>{STAGES.find((s) => s.id === selectedStage)?.label || display(selectedStage)}</strong>
              <span>{STAGES.find((s) => s.id === selectedStage)?.detail || 'Review the current job status.'}</span></div>
            {issues.length ? <div className="sc-hub-blockers"><strong>Production blockers</strong><ul>{issues.map((v, i) => <li key={i}>{typeof v === 'string' ? v : (v?.message || v?.reason || 'Review blocker in Production Board')}</li>)}</ul></div> : null}
            <h4>Next tools</h4>
            <div className="sc-hub-next-links">{suggestedActions(selectedStage, selected.job_id).map((a) =>
              <Link to={a.path} key={a.path}>{a.label} →</Link>)}</div>
            <small>These are workflow suggestions, not automatic authorization to advance the order. Follow actual blockers and approvals in the linked tools.</small>
          </> : <p>Select a job on the left to see the next steps.</p>}
        </div>
      </div>
    </section>
    <section className="card elevated-card">
      <h2>One simple order journey</h2>
      <div className="sc-hub-journey">
        {['Client / team order','Artwork approved','Inventory ready','Make product','Quality check','Package & deliver'].map((step,i)=>
          <span key={step}><b>{i+1}</b>{step}</span>)}
      </div>
      <p>Every existing specialist tool remains accessible from the sidebar. This hub is intended as the easy starting point for you and family helpers.</p>
    </section>
  </main>;
}
