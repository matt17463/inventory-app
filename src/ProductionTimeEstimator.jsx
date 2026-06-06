import React, { useEffect, useMemo, useState } from 'react';
import {
  listProductionTimeRules,
  saveProductionTimeRule,
  deleteProductionTimeRule,
  estimateProductionTime,
} from './lib/productionSchedulingApi';

const emptyRule = {
  rule_name: '',
  production_type: 'DTF',
  setup_minutes: 10,
  minutes_per_item: 1,
  cleanup_minutes: 5,
  default_quantity: 24,
  active: true,
  notes: '',
};

export default function ProductionTimeEstimator() {
  const [rules, setRules] = useState([]);
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [quantity, setQuantity] = useState(24);
  const [estimate, setEstimate] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const rows = await listProductionTimeRules();
      setRules(rows);
      if (!selectedRuleId && rows[0]) setSelectedRuleId(rows[0].id);
    } catch (e) {
      setMessage(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const selectedRule = useMemo(() => rules.find((r) => r.id === selectedRuleId), [rules, selectedRuleId]);

  async function saveRule(e) {
    e.preventDefault();
    setMessage('');
    try {
      await saveProductionTimeRule(ruleForm);
      setRuleForm(emptyRule);
      await load();
      setMessage('Time rule saved.');
    } catch (err) {
      setMessage(err.message || String(err));
    }
  }

  async function handleDeleteRule(id) {
    if (!confirm('Delete this saved time rule?')) return;
    setMessage('');
    try {
      await deleteProductionTimeRule(id);
      if (selectedRuleId === id) setSelectedRuleId('');
      await load();
      setMessage('Time rule deleted.');
    } catch (err) {
      setMessage(err.message || String(err));
    }
  }

  async function runEstimate(e) {
    e.preventDefault();
    setMessage('');
    if (!selectedRuleId) {
      setMessage('Choose a time rule first.');
      return;
    }
    try {
      setEstimate(await estimateProductionTime(selectedRuleId, quantity));
    } catch (err) {
      setMessage(err.message || String(err));
    }
  }

  return (
    <div className="page production-time-page">
      <div className="page-header-row">
        <div>
          <div className="eyebrow">Production</div>
          <h1>Production Time Estimator</h1>
          <p>Build reusable production time rules, estimate job duration, and delete outdated rules individually.</p>
        </div>
        <button className="button secondary" onClick={load}>{loading ? 'Loading...' : 'Refresh'}</button>
      </div>

      {message && <div className="notice-card">{message}</div>}

      <div className="two-column-grid">
        <section className="card roomy-card">
          <h2>Create Time Rule</h2>
          <p className="muted">Use rules for common production types such as DTF front print, left chest, full back, QC, or packing.</p>
          <form onSubmit={saveRule} className="stacked-form">
            <label>Rule Name<input value={ruleForm.rule_name} onChange={(e) => setRuleForm({ ...ruleForm, rule_name: e.target.value })} placeholder="DTF front print" required /></label>
            <label>Production Type<input value={ruleForm.production_type} onChange={(e) => setRuleForm({ ...ruleForm, production_type: e.target.value })} /></label>
            <div className="three-field-row">
              <label>Setup Minutes<input type="number" step="0.01" value={ruleForm.setup_minutes} onChange={(e) => setRuleForm({ ...ruleForm, setup_minutes: e.target.value })} /></label>
              <label>Minutes Per Item<input type="number" step="0.01" value={ruleForm.minutes_per_item} onChange={(e) => setRuleForm({ ...ruleForm, minutes_per_item: e.target.value })} /></label>
              <label>Cleanup Minutes<input type="number" step="0.01" value={ruleForm.cleanup_minutes} onChange={(e) => setRuleForm({ ...ruleForm, cleanup_minutes: e.target.value })} /></label>
            </div>
            <label>Default Quantity<input type="number" value={ruleForm.default_quantity} onChange={(e) => setRuleForm({ ...ruleForm, default_quantity: e.target.value })} /></label>
            <label>Notes<textarea value={ruleForm.notes} onChange={(e) => setRuleForm({ ...ruleForm, notes: e.target.value })} /></label>
            <button className="button primary" type="submit">Save Time Rule</button>
          </form>
        </section>

        <section className="card roomy-card">
          <h2>Estimate a Job</h2>
          <form onSubmit={runEstimate} className="stacked-form">
            <label>Saved Rule<select value={selectedRuleId} onChange={(e) => setSelectedRuleId(e.target.value)}>
              <option value="">Choose rule</option>
              {rules.map((r) => <option key={r.id} value={r.id}>{r.rule_name} — {r.production_type}</option>)}
            </select></label>
            <label>Quantity<input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
            <button className="button primary" type="submit">Estimate Time</button>
          </form>
          {estimate && (
            <div className="estimate-result">
              <h3>{estimate.rule_name}</h3>
              <p><strong>{estimate.total_minutes}</strong> minutes / <strong>{estimate.total_hours}</strong> hours</p>
              <p className="muted">Setup {estimate.setup_minutes} + Qty {estimate.quantity} × {estimate.minutes_per_item} + Cleanup {estimate.cleanup_minutes}</p>
            </div>
          )}
          {selectedRule && <p className="muted">Selected rule notes: {selectedRule.notes || 'None'}</p>}
        </section>
      </div>

      <section className="card roomy-card">
        <h2>Saved Time Rules</h2>
        <div className="responsive-table-wrap">
          <table className="clean-table">
            <thead><tr><th>Rule</th><th>Type</th><th>Setup</th><th>Per Item</th><th>Cleanup</th><th>Default Qty</th><th>Action</th></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.rule_name}</strong><br /><span className="muted">{r.notes}</span></td>
                  <td>{r.production_type}</td>
                  <td>{r.setup_minutes}</td>
                  <td>{r.minutes_per_item}</td>
                  <td>{r.cleanup_minutes}</td>
                  <td>{r.default_quantity}</td>
                  <td><button className="button danger" onClick={() => handleDeleteRule(r.id)}>Delete</button></td>
                </tr>
              ))}
              {!rules.length && <tr><td colSpan="7">No time rules saved yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
