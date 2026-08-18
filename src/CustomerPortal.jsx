import { useEffect, useState } from 'react';
import { getCustomerPortalData } from './lib/phase6Api';

export default function CustomerPortal() {
  const token = new URLSearchParams(window.location.search).get('token')?.trim() || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadPortal() {
      if (!token) {
        setData({ ok: false, message: 'This customer portal link is incomplete.' });
        return;
      }

      setError('');
      try {
        const result = await getCustomerPortalData(token);
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err.message || 'The customer portal could not be loaded.');
      }
    }

    loadPortal();
    return () => { active = false; };
  }, [token]);

  if (error) {
    return (
      <main className="page phase6-page customer-portal-public">
        <section className="page-header"><div><p className="eyebrow">Customer Experience</p><h1>Customer Portal</h1></div></section>
        <div className="error-card">{error}</div>
      </main>
    );
  }

  if (!data) {
    return <main className="page phase6-page customer-portal-public"><p>Loading…</p></main>;
  }

  if (!data.ok) {
    return (
      <main className="page phase6-page customer-portal-public">
        <section className="page-header"><div><p className="eyebrow">Customer Experience</p><h1>Customer Portal</h1></div></section>
        <section className="card">
          <h2>Link unavailable</h2>
          <p>{data.message || 'This customer portal link is invalid, expired, or no longer active.'}</p>
          <p>Please contact Skilled Crafting for a current portal link.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page phase6-page customer-portal-public">
      <section className="page-header">
        <div>
          <p className="eyebrow">Customer Experience</p>
          <h1>Order &amp; Artwork Status</h1>
          <p>Customer: <strong>{data.customer?.customer_name}</strong>{data.customer?.organization ? ` — ${data.customer.organization}` : ''}</p>
        </div>
      </section>
      <section className="phase6-timeline">
        {(data.events || []).map((event) => (
          <article className="phase6-timeline-item" key={event.id}>
            <span>{event.created_at ? new Date(event.created_at).toLocaleDateString() : ''}</span>
            <h2>{event.title || 'Status update'}</h2>
            <p className="phase6-pill">{event.status || event.event_type || 'update'}</p>
            {event.due_date && <p><strong>Due:</strong> {event.due_date}</p>}
            <p>{event.public_note || event.message || ''}</p>
          </article>
        ))}
        {!(data.events || []).length && <p>No customer-visible status updates have been posted yet.</p>}
      </section>
    </main>
  );
}
