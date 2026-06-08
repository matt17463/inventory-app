import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCustomerPortalData } from './lib/phase6Api';
import { supabase } from './supabaseClient';

export default function CustomerPortal() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [data, setData] = useState(null);
  const [samples, setSamples] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setError('');
      try {
        if (token) {
          setData(await getCustomerPortalData(token));
          return;
        }
        const { data: preview, error: previewError } = await supabase.rpc('sc_customer_portal_preview_samples');
        if (!previewError) setSamples(preview || []);
      } catch (err) {
        setError(err.message || 'Failed to load customer portal data.');
      }
    })();
  }, [token]);

  if (!token) {
    return (
      <main className="page phase6-page customer-portal-public">
        <section className="page-header">
          <div>
            <p className="eyebrow">Customer Experience</p>
            <h1>Customer Portal</h1>
            <p>This is the public customer status page. A real customer link includes a secure portal token.</p>
          </div>
        </section>

        {error && <div className="error-card">{error}</div>}

        <section className="card portal-token-help">
          <h2>Admin Preview / Missing Token</h2>
          <p>You are viewing the portal without a token. That is normal when opening it from the app menu. To test a real customer link, create or copy a customer portal link from the portal admin page and open it with a URL like:</p>
          <p><code>/customer-portal?token=customer-token-here</code></p>
          <div className="inline-form-row">
            <Link className="button primary" to="/customer-portal-preview">Open Customer Portal Preview</Link>
            <Link className="button" to="/customer-portal-admin">Manage Portal Updates</Link>
          </div>
        </section>

        <section className="card">
          <h2>Recent Preview Records</h2>
          <div className="sc-portal-preview-list">
            {(samples || []).map((r, i) => (
              <article className="sc-portal-card" key={r.id || i}>
                <div className="sc-card-title-row"><strong>{r.customer_name || 'Customer'}</strong><span className="sc-badge">{r.status || 'open'}</span></div>
                <p><strong>Order:</strong> {r.order_reference || r.id || 'Preview Order'}</p>
                <p><strong>Due:</strong> {r.due_date || 'Not set'}</p>
              </article>
            ))}
            {!samples.length && <div className="sc-empty-card">No preview records found yet. This page is ready once customer portal events exist.</div>}
          </div>
        </section>
      </main>
    );
  }

  if (error) return <main className="page phase6-page"><h1>Customer Portal</h1><div className="error-card">{error}</div></main>;
  if (!data) return <main className="page phase6-page"><p>Loading…</p></main>;
  if (!data.ok) return <main className="page phase6-page"><h1>Customer Portal</h1><p>{data.message}</p></main>;

  return (
    <main className="page phase6-page customer-portal-public">
      <section className="page-header"><div><p className="eyebrow">Customer Experience</p><h1>Order & Artwork Status</h1><p>Customer: <strong>{data.customer?.customer_name}</strong> {data.customer?.organization ? `— ${data.customer.organization}` : ''}</p></div></section>
      <section className="phase6-timeline">
        {(data.events || []).map((e) => <article className="phase6-timeline-item" key={e.id}><span>{new Date(e.created_at).toLocaleDateString()}</span><h2>{e.title}</h2><p className="phase6-pill">{e.status || e.event_type}</p><p>{e.public_note || e.message}</p></article>)}
        {!(data.events || []).length && <p>No status updates have been posted yet.</p>}
      </section>
    </main>
  );
}
