import { shouldSimulateWrites, requireTestingConfirmation } from './lib/testingMode';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getWooSyncQueue } from './lib/inventoryApi';
import { authenticatedFunctionFetch } from './lib/netlifyFunctionClient';

const when = (value) => value ? new Date(value).toLocaleString() : 'No observation yet';
export default function WooSync() {
  const [rows, setRows] = useState([]);
  const [health, setHealth] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState('');
  async function load() {
    try {
      const [queue, response] = await Promise.all([getWooSyncQueue(100), authenticatedFunctionFetch('/.netlify/functions/woocommerce-sync-monitor')]);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Sync health could not be loaded.');
      setRows(queue); setHealth(body.data);
    } catch (err) { setMessage(err.message || 'Failed to load sync health.'); }
  }
  useEffect(() => { load(); }, []);
  async function retry(id) {
    if (shouldSimulateWrites()) { setMessage('Training preview: no order was refreshed.'); return; }
    if (requireTestingConfirmation() && !window.confirm('Testing mode is set to live writes. Continue with this change?')) return;
    setBusy(true); setMessage('');
    try {
      const response = await authenticatedFunctionFetch('/.netlify/functions/woocommerce-sync-monitor', {
        method:'POST', body:JSON.stringify({action:'retry_order',order_id:Number(id)}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Order refresh failed.');
      setMessage(body.message || 'Order refreshed.'); await load();
    } catch(error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <main className="page">
    <div className="page-heading-row"><div><p className="eyebrow">Integration Monitor</p><h1>WooCommerce Sync Health</h1><p>Check order imports, refresh a missed order, and distinguish internal inventory history from storefront updates.</p></div><button type="button" onClick={load} disabled={busy}>Refresh</button></div>
    {message && <p className="message" role="status">{message}</p>}
    <section className="sc-stat-grid">
      <article className="card"><h2>Last successful order sync</h2><p>{when(health?.last_successful_order_sync)}</p></article>
      <article className="card"><h2>Recent runs needing review</h2><p>{health?.order_syncs_needing_attention ?? '—'} in the past 7 days</p></article>
      <article className="card"><h2>Latest observed attribute update</h2><p>{when(health?.last_attribute_update)}</p></article>
    </section>
    <section className="card"><h2>Refresh an order from WooCommerce</h2><p>Fetch the current order again after fixing a pairing or recovering a missed webhook. Existing production progress and completed lines are preserved. Changed production quantities are flagged for review.</p><form onSubmit={(event)=>{event.preventDefault();retry(orderId);}}><label htmlFor="sync-order-id">WooCommerce order ID</label><input id="sync-order-id" type="number" min="1" step="1" required value={orderId} onChange={(e)=>setOrderId(e.target.value)} /><button type="submit" disabled={busy}>{busy?'Refreshing…':'Refresh order'}</button></form></section>
    <section className="card"><h2>Product and attribute imports</h2><p>These imports run in WordPress → WooCommerce → Supabase Sync. The attribute timestamp above is an observation of lookup changes, not proof of a complete product import. Latest product first imported: {when(health?.latest_product_created)}.</p><a href="https://skilledcrafting.com/wp-admin/admin.php?page=wcsb-supabase-sync" target="_blank" rel="noreferrer">Open WordPress Supabase Sync</a><p><Link to="/catalog-workbench">Open Catalog Workbench</Link> to check mappings after an import.</p></section>
    <section className="card wide-card"><h2>Recent order sync attempts</h2><div className="responsive-table"><table><thead><tr><th>Started</th><th>Order</th><th>Result</th><th>Pairing review</th><th>Reservation failures</th><th>Details</th><th>Recovery</th></tr></thead><tbody>{(health?.recent_order_syncs||[]).map(run=><tr key={run.id}><td>{when(run.created_at)}</td><td>{run.woocommerce_order_id || '—'}</td><td>{run.completed_at ? run.outcome : 'Incomplete — review required'}</td><td>{run.items_needing_pairing || 0}</td><td>{run.reservations_failed || 0}</td><td>{run.error_message && <p>{run.error_message}</p>}{run.job_id ? <Link to={`/pullsheets/${run.job_id}`}>Open pull sheet</Link> : !run.error_message ? '—' : null}</td><td>{run.woocommerce_order_id && <button type="button" disabled={busy} onClick={()=>retry(run.woocommerce_order_id)}>Refresh order</button>}</td></tr>)}{!health?.recent_order_syncs?.length && <tr><td colSpan="7">No order sync attempts recorded.</td></tr>}</tbody></table></div></section>
    <section className="card wide-card"><h2>Internal inventory event history</h2><p>Bin receipts, transfers, and reservations stay inside the app. “Ignored” means no storefront stock update is required. WooCommerce controls its own stock and backorder settings.</p><div className="responsive-table"><table><thead><tr><th>Created</th><th>Entity</th><th>Action</th><th>Status</th><th>Attempts</th><th>Details</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{when(row.created_at)}</td><td>{row.entity_type}</td><td>{row.action}</td><td>{row.status}</td><td>{row.attempt_count||0}</td><td>{row.last_error || row.payload?.disposition || ''}</td></tr>)}{!rows.length&&<tr><td colSpan="6">No inventory events yet.</td></tr>}</tbody></table></div></section>
  </main>;
}
