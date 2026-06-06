import { useEffect, useMemo, useState } from 'react';
import {
  getArtworkSystemRequests,
  getArtworkSystemReorders,
  getArtworkSystemHandoffs,
  updateArtworkSystemRequestStatus,
  updateArtworkSystemReorderStatus,
} from './lib/artworkSystemApi';

const statusOptions = [
  ['new', 'New'],
  ['reviewed', 'Reviewed'],
  ['in_design', 'In Design'],
  ['approved', 'Approved'],
  ['sent_to_production', 'Sent to Production'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

function Field({ label, children }) {
  return <p><strong>{label}:</strong><br />{children || '—'}</p>;
}

function dueBadge(row) {
  if (!row.deadline_date) return 'No due date';
  const days = Math.ceil((new Date(row.deadline_date).getTime() - Date.now()) / 86400000);
  if (days < 0) return `${Math.abs(days)} day(s) overdue`;
  if (days === 0) return 'Due today';
  return `Due in ${days} day(s)`;
}

export default function ArtworkRequests() {
  const [tab, setTab] = useState('requests');
  const [status, setStatus] = useState('open');
  const [requests, setRequests] = useState([]);
  const [reorders, setReorders] = useState([]);
  const [handoffs, setHandoffs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [savingId, setSavingId] = useState('');

  async function load() {
    try {
      setMessage('');
      const [requestRows, reorderRows, handoffRows] = await Promise.all([
        getArtworkSystemRequests(status),
        getArtworkSystemReorders(status),
        getArtworkSystemHandoffs(),
      ]);
      setRequests(requestRows);
      setReorders(reorderRows);
      setHandoffs(handoffRows);
      if (selected) {
        const source = selected.kind === 'reorder' ? reorderRows : requestRows;
        const updated = source.find((row) => row.id === selected.id);
        if (updated) setSelected({ ...updated, kind: selected.kind });
      }
    } catch (err) {
      setMessage(err.message || 'Failed to load artwork system records.');
    }
  }

  useEffect(() => { load(); }, [status]);

  const rows = tab === 'reorders' ? reorders : requests;

  const stats = useMemo(() => ({
    requests: requests.length,
    reorders: reorders.length,
    handoffs: handoffs.length,
    urgent: [...requests, ...reorders].filter((row) => row.deadline_date && new Date(row.deadline_date) <= new Date(Date.now() + 2 * 86400000)).length,
  }), [requests, reorders, handoffs]);

  async function updateStatus(row, kind, appStatus) {
    try {
      setSavingId(row.id);
      if (kind === 'reorder') await updateArtworkSystemReorderStatus(row.id, appStatus, row.app_notes || '');
      else await updateArtworkSystemRequestStatus(row.id, appStatus, row.app_notes || '');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to update artwork status.');
    } finally {
      setSavingId('');
    }
  }

  function copyPrompt(row) {
    const prompt = row.chatgpt_prompt || row.generated_prompt || '';
    if (!prompt) return;
    navigator.clipboard?.writeText(prompt);
    setMessage('Prompt copied.');
  }

  return (
    <main className="page artwork-system-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Artwork System</p>
          <h1>Artwork Requests & Reorders</h1>
          <p>Review handoffs from the consolidated WordPress Artwork System plugin and move approved artwork into production.</p>
        </div>
        <button className="secondary-button" onClick={load}>Refresh</button>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="metric-grid">
        <article className="metric-card"><strong>{stats.requests}</strong><span>Artwork requests</span></article>
        <article className="metric-card"><strong>{stats.reorders}</strong><span>Reorder requests</span></article>
        <article className="metric-card"><strong>{stats.urgent}</strong><span>Due soon / overdue</span></article>
        <article className="metric-card"><strong>{stats.handoffs}</strong><span>Recent handoffs</span></article>
      </section>

      <section className="card elevated-card">
        <div className="section-heading-row wrap-row">
          <div>
            <h2>WordPress Artwork System Integration</h2>
            <p className="muted">Set the plugin webhook URL to your Netlify function: <code>/.netlify/functions/artwork-system-handoff</code>.</p>
          </div>
          <div className="button-row">
            <button className={tab === 'requests' ? 'primary-button' : 'secondary-button'} onClick={() => setTab('requests')}>Requests</button>
            <button className={tab === 'reorders' ? 'primary-button' : 'secondary-button'} onClick={() => setTab('reorders')}>Reorders</button>
            <button className={tab === 'handoffs' ? 'primary-button' : 'secondary-button'} onClick={() => setTab('handoffs')}>Handoff Log</button>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="open">Open</option>
              <option value="new">New</option>
              <option value="reviewed">Reviewed</option>
              <option value="in_design">In Design</option>
              <option value="approved">Approved</option>
              <option value="sent_to_production">Sent to Production</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
      </section>

      {tab === 'handoffs' ? (
        <section className="card elevated-card table-card">
          <h2>Recent Handoff Log</h2>
          <div className="responsive-table">
            <table className="data-table">
              <thead><tr><th>Received</th><th>Event</th><th>Source</th><th>Site</th></tr></thead>
              <tbody>{handoffs.length === 0 ? <tr><td colSpan="4">No handoffs received yet.</td></tr> : handoffs.map((row) => (
                <tr key={row.id}><td>{new Date(row.received_at).toLocaleString()}</td><td>{row.event_type}</td><td>{row.source_type} #{row.source_id}</td><td>{row.source_site_url || '—'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="content-two-column wide-two-column">
          <section className="card elevated-card table-card">
            <h2>{tab === 'reorders' ? 'Artwork Reorders' : 'Artwork Requests'}</h2>
            <div className="responsive-table">
              <table className="data-table">
                <thead><tr><th>Project</th><th>Customer</th><th>Status</th><th>Due</th><th>Actions</th></tr></thead>
                <tbody>{rows.length === 0 ? <tr><td colSpan="5">No records found.</td></tr> : rows.map((row) => {
                  const kind = tab === 'reorders' ? 'reorder' : 'request';
                  const title = kind === 'reorder' ? (row.artwork_title || row.artwork_code || 'Artwork reorder') : (row.organization || row.main_subject || row.project_type || 'Artwork request');
                  return (
                    <tr key={row.id} className={selected?.id === row.id ? 'selected-row' : ''}>
                      <td><strong>{title}</strong><br /><small>WordPress #{row.wp_source_id}</small></td>
                      <td>{row.customer_name || row.requester_name || '—'}<br /><small>{row.email || row.requester_email || '—'}</small></td>
                      <td>{row.app_status || row.status || 'new'}<br /><small>WP: {row.status || '—'}</small></td>
                      <td>{row.deadline || '—'}<br /><small>{dueBadge(row)}</small></td>
                      <td><button className="secondary-button" onClick={() => setSelected({ ...row, kind })}>Open</button></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </section>

          <aside className="card elevated-card detail-card">
            {!selected ? <p>Select a record to review details.</p> : selected.kind === 'reorder' ? (
              <>
                <h2>{selected.artwork_title || selected.artwork_code || 'Artwork Reorder'}</h2>
                <Field label="Customer">{selected.customer_name || selected.requester_name}</Field>
                <Field label="Artwork Code">{selected.artwork_code}</Field>
                <Field label="Quantity Notes">{selected.quantity_notes}</Field>
                <Field label="Garment Notes">{selected.garment_notes}</Field>
                <Field label="Deadline">{selected.deadline}</Field>
                <Field label="Message">{selected.message}</Field>
                {selected.mockup_url && <p><a href={selected.mockup_url} target="_blank" rel="noreferrer">Open Mockup</a></p>}
                {selected.file_url && <p><a href={selected.file_url} target="_blank" rel="noreferrer">Open Artwork File</a></p>}
                <label>Inventory App Status</label>
                <select value={selected.app_status || 'new'} onChange={(e) => updateStatus(selected, 'reorder', e.target.value)} disabled={savingId === selected.id}>
                  {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </>
            ) : (
              <>
                <h2>{selected.organization || selected.main_subject || 'Artwork Request'}</h2>
                <Field label="Customer">{selected.customer_name}</Field>
                <Field label="Project Type">{selected.project_type}</Field>
                <Field label="Main Subject">{selected.main_subject}</Field>
                <Field label="Graphic Elements">{selected.graphic_elements}</Field>
                <Field label="Exact Text">{selected.graphic_text}</Field>
                <Field label="Garment Color">{selected.garment_color}</Field>
                <Field label="Deadline">{selected.deadline}</Field>
                <Field label="Notes">{selected.notes || selected.final_notes}</Field>
                <label>Inventory App Status</label>
                <select value={selected.app_status || 'new'} onChange={(e) => updateStatus(selected, 'request', e.target.value)} disabled={savingId === selected.id}>
                  {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {(selected.chatgpt_prompt || selected.generated_prompt) && <button className="secondary-button" onClick={() => copyPrompt(selected)}>Copy Prompt</button>}
                {Array.isArray(selected.mockups) && selected.mockups.length > 0 && <div><h3>Mockups</h3>{selected.mockups.map((m, idx) => <p key={idx}><a href={m.file_url} target="_blank" rel="noreferrer">{m.title || `Mockup ${idx + 1}`}</a><br /><small>{m.placement} {m.garment_color}</small></p>)}</div>}
              </>
            )}
          </aside>
        </section>
      )}
    </main>
  );
}
