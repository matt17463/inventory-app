import React, { useEffect, useMemo, useState } from 'react';
import {
  buildArtworkPrompt,
  getArtworkBridgeSummary,
  getArtworkHandoffLog,
  getArtworkRequests,
  sendArtworkToProduction,
  updateArtworkStatus,
} from './lib/artworkBridgeApi';

const STATUSES = [
  'new',
  'mockup_needed',
  'waiting_on_customer',
  'revision_requested',
  'approved',
  'ready_for_production',
  'sent_to_production',
  'completed',
  'cancelled',
];

function statusLabel(status) {
  return String(status || 'new')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function badgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('approved') || s.includes('ready')) return 'status-badge success';
  if (s.includes('revision') || s.includes('waiting')) return 'status-badge warning';
  if (s.includes('cancel')) return 'status-badge danger';
  if (s.includes('sent') || s.includes('production')) return 'status-badge info';
  if (s.includes('complete')) return 'status-badge neutral';
  return 'status-badge new';
}

function DetailField({ label, value }) {
  return (
    <div className="art-detail-field">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

export default function ArtworkPluginBridge() {
  const [summary, setSummary] = useState(null);
  const [requests, setRequests] = useState([]);
  const [handoffs, setHandoffs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('requests');
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [sum, reqs, logs] = await Promise.all([
        getArtworkBridgeSummary(),
        getArtworkRequests(),
        getArtworkHandoffLog(),
      ]);
      setSummary(sum);
      setRequests(reqs);
      setHandoffs(logs);
      if (!selectedId && reqs.length) setSelectedId(reqs[0].id);
    } catch (err) {
      setError(err.message || 'Unable to load artwork requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      const status = String(r.status || '').toLowerCase();
      const isComplete = ['complete', 'completed', 'closed', 'cancelled'].includes(status);
      if (filter === 'open' && isComplete) return false;
      if (filter === 'approved' && !(status.includes('approved') || status.includes('ready'))) return false;
      if (filter === 'production' && !status.includes('production')) return false;
      if (filter === 'completed' && !isComplete) return false;
      if (!q) return true;
      const haystack = [r.project_name, r.customer_name, r.customer_email, r.organization, r.status, r.deadline, r.project_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [requests, filter, search]);

  const selected = requests.find((r) => String(r.id) === String(selectedId)) || filtered[0] || null;
  const prompt = selected ? buildArtworkPrompt(selected) : '';

  async function copyPrompt() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setMessage('Prompt copied.');
  }

  async function setStatus(status) {
    if (!selected) return;
    setMessage('');
    try {
      await updateArtworkStatus(selected.id, status, note);
      setMessage(`Status updated to ${statusLabel(status)}.`);
      await load();
    } catch (err) {
      setError(err.message || 'Unable to update status.');
    }
  }

  async function handoff() {
    if (!selected) return;
    setMessage('');
    try {
      await sendArtworkToProduction(selected.id, note || 'Sent to production from Artwork Requests page.');
      setMessage('Artwork handoff logged and marked for production.');
      await load();
    } catch (err) {
      setError(err.message || 'Unable to send artwork to production.');
    }
  }

  return (
    <main className="page art-bridge-page">
      <section className="page-hero compact art-hero">
        <div>
          <p className="eyebrow">Artwork • WordPress Plugin Bridge</p>
          <h1>Artwork Requests & Reorders</h1>
          <p>
            Review customer artwork intake, copy AI prompts, track approvals, and send approved artwork into the production workflow.
          </p>
        </div>
        <div className="hero-actions">
          <button className="btn secondary" onClick={load} disabled={loading}>Refresh</button>
        </div>
      </section>

      {error && <div className="notice error">{error}</div>}
      {message && <div className="notice success">{message}</div>}

      <section className="stat-grid artwork-stat-grid">
        <div className="stat-card accent-blue"><span>Artwork Requests</span><strong>{summary?.artwork_requests ?? 0}</strong></div>
        <div className="stat-card accent-purple"><span>Open Requests</span><strong>{summary?.open_requests ?? 0}</strong></div>
        <div className="stat-card accent-orange"><span>Due Soon / Overdue</span><strong>{summary?.due_soon_or_overdue ?? 0}</strong></div>
        <div className="stat-card accent-green"><span>Recent Handoffs</span><strong>{summary?.recent_handoffs ?? 0}</strong></div>
      </section>

      <section className="panel bridge-setup-panel">
        <div>
          <h2>WordPress Artwork System Integration</h2>
          <p>
            In the WordPress Artwork System plugin settings, set the inventory app webhook URL to:
            <code>/.netlify/functions/artwork-system-handoff</code>
          </p>
        </div>
        <div className="bridge-status-steps">
          <span>1. Customer submits artwork request</span>
          <span>2. Plugin captures request</span>
          <span>3. App reviews and prepares production</span>
        </div>
      </section>

      <section className="panel art-control-panel">
        <div className="tabs">
          <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>Requests</button>
          <button className={tab === 'handoffs' ? 'active' : ''} onClick={() => setTab('handoffs')}>Handoff Log</button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Guide</button>
        </div>
        {tab === 'requests' && (
          <div className="art-filters">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="open">Open / Active</option>
              <option value="all">All Requests</option>
              <option value="approved">Approved / Ready</option>
              <option value="production">Sent to Production</option>
              <option value="completed">Completed / Closed</option>
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, project, email, status..." />
          </div>
        )}
      </section>

      {tab === 'requests' && (
        <section className="artwork-layout">
          <div className="panel art-list-panel">
            <h2>Artwork Requests</h2>
            {loading && <p>Loading...</p>}
            {!loading && filtered.length === 0 && (
              <div className="empty-state">
                <h3>No artwork requests found</h3>
                <p>If you expected requests here, confirm the WordPress plugin handoff is configured and the SQL functions were installed.</p>
              </div>
            )}
            <div className="art-request-list">
              {filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`art-request-card ${String(selected?.id) === String(r.id) ? 'selected' : ''}`}
                  onClick={() => setSelectedId(r.id)}
                >
                  <div>
                    <strong>{r.organization || r.project_name || 'Artwork Request'}</strong>
                    <span>{r.customer_name || 'Unknown customer'} {r.customer_email ? `• ${r.customer_email}` : ''}</span>
                  </div>
                  <span className={badgeClass(r.status)}>{statusLabel(r.status)}</span>
                  <small>Due: {r.deadline || 'Not set'}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="panel art-detail-panel">
            {!selected ? (
              <div className="empty-state">
                <h3>Select an artwork request</h3>
                <p>Choose a request to review details, copy a prompt, or send to production.</p>
              </div>
            ) : (
              <>
                <div className="detail-header">
                  <div>
                    <p className="eyebrow">Selected Artwork</p>
                    <h2>{selected.organization || selected.project_name || 'Artwork Request'}</h2>
                    <span className={badgeClass(selected.status)}>{statusLabel(selected.status)}</span>
                  </div>
                  <button className="btn primary" onClick={copyPrompt}>Copy AI Prompt</button>
                </div>

                <div className="art-detail-grid">
                  <DetailField label="Customer" value={selected.customer_name} />
                  <DetailField label="Email" value={selected.customer_email} />
                  <DetailField label="Project Type" value={selected.project_type} />
                  <DetailField label="Deadline" value={selected.deadline} />
                  <DetailField label="Main Subject" value={selected.main_subject} />
                  <DetailField label="Graphic Elements" value={selected.graphic_elements} />
                  <DetailField label="Exact Text" value={selected.exact_text} />
                  <DetailField label="Garment Color" value={selected.garment_color} />
                  <DetailField label="Preferred Shape" value={selected.preferred_shape} />
                  <DetailField label="Emotion" value={selected.emotion} />
                </div>

                <div className="art-notes-box">
                  <h3>Customer Notes</h3>
                  <p>{selected.notes || 'No notes provided.'}</p>
                </div>

                <div className="art-prompt-box">
                  <h3>AI Artwork Prompt</h3>
                  <textarea readOnly value={prompt} rows={9} />
                </div>

                <div className="art-actions-box">
                  <h3>Workflow Actions</h3>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional internal note for status changes or production handoff" rows={3} />
                  <div className="button-row wrap">
                    <button className="btn secondary" onClick={() => setStatus('mockup_needed')}>Mockup Needed</button>
                    <button className="btn secondary" onClick={() => setStatus('waiting_on_customer')}>Waiting on Customer</button>
                    <button className="btn success" onClick={() => setStatus('approved')}>Mark Approved</button>
                    <button className="btn primary" onClick={handoff}>Send to Production</button>
                    <button className="btn danger" onClick={() => setStatus('cancelled')}>Cancel / Close</button>
                  </div>
                  <div className="status-select-row">
                    <label>Set custom status</label>
                    <select onChange={(e) => e.target.value && setStatus(e.target.value)} defaultValue="">
                      <option value="">Choose status...</option>
                      {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {tab === 'handoffs' && (
        <section className="panel">
          <h2>Artwork Handoff Log</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Request</th><th>Action</th><th>Status</th><th>Message</th></tr>
              </thead>
              <tbody>
                {handoffs.map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.created_at).toLocaleString()}</td>
                    <td>{h.artwork_request_id || '—'}</td>
                    <td>{h.action}</td>
                    <td><span className={badgeClass(h.status)}>{statusLabel(h.status)}</span></td>
                    <td>{h.message || '—'}</td>
                  </tr>
                ))}
                {handoffs.length === 0 && <tr><td colSpan="5">No handoff events yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'settings' && (
        <section className="panel guide-panel">
          <h2>How to use this page</h2>
          <ol>
            <li>Review new artwork requests as they arrive from the WordPress Artwork System plugin.</li>
            <li>Copy the generated AI prompt and use it to create artwork/mockup concepts.</li>
            <li>Move the request through statuses such as Mockup Needed, Waiting on Customer, Approved, and Sent to Production.</li>
            <li>When artwork is approved, click Send to Production to log a production handoff.</li>
            <li>Use the handoff log to confirm which requests were moved into production.</li>
          </ol>
        </section>
      )}
    </main>
  );
}
