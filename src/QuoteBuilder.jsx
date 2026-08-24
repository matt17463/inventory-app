import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPhase5Quote, getPhase5Quotes, money } from './lib/inventoryApi';
import { supabase } from './supabaseClient';

const emptyForm = { customerName: '', quoteTitle: '', notes: '' };
const emptyItem = { description: '', quantity: 12, blankCost: 8, decorationCost: 6, laborCost: 2, priceEach: 24 };

function normalizeRule(rule) {
  const markupMultiplier = Number(rule.markup_multiplier || 0) || (Number(rule.markup_percent || 0) ? 1 + Number(rule.markup_percent || 0) / 100 : 0);
  return {
    id: rule.id,
    rule_name: rule.rule_name || rule.name || 'Pricing rule',
    product_type: rule.product_type || '',
    decoration_type: rule.decoration_type || '',
    base_price: Number(rule.base_price || 0),
    markup_percent: Number(rule.markup_percent || 0),
    markup_multiplier: markupMultiplier || 2,
    decoration_cost: Number(rule.decoration_cost || rule.flat_fee || 0),
    setup_fee: Number(rule.setup_fee || 0),
    minimum_margin_percent: Number(rule.minimum_margin_percent || 0),
    active: rule.active ?? rule.is_active ?? true,
    notes: rule.notes || '',
  };
}

export default function QuoteBuilder() {
  const [quotes, setQuotes] = useState([]);
  const [rules, setRules] = useState([]);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [item, setItem] = useState(emptyItem);

  const loadRules = useCallback(async () => {
    const rpc = await supabase.rpc('sc_quote_builder_pricing_rules');
    if (!rpc.error) return (rpc.data || []).map(normalizeRule).filter((r) => r.active !== false);

    const current = await supabase.from('sc_pricing_rules').select('*').order('updated_at', { ascending: false });
    if (!current.error) return (current.data || []).map(normalizeRule).filter((r) => r.active !== false);

    const legacy = await supabase.from('phase5_pricing_rules').select('*').order('rule_name', { ascending: true });
    if (!legacy.error) return (legacy.data || []).map(normalizeRule).filter((r) => r.active !== false);

    throw rpc.error || current.error || legacy.error;
  }, []);

  const load = useCallback(async () => {
    try {
      const [q, r] = await Promise.all([getPhase5Quotes('open'), loadRules()]);
      setQuotes(q);
      setRules(r);
      setMessage('');
    } catch (err) {
      setMessage(err.message || 'Failed to load quote data.');
    }
  }, [loadRules]);

  useEffect(() => { load(); }, [load]);

  const selectedRule = useMemo(() => rules.find((rule) => String(rule.id) === String(selectedRuleId)), [rules, selectedRuleId]);
  const costEach = Number(item.blankCost || 0) + Number(item.decorationCost || 0) + Number(item.laborCost || 0);
  const profitEach = Number(item.priceEach || 0) - costEach;
  const margin = Number(item.priceEach || 0) > 0 ? (profitEach / Number(item.priceEach || 0)) * 100 : 0;

  function applyRule(rule) {
    if (!rule) return;
    const blankCost = Number(item.blankCost || 0);
    const decorationCost = Number(rule.decoration_cost || 0);
    const setupPerUnit = Number(item.quantity || 1) > 0 ? Number(rule.setup_fee || 0) / Number(item.quantity || 1) : 0;
    const baseCost = blankCost + decorationCost + Number(item.laborCost || 0) + setupPerUnit;
    const suggestedPrice = rule.base_price > 0 ? rule.base_price : baseCost * Number(rule.markup_multiplier || 2);
    setItem((current) => ({
      ...current,
      decorationCost: decorationCost.toFixed(2),
      priceEach: suggestedPrice.toFixed(2),
      description: current.description || [rule.product_type, rule.decoration_type].filter(Boolean).join(' with '),
    }));
  }

  async function create(e) {
    e.preventDefault();
    try {
      await createPhase5Quote({ ...form, items: [{ ...item, pricing_rule_id: selectedRuleId || null, pricing_rule_snapshot: selectedRule || null }] });
      setForm(emptyForm);
      setItem(emptyItem);
      setSelectedRuleId('');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to create quote.');
    }
  }

  return (
    <main className="page quote-builder-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Sales + Profit</p>
          <h1>Quote Builder</h1>
          <p>Create quotes using saved Pricing Rules, blank cost, decoration cost, labor, sell price, profit, and margin.</p>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="content-two-column wide-two-column">
        <form className="card elevated-card" onSubmit={create}>
          <h2>New Quote</h2>
          <div className="form-grid">
            <label>Customer<input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></label>
            <label>Quote Title<input value={form.quoteTitle} onChange={(e) => setForm({ ...form, quoteTitle: e.target.value })} /></label>
            <label>
              Pricing Rule
              <select value={selectedRuleId} onChange={(e) => { setSelectedRuleId(e.target.value); const rule = rules.find((r) => String(r.id) === e.target.value); if (rule) applyRule(rule); }}>
                <option value="">Choose a saved pricing rule...</option>
                {rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.rule_name} {rule.product_type ? `— ${rule.product_type}` : ''}</option>)}
              </select>
            </label>
          </div>

          {selectedRule && (
            <div className="pricing-rule-select-card">
              <strong>{selectedRule.rule_name}</strong>
              <p>{selectedRule.product_type || 'Any product'} · {selectedRule.decoration_type || 'Any decoration'} · {selectedRule.markup_percent ? `${selectedRule.markup_percent}% markup` : `${selectedRule.markup_multiplier}x markup`} · {money(selectedRule.decoration_cost)} decoration</p>
              {selectedRule.notes && <small>{selectedRule.notes}</small>}
            </div>
          )}

          <label>Item Description<input value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} placeholder="Gildan 18500 Navy hoodie with left chest logo" /></label>
          <div className="form-grid">
            <label>Qty<input type="number" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} /></label>
            <label>Blank Cost<input type="number" step="0.01" value={item.blankCost} onChange={(e) => setItem({ ...item, blankCost: e.target.value })} /></label>
            <label>Decoration<input type="number" step="0.01" value={item.decorationCost} onChange={(e) => setItem({ ...item, decorationCost: e.target.value })} /></label>
            <label>Labor<input type="number" step="0.01" value={item.laborCost} onChange={(e) => setItem({ ...item, laborCost: e.target.value })} /></label>
            <label>Price Each<input type="number" step="0.01" value={item.priceEach} onChange={(e) => setItem({ ...item, priceEach: e.target.value })} /></label>
          </div>
          <p><strong>Estimated margin:</strong> {margin.toFixed(1)}% · <strong>Profit:</strong> {money(profitEach * Number(item.quantity || 0))}</p>
          <label>Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <button className="button primary">Create Quote</button>
        </form>

        <section className="card elevated-card">
          <h2>Pricing Rules Snapshot</h2>
          <p className="helper-text">This now reads from the same saved rules used on the Pricing Rules page.</p>
          {rules.length === 0 ? <p>No pricing rules yet.</p> : rules.slice(0, 10).map((rule) => (
            <div key={rule.id} className="compact-row pricing-rule-select-card">
              <strong>{rule.rule_name}</strong>
              <span>{rule.product_type || 'Any product'} · {rule.decoration_type || 'Any decoration'} · {rule.markup_percent ? `${rule.markup_percent}% markup` : `${rule.markup_multiplier}x markup`} · {money(rule.decoration_cost)} decoration</span>
              <button type="button" className="button" onClick={() => { setSelectedRuleId(rule.id); applyRule(rule); }}>Use Rule</button>
            </div>
          ))}
        </section>
      </section>

      <section className="card elevated-card table-card">
        <h2>Recent Quotes</h2>
        <div className="responsive-table">
          <table className="data-table">
            <thead><tr><th>Quote</th><th>Customer</th><th>Status</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin</th></tr></thead>
            <tbody>{quotes.length === 0 ? <tr><td colSpan="7">No quotes yet.</td></tr> : quotes.map((q) => <tr key={q.id}><td>{q.quote_number}<br /><small>{q.quote_title}</small></td><td>{q.customer_name}</td><td>{q.status}</td><td>{money(q.total_revenue)}</td><td>{money(q.total_cost)}</td><td>{money(q.estimated_profit)}</td><td>{Number(q.estimated_margin_percent || 0).toFixed(1)}%</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
