import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { getPhase5ProductionTimeRules, savePhase5ProductionTimeRule } from './lib/inventoryApi';

const defaultForm = {
  ruleName: 'DTF Pressing',
  decorationType: 'DTF',
  setupMinutes: 20,
  secondsPerUnit: 60,
  qcSecondsPerUnit: 20,
  packingSecondsPerUnit: 20,
};

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function estimateHours(values) {
  const totalMinutes =
    number(values.setupMinutes) +
    (number(values.quantity) * (number(values.secondsPerUnit) + number(values.qcSecondsPerUnit) + number(values.packingSecondsPerUnit))) / 60;
  return {
    totalMinutes,
    totalHours: totalMinutes / 60,
  };
}

export default function ProductionEstimator() {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [estimate, setEstimate] = useState({
    quantity: 48,
    setupMinutes: 20,
    secondsPerUnit: 60,
    qcSecondsPerUnit: 20,
    packingSecondsPerUnit: 20,
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      setRules(await getPhase5ProductionTimeRules());
      setMessage('');
    } catch (err) {
      setMessage(err.message || 'Failed to load estimator.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    try {
      await savePhase5ProductionTimeRule(form);
      setForm(defaultForm);
      await load();
      setMessage('Time rule saved.');
    } catch (err) {
      setMessage(err.message || 'Failed to save rule.');
    }
  }

  async function deleteRule(rule) {
    const label = rule.rule_name || 'this rule';
    if (!window.confirm(`Delete saved time rule “${label}”? This only removes the rule; it does not delete jobs.`)) return;
    setDeletingId(rule.id);
    setMessage('');
    try {
      const { error } = await supabase.from('phase5_production_time_rules').delete().eq('id', rule.id);
      if (error) throw error;
      await load();
      setMessage('Time rule deleted.');
    } catch (err) {
      setMessage(err.message || 'Failed to delete rule.');
    } finally {
      setDeletingId(null);
    }
  }

  function applyRule(rule) {
    setEstimate({
      ...estimate,
      setupMinutes: rule.setup_minutes ?? 0,
      secondsPerUnit: rule.seconds_per_unit ?? 0,
      qcSecondsPerUnit: rule.qc_seconds_per_unit ?? 0,
      packingSecondsPerUnit: rule.packing_seconds_per_unit ?? 0,
    });
    setForm({
      ruleName: rule.rule_name || '',
      decorationType: rule.decoration_type || '',
      setupMinutes: rule.setup_minutes ?? 0,
      secondsPerUnit: rule.seconds_per_unit ?? 0,
      qcSecondsPerUnit: rule.qc_seconds_per_unit ?? 0,
      packingSecondsPerUnit: rule.packing_seconds_per_unit ?? 0,
    });
    document.querySelector('.production-estimator-grid')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }

  const totals = useMemo(() => estimateHours(estimate), [estimate]);

  return (
    <main className="page production-estimator-page">
      <section className="page-header production-page-header">
        <div>
          <p className="eyebrow">Production</p>
          <h1>Production Time Estimator</h1>
          <p>Estimate setup, pressing, QC, and packing time. Save common production rules and delete outdated duplicates individually.</p>
        </div>
        <button className="secondary-button" type="button" onClick={load}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </section>

      {message && <p className="message production-message">{message}</p>}

      <section className="production-estimator-grid">
        <section className="card elevated-card production-estimator-card">
          <h2>Quick Estimate</h2>
          <p className="helper-text">Use this before scheduling a job. Enter the quantity and expected seconds per unit.</p>
          <div className="production-form-grid compact">
            <label>Quantity<input type="number" min="0" value={estimate.quantity} onChange={e=>setEstimate({...estimate,quantity:e.target.value})}/></label>
            <label>Setup Min<input type="number" min="0" value={estimate.setupMinutes} onChange={e=>setEstimate({...estimate,setupMinutes:e.target.value})}/></label>
            <label>Press Sec/Unit<input type="number" min="0" value={estimate.secondsPerUnit} onChange={e=>setEstimate({...estimate,secondsPerUnit:e.target.value})}/></label>
            <label>QC Sec/Unit<input type="number" min="0" value={estimate.qcSecondsPerUnit} onChange={e=>setEstimate({...estimate,qcSecondsPerUnit:e.target.value})}/></label>
            <label>Pack Sec/Unit<input type="number" min="0" value={estimate.packingSecondsPerUnit} onChange={e=>setEstimate({...estimate,packingSecondsPerUnit:e.target.value})}/></label>
          </div>
          <div className="production-big-estimate">
            <span>{totals.totalHours.toFixed(2)} hrs</span>
            <small>{Math.round(totals.totalMinutes)} total minutes</small>
          </div>
        </section>

        <form className="card elevated-card production-estimator-card" onSubmit={save}>
          <h2>Save Time Rule</h2>
          <p className="helper-text">Save reusable rules such as “Single Sided DTF,” “Full Front + Back,” or “Embroidery Estimate.”</p>
          <label>Rule Name<input value={form.ruleName} onChange={e=>setForm({...form,ruleName:e.target.value})}/></label>
          <label>Decoration Type<input value={form.decorationType} onChange={e=>setForm({...form,decorationType:e.target.value})}/></label>
          <div className="production-form-grid compact">
            <label>Setup Min<input type="number" min="0" value={form.setupMinutes} onChange={e=>setForm({...form,setupMinutes:e.target.value})}/></label>
            <label>Press Sec<input type="number" min="0" value={form.secondsPerUnit} onChange={e=>setForm({...form,secondsPerUnit:e.target.value})}/></label>
            <label>QC Sec<input type="number" min="0" value={form.qcSecondsPerUnit} onChange={e=>setForm({...form,qcSecondsPerUnit:e.target.value})}/></label>
            <label>Pack Sec<input type="number" min="0" value={form.packingSecondsPerUnit} onChange={e=>setForm({...form,packingSecondsPerUnit:e.target.value})}/></label>
          </div>
          <button className="primary-button" type="submit">Save Rule</button>
        </form>
      </section>

      <section className="card elevated-card production-rules-card">
        <div className="section-title-row">
          <div>
            <h2>Saved Time Rules</h2>
            <p className="helper-text">Delete duplicates or outdated rules with the Delete button on each row.</p>
          </div>
          <span className="count-pill">{rules.length} rules</span>
        </div>
        <div className="production-rule-list">
          {rules.length === 0 ? <p className="helper-text">No time rules yet.</p> : rules.map(rule => (
            <article className="production-rule-card" key={rule.id}>
              <div className="production-rule-main">
                <h3>{rule.rule_name}</h3>
                <span className="status-chip">{rule.decoration_type || 'Any decoration'}</span>
              </div>
              <div className="production-rule-metrics">
                <span><strong>{rule.setup_minutes}</strong><small>setup min</small></span>
                <span><strong>{rule.seconds_per_unit}</strong><small>press sec/unit</small></span>
                <span><strong>{rule.qc_seconds_per_unit}</strong><small>QC sec/unit</small></span>
                <span><strong>{rule.packing_seconds_per_unit}</strong><small>pack sec/unit</small></span>
              </div>
              <div className="production-rule-actions">
                <button className="secondary-button small-button" type="button" onClick={() => applyRule(rule)}>Use Rule</button>
                <button className="danger-button small-button" type="button" disabled={deletingId === rule.id} onClick={() => deleteRule(rule)}>{deletingId === rule.id ? 'Deleting…' : 'Delete'}</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
