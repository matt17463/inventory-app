import { useEffect, useMemo, useState } from 'react';
import {
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  runGoogleCalendarSync,
  saveGoogleCalendarSettings,
  startGoogleCalendarConnection,
} from './lib/googleCalendarApi';

const TARGET_LABELS = {
  order_due: 'Order Commitments',
  purchase_order_expected: 'Purchasing',
  owner_task: 'Owner Tasks',
};

function localDateTime(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : String(value);
}

function calendarLink(calendarId) {
  return `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calendarId)}`;
}

function runSummary(run) {
  if (!run) return 'No sync has run yet.';
  return `${run.created_events || 0} created • ${run.updated_events || 0} updated • ${run.deleted_events || 0} removed • ${run.skipped_events || 0} unchanged`;
}

export default function GoogleCalendarIntegration() {
  const [status, setStatus] = useState(null);
  const [settings, setSettings] = useState({
    time_zone: 'America/Los_Angeles',
    owner_employee_id: '',
    owner_task_priority_min: 5,
    targets: {},
  });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function applyStatus(payload) {
    setStatus(payload);
    const targetSettings = {};
    (payload.targets || []).forEach((target) => { targetSettings[target.event_kind] = target.is_active !== false; });
    setSettings({
      time_zone: payload.connection?.time_zone || 'America/Los_Angeles',
      owner_employee_id: payload.connection?.owner_employee_id || '',
      owner_task_priority_min: Number(payload.connection?.owner_task_priority_min ?? 5),
      targets: targetSettings,
    });
  }

  async function load() {
    setError('');
    try {
      applyStatus(await getGoogleCalendarStatus());
    } catch (err) {
      setError(err.message || 'Unable to load Google Calendar integration status.');
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function connectedMessage(event) {
      if (event.origin !== window.location.origin || event.data?.type !== 'sc-google-calendar-oauth') return;
      if (event.data.success) {
        setMessage('Google Calendar connected. Run the initial sync below.');
        setError('');
        await load();
      } else {
        setError('Google Calendar was not connected. Review the connection window and try again.');
      }
      setBusy('');
    }
    window.addEventListener('message', connectedMessage);
    return () => window.removeEventListener('message', connectedMessage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const latestRun = status?.runs?.[0] || null;
  const totalSynced = useMemo(() => Object.values(status?.link_counts || {}).reduce(
    (total, counts) => total + Number(counts.synced || 0), 0
  ), [status]);
  const totalErrors = useMemo(() => Object.values(status?.link_counts || {}).reduce(
    (total, counts) => total + Number(counts.error || 0), 0
  ), [status]);

  async function connect() {
    setBusy('connect');
    setError('');
    setMessage('Opening Google authorization…');
    const popup = window.open('about:blank', 'scGoogleCalendarConnect', 'width=620,height=760,resizable=yes,scrollbars=yes');
    try {
      const result = await startGoogleCalendarConnection();
      if (popup) popup.location.replace(result.authorization_url);
      else window.location.assign(result.authorization_url);
    } catch (err) {
      popup?.close();
      setBusy('');
      setMessage('');
      setError(err.message || 'Unable to start Google authorization.');
    }
  }

  async function sync(rebuild = false) {
    setBusy(rebuild ? 'rebuild' : 'sync');
    setMessage(rebuild ? 'Rebuilding every managed Google Calendar event…' : 'Synchronizing calendar changes…');
    setError('');
    try {
      const result = await runGoogleCalendarSync({ rebuild });
      applyStatus(result);
      const syncResult = result.result || {};
      setMessage(syncResult.status === 'already_running'
        ? 'Another calendar sync is already running. Refresh this page in a minute.'
        : `Calendar sync complete: ${syncResult.created || 0} created, ${syncResult.updated || 0} updated, ${syncResult.deleted || 0} removed, ${syncResult.skipped || 0} unchanged.`);
    } catch (err) {
      setMessage('');
      setError(err.message || 'Calendar synchronization failed.');
    } finally {
      setBusy('');
    }
  }

  async function saveSettings() {
    setBusy('settings');
    setMessage('Saving calendar settings…');
    setError('');
    try {
      const result = await saveGoogleCalendarSettings(settings);
      applyStatus(result);
      setMessage('Calendar settings saved. Run Sync Now to apply these settings immediately.');
    } catch (err) {
      setMessage('');
      setError(err.message || 'Unable to save calendar settings.');
    } finally {
      setBusy('');
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect Google Calendar? Existing Google calendars and events will remain, but the application will stop updating them.')) return;
    setBusy('disconnect');
    setError('');
    try {
      const result = await disconnectGoogleCalendar();
      applyStatus(result);
      setMessage('Google Calendar disconnected. Existing events were left in Google Calendar.');
    } catch (err) {
      setError(err.message || 'Unable to disconnect Google Calendar.');
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="page sc-page-stack google-calendar-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Tools &amp; Admin</p>
          <h1>Google Calendar Integration</h1>
          <p>One-way synchronization for order due dates, purchase-order arrivals, and high-priority owner tasks. Skilled Crafting remains the source of truth.</p>
        </div>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={load} disabled={Boolean(busy)}>Refresh Status</button>
          {!status?.connected && <button type="button" onClick={connect} disabled={Boolean(busy)}>{busy === 'connect' ? 'Connecting…' : 'Connect Google Account'}</button>}
        </div>
      </section>

      {message && <p className="message success-message">{message}</p>}
      {error && <p className="message error-message">{error}</p>}

      <section className="metric-grid google-calendar-metrics">
        <article className="metric-card"><span>Connection</span><strong>{status?.connected ? 'Connected' : status?.needs_reconnect ? 'Reconnect' : 'Not Connected'}</strong><small>{status?.connection?.connected_email || 'No Google account'}</small></article>
        <article className="metric-card"><span>Managed Events</span><strong>{totalSynced}</strong><small>{totalErrors ? `${totalErrors} need attention` : 'No event errors'}</small></article>
        <article className="metric-card"><span>Last Sync</span><strong>{status?.connection?.last_sync_status || 'Never'}</strong><small>{localDateTime(status?.connection?.last_sync_at)}</small></article>
        <article className="metric-card"><span>Automatic Sync</span><strong>{status?.automatic_sync_minutes || 15} min</strong><small>Production deploys only</small></article>
      </section>

      {!status?.connected ? (
        <section className="card elevated-card google-calendar-setup-card">
          <h2>Connect the Skilled Crafting owner calendar</h2>
          <ol>
            <li>Complete the Google Cloud and Netlify setup in the Phase 1 deployment guide.</li>
            <li>Select <strong>Connect Google Account</strong> and approve the requested app-created-calendar permission.</li>
            <li>Return here and select <strong>Run Initial Sync</strong>.</li>
          </ol>
          <p className="muted">The integration cannot read, change, or delete unrelated calendars. It manages only the secondary calendars it creates for Skilled Crafting.</p>
        </section>
      ) : (
        <>
          <section className="card elevated-card">
            <div className="section-heading-row wrap-row">
              <div><h2>Synchronization</h2><p className="muted">Normal sync sends only changed records. Rebuild repairs every managed event without creating duplicates.</p></div>
              <div className="button-row">
                <button type="button" onClick={() => sync(false)} disabled={Boolean(busy)}>{busy === 'sync' ? 'Syncing…' : totalSynced ? 'Sync Now' : 'Run Initial Sync'}</button>
                <button type="button" className="secondary-button" onClick={() => sync(true)} disabled={Boolean(busy)}>{busy === 'rebuild' ? 'Rebuilding…' : 'Rebuild Calendar Sync'}</button>
              </div>
            </div>
            {status?.connection?.last_sync_error && <p className="message error-message">Last error: {status.connection.last_sync_error}</p>}
          </section>

          <section className="content-two-column wide-two-column">
            <section className="card elevated-card">
              <h2>Calendar Settings</h2>
              <div className="stacked-form">
                <label>Business Time Zone
                  <input value={settings.time_zone} onChange={(event) => setSettings({ ...settings, time_zone: event.target.value })} placeholder="America/Los_Angeles" />
                </label>
                <label>Owner Employee Record
                  <select value={settings.owner_employee_id} onChange={(event) => setSettings({ ...settings, owner_employee_id: event.target.value })}>
                    <option value="">Do not sync owner tasks yet</option>
                    {(status?.employees || []).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.role ? ` — ${employee.role}` : ''}</option>)}
                  </select>
                </label>
                <label>Minimum Owner Task Priority
                  <input type="number" min="0" max="100" value={settings.owner_task_priority_min} onChange={(event) => setSettings({ ...settings, owner_task_priority_min: event.target.value })} />
                </label>
                <p className="muted">Only open tasks assigned to the selected owner with this priority or higher are synchronized.</p>
                <button type="button" onClick={saveSettings} disabled={Boolean(busy)}>{busy === 'settings' ? 'Saving…' : 'Save Settings'}</button>
              </div>
            </section>

            <section className="card elevated-card">
              <h2>Managed Calendars</h2>
              <p className="muted">Disabling a calendar removes its managed events during the next sync. The Google calendar itself remains available.</p>
              <div className="google-calendar-target-list">
                {(status?.targets || []).map((target) => {
                  const counts = status?.link_counts?.[target.event_kind] || {};
                  return (
                    <article key={target.event_kind} className="google-calendar-target">
                      <span className="google-calendar-color" style={{ backgroundColor: target.background_color || '#0b57d0' }} />
                      <div><strong>{TARGET_LABELS[target.event_kind] || target.calendar_summary}</strong><small>{counts.synced || 0} active events{counts.error ? ` • ${counts.error} errors` : ''}</small></div>
                      <label className="checkbox-line"><input type="checkbox" checked={settings.targets[target.event_kind] !== false} onChange={(event) => setSettings({ ...settings, targets: { ...settings.targets, [target.event_kind]: event.target.checked } })} /> Enabled</label>
                      <a href={calendarLink(target.google_calendar_id)} target="_blank" rel="noreferrer">Open Google Calendar</a>
                    </article>
                  );
                })}
              </div>
            </section>
          </section>

          <section className="card elevated-card table-card">
            <div className="section-heading-row"><div><h2>Recent Sync History</h2><p className="muted">Latest run: {runSummary(latestRun)}</p></div></div>
            <div className="responsive-table"><table className="data-table"><thead><tr><th>Started</th><th>Source</th><th>Status</th><th>Desired</th><th>Created</th><th>Updated</th><th>Removed</th><th>Errors</th></tr></thead><tbody>
              {!status?.runs?.length ? <tr><td colSpan="8">No calendar sync has run yet.</td></tr> : status.runs.map((run) => <tr key={run.id}><td>{localDateTime(run.started_at)}</td><td>{run.trigger_source}</td><td>{run.status}</td><td>{run.desired_events}</td><td>{run.created_events}</td><td>{run.updated_events}</td><td>{run.deleted_events}</td><td>{run.error_count}</td></tr>)}
            </tbody></table></div>
          </section>

          <section className="card elevated-card google-calendar-safety">
            <h2>Connection Safety</h2>
            <p>Google edits never change Skilled Crafting records. Use Rebuild Calendar Sync to restore events after an accidental Google-side edit.</p>
            <button type="button" className="danger-button" onClick={disconnect} disabled={Boolean(busy)}>{busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect Google Calendar'}</button>
          </section>
        </>
      )}

      <style>{`.google-calendar-page .google-calendar-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.google-calendar-page .google-calendar-setup-card ol{line-height:1.8}.google-calendar-page .google-calendar-target-list{display:grid;gap:12px}.google-calendar-page .google-calendar-target{display:grid;grid-template-columns:16px minmax(190px,1fr) auto auto;align-items:center;gap:12px;padding:14px;border:1px solid var(--border-color,#d8e0ea);border-radius:12px}.google-calendar-page .google-calendar-target small{display:block;margin-top:4px}.google-calendar-page .google-calendar-color{width:14px;height:48px;border-radius:8px}.google-calendar-page .google-calendar-safety{border-color:#efb8b4}.google-calendar-page .success-message{color:#137333}@media(max-width:900px){.google-calendar-page .google-calendar-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.google-calendar-page .google-calendar-target{grid-template-columns:16px 1fr}.google-calendar-page .google-calendar-target>a,.google-calendar-page .google-calendar-target>label{grid-column:2}}@media(max-width:560px){.google-calendar-page .google-calendar-metrics{grid-template-columns:1fr}}`}</style>
    </main>
  );
}
