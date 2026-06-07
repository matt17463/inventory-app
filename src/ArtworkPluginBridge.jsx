import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function ArtworkPluginBridge() {
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');

  async function load() {
    setMessage('');
    const { data, error } = await supabase.rpc('sc_artwork_bridge_status');
    if (error) setMessage(error.message); else setStatus(data || {});
  }
  useEffect(() => { load(); }, []);

  return <div className="sc-page-stack">
    <div className="sc-page-header-card"><div><div className="sc-kicker">Artwork</div><h2>Artwork Bridge</h2><p>Monitor artwork records handed off from the WordPress Artwork System plugin into the inventory app.</p></div><button className="sc-btn" onClick={load}>Refresh</button></div>
    {message && <div className="sc-alert">{message}</div>}
    <section className="sc-stat-grid compact">
      <article className="sc-stat-card"><span>Artwork Requests</span><strong>{status?.request_count ?? '—'}</strong><small>Synced or mirrored records found in Supabase.</small></article>
      <article className="sc-stat-card"><span>Handoffs Logged</span><strong>{status?.handoff_count ?? '—'}</strong><small>Webhook handoff records from WordPress.</small></article>
      <article className="sc-stat-card"><span>Bridge Status</span><strong>{status?.has_records ? 'Active' : 'No Records'}</strong><small>No records does not mean broken; it may mean no artwork has been handed off yet.</small></article>
    </section>
    <section className="sc-panel">
      <div className="sc-panel-header"><div><h3>Latest Artwork Records</h3><p>If this section is empty, confirm the WordPress plugin webhook URL and secret are configured and that a request has been sent to inventory.</p></div></div>
      <div className="sc-responsive-table-wrap"><table className="sc-table"><thead><tr><th>Record</th><th>Status</th><th>Customer</th><th>Created</th></tr></thead><tbody>{(status?.latest_records || []).map((r, i) => <tr key={r.id || i}><td>{r.id || r.request_id || i + 1}</td><td>{r.status || r.request_status || '—'}</td><td>{r.customer_name || r.name || r.email || '—'}</td><td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td></tr>)}{!(status?.latest_records || []).length && <tr><td className="sc-empty-cell" colSpan="4">No artwork records are currently visible in Supabase.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
