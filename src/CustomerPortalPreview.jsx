import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function CustomerPortalPreview() {
  const [token, setToken] = useState('');
  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState('');
  const [previewMode, setPreviewMode] = useState(true);

  async function loadPreview() {
    setMessage('');
    if (token.trim()) {
      setPreviewMode(false);
      const { data, error } = await supabase.rpc('sc_customer_portal_data_v2', { p_token: token.trim() });
      if (error) {
        setMessage(error.message);
        setRecords([]);
      } else if (data?.ok) {
        setRecords([{
          id: data.customer?.id,
          customer_name: data.customer?.customer_name,
          organization: data.customer?.organization,
          status: data.events?.[0]?.status || 'open',
          order_reference: data.events?.[0]?.title || 'Customer portal',
          due_date: data.events?.find((event) => event.due_date)?.due_date || null,
        }]);
      } else {
        setMessage(data?.message || 'Portal token is invalid, expired, or inactive.');
        setRecords([]);
      }
      return;
    }
    setPreviewMode(true);
    const { data, error } = await supabase.rpc('sc_customer_portal_preview_samples');
    if (error) setMessage(error.message); else setRecords(data || []);
  }

  useEffect(() => { loadPreview(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="sc-page-stack">
    <div className="sc-page-header-card"><div><div className="sc-kicker">Customer Experience</div><h2>Customer Portal Preview</h2><p>Preview how customers understand order, artwork, and production status. A token is optional on this admin preview page.</p></div></div>
    {message && <div className="sc-alert">{message}</div>}
    <section className="sc-panel">
      <div className="sc-panel-header"><div><h3>Preview Controls</h3><p>Leave token blank to view sample/recent job data. Enter a token only when testing a real customer portal link.</p></div></div>
      <div className="sc-toolbar"><input className="sc-search-input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Optional customer portal token" /><button className="sc-btn sc-btn-primary" onClick={loadPreview}>Load Preview</button></div>
      {previewMode && <div className="sc-alert sc-alert-info">Admin preview mode: no portal token is required. This prevents the old “missing portal token” error.</div>}
    </section>
    <section className="sc-panel">
      <div className="sc-portal-preview-list">
        {(records || []).map((r, i) => <article className="sc-portal-card" key={r.id || i}>
          <div className="sc-card-title-row"><strong>{r.customer_name || 'Customer'}</strong><span className="sc-badge">{r.status || 'open'}</span></div>
          <div className="sc-progress-steps"><span>Artwork Submitted</span><span>Approved</span><span>Waiting on Blanks</span><span>In Production</span><span>QC</span><span>Ready</span></div>
          <p><strong>Order:</strong> {r.order_reference || r.id || 'Preview Order'}</p>
          <p><strong>Due:</strong> {r.due_date || 'Not set'}</p>
        </article>)}
        {!records.length && <div className="sc-empty-card">No recent portal records found. Once jobs exist, this page will show preview cards.</div>}
      </div>
    </section>
  </div>;
}
