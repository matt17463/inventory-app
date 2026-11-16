import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import usePrinterActivity from '../lib/usePrinterActivity';
import { shouldSimulateWrites } from '../lib/testingMode';
import { DAY_MS, METRICS, PRINTERS, PRINTER_MODES, SOURCE_LABELS, printerStatus } from '../lib/printerActivity';
import './PrinterIdleMonitor.css';

const STATUS_TEXT = { unknown: 'Last print unknown', overdue: 'Print overdue', soon: 'Print due soon', ok: 'Within reminder interval' };
const MODE_TEXT = { unknown: 'Unknown', normal: 'Normal', sleep: 'Sleep', vacation: 'Vacation' };
const READING_LABELS = { low_power_or_sleep: 'Low power / sleep', firmware_update: 'Firmware update', wifi_setup: 'Wi-Fi setup' };
const formatTime = (value) => value ? new Date(value).toLocaleString() : 'Unknown';
const localTime = (time) => {
  const date = new Date(time);
  return new Date(time - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function PrinterActivitySummary({ row, now, expanded = false }) {
  if (!row) return null;
  const state = printerStatus(row, now);
  const readings = state.telemetry === 'fresh' ? Object.entries(row.readings || {}) : [];
  return <div className="printer-idle-summary">
    <strong className="printer-idle-status">{STATUS_TEXT[state.status]}</strong>
    <p>Last successful print {formatTime(row.last_print_at)}{row.last_print_source ? ` · ${SOURCE_LABELS[row.last_print_source]}` : ''}</p>
    {state.hardware_alerts.length > 0 && <p className="printer-idle-hardware-alert">Maintenance alerts: {state.hardware_alerts.join(', ')}</p>}
    {expanded && <>
      {row.last_print_evidence && <p>Print evidence: {row.last_print_evidence}</p>}
      {state.due_at && <p>Reminder due {formatTime(state.due_at)} · {state.idle_days_elapsed} full days idle</p>}
      <p>Hardware mode: {MODE_TEXT[state.verified_mode]} · Device feed: {state.telemetry}{row.telemetry_at ? ` · ${formatTime(row.telemetry_at)}` : ''}</p>
      <p>Staff observation: {MODE_TEXT[row.staff_observed_mode] || 'Unknown'}{row.staff_observed_at ? ` · ${formatTime(row.staff_observed_at)}` : ''}</p>
      <p>Planned mode: {MODE_TEXT[row.planned_mode]}{state.reminder_snoozed ? ` · Early alerts paused until ${formatTime(row.snoozed_until)}` : ''}</p>
      {readings.length > 0 && <dl className="printer-idle-readings">{readings.map(([key, value]) => {
        const metric = METRICS[row.printer_id][key];
        if (!metric) return null;
        return <div key={key}><dt>{metric[0]}</dt><dd>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : (READING_LABELS[value] || MODE_TEXT[value] || `${value} ${metric[1]}`.trim())}</dd></div>;
      })}</dl>}
    </>}
  </div>;
}

function ModeOptions() {
  return PRINTER_MODES.map((mode) => <option key={mode} value={mode}>{MODE_TEXT[mode]}</option>);
}

function EventForm({ row, kind, now, refresh }) {
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const title = { correction: 'Confirm or correct last print', observation: 'Record observed mode', settings: 'Edit reminder settings' }[kind];

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (shouldSimulateWrites()) {
      setNotice('Training preview. Shared records were left unchanged.');
      return;
    }

    const payload = { printer_id: row.printer_id, kind };
    if (kind === 'correction') {
      const printed = new Date(fields.get('lastPrint'));
      if (!Number.isFinite(printed.getTime()) || printed.getTime() > Date.now()) {
        setNotice('Enter a valid print date and time in the past.');
        return;
      }
      Object.assign(payload, { occurred_at: printed.toISOString(), detail: fields.get('evidence').trim() });
    } else if (kind === 'observation') {
      Object.assign(payload, { observed_mode: fields.get('observedMode'), detail: fields.get('evidence').trim() });
    } else {
      const idleDays = Number(fields.get('idleDays'));
      const warningDays = Number(fields.get('warningDays'));
      const snooze = fields.get('snooze');
      if (warningDays > idleDays || (snooze && !Number.isFinite(Date.parse(snooze)))) {
        setNotice('Enter a valid alert date and a lead time within the reminder interval.');
        return;
      }
      Object.assign(payload, {
        idle_days: idleDays,
        warning_days: warningDays,
        planned_mode: fields.get('plannedMode'),
        snoozed_until: snooze ? new Date(snooze).toISOString() : null,
      });
    }

    setBusy(true);
    try {
      const { error } = await supabase.from('sc_printer_activity_events').insert(payload);
      if (error) throw error;
      setNotice('Saved to shared printer activity.');
      refresh();
    } catch {
      setNotice('Could not save printer activity. Check your access and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <details className="printer-idle-edit"><summary>{title}</summary>
    <form className="printer-idle-fields" onSubmit={submit}>
      {kind === 'correction' && <label>Successful print time<input name="lastPrint" type="datetime-local" required max={localTime(now)} defaultValue={row.last_print_at ? localTime(Date.parse(row.last_print_at)) : ''} /></label>}
      {kind === 'observation' && <label>Mode shown on the printer or in its software<select name="observedMode" defaultValue={row.staff_observed_mode || 'unknown'}><ModeOptions /></select></label>}
      {kind === 'correction' && <label>Job reference or reason for correction<input name="evidence" required maxLength={200} /></label>}
      {kind === 'observation' && <label>Where you checked the mode<input name="evidence" required maxLength={200} /></label>}
      {kind === 'settings' && <>
        <label>Maximum idle days<input name="idleDays" type="number" min="1" max="365" required defaultValue={row.idle_days} /></label>
        <label>Warning lead days<input name="warningDays" type="number" min="0" max="365" required defaultValue={row.warning_days} /></label>
        <label>Planned mode<select name="plannedMode" defaultValue={row.planned_mode}><ModeOptions /></select></label>
        <label>Pause early alerts until<input name="snooze" type="datetime-local" max={localTime(now + 30 * DAY_MS)} defaultValue={Date.parse(row.snoozed_until) > now ? localTime(Date.parse(row.snoozed_until)) : ''} /></label>
      </>}
      <div className="printer-idle-submit"><button className="eq-button" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      {notice && <p role="status" className="printer-idle-saved">{notice}</p>}
    </form>
  </details>;
}

export default function PrinterIdleMonitor() {
  const activity = usePrinterActivity();
  return <PrinterActivityPanel activity={activity} compact />;
}

export function PrinterActivityPanel({ activity, compact = false }) {
  const { rows, role, now, refresh, loading, unavailable } = activity;
  const canConfigure = ['admin', 'manager'].includes(role);
  return <section className="printer-idle-panel" aria-label="Printer activity reminders">
    <div className="printer-idle-heading">
      <h2 id={compact ? undefined : 'printer-activity'}>Printer activity reminders</h2>
      {compact && <Link to="/equipment-center#printer-activity">Equipment & Remote Access</Link>}
    </div>
    {!rows.length && <p role="status">{loading ? 'Loading shared printer activity…' : unavailable ? 'Shared printer activity is unavailable.' : 'Shared printer activity requires equipment access.'}</p>}
    <div className="printer-idle-grid">{PRINTERS.map((printer) => {
      const row = rows.find((entry) => entry.printer_id === printer.id);
      if (!row) return null;
      return <div className={`printer-idle-card printer-idle-${printerStatus(row, now).status}`} key={printer.id}>
        <h3>{printer.name}</h3>
        <PrinterActivitySummary row={row} now={now} expanded={!compact} />
        {!compact && (canConfigure || role === 'operator') && <>
          <EventForm row={row} kind="correction" now={now} refresh={refresh} />
          <EventForm row={row} kind="observation" now={now} refresh={refresh} />
          {canConfigure && <EventForm row={row} kind="settings" now={now} refresh={refresh} />}
          <p className="printer-idle-explain">Record production prints only. Make Omni sleep or vacation changes in xTool Studio. Early alert pauses and planned modes leave overdue reminders visible.</p>
        </>}
      </div>;
    })}</div>
  </section>;
}
