import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './PrinterIdleMonitor.css';

// These are manually maintained reminder states, NOT confirmed physical printer modes.
// The Work handoff will replace browser-local data with an audited shared store.
export const MONITORED_PRINTERS = [
  { id: 'roland', name: 'Roland BN2-30', interval: 7 },
  { id: 'omni', name: 'xTool Omni Dual UV', interval: 7 },
];
export function printerDueStatus(item, now = Date.now()) {
  if (!item?.lastPrinted) return { kind: 'unknown', text: 'Last print not recorded' };
  const printed = new Date(item.lastPrinted).getTime();
  if (!Number.isFinite(printed) || printed > now + 60000) return { kind: 'unknown', text: 'Last print needs verification' };
  const interval = Number(item.interval);
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) return { kind: 'unknown', text: 'Set a valid interval' };
  const elapsed = Math.max(0, (now - printed) / 86400000);
  const left = interval - elapsed;
  if (left <= 0) return { kind: 'overdue', text: `Overdue by ${Math.floor(-left) + 1} day(s)` };
  if (left <= Math.min(2, interval / 3)) return { kind: 'soon', text: `Due within ${Math.ceil(left)} day(s)` };
  return { kind: 'ok', text: `${Math.ceil(left)} day(s) until reminder` };
}
function defaults() {
  return Object.fromEntries(MONITORED_PRINTERS.map((p) => [p.id, { interval: p.interval, mode: 'unknown', lastPrinted: '', lastConfirmedAt: '' }]));
}
export default function PrinterIdleMonitor({ compact = false }) {
  const [userId, setUserId] = useState('');
  const [items, setItems] = useState(defaults);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => { if (active) setUserId(data?.user?.id || ''); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user?.id || ''));
    const tick = window.setInterval(() => setNow(Date.now()), 60000);
    return () => { active = false; subscription.unsubscribe(); window.clearInterval(tick); };
  }, []);
  useEffect(() => {
    if (!userId) { setItems(defaults()); return; }
    const key = `sc_printer_idle_v1:${userId}`;
    const reload = () => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(key) || '{}');
        const baseline = defaults();
        for (const p of MONITORED_PRINTERS) {
          const source = saved[p.id] && typeof saved[p.id] === 'object' ? saved[p.id] : {};
          baseline[p.id] = { ...baseline[p.id], ...source };
        }
        setItems(baseline);
      } catch { setItems(defaults()); }
    };
    reload();
    window.addEventListener('storage', reload);
    return () => window.removeEventListener('storage', reload);
  }, [userId]);
  function update(id, changes) {
    if (!userId) return;
    const next = { ...items, [id]: { ...items[id], ...changes } };
    window.localStorage.setItem(`sc_printer_idle_v1:${userId}`, JSON.stringify(next));
    setItems(next);
    setNotice('Saved in this browser only. Not synchronized with Home Assistant or the physical printer.');
  }
  return <section className="printer-idle-panel" aria-label="Printer activity reminders">
    <div className="printer-idle-heading">
      <div><h2>Printer activity reminders</h2><p>Manual tracking on this browser · not verified device telemetry</p></div>
      <Link to="/equipment-center">Equipment & Remote Access</Link>
    </div>
    <div className="printer-idle-grid">{MONITORED_PRINTERS.map((printer) => {
      const item = items[printer.id] || defaults()[printer.id];
      const status = printerDueStatus(item, now);
      return <div className={`printer-idle-card printer-idle-${status.kind}`} key={printer.id}>
        <div className="printer-idle-top"><strong>{printer.name}</strong><span className="printer-idle-status">{status.text}</span></div>
        <div className="printer-idle-date">Last confirmed print: {item.lastPrinted ? new Date(item.lastPrinted).toLocaleDateString() : 'Not recorded'} · Reported mode: {item.mode === 'unknown' ? 'Not verified' : `${item.mode} (manual)`}</div>
        {!compact && <div className="printer-idle-fields">
          <label>Last successful print date<input type="date" value={item.lastPrinted || ''} max={new Date(now).toLocaleDateString('en-CA')} onChange={(e) => update(printer.id, { lastPrinted: e.target.value, lastConfirmedAt: new Date().toISOString() })} /></label>
          <label>Reminder interval (days)<input type="number" min="1" max="365" value={item.interval} onChange={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= 365) update(printer.id, { interval: n }); }} /></label>
          <label>Manually observed mode<select value={item.mode} onChange={(e) => update(printer.id, { mode: e.target.value })}>
            <option value="unknown">Not verified</option><option value="normal">Normal</option><option value="sleep">Sleep</option><option value="vacation">Vacation</option>
          </select></label>
        </div>}
        {!compact && <p className="printer-idle-explain">Selecting Sleep or Vacation records what you observed. It does not send a command to the machine. Use xTool Studio for Omni printhead controls; Roland sleep is managed on the printer.</p>}
      </div>;
    })}</div>
    {compact && <p className="printer-idle-explain">Update dates and modes in Equipment & Remote Access. Reminders are browser-local until the shared Home Assistant bridge is installed.</p>}
    {notice && <p role="status" className="printer-idle-saved">{notice}</p>}
  </section>;
}
