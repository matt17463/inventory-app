import { useEffect, useState } from 'react';
import { getCustomerPortalData } from './lib/phase6Api';

export default function CustomerPortal() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { (async()=>{ try { setData(await getCustomerPortalData(token)); } catch(err){ setError(err.message); } })(); }, [token]);
  if (!token) return <main className="page phase6-page"><h1>Customer Portal</h1><p>Missing portal token.</p></main>;
  if (error) return <main className="page phase6-page"><h1>Customer Portal</h1><div className="error-card">{error}</div></main>;
  if (!data) return <main className="page phase6-page"><p>Loading…</p></main>;
  if (!data.ok) return <main className="page phase6-page"><h1>Customer Portal</h1><p>{data.message}</p></main>;
  return <main className="page phase6-page customer-portal-public">
    <h1>Order & Artwork Status</h1>
    <p className="muted">Customer: <strong>{data.customer?.customer_name}</strong> {data.customer?.organization ? `— ${data.customer.organization}` : ''}</p>
    <section className="phase6-timeline">
      {(data.events || []).map((e) => <article className="phase6-timeline-item" key={e.id}><span>{new Date(e.created_at).toLocaleDateString()}</span><h2>{e.title}</h2><p className="phase6-pill">{e.status || e.event_type}</p><p>{e.public_note || e.message}</p></article>)}
      {!(data.events || []).length && <p>No status updates have been posted yet.</p>}
    </section>
  </main>;
}
