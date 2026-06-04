import { useEffect, useMemo, useState } from 'react';
import {
  getColorAliasApprovals,
  getColorAliasCandidates,
  getWooBlankMatchSummary,
  relinkWooProductsToBlankMaster,
  saveColorAliasDecision,
} from './lib/inventoryApi';

function colorKey(row) {
  return `${row.woo_color || ''}|||${row.possible_blank_color || ''}`;
}

function groupCandidates(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const key = colorKey(row);
    const existing = map.get(key) || {
      woo_color: row.woo_color,
      possible_blank_color: row.possible_blank_color,
      affected_woo_products: 0,
      approval_status: row.approval_status,
      notes: row.notes,
      examples: [],
    };

    existing.affected_woo_products += Number(row.affected_woo_products || 0);
    if (existing.examples.length < 5) {
      existing.examples.push([
        row.brand,
        row.style,
        row.size,
      ].filter(Boolean).join(' / '));
    }

    if (row.approval_status && row.approval_status !== 'not_reviewed') {
      existing.approval_status = row.approval_status;
    }

    map.set(key, existing);
  });

  return Array.from(map.values()).sort((a, b) => {
    if ((b.affected_woo_products || 0) !== (a.affected_woo_products || 0)) {
      return (b.affected_woo_products || 0) - (a.affected_woo_products || 0);
    }
    return `${a.woo_color} ${a.possible_blank_color}`.localeCompare(`${b.woo_color} ${b.possible_blank_color}`);
  });
}

export default function ColorAliasReview() {
  const [candidates, setCandidates] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [summary, setSummary] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [reviewer, setReviewer] = useState('Matthew');
  const [notesByKey, setNotesByKey] = useState({});
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [relinking, setRelinking] = useState(false);

  async function load() {
    setMessage('');
    try {
      const [candidateRows, approvalRows, summaryRows] = await Promise.all([
        getColorAliasCandidates(),
        getColorAliasApprovals('all'),
        getWooBlankMatchSummary().catch(() => []),
      ]);
      setCandidates(candidateRows);
      setApprovals(approvalRows);
      setSummary(summaryRows);
    } catch (err) {
      setMessage(err.message || 'Failed to load color alias review data. Run the included SQL migration first.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => groupCandidates(candidates), [candidates]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return grouped.filter((row) => {
      const status = row.approval_status || 'not_reviewed';

      if (filter === 'pending' && status !== 'not_reviewed' && status !== 'pending') return false;
      if (filter === 'approved' && status !== 'approved') return false;
      if (filter === 'rejected' && status !== 'rejected') return false;

      if (!term) return true;

      return [
        row.woo_color,
        row.possible_blank_color,
        ...(row.examples || []),
      ].filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [grouped, filter, search]);

  const totals = useMemo(() => ({
    candidates: grouped.length,
    pending: grouped.filter((row) => !row.approval_status || row.approval_status === 'not_reviewed' || row.approval_status === 'pending').length,
    approved: grouped.filter((row) => row.approval_status === 'approved').length,
    rejected: grouped.filter((row) => row.approval_status === 'rejected').length,
  }), [grouped]);

  async function decide(row, status) {
    const key = colorKey(row);
    setBusyKey(`${key}:${status}`);
    setMessage('');

    try {
      await saveColorAliasDecision({
        wooColor: row.woo_color,
        blankColor: row.possible_blank_color,
        status,
        notes: notesByKey[key] || (status === 'approved' ? 'Approved in app' : 'Rejected in app'),
        reviewedBy: reviewer || 'Matthew',
      });
      setMessage(`${status === 'approved' ? 'Approved' : 'Rejected'}: ${row.woo_color} → ${row.possible_blank_color}`);
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to save color alias decision.');
    } finally {
      setBusyKey('');
    }
  }

  async function handleRelink() {
    setRelinking(true);
    setMessage('Relinking WooCommerce products to blank master using approved aliases...');
    try {
      const result = await relinkWooProductsToBlankMaster();
      setMessage(`Relink complete. Processed: ${result?.processed ?? 0}. Linked: ${result?.linked ?? 0}. Unmatched: ${result?.unmatched ?? 0}.`);
      await load();
    } catch (err) {
      setMessage(err.message || 'Relink failed.');
    } finally {
      setRelinking(false);
    }
  }

  return (
    <main className="page color-alias-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">WooCommerce Matching</p>
          <h1>Color Alias Review</h1>
          <p>
            Approve color aliases only when the WooCommerce color and blank master color are truly the same.
            Nothing is normalized automatically. Rejected or pending aliases are ignored by the matcher.
          </p>
        </div>
        <button type="button" className="primary-action" onClick={handleRelink} disabled={relinking}>
          {relinking ? 'Relinking...' : 'Relink Products'}
        </button>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="summary-grid">
        <div className="metric-card"><strong>{totals.candidates}</strong><span>Candidate aliases</span></div>
        <div className="metric-card"><strong>{totals.pending}</strong><span>Pending review</span></div>
        <div className="metric-card"><strong>{totals.approved}</strong><span>Approved</span></div>
        <div className="metric-card"><strong>{totals.rejected}</strong><span>Rejected</span></div>
      </section>

      {summary.length > 0 && (
        <section className="card elevated-card">
          <h2>Current Match Summary</h2>
          <div className="status-pill-list">
            {summary.map((row) => (
              <span key={row.match_diagnostic} className="status-pill">
                {row.match_diagnostic}: {row.qty}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="card elevated-card">
        <h2>Review Controls</h2>
        <div className="filter-row">
          <label>
            Reviewer
            <input value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="Reviewer name" />
          </label>
          <label>
            Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search color or example..." />
          </label>
          <label>
            Status
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card elevated-card">
        <h2>Candidate Color Aliases</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Woo Color</th>
                <th>Possible Blank Color</th>
                <th>Affected</th>
                <th>Status</th>
                <th>Examples</th>
                <th>Notes</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const key = colorKey(row);
                const status = row.approval_status || 'not_reviewed';

                return (
                  <tr key={key}>
                    <td><strong>{row.woo_color}</strong></td>
                    <td><strong>{row.possible_blank_color}</strong></td>
                    <td>{row.affected_woo_products}</td>
                    <td><span className={`alias-status alias-status-${status}`}>{status}</span></td>
                    <td>
                      {(row.examples || []).map((example) => (
                        <div key={example} className="example-line">{example}</div>
                      ))}
                    </td>
                    <td>
                      <textarea
                        rows="3"
                        value={notesByKey[key] ?? row.notes ?? ''}
                        onChange={(event) => setNotesByKey((current) => ({ ...current, [key]: event.target.value }))}
                        placeholder="Optional review note"
                      />
                    </td>
                    <td>
                      <div className="button-stack">
                        <button
                          type="button"
                          className="success-button"
                          onClick={() => decide(row, 'approved')}
                          disabled={Boolean(busyKey)}
                        >
                          {busyKey === `${key}:approved` ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => decide(row, 'rejected')}
                          disabled={Boolean(busyKey)}
                        >
                          {busyKey === `${key}:rejected` ? 'Rejecting...' : 'Reject'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7">No candidates found for this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card elevated-card">
        <h2>Saved Decisions</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Woo Color</th>
                <th>Blank Color</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Reviewed By</th>
                <th>Reviewed At</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((row) => (
                <tr key={row.id}>
                  <td>{row.woo_color}</td>
                  <td>{row.blank_color}</td>
                  <td><span className={`alias-status alias-status-${row.status}`}>{row.status}</span></td>
                  <td>{row.notes}</td>
                  <td>{row.reviewed_by}</td>
                  <td>{row.reviewed_at ? new Date(row.reviewed_at).toLocaleString() : ''}</td>
                </tr>
              ))}
              {approvals.length === 0 && (
                <tr>
                  <td colSpan="6">No saved decisions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
