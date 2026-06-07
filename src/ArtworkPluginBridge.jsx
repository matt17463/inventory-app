import React, { useEffect, useMemo, useState } from 'react';
import {
  buildPrompt,
  getArtworkBridgeStatus,
  getArtworkBridgeSummary,
  getArtworkHandoffLog,
  getArtworkRequests,
  recordSubtitle,
  recordTitle,
  sendArtworkToProduction,
  updateArtworkStatus,
} from './lib/artworkBridgeApi';

const FILTERS = [
  { value: 'all', label: 'All Open' },
  { value: 'requests', label: 'Artwork Requests' },
  { value: 'reorders', label: 'Reorders' },
  { value: 'new', label: 'New' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent_to_production', label: 'Sent to Production' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_OPTIONS = [
  'new',
  'reviewing',
  'mockup_needed',
  'mockup_ready',
  'changes_requested',
  'approved',
  'sent_to_production',
  'in_production',
  'completed',
  'cancelled',
];

function Badge({ children, tone = 'neutral' }) {
  return <span className={`sc-badge sc-badge-${tone}`}>{children}</span>;
}

function safeDate(value) {
  if (!value) return '—';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleString();
}

function DetailField({ label, value }) {
  return (
    <div className="sc-detail-field">
      <div className="sc-detail-label">{label}</div>
      <div className="sc-detail-value">{value || '—'}</div>
    </div>
  );
}

export default function ArtworkPluginBridge() {
  const [summary, setSummary] = useState({});
  const [statusChecks, setStatusChecks] = useState([]);
  const [records, setRecords] = useState([]);
  const [handoffs, setHandoffs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load(nextFilter = filter) {
    setLoading(true);
    setError('');
    try {
      const [summaryData, statusData, requestRows, logRows] = await Promise.all([
        getArtworkBridgeSummary(),
        getArtworkBridgeStatus(),
        getArtworkRequests(nextFilter),
        getArtworkHandoffLog(50),
      ]);
      setSummary(summaryData || {});
      setStatusChecks(statusData || []);
      setRecords(requestRows || []);
      setHandoffs(logRows || []);
      setSelected((current) => {
        if (!current && requestRows?.length) return requestRows[0];
        if (!current) return null;
        return requestRows.find((row) => row.source_type === current.source_type && row.app_row_id === current.app_row_id) || requestRows[0] || null;
      });
    } catch (err) {
      setError(err.message || 'Could not load artwork bridge.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copyPrompt() {
    const prompt = buildPrompt(selected);
    if (!prompt) {
      setMessage('No prompt is available for this record.');
      return;
    }
    await navigator.clipboard.writeText(prompt);
    setMessage('Prompt copied.');
  }

  async function changeStatus(status) {
    if (!selected) return;
    setMessage('');
    setError('');
    try {
      await updateArtworkStatus(selected.source_type, selected.app_row_id || selected.source_id, status);
      setMessage(`Status updated to ${status}.`);
      await load(filter);
    } catch (err) {
      setError(err.message || 'Status update failed.');
    }
  }

  async function handoffToProduction() {
    if (!selected) return;
    setMessage('');
    setError('');
    try {
      const result = await sendArtworkToProduction(selected.source_type, selected.app_row_id || selected.source_id, 'Sent from inventory app Artwork Requests page.');
      if (result?.ok === false) throw new Error(result.message || 'Production handoff failed.');
      setMessage('Production handoff created.');
      await load(filter);
    } catch (err) {
      setError(err.message || 'Production handoff failed.');
    }
  }

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((row) => {
      const haystack = [
        row.source_type,
        row.source_id,
        row.customer_name,
        row.organization,
        row.email,
        row.project_name,
        row.app_status,
        row.wordpress_status,
        row.deadline,
        row.main_subject,
        row.graphic_elements,
        row.graphic_text,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [records, search]);

  const prompt = buildPrompt(selected);

  return (
    <main className="sc-page sc-artwork-page">
      <section className="sc-page-header sc-artwork-header">
        <div>
          <div className="sc-kicker">Artwork • WordPress Bridge</div>
          <h1>Artwork Requests & Reorders</h1>
          <p>
            Review artwork handoffs from the consolidated WordPress Artwork System plugin, copy AI prompts, update status,
            and move approved artwork into production.
          </p>
        </div>
        <button className="sc-btn sc-btn-primary" type="button" onClick={() => load(filter)} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </section>

      {message ? <div className="sc-alert sc-alert-success">{message}</div> : null}
      {error ? <div className="sc-alert sc-alert-danger">{error}</div> : null}

      <section className="sc-stat-grid sc-artwork-stat-grid">
        <div className="sc-stat-card accent-blue"><span>Artwork Requests</span><strong>{summary.request_count ?? 0}</strong></div>
        <div className="sc-stat-card accent-purple"><span>Reorders</span><strong>{summary.reorder_count ?? 0}</strong></div>
        <div className="sc-stat-card accent-gold"><span>Due Soon</span><strong>{summary.due_soon_count ?? 0}</strong></div>
        <div className="sc-stat-card accent-green"><span>Open Artwork Work</span><strong>{summary.pending_count ?? 0}</strong></div>
        <div className="sc-stat-card accent-slate"><span>Recent Handoffs</span><strong>{summary.recent_handoff_count ?? 0}</strong></div>
      </section>

      <section className="sc-card sc-bridge-card">
        <div className="sc-section-heading">
          <div>
            <h2>WordPress Integration Status</h2>
            <p>The Netlify function should write to sc_artwork_system_handoffs, sc_artwork_system_requests, and sc_artwork_system_reorders.</p>
          </div>
          <code>/.netlify/functions/artwork-system-handoff</code>
        </div>
        <div className="sc-status-check-grid">
          {statusChecks.map((check) => (
            <div key={`${check.check_name}-${check.details}`} className="sc-status-check">
              <Badge tone={check.status === 'ok' ? 'success' : check.status === 'warning' ? 'warning' : 'neutral'}>{check.status}</Badge>
              <strong>{check.check_name}</strong>
              <span>{check.details}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sc-card sc-artwork-controls">
        <div className="sc-control-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, organization, request, status, deadline…"
            className="sc-input"
          />
          <select
            className="sc-select"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              load(e.target.value);
            }}
          >
            {FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </section>

      <section className="sc-two-column sc-artwork-workspace">
        <div className="sc-card sc-record-list-card">
          <div className="sc-section-heading compact">
            <h2>Requests</h2>
            <span>{filteredRecords.length} shown</span>
          </div>
          <div className="sc-record-list">
            {filteredRecords.map((row) => (
              <button
                type="button"
                key={`${row.source_type}-${row.app_row_id}`}
                className={`sc-record-button ${selected?.source_type === row.source_type && selected?.app_row_id === row.app_row_id ? 'active' : ''}`}
                onClick={() => setSelected(row)}
              >
                <div className="sc-record-title-row">
                  <strong>{recordTitle(row)}</strong>
                  <Badge tone={row.source_type === 'reorder' ? 'purple' : 'blue'}>{row.source_type}</Badge>
                </div>
                <span>{recordSubtitle(row)}</span>
                <div className="sc-record-meta">
                  <Badge tone="neutral">{row.app_status || row.wordpress_status || 'new'}</Badge>
                  <span>WP #{row.source_id || '—'}</span>
                </div>
              </button>
            ))}
            {!loading && filteredRecords.length === 0 ? <div className="sc-empty-state">No artwork records found. Check the webhook status or sync unsent requests from WordPress.</div> : null}
          </div>
        </div>

        <div className="sc-card sc-artwork-detail-card">
          {!selected ? (
            <div className="sc-empty-state">Select an artwork request to review details.</div>
          ) : (
            <>
              <div className="sc-detail-header">
                <div>
                  <Badge tone={selected.source_type === 'reorder' ? 'purple' : 'blue'}>{selected.source_type}</Badge>
                  <h2>{recordTitle(selected)}</h2>
                  <p>{recordSubtitle(selected)}</p>
                </div>
                <div className="sc-detail-actions">
                  <button className="sc-btn" type="button" onClick={copyPrompt}>Copy Prompt</button>
                  <button className="sc-btn sc-btn-primary" type="button" onClick={handoffToProduction}>Send to Production</button>
                </div>
              </div>

              <div className="sc-status-edit-row">
                <label>
                  Inventory App Status
                  <select value={selected.app_status || 'new'} onChange={(e) => changeStatus(e.target.value)}>
                    {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
                  </select>
                </label>
              </div>

              <div className="sc-detail-grid">
                <DetailField label="Customer" value={selected.customer_name} />
                <DetailField label="Organization" value={selected.organization} />
                <DetailField label="Email" value={selected.email} />
                <DetailField label="Deadline" value={selected.deadline} />
                <DetailField label="Project Type" value={selected.project_name} />
                <DetailField label="Garment Color" value={selected.garment_color} />
                <DetailField label="Main Subject" value={selected.main_subject} />
                <DetailField label="Graphic Elements" value={selected.graphic_elements} />
                <DetailField label="Exact Text" value={selected.graphic_text} />
                <DetailField label="WordPress Status" value={selected.wordpress_status} />
              </div>

              <div className="sc-card-inner">
                <h3>Notes</h3>
                <p className="sc-preline">{selected.notes || '—'}</p>
              </div>

              <div className="sc-card-inner">
                <h3>AI Artwork Prompt</h3>
                {prompt ? <textarea className="sc-prompt-box" readOnly value={prompt} /> : <p>No generated prompt was included in this handoff.</p>}
              </div>

              <div className="sc-card-inner">
                <h3>Raw Handoff Summary</h3>
                <div className="sc-detail-grid small">
                  <DetailField label="Source ID" value={selected.source_id} />
                  <DetailField label="App Row ID" value={selected.app_row_id} />
                  <DetailField label="Created" value={safeDate(selected.created_at)} />
                  <DetailField label="WordPress Created" value={selected.wordpress_created_at} />
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="sc-card sc-handoff-log-card">
        <div className="sc-section-heading compact">
          <h2>Recent Handoff Log</h2>
          <span>{handoffs.length} rows</span>
        </div>
        <div className="sc-table-wrap">
          <table className="sc-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Source</th>
                <th>Status</th>
                <th>Site</th>
              </tr>
            </thead>
            <tbody>
              {handoffs.map((row) => (
                <tr key={row.id}>
                  <td>{safeDate(row.created_at)}</td>
                  <td>{row.event_type || '—'}</td>
                  <td>{row.source_type} #{row.source_id}</td>
                  <td><Badge tone={row.status === 'sent' || row.status === 'received' ? 'success' : 'neutral'}>{row.status || 'received'}</Badge></td>
                  <td>{row.source_site_url || '—'}</td>
                </tr>
              ))}
              {handoffs.length === 0 ? <tr><td colSpan="5">No handoff rows found yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
