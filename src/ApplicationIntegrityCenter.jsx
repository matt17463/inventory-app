import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProductIntegrityIssues } from './lib/productIntegrityApi';
import { getSupplierReceivingHistory } from './lib/supplierReceivingApi';
import {
  createDuplicateReviewCase,
  getDuplicateReviewCases,
  getIntegrationJobs,
  getInventoryReconciliation,
  getTeamStoreWorkflows,
  previewBlankProduct,
  rememberProductIdentity,
  resolveProductIdentity,
  saveTeamStoreWorkflow,
  updateIntegrationJob,
} from './lib/applicationIntegrityApi';

const tabs = [
  ['overview', 'Overview'], ['identity', 'Product Identity'], ['duplicates', 'Duplicate Workbench'],
  ['receiving', 'Receiving Inbox'], ['reconciliation', 'Reconciliation'], ['jobs', 'Integration Jobs'],
  ['stores', 'Team Stores'],
];

function text(value) { return String(value ?? '').trim(); }
function status(value) { return text(value).replaceAll('_', ' ') || 'unknown'; }
function date(value) { return value ? new Date(value).toLocaleString() : '—'; }
function count(value) { return Number(value || 0).toLocaleString(); }
function messageFor(error) {
  return /Application Integrity SQL is not installed|sc_blank_product_candidates_v1|schema cache|does not exist/i.test(error?.message || '')
    ? 'Application Integrity SQL is not installed. Run deployment/sql/28_APPLICATION_INTEGRITY_PLATFORM.sql in Supabase, then refresh.'
    : (error?.message || 'The request could not be completed.');
}

function TabButton({ id, current, children, onClick }) {
  return <button type="button" className={id === current ? 'sc-btn sc-btn-primary' : 'sc-btn'} onClick={() => onClick(id)}>{children}</button>;
}

function Overview() {
  const cards = [
    ['Product Identity', 'Resolve supplier SKUs, barcodes, SKUs, and complete brand/style/color/size identities before creating a product.', 'identity'],
    ['Duplicate Workbench', 'Turn deterministic conflicts into review cases with snapshots and a proposed survivor. Nothing is merged automatically.', 'duplicates'],
    ['Receiving Inbox', 'See saved supplier confirmations, remaining quantities, and receiving status before returning to the receiving screen.', 'receiving'],
    ['Reconciliation', 'Review unlocated movements, duplicate identities, and negative purchasing demand without rewriting the ledger.', 'reconciliation'],
    ['Integration Jobs', 'See background work and failures from Mockup Studio, WooCommerce, colors, supplier feeds, and the new job ledger.', 'jobs'],
    ['Team Stores', 'Track the complete request → artwork → mockup → approval → WooCommerce draft → live workflow.', 'stores'],
  ];
  return <section className="sc-card-grid">{cards.map(([title, description, tab]) => (
    <article className="sc-panel" key={tab}><h2>{title}</h2><p>{description}</p><a href={`?tab=${tab}`} className="sc-btn">Open {title}</a></article>
  ))}</section>;
}

function IdentityResolver() {
  const [form, setForm] = useState({ source_system: '', supplier_sku: '', sku: '', barcode: '', brand: '', style: '', color: '', size: '' });
  const [candidates, setCandidates] = useState([]);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function resolve() {
    setBusy('resolve'); setMessage(''); setPreview(null);
    try { const rows = await resolveProductIdentity(form); setCandidates(rows); setSelected(rows[0] || null); if (!rows.length) setMessage('No likely existing product was found. Run Creation Preview before creating anything.'); }
    catch (error) { setMessage(messageFor(error)); } finally { setBusy(''); }
  }
  async function runPreview() {
    setBusy('preview'); setMessage('');
    try {
      const result = await previewBlankProduct({
        source_system: form.source_system, supplier_sku: form.supplier_sku, sku_base: form.sku,
        barcode: form.barcode, brand: form.brand, style: form.style, color: form.color, size: form.size,
      });
      setPreview(result);
    } catch (error) { setMessage(messageFor(error)); } finally { setBusy(''); }
  }
  async function remember() {
    if (!selected || !form.source_system || !form.supplier_sku) { setMessage('Choose a result and enter both Source System and Supplier SKU.'); return; }
    setBusy('remember'); setMessage('');
    try {
      await rememberProductIdentity({ source_system: form.source_system, alias_type: 'supplier_sku', source_value: form.supplier_sku, blank_product_id: selected.blank_product_id_text, canonical_label: selected.sku_base, context_brand: form.brand, context_style: form.style });
      setMessage('Supplier identity saved. Future imports will check this rule first.');
    } catch (error) { setMessage(messageFor(error)); } finally { setBusy(''); }
  }
  return <>
    <section className="sc-panel"><h2>Resolve before creating</h2><p>Exact remembered supplier SKU, barcode, SKU, and complete identity matches rank highest. Partial matches are suggestions only.</p>
      <div className="sc-form-grid">
        {Object.keys(form).map((key) => <label className="sc-field" key={key}><span>{key.replaceAll('_', ' ')}</span><input value={form[key]} onChange={change(key)} /></label>)}
      </div>
      <div className="sc-button-row"><button className="sc-btn sc-btn-primary" onClick={resolve} disabled={Boolean(busy)}>{busy === 'resolve' ? 'Resolving…' : 'Resolve Existing Product'}</button><button className="sc-btn" onClick={runPreview} disabled={Boolean(busy)}>{busy === 'preview' ? 'Previewing…' : 'Preview Product Creation'}</button><button className="sc-btn" onClick={remember} disabled={!selected || Boolean(busy)}>{busy === 'remember' ? 'Saving…' : 'Remember Selected Match'}</button></div>
      {message && <div className="sc-alert">{message}</div>}
      {preview && <div className={`sc-alert ${preview.decision === 'create_allowed' ? 'success' : 'warning'}`}><strong>Creation decision: {status(preview.decision)}</strong><br />{preview.rule}</div>}
    </section>
    <section className="sc-panel"><h2>Candidate products</h2><div className="sc-responsive-table-wrap"><table className="sc-table"><thead><tr><th>Select</th><th>Confidence</th><th>Method</th><th>SKU</th><th>Product</th><th>Identity</th></tr></thead><tbody>
      {candidates.map((row) => <tr key={row.blank_product_id_text}><td><input type="radio" checked={selected?.blank_product_id_text === row.blank_product_id_text} onChange={() => setSelected(row)} /></td><td>{row.confidence}%</td><td>{status(row.match_method)}</td><td>{row.sku_base}</td><td>{row.product_name}</td><td>{[row.brand,row.style,row.color,row.size].filter(Boolean).join(' / ')}</td></tr>)}
      {!candidates.length && <tr><td colSpan="6" className="sc-empty-cell">Run the resolver to check existing records.</td></tr>}
    </tbody></table></div></section>
  </>;
}

function DuplicateWorkbench() {
  const [issues, setIssues] = useState([]); const [cases, setCases] = useState([]); const [selected, setSelected] = useState([]);
  const [survivor, setSurvivor] = useState(''); const [reason, setReason] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setMessage('');
    try {
      const [issueRows, caseRows] = await Promise.all([getProductIntegrityIssues({ issueType: 'all', limit: 1000 }), getDuplicateReviewCases()]);
      setIssues(issueRows.filter((row) => row.issue_type.startsWith('duplicate_') && row.entity_type === 'blank_product'));
      setCases(caseRows);
    } catch (error) { setMessage(messageFor(error)); } finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  function toggle(id) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  async function createCase() {
    if (selected.length < 2 || !survivor) { setMessage('Choose at least two products and identify the proposed survivor.'); return; }
    setBusy(true); setMessage('');
    try { await createDuplicateReviewCase({ entity_ids: selected, proposed_survivor_id: survivor, reason }); setSelected([]); setSurvivor(''); setReason(''); setMessage('Review case created. No product or inventory record was changed.'); await load(); }
    catch (error) { setMessage(messageFor(error)); } finally { setBusy(false); }
  }
  return <>
    <section className="sc-panel"><div className="sc-panel-header"><div><h2>Duplicate candidates</h2><p>Choose records that represent the same physical blank. Creating a case preserves evidence; it does not merge or delete anything.</p></div><button className="sc-btn" onClick={load} disabled={busy}>Refresh</button></div>
      {message && <div className="sc-alert">{message}</div>}
      <div className="sc-responsive-table-wrap"><table className="sc-table"><thead><tr><th>Review</th><th>Proposed survivor</th><th>Issue</th><th>SKU</th><th>Product</th><th>Group</th></tr></thead><tbody>
        {issues.map((row) => <tr key={row.issue_id}><td><input type="checkbox" checked={selected.includes(row.entity_id)} onChange={() => toggle(row.entity_id)} /></td><td><input type="radio" name="survivor" checked={survivor === row.entity_id} onChange={() => { setSurvivor(row.entity_id); if (!selected.includes(row.entity_id)) setSelected((current) => [...current, row.entity_id]); }} /></td><td>{status(row.issue_type)}</td><td>{row.sku}</td><td>{row.product_name}</td><td><code>{row.candidate_group}</code></td></tr>)}
        {!issues.length && !busy && <tr><td colSpan="6" className="sc-empty-cell">No duplicate product candidates were returned.</td></tr>}
      </tbody></table></div>
      <label className="sc-field"><span>Review reason</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why these records appear to be the same product" /></label>
      <button className="sc-btn sc-btn-primary" disabled={busy || selected.length < 2 || !survivor} onClick={createCase}>Create Review Case ({selected.length})</button>
    </section>
    <section className="sc-panel"><h2>Open and completed cases</h2><div className="sc-responsive-table-wrap"><table className="sc-table"><thead><tr><th>Status</th><th>Case</th><th>Proposed survivor</th><th>Records</th><th>Updated</th></tr></thead><tbody>
      {cases.map((row) => <tr key={row.id}><td><span className="sc-badge">{status(row.status)}</span></td><td><strong>{row.title}</strong><br /><small>{row.reason}</small></td><td>{row.proposed_survivor_id_text || 'Not chosen'}</td><td>{row.items?.length || 0}</td><td>{date(row.updated_at)}</td></tr>)}
      {!cases.length && <tr><td colSpan="5" className="sc-empty-cell">No review cases have been created.</td></tr>}
    </tbody></table></div></section>
  </>;
}

function ReceivingInbox() {
  const [rows, setRows] = useState([]); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { const result = await getSupplierReceivingHistory(); setRows(result.history || []); } catch (error) { setMessage(error.message); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  return <section className="sc-panel"><div className="sc-panel-header"><div><h2>Supplier Receiving Inbox</h2><p>PDFs are saved as review drafts as soon as they parse, so you can see outstanding orders before inventory is received.</p></div><div className="sc-button-row"><Link className="sc-btn sc-btn-primary" to="/add-item">Open Receiving</Link><button className="sc-btn" onClick={load}>Refresh</button></div></div>{message && <div className="sc-alert">{message}</div>}
    <div className="sc-responsive-table-wrap"><table className="sc-table"><thead><tr><th>Status</th><th>Supplier / Order</th><th>Units</th><th>Remaining</th><th>Receipts</th><th>Updated</th></tr></thead><tbody>
      {rows.map((row) => { const remaining = Math.max(0, Number(row.ordered_units || 0) - Number(row.received_units || 0)); return <tr key={row.id}><td><span className="sc-badge">{status(row.status)}</span></td><td><strong>{row.supplier_name}</strong><br />Order {row.order_number}</td><td>{count(row.received_units)} / {count(row.ordered_units)}</td><td>{count(remaining)}</td><td>{row.receipts?.length || 0}</td><td>{date(row.updated_at || row.created_at)}</td></tr>; })}
      {!rows.length && !loading && <tr><td colSpan="6" className="sc-empty-cell">No saved supplier confirmations.</td></tr>}
    </tbody></table></div></section>;
}

function Reconciliation() {
  const [result, setResult] = useState({ issues: [], summary: {} }); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false);
  async function run() { setLoading(true); setMessage(''); try { setResult(await getInventoryReconciliation()); } catch (error) { setMessage(messageFor(error)); } finally { setLoading(false); } }
  useEffect(() => { run(); }, []);
  return <><section className="sc-panel"><div className="sc-panel-header"><div><h2>Inventory Reconciliation Center</h2><p>Find ledger and identity exceptions. Negative stock is reported as purchasing demand and is never “corrected” by this page.</p></div><button className="sc-btn sc-btn-primary" onClick={run} disabled={loading}>{loading ? 'Checking…' : 'Run Reconciliation'}</button></div>{message && <div className="sc-alert">{message}</div>}<div className="sc-stat-grid compact">{Object.entries(result.summary || {}).map(([key,value]) => <article className="sc-stat-card" key={key}><span>{status(key)}</span><strong>{count(value)}</strong></article>)}</div></section>
    <section className="sc-panel"><div className="sc-responsive-table-wrap"><table className="sc-table"><thead><tr><th>Severity</th><th>Category</th><th>Record</th><th>Issue</th><th>Evidence</th></tr></thead><tbody>{(result.issues || []).map((row,index) => <tr key={`${row.category}-${row.entity_id}-${index}`}><td><span className="sc-badge">{row.severity}</span></td><td>{status(row.category)}</td><td>{row.label || row.entity_id}</td><td>{row.message}</td><td><code>{JSON.stringify(row.details || {})}</code></td></tr>)}{!result.issues?.length && !loading && <tr><td colSpan="5" className="sc-empty-cell">No reconciliation issues were returned.</td></tr>}</tbody></table></div></section></>;
}

function IntegrationJobs() {
  const [rows, setRows] = useState([]); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false);
  const load = useCallback(async () => { setLoading(true); setMessage(''); try { setRows(await getIntegrationJobs()); } catch (error) { setMessage(messageFor(error)); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  async function changeJob(row, mode) { setLoading(true); setMessage(''); try { await updateIntegrationJob(row.id, mode); setMessage(mode === 'retry' ? 'Retry queued.' : 'Job cancelled.'); await load(); } catch (error) { setMessage(messageFor(error)); } finally { setLoading(false); } }
  return <section className="sc-panel"><div className="sc-panel-header"><div><h2>Integration Job Center</h2><p>One operational view for app jobs, Mockup Studio AI, WooCommerce mockup exports, color lifecycle work, and supplier feed runs.</p></div><button className="sc-btn" onClick={load}>Refresh</button></div>{message && <div className="sc-alert">{message}</div>}<div className="sc-responsive-table-wrap"><table className="sc-table"><thead><tr><th>Status</th><th>Job type</th><th>Source</th><th>Progress</th><th>Reference</th><th>Error</th><th>Created</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><span className="sc-badge">{status(row.status)}</span></td><td>{status(row.job_type)}</td><td>{row.source_system || 'application'}</td><td>{count(row.progress_current)} / {count(row.progress_total)}</td><td>{row.external_reference || row.native_id || '—'}</td><td>{row.last_error || row.error_message || '—'}</td><td>{date(row.created_at)}</td><td>{row.external_table ? <small>Managed by source workflow</small> : <div className="sc-button-row"><button className="sc-btn sc-btn-small" disabled={loading || row.status === 'running'} onClick={() => changeJob(row, 'retry')}>Retry</button><button className="sc-btn sc-btn-small sc-btn-danger" disabled={loading || ['completed','cancelled'].includes(row.status)} onClick={() => changeJob(row, 'cancel')}>Cancel</button></div>}</td></tr>)}{!rows.length && !loading && <tr><td colSpan="8" className="sc-empty-cell">No integration jobs found.</td></tr>}</tbody></table></div></section>;
}

const emptyStore = { workflow_name: '', customer_name: '', store_name: '', stage: 'request', due_date: '', notes: '' };
function TeamStores() {
  const [rows, setRows] = useState([]); const [form, setForm] = useState(emptyStore); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setRows(await getTeamStoreWorkflows()); } catch (error) { setMessage(messageFor(error)); } }, []);
  useEffect(() => { load(); }, [load]);
  async function save() { setBusy(true); setMessage(''); try { await saveTeamStoreWorkflow(form); setForm(emptyStore); setMessage('Team-store workflow saved.'); await load(); } catch (error) { setMessage(messageFor(error)); } finally { setBusy(false); } }
  async function updateStage(row, stage) { setBusy(true); setMessage(''); try { await saveTeamStoreWorkflow({ ...row, stage }); setMessage(`${row.workflow_name} moved to ${status(stage)}.`); await load(); } catch (error) { setMessage(messageFor(error)); } finally { setBusy(false); } }
  return <><section className="sc-panel"><h2>New Team-Store Workflow</h2><p>Keep the customer request, artwork, mockup, approval, and WooCommerce handoff together. Existing specialized pages remain the work surfaces.</p><div className="sc-form-grid">{['workflow_name','customer_name','store_name','due_date'].map((key) => <label className="sc-field" key={key}><span>{key.replaceAll('_',' ')}</span><input type={key === 'due_date' ? 'date' : 'text'} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<label className="sc-field"><span>stage</span><select value={form.stage} onChange={(event) => setForm((current) => ({ ...current, stage: event.target.value }))}>{['request','artwork','mockups','approval','woocommerce_draft','ready_to_publish','live','on_hold','complete'].map((value) => <option key={value} value={value}>{status(value)}</option>)}</select></label><label className="sc-field"><span>notes</span><input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label></div><button className="sc-btn sc-btn-primary" disabled={busy || !form.workflow_name.trim()} onClick={save}>{busy ? 'Saving…' : 'Create Workflow'}</button>{message && <div className="sc-alert">{message}</div>}</section>
    <section className="sc-panel"><h2>Store Pipeline</h2><div className="sc-responsive-table-wrap"><table className="sc-table"><thead><tr><th>Stage</th><th>Workflow</th><th>Customer / Store</th><th>Due</th><th>Work areas</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><select value={row.stage} disabled={busy} onChange={(event) => updateStage(row, event.target.value)}>{['request','artwork','mockups','approval','woocommerce_draft','ready_to_publish','live','on_hold','complete'].map((value) => <option key={value} value={value}>{status(value)}</option>)}</select></td><td><strong>{row.workflow_name}</strong><br /><small>{row.notes}</small></td><td>{row.customer_name || '—'} / {row.store_name || '—'}</td><td>{row.due_date || '—'}</td><td><Link to="/artwork-requests">Artwork</Link> · <Link to="/mockup-studio">Mockups</Link> · <Link to="/woo-sync">Woo Sync</Link></td></tr>)}{!rows.length && <tr><td colSpan="5" className="sc-empty-cell">No team-store workflows yet.</td></tr>}</tbody></table></div></section></>;
}

export default function ApplicationIntegrityCenter() {
  const initialTab = new URLSearchParams(window.location.search).get('tab') || 'overview';
  const [tab, setTab] = useState(tabs.some(([id]) => id === initialTab) ? initialTab : 'overview');
  const content = useMemo(() => ({ overview: <Overview />, identity: <IdentityResolver />, duplicates: <DuplicateWorkbench />, receiving: <ReceivingInbox />, reconciliation: <Reconciliation />, jobs: <IntegrationJobs />, stores: <TeamStores /> })[tab], [tab]);
  function choose(next) { setTab(next); const url = new URL(window.location.href); url.searchParams.set('tab', next); window.history.replaceState({}, '', url); }
  return <main className="page sc-page-stack"><section className="sc-page-header-card"><div><div className="sc-kicker">Product, inventory, and workflow controls</div><h1>Operations Integrity</h1><p>Prevent duplicate products, preserve inventory traceability, resume supplier receiving, monitor integrations, and stage team stores from one workspace.</p></div><span className="sc-badge success">v1.0</span></section><section className="sc-panel"><div className="sc-button-row sc-tab-row">{tabs.map(([id,label]) => <TabButton key={id} id={id} current={tab} onClick={choose}>{label}</TabButton>)}</div></section>{content}</main>;
}
