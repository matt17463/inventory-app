import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { contractorCsv, contractorReport, localDate, periodRange } from './lib/contractorHours';
import './ContractorHours.css';

const ACTIVITIES = ['Production', 'Artwork', 'Inventory', 'Shipping', 'Equipment Maintenance', 'Administration', 'Other'];
const currency = (value) => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const displayHours = (value) => value == null ? '—' : Number(value).toFixed(2);
function errorText(error) {
  if (/sc_contractor_|does not exist|schema cache/i.test(error?.message || '')) {
    return 'Contractor database migration is not installed yet. Ask the administrator to apply the reviewed Supabase migration.';
  }
  return error?.message || 'Unable to complete the request.';
}

export default function ContractorHours() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('');
  const admin = role === 'admin' || role === 'manager';
  const [period, setPeriod] = useState('week');
  const [anchor, setAnchor] = useState(localDate);
  const [customStart, setCustomStart] = useState(localDate);
  const [customEnd, setCustomEnd] = useState(localDate);
  const [contractorFilter, setContractorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [entries, setEntries] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [rates, setRates] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [workDate, setWorkDate] = useState(localDate);
  const [hours, setHours] = useState('');
  const [activity, setActivity] = useState('Production');
  const [notes, setNotes] = useState('');
  const [targetId, setTargetId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [rateValue, setRateValue] = useState('');
  const [rateEffective, setRateEffective] = useState(localDate);

  const range = useMemo(() => period === 'custom'
    ? { start: customStart, end: customEnd }
    : periodRange(period, anchor), [period, anchor, customStart, customEnd]);
  const validRange = range.start && range.end && range.start <= range.end;

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!mounted) return;
      if (authError || !auth?.user) { setMessage('Please sign in to track hours.'); return; }
      setUser(auth.user);
      const { data: roles, error: roleError } = await supabase.from('sc_app_user_roles')
        .select('role').eq('user_id', auth.user.id).single();
      if (!mounted) return;
      if (roleError) setMessage(errorText(roleError));
      setRole(roles?.role || 'operator');
      setTargetId(auth.user.id);
    }
    init();
    return () => { mounted = false; };
  }, []);

  const reload = useCallback(async () => {
    if (!user || !validRange) return;
    setBusy(true);
    try {
      const { error: initError } = await supabase.rpc('sc_contractor_initialize');
      if (initError) throw initError;
      const peopleQuery = supabase.from('sc_contractors').select('user_id,display_name').order('display_name');
      const timeQuery = supabase.from('sc_contractor_time_entries').select('*')
        .gte('work_date', range.start).lte('work_date', range.end)
        .order('work_date', { ascending: false }).order('created_at', { ascending: false });
      const [peopleResult, timeResult, rateResult, activeResult] = await Promise.all([
        peopleQuery,
        timeQuery,
        admin ? supabase.from('sc_contractor_hourly_rates').select('contractor_id,effective_on,hourly_rate') : Promise.resolve({ data: [], error: null }),
        supabase.from('sc_contractor_time_entries').select('*').eq('contractor_id', user.id).eq('status', 'open'),
      ]);
      for (const response of [peopleResult,timeResult,rateResult,activeResult]) if (response.error) throw response.error;
      const records = timeResult.data || [];
      const seen = new Set(records.map((row) => row.id));
      setEntries([...records, ...(activeResult.data || []).filter((row) => !seen.has(row.id))]);
      setProfiles(peopleResult.data || []);
      setRates(rateResult.data || []);
      setMessage('');
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }, [user, admin, range.start, range.end, validRange]);

  useEffect(() => { reload(); }, [reload]);

  const names = useMemo(() => Object.fromEntries(profiles.map((p) => [p.user_id,p.display_name])), [profiles]);
  const filtered = useMemo(() => entries.filter((row) =>
    (row.work_date >= range.start && row.work_date <= range.end || row.status === 'open' && row.contractor_id === user?.id)
    && (contractorFilter === 'all' || row.contractor_id === contractorFilter)
    && (statusFilter === 'all' || row.status === statusFilter)
  ), [entries, contractorFilter, statusFilter, range.start, range.end, user]);
  const report = useMemo(() => contractorReport(filtered, rates), [filtered, rates]);
  const ownOpen = entries.find((row) => row.contractor_id === user?.id && row.status === 'open');

  const run = async (procedure, args, success) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc(procedure, args);
      if (error) throw error;
      await reload();
      setMessage(success);
      return true;
    } catch (error) {
      setMessage(errorText(error));
      return false;
    } finally { setBusy(false); }
  };

  const submitManual = async (event) => {
    event.preventDefault();
    const parsed = Number(hours);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 24) { setMessage('Enter hours greater than zero and no more than 24.'); return; }
    const parameters = { p_work_date: workDate, p_hours: parsed, p_activity: activity, p_notes: notes };
    const success = editingId
      ? await run('sc_contractor_edit_manual', { p_entry_id: editingId, ...parameters }, 'Manual entry updated.')
      : await run('sc_contractor_record_manual', { ...parameters, p_contractor_id: admin ? targetId : user.id }, 'Hours submitted for review.');
    if (success) { setEditingId(''); setHours(''); setNotes(''); setWorkDate(localDate()); }
  };
  const beginEdit = (row) => {
    setEditingId(row.id);
    setWorkDate(row.work_date);
    setHours(String(row.hours));
    setActivity(row.activity);
    setNotes(row.notes);
    setTargetId(row.contractor_id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const exportCsv = () => {
    const output = contractorCsv(report.rows, names);
    const blob = new Blob(['\uFEFF' + output], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contractor-hours-${range.start}-${range.end}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="sc-page sc-contractor-hours">
      <header className="sc-contractor-heading">
        <div>
          <p className="sc-kicker">Team administration / Timesheets</p>
          <h1>Contractor Hours</h1>
          <p>Manual entries, clock in/out, review and payment tracking. All entries are associated with signed-in users.</p>
        </div>
        <button type="button" onClick={reload} disabled={busy || !user}>Refresh</button>
      </header>

      {message && <div className="sc-contractor-message" role="status" aria-live="polite">{message}</div>}
      <div className="sc-contractor-grid">
        <section className="sc-contractor-card">
          <h2>Clock In / Clock Out</h2>
          {ownOpen ? <>
            <p className="sc-contractor-active"><span className="sc-contractor-dot" />Clocked in</p>
            <p>Started {new Date(ownOpen.started_at).toLocaleString()} · {ownOpen.activity}</p>
            <button type="button" disabled={busy} onClick={() => run('sc_contractor_clock_out', {}, 'Clock-out submitted for review.')}>Clock Out</button>
          </> : <>
            <p>Start a time entry using the activity and notes below.</p>
            <button type="button" disabled={busy || !user} onClick={() => run('sc_contractor_clock_in', { p_activity: activity, p_notes: notes }, 'Clocked in successfully.')}>Clock In</button>
          </>}
          <small>Hours are calculated from server timestamps. Long or forgotten shifts require manager review.</small>
        </section>

        <section className="sc-contractor-card">
          <h2>{editingId ? 'Correct Manual Entry' : 'Manual Hours Entry'}</h2>
          <form className="sc-contractor-form" onSubmit={submitManual}>
            {admin && !editingId && <label>Contractor
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                {profiles.map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}
              </select>
            </label>}
            <label>Work date<input type="date" required value={workDate} onChange={(e) => setWorkDate(e.target.value)} /></label>
            <label>Hours worked<input type="number" required min="0.01" max="24" step="0.01" placeholder="e.g. 6.50" value={hours} onChange={(e) => setHours(e.target.value)} /></label>
            <label>Work type<select value={activity} onChange={(e) => setActivity(e.target.value)}>{ACTIVITIES.map((v) => <option key={v}>{v}</option>)}</select></label>
            <label className="sc-contractor-wide">Description / notes<textarea maxLength={2000} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <div className="sc-contractor-actions">
              <button type="submit" disabled={busy || !user || !hours || admin && !editingId && !targetId}>{editingId ? 'Save correction' : 'Submit hours'}</button>
              {editingId && <button type="button" className="secondary" onClick={() => { setEditingId(''); setHours(''); setNotes(''); setTargetId(user?.id || ''); }}>Cancel</button>}
            </div>
          </form>
        </section>
      </div>

      {admin && <section className="sc-contractor-card">
        <h2>Contractors and Pay Rates <small>Manager only</small></h2>
        <p>Contractors must already have an active Skilled Crafting login. Historical hourly rates are used for payment totals based on each work date.</p>
        <div className="sc-contractor-admin-forms">
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (await run('sc_contractor_register', { p_email: newEmail, p_name: newName || null }, 'Contractor registered.')) { setNewEmail(''); setNewName(''); }
          }}>
            <label>Existing user email<input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></label>
            <label>Display name (optional)<input value={newName} maxLength={120} onChange={(e) => setNewName(e.target.value)} /></label>
            <button disabled={busy || !newEmail} type="submit">Add / Update Contractor</button>
          </form>
          <form onSubmit={async (e) => {
            e.preventDefault();
            await run('sc_contractor_set_rate', { p_contractor_id: targetId, p_hourly_rate: Number(rateValue), p_effective_on: rateEffective }, 'Hourly rate saved.');
          }}>
            <label>Contractor<select value={targetId} onChange={(e) => setTargetId(e.target.value)}>{profiles.map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}</select></label>
            <label>Hourly rate ($)<input type="number" min="0" max="10000" step="0.01" value={rateValue} onChange={(e) => setRateValue(e.target.value)} required /></label>
            <label>Effective date<input type="date" value={rateEffective} onChange={(e) => setRateEffective(e.target.value)} required /></label>
            <button type="submit" disabled={busy || !targetId || rateValue === ''}>Save rate</button>
          </form>
        </div>
      </section>}

      <section className="sc-contractor-card">
        <div className="sc-contractor-report-heading">
          <div><h2>Hours & Payment Reports</h2><p>Choose a period, filter contractor entries, review totals and export a CSV for bookkeeping.</p></div>
          <button disabled={busy || !report.rows.length} onClick={exportCsv} type="button">Export CSV</button>
        </div>
        <div className="sc-contractor-filters">
          <label>Period<select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="week">Weekly (Monday–Sunday)</option><option value="month">Monthly</option>
            <option value="quarter">Quarterly</option><option value="year">Yearly</option><option value="custom">Custom dates</option>
          </select></label>
          {period !== 'custom' ? <label>Period containing<input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} /></label>
            : <><label>From<input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /></label>
              <label>Through<input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></label></>}
          {admin && <label>Contractor<select value={contractorFilter} onChange={(e) => setContractorFilter(e.target.value)}>
            <option value="all">All contractors</option>{profiles.map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}
          </select></label>}
          <label>Status<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {['all','open','submitted','approved','paid','rejected','void'].map((value) => <option value={value} key={value}>{value === 'all' ? 'All statuses' : value}</option>)}
          </select></label>
        </div>
        {!validRange && <p role="alert">The report start date must not be after the end date.</p>}
        <p className="helper-text">Reporting period: {range.start} through {range.end}. Financial totals use approved and paid entries; submitted hours are shown separately.</p>
        <div className="sc-contractor-metrics">
          <div><small>Total report hours</small><strong>{displayHours(report.totalHours)}</strong></div>
          <div><small>Awaiting approval</small><strong>{displayHours(report.pendingHours)}</strong></div>
          <div><small>Approved / unpaid</small><strong>{displayHours(report.approvedHours)}</strong></div>
          <div><small>Paid hours</small><strong>{displayHours(report.paidHours)}</strong></div>
          {admin && <><div><small>Approved amount due</small><strong>{currency(report.dueAmount)}</strong></div>
          <div><small>Paid amount (tracked)</small><strong>{currency(report.paidAmount)}</strong></div></>}
        </div>
        <div className="sc-contractor-table-wrap">
          <table className="sc-contractor-table">
            <thead><tr><th>Contractor</th><th>Date</th><th>Source</th><th>Activity</th><th>Hours</th><th>Status</th>{admin && <><th>Rate</th><th>Amount</th></>}<th>Notes</th><th>Actions</th></tr></thead>
            <tbody>
              {report.rows.map((row) => <tr key={row.id}>
                <td>{names[row.contractor_id] || 'Contractor'}</td>
                <td>{row.work_date}</td><td>{row.method === 'clock' ? 'Clock' : 'Manual'}</td>
                <td>{row.activity}</td><td>{displayHours(row.hours)}</td>
                <td><span className={'sc-contractor-status sc-contractor-status-' + row.status}>{row.status}</span></td>
                {admin && <><td>{currency(row.rate)}</td><td>{currency(row.amount)}</td></>}
                <td>{row.notes || '—'}</td>
                <td><div className="sc-contractor-row-actions">
                  {row.method === 'manual' && ['submitted','rejected'].includes(row.status) && <button type="button" disabled={busy} onClick={() => beginEdit(row)}>Edit</button>}
                  {admin && ['submitted','rejected'].includes(row.status) && <button type="button" disabled={busy} onClick={() => run('sc_contractor_review', { p_entry_id: row.id, p_status: 'approved' }, 'Hours approved.')}>Approve</button>}
                  {admin && ['submitted','approved'].includes(row.status) && <button type="button" disabled={busy} onClick={() => run('sc_contractor_review', { p_entry_id: row.id, p_status: 'rejected' }, 'Hours rejected.')}>Reject</button>}
                  {admin && row.status === 'approved' && <button type="button" disabled={busy} onClick={() => window.confirm('Mark this entry paid? This cannot be reversed from this screen.') && run('sc_contractor_review', { p_entry_id: row.id, p_status: 'paid' }, 'Entry marked paid.')}>Mark paid</button>}
                  {['submitted','rejected'].includes(row.status) && <button type="button" className="secondary" disabled={busy} onClick={() => {
                    const reason = window.prompt('Reason for voiding this entry (required):');
                    if (reason !== null) run('sc_contractor_void', { p_entry_id: row.id, p_reason: reason }, 'Entry voided.');
                  }}>Void</button>}
                </div></td>
              </tr>)}
              {report.rows.length === 0 && <tr><td colSpan={admin ? 10 : 8}>No entries for this period and filter. Start by submitting hours above.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="helper-text">Marking an entry paid records its bookkeeping status; it does not transfer money or create payroll in QuickBooks. Time entry and approvals are preserved in the database audit history.</p>
      </section>
    </main>
  );
}
