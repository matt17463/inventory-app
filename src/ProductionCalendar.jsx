import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listCapacityWindows,
  listWindowAssignments,
  listSchedulableJobs,
  assignJobToWindow,
  deleteWindowAssignment,
} from './lib/productionSchedulingApi';

function today() { return new Date().toISOString().slice(0, 10); }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

export default function ProductionCalendar() {
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(addDays(today(), 14));
  const [windows, setWindows] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState({ window_id: '', job_id: '', assigned_minutes: 60, assignment_title: '', notes: '' });
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setMessage('');
    try {
      const [w, a, j] = await Promise.all([
        listCapacityWindows({ startDate, endDate }),
        listWindowAssignments({ startDate, endDate }),
        listSchedulableJobs(),
      ]);
      setWindows(w); setAssignments(a); setJobs(j);
      setForm((current) => ({
        ...current,
        window_id: current.window_id || w[0]?.id || '',
        job_id: current.job_id || j[0]?.job_id || '',
      }));
    } catch (e) { setMessage(e.message || String(e)); }
  }, [startDate, endDate]);
  useEffect(() => { load(); }, [load]);

  const byDate = useMemo(() => {
    const m = new Map();
    windows.forEach((w) => { if (!m.has(w.window_date)) m.set(w.window_date, []); m.get(w.window_date).push(w); });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [windows]);

  function assignmentsFor(windowId) { return assignments.filter((a) => a.window_id === windowId); }

  async function submitAssignment(e) {
    e.preventDefault();
    try {
      await assignJobToWindow(form);
      setForm((f) => ({ ...f, assignment_title: '', notes: '' }));
      await load();
      setMessage('Job assigned to production window.');
    } catch (err) { setMessage(err.message || String(err)); }
  }

  async function removeAssignment(id) {
    if (!confirm('Remove this job from the production window?')) return;
    try { await deleteWindowAssignment(id); await load(); } catch (err) { setMessage(err.message || String(err)); }
  }

  return (
    <div className="page production-calendar-page">
      <div className="page-header-row"><div><div className="eyebrow">Production</div><h1>Production Calendar</h1><p>Assign jobs to scheduled production windows by employee or production resource.</p></div><button className="button secondary" onClick={load}>Refresh</button></div>
      {message && <div className="notice-card">{message}</div>}

      <section className="card roomy-card">
        <h2>Assign Job to Production Window</h2>
        <form onSubmit={submitAssignment} className="assignment-form-grid">
          <label>Production Window<select value={form.window_id} onChange={(e) => setForm({ ...form, window_id: e.target.value })} required>
            <option value="">Choose window</option>{windows.map((w) => <option key={w.id} value={w.id}>{w.window_date} {w.start_time?.slice(0,5)}–{w.end_time?.slice(0,5)} • {w.employee_name || 'Unassigned'}</option>)}
          </select></label>
          <label>Job<select value={form.job_id} onChange={(e) => setForm({ ...form, job_id: e.target.value })} required>
            <option value="">Choose job</option>{jobs.map((j) => <option key={j.job_id} value={j.job_id}>{j.job_number} {j.customer_name ? `• ${j.customer_name}` : ''} {j.due_date_text ? `• Due ${j.due_date_text}` : ''}</option>)}
          </select></label>
          <label>Assigned Minutes<input type="number" value={form.assigned_minutes} onChange={(e) => setForm({ ...form, assigned_minutes: e.target.value })} /></label>
          <label>Assignment Title<input value={form.assignment_title} onChange={(e) => setForm({ ...form, assignment_title: e.target.value })} placeholder="Optional label" /></label>
          <label className="wide">Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <button className="button primary" type="submit">Assign Job</button>
        </form>
      </section>

      <section className="card roomy-card">
        <div className="filter-row"><label>Start <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label>End <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label></div>
        <h2>Calendar</h2>
        <div className="production-calendar-grid">
          {byDate.map(([date, dayWindows]) => (
            <div className="calendar-day-card" key={date}>
              <h3>{date}</h3>
              {dayWindows.map((w) => (
                <div className="calendar-window" key={w.id}>
                  <strong>{w.start_time?.slice(0,5)}–{w.end_time?.slice(0,5)} • {w.employee_name || 'Unassigned'}</strong>
                  <p>{w.title} — {Math.round(w.assigned_minutes || 0)} / {Math.round(w.capacity_minutes || 0)} minutes</p>
                  {assignmentsFor(w.id).map((a) => (
                    <div key={a.id} className="assignment-pill">
                      <span>{a.display_title} • {a.assigned_minutes} min</span>
                      <button onClick={() => removeAssignment(a.id)}>×</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
          {!byDate.length && <p>No production windows scheduled for this date range.</p>}
        </div>
      </section>
    </div>
  );
}
