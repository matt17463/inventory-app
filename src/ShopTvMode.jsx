import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getShopTouchMode } from './lib/shopTvApi';

const REFRESH_SECONDS = 60;

const STATIONS = [
  { key: 'all', label: 'All Work' },
  { key: 'press', label: 'Press' },
  { key: 'receiving', label: 'Receiving' },
  { key: 'qc', label: 'QC' },
  { key: 'packing', label: 'Packing' },
  { key: 'admin', label: 'Admin' },
];

const QUICK_ACTIONS = [
  { label: 'Open Pull Sheets', path: '/pullsheets', icon: '📋' },
  { label: 'Production Board', path: '/production-board', icon: '🏭' },
  { label: 'Receive Inventory', path: '/add-item', icon: '📦' },
  { label: 'Spoilage / Misprint', path: '/spoilage', icon: '⚠️' },
  { label: 'Due Dates', path: '/pullsheet-due-dates', icon: '📅' },
  { label: 'Scan Inventory', path: '/scan', icon: '🔎' },
];

function normalizeText(value) {
  return String(value || '').replace(/_/g, ' ').trim();
}

function titleCaseStatus(value) {
  const text = normalizeText(value);
  if (!text) return 'Unknown';
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return 'No due date';
  try {
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return String(value).slice(0, 10);
  }
}

function formatDateTime(value) {
  if (!value) return 'Never';
  try {
    return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return String(value);
  }
}

function bucketLabel(bucket) {
  switch (bucket) {
    case 'overdue':
      return 'Overdue';
    case 'due_today':
      return 'Due Today';
    case 'due_tomorrow':
      return 'Due Tomorrow';
    case 'due_this_week':
      return 'Due This Week';
    case 'future':
      return 'Future';
    default:
      return 'No Due Date';
  }
}

function bucketTone(bucket) {
  switch (bucket) {
    case 'overdue':
      return 'danger';
    case 'due_today':
      return 'urgent';
    case 'due_tomorrow':
    case 'due_this_week':
      return 'warning';
    case 'future':
      return 'success';
    default:
      return 'muted';
  }
}

function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('attention') || s.includes('blocked') || s.includes('cancel')) return 'danger';
  if (s.includes('overdue')) return 'danger';
  if (s.includes('hold') || s.includes('partial') || s.includes('qc')) return 'warning';
  if (s.includes('ready') || s.includes('complete')) return 'success';
  if (s.includes('production')) return 'info';
  return 'muted';
}

function nextAction(job) {
  if (job.next_action) return job.next_action;
  const status = String(job.production_status || job.board_column || '').toLowerCase();
  if (job.unpaired_required_lines > 0) return 'Pair missing blank items';
  if (job.unresolved_lines > 0 && status.includes('attention')) return 'Review pull sheet blockers';
  if (status.includes('ready')) return 'Start production';
  if (status.includes('production')) return 'Continue production';
  if (status.includes('qc')) return 'Inspect / close pull sheet';
  if (status.includes('complete')) return 'Ready for final handoff';
  return 'Review order';
}

function orderLabel(job) {
  if (job.woo_order_number) return `#${job.woo_order_number}`;
  if (job.woocommerce_order_id) return `#${job.woocommerce_order_id}`;
  if (job.job_id) return `Job #${job.job_id}`;
  return 'Order';
}

function JobCard({ job }) {
  const issues = Array.isArray(job.blocking_issues) ? job.blocking_issues : [];
  const primaryIssue = issues.map((issue) => issue.message || issue.type).filter(Boolean)[0]
    || job.production_status_reason
    || job.blocker_summary
    || '';

  return (
    <article className={`shop-touch-job-card tone-${statusTone(job.production_status || job.board_column)}`}>
      <div className="shop-touch-job-topline">
        <strong>{orderLabel(job)}</strong>
        <span className={`shop-touch-chip tone-${bucketTone(job.due_date_bucket)}`}>{bucketLabel(job.due_date_bucket)}</span>
      </div>

      <h3>{job.customer_name || job.job_name || 'No customer name'}</h3>

      <div className="shop-touch-job-meta">
        <span>Due: {formatDate(job.due_date)}</span>
        <span>{titleCaseStatus(job.production_status || job.board_column)}</span>
        <span>{Number(job.total_lines || 0)} item{Number(job.total_lines || 0) === 1 ? '' : 's'}</span>
      </div>

      {primaryIssue ? <p className="shop-touch-job-alert">{primaryIssue}</p> : null}

      <div className="shop-touch-next-action">
        <span>Next:</span>
        <strong>{nextAction(job)}</strong>
      </div>

      <div className="shop-touch-job-actions">
        {job.job_id ? (
          <Link className="shop-touch-action-button primary" to={`/pullsheets/${job.job_id}`}>
            Open Pull Sheet
          </Link>
        ) : null}
        <Link className="shop-touch-action-button" to={`/production-board?search=${encodeURIComponent(job.woocommerce_order_id || job.job_id || '')}`}>
          Board
        </Link>
      </div>
    </article>
  );
}

function TaskCard({ task }) {
  return (
    <article className="shop-touch-task-card">
      <strong>{task.title || task.task_title || 'Task'}</strong>
      <span>{task.assigned_to_name || task.assigned_to || 'Unassigned'} · {titleCaseStatus(task.status)}</span>
      <small>{task.due_at ? new Date(task.due_at).toLocaleString() : 'No due time'}</small>
    </article>
  );
}

export default function ShopTvMode() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ metrics: {}, jobs: [], tasks: [] });
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [station, setStation] = useState(searchParams.get('station') || 'all');
  const [touchMode, setTouchMode] = useState(searchParams.get('mode') !== 'tv');
  const [kiosk, setKiosk] = useState(searchParams.get('kiosk') === '1');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_SECONDS);
  const searchInputRef = useRef(null);

  const metrics = data.metrics || {};
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const updatedAt = lastUpdated || data.generated_at;

  async function load(options = {}) {
    const nextStation = options.station ?? station;
    const nextSearch = options.search ?? search;
    setLoading(true);

    try {
      const nextData = await getShopTouchMode({ station: nextStation, search: nextSearch, limit: 80 });
      setData(nextData || { metrics: {}, jobs: [], tasks: [] });
      setMessage('');
      setLastUpdated(new Date().toISOString());
      setSecondsLeft(REFRESH_SECONDS);
    } catch (err) {
      setMessage(err.message || 'Failed to load Shop TV / Touch Mode.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams();
    if (station && station !== 'all') params.set('station', station);
    if (search) params.set('search', search);
    params.set('mode', touchMode ? 'touch' : 'tv');
    if (kiosk) params.set('kiosk', '1');
    setSearchParams(params, { replace: true });
  }, [station, search, touchMode, kiosk, setSearchParams]);

  useEffect(() => {
    document.body.classList.toggle('shop-touch-kiosk-active', kiosk);
    return () => document.body.classList.remove('shop-touch-kiosk-active');
  }, [kiosk]);

  useEffect(() => {
    load();
    const refreshTimer = window.setInterval(() => load(), REFRESH_SECONDS * 1000);
    const countdownTimer = window.setInterval(() => {
      setSecondsLeft((current) => (current <= 1 ? REFRESH_SECONDS : current - 1));
    }, 1000);

    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(countdownTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station]);

  const groupedJobs = useMemo(() => {
    const groups = {
      overdue: [],
      due_today: [],
      needs_attention: [],
      ready: [],
      in_production: [],
      qc: [],
    };

    jobs.forEach((job) => {
      const bucket = String(job.due_date_bucket || '').toLowerCase();
      const status = String(job.production_status || job.board_column || '').toLowerCase();

      if (bucket === 'overdue') groups.overdue.push(job);
      else if (bucket === 'due_today') groups.due_today.push(job);
      else if (status.includes('attention') || Number(job.unpaired_required_lines || 0) > 0) groups.needs_attention.push(job);
      else if (status.includes('ready')) groups.ready.push(job);
      else if (status.includes('production')) groups.in_production.push(job);
      else if (status.includes('qc') || status.includes('ship')) groups.qc.push(job);
      else groups.ready.push(job);
    });

    return groups;
  }, [jobs]);

  function runSearch(event) {
    event.preventDefault();
    load({ search });
  }

  function changeStation(nextStation) {
    setStation(nextStation);
    load({ station: nextStation });
  }

  async function enterFullScreen() {
    setKiosk(true);
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Browser may block fullscreen unless triggered by a user action. Kiosk layout still applies.
    }
  }

  async function exitFullScreen() {
    setKiosk(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore browser fullscreen errors.
    }
  }

  function goToSearchTarget() {
    const value = search.trim();
    if (!value) {
      searchInputRef.current?.focus();
      return;
    }
    navigate(`/production-board?search=${encodeURIComponent(value)}`);
  }

  const priorityGroups = [
    { key: 'overdue', label: 'Overdue', jobs: groupedJobs.overdue, tone: 'danger' },
    { key: 'due_today', label: 'Due Today', jobs: groupedJobs.due_today, tone: 'urgent' },
    { key: 'needs_attention', label: 'Needs Attention', jobs: groupedJobs.needs_attention, tone: 'danger' },
    { key: 'ready', label: 'Ready to Produce', jobs: groupedJobs.ready, tone: 'success' },
    { key: 'in_production', label: 'In Production', jobs: groupedJobs.in_production, tone: 'info' },
    { key: 'qc', label: 'QC / Closeout', jobs: groupedJobs.qc, tone: 'warning' },
  ];

  return (
    <main className={`shop-touch-page ${touchMode ? 'touch-mode' : 'tv-mode'} ${kiosk ? 'kiosk-mode' : ''}`}>
      <section className="shop-touch-header">
        <div className="shop-touch-brand-block">
          <img src="/skilled-crafting-logo.png" alt="Skilled Crafting" />
          <div>
            <p className="shop-touch-eyebrow">Shop Floor</p>
            <h1>{touchMode ? 'Shop Touch Mode' : 'Shop TV Mode'}</h1>
            <p>Production priorities, blockers, due dates, and quick actions from one screen.</p>
          </div>
        </div>

        <div className="shop-touch-header-actions">
          <button type="button" className="shop-touch-toggle" onClick={() => setTouchMode((value) => !value)}>
            {touchMode ? 'Touch Mode' : 'TV Mode'}
          </button>
          {kiosk ? (
            <button type="button" className="shop-touch-toggle" onClick={exitFullScreen}>Exit Kiosk</button>
          ) : (
            <button type="button" className="shop-touch-toggle" onClick={enterFullScreen}>Full Screen</button>
          )}
          <button type="button" className="shop-touch-toggle primary" onClick={() => load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </section>

      <section className="shop-touch-status-strip">
        <div>
          <span>Last updated</span>
          <strong>{formatDateTime(updatedAt)}</strong>
        </div>
        <div>
          <span>Next refresh</span>
          <strong>{secondsLeft}s</strong>
        </div>
        <div>
          <span>Data source</span>
          <strong>Production Board Sync</strong>
        </div>
        {message ? <div className="shop-touch-stale-warning"><strong>Connection issue</strong><span>{message}</span></div> : null}
      </section>

      <section className="shop-touch-search-panel">
        <form onSubmit={runSearch} className="shop-touch-search-form">
          <label>
            <span>Scan or search order, customer, SKU, or job</span>
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Scan barcode or type order # / customer"
            />
          </label>
          <button type="submit">Search</button>
          {touchMode ? <button type="button" className="secondary" onClick={goToSearchTarget}>Open in Board</button> : null}
        </form>

        <div className="shop-touch-station-tabs" role="tablist" aria-label="Station filter">
          {STATIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={station === item.key ? 'active' : ''}
              onClick={() => changeStation(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="shop-touch-metric-grid">
        <div className="shop-touch-metric danger"><span>{metrics.overdue ?? 0}</span><strong>Overdue</strong></div>
        <div className="shop-touch-metric urgent"><span>{metrics.due_today ?? 0}</span><strong>Due Today</strong></div>
        <div className="shop-touch-metric warning"><span>{metrics.needs_attention ?? 0}</span><strong>Needs Attention</strong></div>
        <div className="shop-touch-metric success"><span>{metrics.ready_to_produce ?? 0}</span><strong>Ready</strong></div>
        <div className="shop-touch-metric info"><span>{metrics.in_production ?? 0}</span><strong>In Production</strong></div>
        <div className="shop-touch-metric muted"><span>{metrics.no_due_date ?? 0}</span><strong>No Due Date</strong></div>
      </section>

      {touchMode ? (
        <section className="shop-touch-quick-actions" aria-label="Quick actions">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.path} to={action.path}>
              <span>{action.icon}</span>
              <strong>{action.label}</strong>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="shop-touch-board-grid">
        {priorityGroups.map((group) => (
          <section key={group.key} className={`shop-touch-lane tone-${group.tone}`}>
            <header>
              <h2>{group.label}</h2>
              <span>{group.jobs.length}</span>
            </header>
            <div className="shop-touch-lane-body">
              {group.jobs.length ? (
                group.jobs.slice(0, touchMode ? 12 : 6).map((job) => <JobCard key={`${group.key}-${job.job_id || job.woocommerce_order_id}`} job={job} />)
              ) : (
                <p className="shop-touch-empty">Nothing here.</p>
              )}
            </div>
          </section>
        ))}
      </section>

      {touchMode ? (
        <section className="shop-touch-bottom-grid">
          <section className="shop-touch-panel">
            <header>
              <h2>Open Tasks</h2>
              <span>{tasks.length}</span>
            </header>
            {tasks.length ? tasks.slice(0, 8).map((task) => <TaskCard key={task.id || task.title} task={task} />) : <p>No open tasks.</p>}
          </section>
          <section className="shop-touch-panel">
            <header>
              <h2>Watch List</h2>
              <span>{Number(metrics.no_due_date || 0) + Number(metrics.woo_completed_not_production || 0)}</span>
            </header>
            <div className="shop-touch-watch-item">
              <strong>{metrics.no_due_date ?? 0}</strong>
              <span>Open jobs without a due date</span>
            </div>
            <div className="shop-touch-watch-item">
              <strong>{metrics.woo_completed_not_production ?? 0}</strong>
              <span>Woo completed but production not complete</span>
            </div>
            <div className="shop-touch-watch-item">
              <strong>{metrics.unpaired_required_lines ?? 0}</strong>
              <span>Required lines still missing blank pairings</span>
            </div>
          </section>
        </section>
      ) : null}
    </main>
  );
}
