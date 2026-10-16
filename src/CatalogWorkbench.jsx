import { shouldSimulateWrites, requireTestingConfirmation } from './lib/testingMode';
import { Link } from 'react-router-dom';
import { useEffect,useState } from 'react';
import { supabase } from './supabaseClient';

const catalogWorkflows = [
  { title: '1. Check catalog health', description: 'Start with product data health for missing fields, then inspect duplicate or conflicting records. Do not change inventory quantities to repair catalog data.', tools: [['Product Data Health', '/product-data-health'], ['Product Integrity Center', '/product-integrity']] },
  { title: '2. Fix the catalog definition', description: 'Use Color Pairings for supplier color aliases. Use Product Color Manager for WooCommerce color availability or replacements. Product Type Manager maintains catalog types; Non-Inventory Rules identifies services and customization lines that do not need blanks.', tools: [['Color Pairings', '/color-pairings'], ['Product Color Manager', '/product-color-replacement'], ['Product Type Manager', '/product-type-manager'], ['Non-Inventory Rules', '/non-inventory-rules']] },
  { title: '3. Link products to blanks', description: 'Maintain the exact product-to-blank link here. Mapping Repair repairs imported catalog mappings; Bulk Pairing Repair applies known mappings to existing pull-sheet lines. Preview the match before applying and rerun health checks afterward.', tools: [['Product-to-Blank Mappings', '/product-blank-mappings'], ['Mapping Repair', '/mapping-repair'], ['Bulk Pairing Repair', '/bulk-pairing-repair']] },
  { title: '4. Verify orders and sync', description: 'Operations Integrity checks downstream orders, reservations and purchasing. WooCommerce Sync Health shows order attempts and lets a manager refresh a missed order. Bin transfers and holds are internal history; product and attribute imports remain separate. Attribute synchronization remains in WordPress → WooCommerce → Supabase Sync.', tools: [['Operations Integrity', '/operations-integrity'], ['WooCommerce Sync Health', '/woo-sync']] },
];
export default function CatalogWorkbench() {
  const [cleanup,setCleanup]=useState(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  async function loadCleanup() {
    const result=await supabase.rpc('sc_catalog_cleanup_summary_v1');
    if (!result.error) setCleanup(result.data);
  }
  useEffect(()=>{loadCleanup();},[]);
  async function repairExactLinks() {
    if (shouldSimulateWrites()) { setMessage('Training preview: no catalog links were changed.'); return; }
    if (requireTestingConfirmation() && !window.confirm('Testing mode is set to live writes. Continue with this change?')) return;
    setBusy(true); setMessage('');
    const result=await supabase.rpc('sc_repair_exact_catalog_links_v1',{p_limit:50});
    setMessage(result.error ? result.error.message : `${Number(result.data || 0)} exact links repaired. Run again if more unique matches remain.`);
    await loadCleanup(); setBusy(false);
  }
  return <main className="page"><section className="page-header"><div><p className="eyebrow">Catalog & integration</p><h1>Catalog Workbench</h1><p>One starting point for data health, matching, repairs and sync. Choose the underlying problem before running a repair.</p></div></section>
    {message && <p role="status" className="message">{message}</p>}
    {cleanup && <section className="card"><h2>Catalog cleanup</h2><p>{cleanup.lookup_aliases_archived} duplicate lookup entries archived · {cleanup.duplicate_blank_groups_resolved} duplicate blank groups resolved · {cleanup.exact_links_repaired} exact links repaired · {cleanup.parent_rows_excluded} parent rows excluded from blank pairing.</p><p>Physical inventory totals were preserved. Original lookup names and SKU aliases remain available for history. Uncertain matches stay in the review tools.</p>{cleanup.duplicate_groups_requiring_review > 0 && <p><Link to="/operations-integrity?tab=duplicates">Review {cleanup.duplicate_groups_requiring_review} duplicate groups with conflicting costs or supplier details</Link> before merging them.</p>}{cleanup.cost_records_preserved > 0 && <p>{cleanup.cost_records_preserved} merged cost records preserve the original inventory value and are marked for cost review.</p>}<button type="button" disabled={busy} onClick={repairExactLinks}>{busy?'Repairing…':'Repair next 50 exact links'}</button><p className="helper-text">This only fills missing links with one matching brand, style, color and size. It preserves existing pairings and inventory quantities.</p></section>}
    <section className="sc-stat-grid">{catalogWorkflows.map((workflow) => <article className="card" key={workflow.title}><h2>{workflow.title}</h2><p>{workflow.description}</p><div className="phase1-actions">{workflow.tools.map(([label,path]) => <Link className="secondary-button" to={path} key={path}>{label}</Link>)}</div></article>)}</section>
    <section className="card"><h2>Where changes belong</h2><p>WooCommerce owns storefront products, options and online orders. Supabase owns physical bins, inventory movements and operational mappings. An artwork design or product option is not automatically a WooCommerce global Logo Type term. Keep logo design, print placement and decoration method separate.</p><p>Use one repair at a time, verify the exact brand, style, color and size, then recheck the affected order. Bulk repair is a follow-up to correcting mappings, not a second catalog to maintain.</p></section>
  </main>;
}
