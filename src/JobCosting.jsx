import { useEffect, useMemo, useState } from 'react';
import { getPhase4JobCosting, money, savePhase4JobCostSettings } from './lib/inventoryApi';

const EMPTY_FORM = {
  orderRevenue: '',
  decorationCostPerUnit: '',
  laborCostPerUnit: '',
  overheadCost: '',
  shippingRevenue: '',
  shippingCost: '',
  spoilageAllowance: '',
  notes: '',
};

function numberInput(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

export default function JobCosting() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      setRows(await getPhase4JobCosting(search));
    } catch (err) {
      setMessage(err.message || 'Failed to load job costing.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.revenue += Number(row.estimated_total_revenue || 0);
    acc.cost += Number(row.estimated_total_cost || 0);
    acc.profit += Number(row.estimated_gross_profit || 0);
    acc.units += Number(row.total_units || 0);
    return acc;
  }, { revenue: 0, cost: 0, profit: 0, units: 0 }), [rows]);

  function startEdit(row) {
    setEditingJob(row);
    setForm({
      orderRevenue: numberInput(row.order_revenue),
      decorationCostPerUnit: numberInput(row.decoration_cost_per_unit),
      laborCostPerUnit: numberInput(row.labor_cost_per_unit),
      overheadCost: numberInput(row.overhead_cost),
      shippingRevenue: numberInput(row.shipping_revenue),
      shippingCost: numberInput(row.shipping_cost),
      spoilageAllowance: numberInput(row.spoilage_allowance),
      notes: row.costing_notes || '',
    });
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    if (!editingJob) return;
    setLoading(true);
    setMessage('');
    try {
      await savePhase4JobCostSettings({ jobId: editingJob.job_id, ...form });
      setEditingJob(null);
      setForm(EMPTY_FORM);
      setMessage('Job cost settings saved.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to save job cost settings.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Management Intelligence</p>
          <h1>Job Costing & Profitability</h1>
          <p>Estimate margin by combining blank costs, decoration labor, overhead, shipping, spoilage allowance, and order revenue.</p>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="kpi-grid">
        <div className="kpi-card"><span>{money(totals.revenue)}</span><strong>Revenue</strong><small>Visible jobs</small></div>
        <div className="kpi-card"><span>{money(totals.cost)}</span><strong>Estimated cost</strong><small>Blank + labor + overhead</small></div>
        <div className="kpi-card"><span>{money(totals.profit)}</span><strong>Gross profit</strong><small>Estimated</small></div>
        <div className="kpi-card"><span>{totals.units}</span><strong>Units</strong><small>Visible jobs</small></div>
      </section>

      <section className="card elevated-card">
        <h2>Search jobs</h2>
        <div className="inline-form-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search job, customer, order, status..." />
          <button type="button" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Search'}</button>
          <button type="button" onClick={() => { setSearch(''); setTimeout(load, 0); }}>Clear</button>
        </div>
      </section>

      {editingJob && (
        <section className="card elevated-card">
          <h2>Edit costing: {editingJob.job_name || `Job ${editingJob.job_id}`}</h2>
          <form onSubmit={save}>
            <div className="form-grid">
              <label>Order revenue<input type="number" step="0.01" min="0" value={form.orderRevenue} onChange={(e) => updateField('orderRevenue', e.target.value)} /></label>
              <label>Decoration cost / unit<input type="number" step="0.01" min="0" value={form.decorationCostPerUnit} onChange={(e) => updateField('decorationCostPerUnit', e.target.value)} /></label>
              <label>Labor cost / unit<input type="number" step="0.01" min="0" value={form.laborCostPerUnit} onChange={(e) => updateField('laborCostPerUnit', e.target.value)} /></label>
              <label>Overhead cost<input type="number" step="0.01" min="0" value={form.overheadCost} onChange={(e) => updateField('overheadCost', e.target.value)} /></label>
              <label>Shipping revenue<input type="number" step="0.01" min="0" value={form.shippingRevenue} onChange={(e) => updateField('shippingRevenue', e.target.value)} /></label>
              <label>Shipping cost<input type="number" step="0.01" min="0" value={form.shippingCost} onChange={(e) => updateField('shippingCost', e.target.value)} /></label>
              <label>Spoilage allowance<input type="number" step="0.01" min="0" value={form.spoilageAllowance} onChange={(e) => updateField('spoilageAllowance', e.target.value)} /></label>
            </div>
            <label>Notes<textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} /></label>
            <div className="inline-form-row">
              <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Costing'}</button>
              <button type="button" onClick={() => setEditingJob(null)}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      <section className="card table-card">
        <h2>Job Costing</h2>
        <div className="responsive-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Job</th><th>Customer</th><th>Status</th><th>Units</th><th>Blank Cost</th><th>Total Cost</th><th>Revenue</th><th>Profit</th><th>Margin</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.job_id}>
                  <td><strong>{row.job_name || `Job ${row.job_id}`}</strong><br /><small>Order {row.woocommerce_order_id || '—'}</small></td>
                  <td>{row.customer_name}</td>
                  <td>{row.status}</td>
                  <td>{row.total_units}</td>
                  <td>{money(row.estimated_blank_cost)}</td>
                  <td>{money(row.estimated_total_cost)}</td>
                  <td>{money(row.estimated_total_revenue)}</td>
                  <td>{money(row.estimated_gross_profit)}</td>
                  <td>{row.estimated_margin_percent == null ? '—' : `${row.estimated_margin_percent}%`}</td>
                  <td><button type="button" onClick={() => startEdit(row)}>Edit Costs</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="10">No jobs found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
