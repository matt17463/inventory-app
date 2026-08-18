import React, { Fragment, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { InlineEditorPanel, TableInlineEditorRow } from './components/UIPrimitives';

const empty = { rule_name: '', decoration_type: '', product_type: '', base_price: '', markup_percent: '', flat_fee: '', notes: '', is_active: true };

export default function PricingRules() {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  async function loadRules() {
    const { data, error } = await supabase.from('sc_pricing_rules').select('*').order('updated_at', { ascending: false });
    if (error) setMessage(error.message); else setRules(data || []);
  }

  useEffect(() => { loadRules(); }, []);

  async function saveRule() {
    setMessage('');
    const payload = {
      ...form,
      base_price: Number(form.base_price || 0),
      markup_percent: Number(form.markup_percent || 0),
      flat_fee: Number(form.flat_fee || 0),
    };
    const res = editingId
      ? await supabase.from('sc_pricing_rules').update(payload).eq('id', editingId)
      : await supabase.from('sc_pricing_rules').insert(payload);
    if (res.error) setMessage(res.error.message);
    else {
      setMessage(editingId ? 'Pricing rule updated.' : 'Pricing rule saved.');
      setForm(empty);
      setEditingId(null);
      loadRules();
    }
  }

  async function deleteRule(id) {
    if (!confirm('Delete this pricing rule?')) return;
    const { error } = await supabase.from('sc_pricing_rules').delete().eq('id', id);
    if (error) setMessage(error.message); else { setMessage('Pricing rule deleted.'); loadRules(); }
  }

  function edit(rule) {
    setEditingId(rule.id);
    setForm({
      rule_name: rule.rule_name || '',
      decoration_type: rule.decoration_type || '',
      product_type: rule.product_type || '',
      base_price: rule.base_price ?? '',
      markup_percent: rule.markup_percent ?? '',
      flat_fee: rule.flat_fee ?? '',
      notes: rule.notes || '',
      is_active: rule.is_active !== false,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(empty);
  }

  function renderRuleForm({ editing = false } = {}) {
    return (
      <div>
        <div className="sc-form-grid sc-form-grid--compact">
          <label className="sc-field"><span>Rule Name</span><input autoFocus={editing} value={form.rule_name} onChange={(e) => setForm({ ...form, rule_name: e.target.value })} /></label>
          <label className="sc-field"><span>Decoration Type</span><input value={form.decoration_type} onChange={(e) => setForm({ ...form, decoration_type: e.target.value })} placeholder="DTF, embroidery, sublimation..." /></label>
          <label className="sc-field"><span>Product Type</span><input value={form.product_type} onChange={(e) => setForm({ ...form, product_type: e.target.value })} placeholder="Hoodie, T-shirt..." /></label>
          <label className="sc-field"><span>Base Price</span><input type="number" step="0.01" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} /></label>
          <label className="sc-field"><span>Markup %</span><input type="number" step="0.01" value={form.markup_percent} onChange={(e) => setForm({ ...form, markup_percent: e.target.value })} /></label>
          <label className="sc-field"><span>Flat Fee</span><input type="number" step="0.01" value={form.flat_fee} onChange={(e) => setForm({ ...form, flat_fee: e.target.value })} /></label>
          <label className="sc-field sc-field-wide"><span>Notes</span><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </div>
        <div className="sc-form-actions sc-inline-editor__actions">
          <button className="sc-btn sc-btn-primary" onClick={saveRule}>{editing ? 'Save Changes' : 'Save Rule'}</button>
          {editing ? <button className="sc-btn" onClick={cancelEdit}>Cancel Edit</button> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="sc-page-stack">
      <div className="sc-page-header-card"><div><div className="sc-kicker">Sales</div><h2>Pricing Rules</h2><p>Create, modify, or delete saved pricing rules used for estimates and quotes.</p></div></div>
      {message && <div className="sc-alert">{message}</div>}

      {!editingId ? (
        <InlineEditorPanel title="Create Pricing Rule" description="New rules begin here. Edits to saved rules open directly beneath their selected row." className="sc-create-panel">
          {renderRuleForm()}
        </InlineEditorPanel>
      ) : null}

      <section className="sc-panel">
        <div className="sc-panel-header"><div><h3>Saved Rules</h3><p>Use Edit to modify a rule directly beneath its row, or Delete to remove it.</p></div></div>
        <div className="sc-responsive-table-wrap">
          <table className="sc-table">
            <thead><tr><th>Name</th><th>Decoration</th><th>Product</th><th>Base</th><th>Markup</th><th>Flat Fee</th><th>Actions</th></tr></thead>
            <tbody>
              {rules.map((rule) => (
                <Fragment key={rule.id}>
                  <tr className={editingId === rule.id ? 'sc-row-being-edited' : ''}>
                    <td>{rule.rule_name}</td><td>{rule.decoration_type || '—'}</td><td>{rule.product_type || '—'}</td><td>${Number(rule.base_price || 0).toFixed(2)}</td><td>{Number(rule.markup_percent || 0)}%</td><td>${Number(rule.flat_fee || 0).toFixed(2)}</td>
                    <td><div className="sc-button-row"><button className="sc-btn sc-btn-small" onClick={() => edit(rule)}>{editingId === rule.id ? 'Editing' : 'Edit'}</button><button className="sc-btn sc-btn-danger sc-btn-small" onClick={() => deleteRule(rule.id)}>Delete</button></div></td>
                  </tr>
                  {editingId === rule.id ? (
                    <TableInlineEditorRow colSpan={7} title={`Modify ${rule.rule_name || 'pricing rule'}`} description="Changes here apply only to the rule immediately above.">
                      {renderRuleForm({ editing: true })}
                    </TableInlineEditorRow>
                  ) : null}
                </Fragment>
              ))}
              {!rules.length && <tr><td colSpan="7" className="sc-empty-cell">No pricing rules saved yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
