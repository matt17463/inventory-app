import { useEffect, useState } from 'react';
import { createCustomerPortalEvent, createCustomerPortalToken, getCustomerPortalEvents, getCustomerPortalTokens } from './lib/phase6Api';

const initialToken = { customer_name: '', organization: '', customer_email: '', customer_phone: '', notes: '' };
const initialEvent = { portal_token_id: '', title: '', status: 'pending', event_type: 'status_update', public_note: '', private_note: '', due_date: '' };

export default function CustomerPortalAdmin() {
  const [tokens, setTokens] = useState([]);
  const [events, setEvents] = useState([]);
  const [tokenForm, setTokenForm] = useState(initialToken);
  const [eventForm, setEventForm] = useState(initialEvent);
  const [error, setError] = useState('');
  const baseUrl = window.location.origin;

  async function load() {
    setError('');
    try { const [t, e] = await Promise.all([getCustomerPortalTokens(), getCustomerPortalEvents()]); setTokens(t); setEvents(e); }
    catch (err) { setError(err.message || 'Failed to load customer portal.'); }
  }
  useEffect(() => { load(); }, []);

  async function submitToken(e) {
    e.preventDefault(); await createCustomerPortalToken(tokenForm); setTokenForm(initialToken); await load();
  }
  async function submitEvent(e) {
    e.preventDefault(); await createCustomerPortalEvent(eventForm); setEventForm(initialEvent); await load();
  }

  return (
    <main className="page phase6-page">
      <h1>Customer Portal Admin</h1>
      <p className="muted">Create customer portal links and publish customer-facing order/artwork/production updates.</p>
      {error && <div className="error-card">{error}</div>}
      <section className="phase6-two-column">
        <form className="phase6-panel" onSubmit={submitToken}>
          <h2>Create Portal Link</h2>
          <input placeholder="Customer name" value={tokenForm.customer_name} onChange={(e)=>setTokenForm({...tokenForm, customer_name:e.target.value})}/>
          <input placeholder="Organization" value={tokenForm.organization} onChange={(e)=>setTokenForm({...tokenForm, organization:e.target.value})}/>
          <input placeholder="Email" value={tokenForm.customer_email} onChange={(e)=>setTokenForm({...tokenForm, customer_email:e.target.value})}/>
          <input placeholder="Phone" value={tokenForm.customer_phone} onChange={(e)=>setTokenForm({...tokenForm, customer_phone:e.target.value})}/>
          <textarea placeholder="Internal notes" value={tokenForm.notes} onChange={(e)=>setTokenForm({...tokenForm, notes:e.target.value})}/>
          <button className="button button-primary">Create Link</button>
        </form>
        <form className="phase6-panel" onSubmit={submitEvent}>
          <h2>Post Customer Update</h2>
          <select value={eventForm.portal_token_id} onChange={(e)=>setEventForm({...eventForm, portal_token_id:e.target.value})} required>
            <option value="">Choose customer portal</option>
            {tokens.map(t => <option key={t.id} value={t.id}>{t.customer_name || t.customer_email} — {t.organization}</option>)}
          </select>
          <input placeholder="Title" value={eventForm.title} onChange={(e)=>setEventForm({...eventForm, title:e.target.value})} required/>
          <input placeholder="Status" value={eventForm.status} onChange={(e)=>setEventForm({...eventForm, status:e.target.value})}/>
          <input placeholder="Due date" value={eventForm.due_date} onChange={(e)=>setEventForm({...eventForm, due_date:e.target.value})}/>
          <textarea placeholder="Customer-visible note" value={eventForm.public_note} onChange={(e)=>setEventForm({...eventForm, public_note:e.target.value})}/>
          <textarea placeholder="Private note" value={eventForm.private_note} onChange={(e)=>setEventForm({...eventForm, private_note:e.target.value})}/>
          <button className="button button-primary">Publish Update</button>
        </form>
      </section>
      <section className="phase6-panel">
        <h2>Portal Links</h2>
        <div className="table-wrap"><table className="data-table compact-table"><thead><tr><th>Customer</th><th>Email</th><th>Portal URL</th><th>Active</th></tr></thead><tbody>
          {tokens.map(t => <tr key={t.id}><td>{t.customer_name}<br/><small>{t.organization}</small></td><td>{t.customer_email}</td><td><input readOnly value={`${baseUrl}/customer-portal?token=${t.token}`} onFocus={(e)=>e.target.select()} /></td><td>{t.is_active ? 'Yes' : 'No'}</td></tr>)}
        </tbody></table></div>
      </section>
      <section className="phase6-panel"><h2>Recent Portal Events</h2>
        {events.slice(0, 20).map(e => <div className="phase6-list-item" key={e.id}><strong>{e.title}</strong><span>{e.status}</span><p>{e.public_note}</p></div>)}
      </section>
    </main>
  );
}
