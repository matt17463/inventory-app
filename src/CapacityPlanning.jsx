import React, { useEffect, useMemo, useState } from 'react';
import {
  listProductionEmployees,
  saveProductionEmployee,
  listCapacityWindows,
  saveCapacityWindow,
  deleteCapacityWindow,
} from './lib/productionSchedulingApi';

function today() { return new Date().toISOString().slice(0, 10); }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

export default function CapacityPlanning() {
  const [employees, setEmployees] = useState([]);
  const [windows, setWindows] = useState([]);
  const [message, setMessage] = useState('');
  const [rangeStart, setRangeStart] = useState(today());
  const [rangeEnd, setRangeEnd] = useState(addDays(today(), 14));
  const [employeeForm, setEmployeeForm] = useState({ display_name: '', role: 'Production', email: '', active: true });
  const [windowForm, setWindowForm] = useState({ employee_id: '', window_date: today(), start_time: '09:00', end_time: '13:00', title: 'Production Block', work_area: 'General Production', notes: '' });

  async function load() {
    setMessage('');
    try {
      const [emp, win] = await Promise.all([
        listProductionEmployees(),
        listCapacityWindows({ startDate: rangeStart, endDate: rangeEnd }),
      ]);
      setEmployees(emp);
      setWindows(win);
      if (!windowForm.employee_id && emp[0]) setWindowForm((f) => ({ ...f, employee_id: emp[0].id }));
    } catch (e) {
      setMessage(e.message || String(e));
    }
  }

  useEffect(() => { load(); }, [rangeStart, rangeEnd]);

  const totals = useMemo(() => windows.reduce((acc, w) => {
    acc.capacity += Number(w.capacity_minutes || 0);
    acc.assigned += Number(w.assigned_minutes || 0);
    acc.remaining += Number(w.remaining_minutes || 0);
    return acc;
  }, { capacity: 0, assigned: 0, remaining: 0 }), [windows]);

  async function addEmployee(e) {
    e.preventDefault();
    try {
      await saveProductionEmployee(employeeForm);
      setEmployeeForm({ display_name: '', role: 'Production', email: '', active: true });
      await load();
      setMessage('Employee/resource saved.');
    } catch (err) { setMessage(err.message || String(err)); }
  }

  async function addWindow(e) {
    e.preventDefault();
    try {
      await saveCapacityWindow(windowForm);
      setWindowForm((f) => ({ ...f, notes: '' }));
      await load();
      setMessage('Production time block saved.');
    } catch (err) { setMessage(err.message || String(err)); }
  }

  async function removeWindow(id) {
    if (!confirm('Delete this production block and its assignments?')) return;
    try { await deleteCapacityWindow(id); await load(); } catch (err) { setMessage(err.message || String(err)); }
  }

  return (
    <div className="page capacity-page">
      <div className="page-header-row">
        <div><div className="eyebrow">Production</div><h1>Capacity Planning</h1><p>Schedule available production blocks by employee, then compare available minutes to assigned work.</p></div>
        <button className="button secondary" onClick={load}>Refresh</button>
      </div>
      {message && <div className="notice-card">{message}</div>}

      <div className="metric-grid three">
        <div className="metric-card"><span>Available Capacity</span><strong>{Math.round(totals.capacity)}</strong><small>minutes</small></div>
        <div className="metric-card"><span>Assigned Work</span><strong>{Math.round(totals.assigned)}</strong><small>minutes</small></div>
        <div className="metric-card"><span>Remaining Capacity</span><strong>{Math.round(totals.remaining)}</strong><small>minutes</small></div>
      </div>

      <div className="two-column-grid">
        <section className="card roomy-card">
          <h2>Add Employee / Production Resource</h2>
          <p className="muted">Use employees, teams, or production stations as resources. Examples: Matt, Sarah, Heat Press 1, DTF Team.</p>
          <form onSubmit={addEmployee} className="stacked-form">
            <label>Name<input value={employeeForm.display_name} onChange={(e) => setEmployeeForm({ ...employeeForm, display_name: e.target.value })} required /></label>
            <label>Role<input value={employeeForm.role} onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })} /></label>
            <label>Email<input value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} /></label>
            <button className="button primary" type="submit">Save Employee</button>
          </form>
        </section>

        <section className="card roomy-card">
          <h2>Schedule Production Time Block</h2>
          <form onSubmit={addWindow} className="stacked-form">
            <label>Employee / Resource<select value={windowForm.employee_id} onChange={(e) => setWindowForm({ ...windowForm, employee_id: e.target.value })}>
              <option value="">Unassigned</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.display_name}</option>)}
            </select></label>
            <label>Date<input type="date" value={windowForm.window_date} onChange={(e) => setWindowForm({ ...windowForm, window_date: e.target.value })} required /></label>
            <div className="two-field-row"><label>Start<input type="time" value={windowForm.start_time} onChange={(e) => setWindowForm({ ...windowForm, start_time: e.target.value })} /></label><label>End<input type="time" value={windowForm.end_time} onChange={(e) => setWindowForm({ ...windowForm, end_time: e.target.value })} /></label></div>
            <label>Title<input value={windowForm.title} onChange={(e) => setWindowForm({ ...windowForm, title: e.target.value })} /></label>
            <label>Work Area<input value={windowForm.work_area} onChange={(e) => setWindowForm({ ...windowForm, work_area: e.target.value })} /></label>
            <label>Notes<textarea value={windowForm.notes} onChange={(e) => setWindowForm({ ...windowForm, notes: e.target.value })} /></label>
            <button className="button primary" type="submit">Add Production Block</button>
          </form>
        </section>
      </div>

      <section className="card roomy-card">
        <div className="filter-row"><label>Start <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} /></label><label>End <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} /></label></div>
        <h2>Scheduled Production Blocks</h2>
        <div className="capacity-window-list">
          {windows.map((w) => (
            <div key={w.id} className="capacity-window-card">
              <div><strong>{w.window_date} • {w.start_time?.slice(0,5)}–{w.end_time?.slice(0,5)}</strong><p>{w.employee_name || 'Unassigned'} — {w.title}</p><small>{w.work_area} {w.notes ? `• ${w.notes}` : ''}</small></div>
              <div className="capacity-meter"><span>{Math.round(w.assigned_minutes || 0)} / {Math.round(w.capacity_minutes || 0)} min</span><progress max={Number(w.capacity_minutes || 1)} value={Number(w.assigned_minutes || 0)} /></div>
              <button className="button danger" onClick={() => removeWindow(w.id)}>Delete</button>
            </div>
          ))}
          {!windows.length && <p>No production blocks scheduled for this range.</p>}
        </div>
      </section>
    </div>
  );
}
