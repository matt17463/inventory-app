import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader, SectionCard, ActionButton, EmptyState, StatusBadge } from './components/UIPrimitives';
import {
  NON_INVENTORY_RULE_TYPES,
  applyNonInventoryRulesToOpenJobs,
  listNonInventoryRules,
  saveNonInventoryRule,
  setNonInventoryRuleActive,
} from './lib/nonInventoryApi';

const defaultReason = 'No inventory tracking required for this WooCommerce item.';

const emptyRule = {
  id: null,
  rule_type: 'exact_sku',
  match_value: '',
  label: '',
  reason: defaultReason,
  priority: 100,
  is_active: true,
  include_on_purchasing_report: true,
};

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function ruleTypeLabel(type) {
  return NON_INVENTORY_RULE_TYPES.find((item) => item.value === type)?.label || type;
}

function messageTone(message) {
  const lower = String(message || '').toLowerCase();
  return lower.includes('could not') || lower.includes('enter') || lower.includes('error') || lower.includes('required') || lower.includes('invalid') ? 'warning' : 'default';
}

function exampleForRuleType(ruleType) {
  switch (ruleType) {
    case 'exact_sku':
      return 'Example: ARTWORK-FEE';
    case 'sku_contains':
      return 'Example: RUSH or CUSTOM-NAME';
    case 'sku_prefix':
      return 'Example: SERVICE-';
    case 'sku_regex':
      return 'Example: ^FEE-[0-9]+$';
    case 'woo_product_id':
      return 'Example: 12345';
    case 'woo_variation_id':
      return 'Example: 12346';
    case 'product_name_contains':
      return 'Example: Artwork fee';
    default:
      return 'Enter the value this rule should match.';
  }
}

export default function NonInventoryRules() {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(emptyRule);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('');
  const [applyBusy, setApplyBusy] = useState(false);

  async function load({ preserveMessage = false } = {}) {
    setLoading(true);
    if (!preserveMessage) setMessage('');
    try {
      const rows = await listNonInventoryRules();
      setRules(rows);
    } catch (err) {
      setMessage(err.message || 'Could not load non-inventory rules.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredRules = useMemo(() => {
    const tokens = filter.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return rules;
    return rules.filter((rule) => {
      const haystack = [
        rule.rule_type,
        rule.match_value,
        rule.label,
        rule.reason,
        rule.is_active ? 'active' : 'inactive',
        rule.include_on_purchasing_report ? 'purchasing included' : 'purchasing excluded',
      ].join(' ').toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [rules, filter]);

  async function submitRule(event) {
    event.preventDefault();

    const matchValue = String(form.match_value || '').trim();
    if (!matchValue) {
      setMessage('Enter a value to match before saving.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const saved = await saveNonInventoryRule({ ...form, match_value: matchValue });
      setForm(emptyRule);
      await load({ preserveMessage: true });
      setMessage(`Saved non-inventory rule${saved?.id ? ` #${saved.id}` : ''}. Future pull sheets will use this rule.`);
    } catch (err) {
      setMessage(err.message || 'Could not save rule.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule) {
    setMessage('');
    try {
      await setNonInventoryRuleActive(rule.id, !rule.is_active);
      await load({ preserveMessage: true });
      setMessage(`Rule #${rule.id} ${rule.is_active ? 'deactivated' : 'activated'}.`);
    } catch (err) {
      setMessage(err.message || 'Could not update rule.');
    }
  }

  async function applyRules() {
    const confirmed = window.confirm('Apply active non-inventory rules to open pull sheets? Matching lines will become non-inventory and each rule will apply its purchasing-report setting.');
    if (!confirmed) return;
    setApplyBusy(true);
    setMessage('');
    try {
      const rows = await applyNonInventoryRulesToOpenJobs(1000);
      setMessage(`Applied rules to ${rows.length} open pull sheet line${rows.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setMessage(err.message || 'Could not apply rules to open pull sheets.');
    } finally {
      setApplyBusy(false);
    }
  }

  function editRule(rule) {
    setForm({
      id: rule.id,
      rule_type: rule.rule_type || 'exact_sku',
      match_value: rule.match_value || '',
      label: rule.label || '',
      reason: rule.reason || defaultReason,
      priority: rule.priority || 100,
      is_active: rule.is_active !== false,
      include_on_purchasing_report: rule.include_on_purchasing_report !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setForm(emptyRule);
    setMessage('');
  }

  return (
    <main className="sc-page sc-non-inventory-rules-page">
      <PageHeader
        eyebrow="TOOLS & ADMIN"
        title="Non-Inventory Product Rules"
        description="Mark WooCommerce items as non-inventory while separately deciding whether matching lines should remain on the Purchasing Report."
        actions={(
          <div className="sc-button-row">
            <ActionButton tone="secondary" onClick={() => load()}>Refresh</ActionButton>
            <ActionButton tone="primary" disabled={applyBusy} onClick={applyRules}>{applyBusy ? 'Applying…' : 'Apply Rules to Open Pull Sheets'}</ActionButton>
          </div>
        )}
      />

      {message ? (
        <SectionCard tone={messageTone(message)}>
          <p>{message}</p>
        </SectionCard>
      ) : null}

      <SectionCard title={form.id ? `Edit Rule #${form.id}` : 'Create Non-Inventory Rule'}>
        <form className="sc-form-grid" onSubmit={submitRule}>
          <label>
            <span>Rule Type</span>
            <select
              value={form.rule_type}
              onChange={(event) => setForm((current) => ({ ...current, rule_type: event.target.value }))}
            >
              {NON_INVENTORY_RULE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Match Value</span>
            <input
              value={form.match_value}
              onChange={(event) => setForm((current) => ({ ...current, match_value: event.target.value }))}
              placeholder={exampleForRuleType(form.rule_type)}
            />
          </label>

          <label>
            <span>Label</span>
            <input
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              placeholder="Example: Artwork fee"
            />
          </label>

          <label>
            <span>Priority</span>
            <input
              type="number"
              value={form.priority}
              onChange={(event) => setForm((current) => ({ ...current, priority: Number(event.target.value || 100) }))}
            />
          </label>

          <label className="sc-form-wide">
            <span>Reason shown on pull sheet</span>
            <input
              value={form.reason}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
            />
          </label>

          <label className="sc-checkbox-line sc-form-wide">
            <input
              type="checkbox"
              checked={form.include_on_purchasing_report}
              onChange={(event) => setForm((current) => ({
                ...current,
                include_on_purchasing_report: event.target.checked,
              }))}
            />
            <span>
              <strong>Include matching lines on the Purchasing Report</strong><br />
              <small className="sc-muted">
                Turn this off for fees, services, customer-supplied products, and
                other lines that do not need to be ordered.
              </small>
            </span>
          </label>

          <label className="sc-checkbox-line">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
            />
            <span>Active</span>
          </label>

          <div className="sc-button-row sc-form-wide">
            <ActionButton type="submit" tone="primary" disabled={saving}>
              {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Save Rule'}
            </ActionButton>
            {form.id ? (
              <ActionButton type="button" tone="secondary" onClick={resetForm}>Cancel Edit</ActionButton>
            ) : null}
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Existing Rules"
        actions={<input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search rules…" />}
      >
        {loading ? <p>Loading rules…</p> : null}
        {!loading && !filteredRules.length ? (
          <EmptyState title="No rules found" description="Create a rule to tell pull sheets which WooCommerce lines do not require inventory." />
        ) : null}
        {filteredRules.length ? (
          <div className="sc-table-wrap">
            <table className="sc-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Match</th>
                  <th>Label / Reason</th>
                  <th>Priority</th>
                  <th>Purchasing</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => (
                  <tr key={rule.id}>
                    <td><StatusBadge status={rule.is_active ? 'Active' : 'Inactive'} tone={rule.is_active ? 'success' : 'default'} /></td>
                    <td>{ruleTypeLabel(rule.rule_type)}</td>
                    <td><code>{rule.match_value}</code></td>
                    <td>
                      <strong>{rule.label || '—'}</strong><br />
                      <span className="sc-muted">{rule.reason || 'No inventory tracking required'}</span>
                    </td>
                    <td>{rule.priority}</td>
                    <td>
                      <StatusBadge
                        status={rule.include_on_purchasing_report ? 'Included' : 'Excluded'}
                        tone={rule.include_on_purchasing_report ? 'info' : 'default'}
                      />
                    </td>
                    <td>{formatDate(rule.updated_at || rule.created_at)}</td>
                    <td>
                      <div className="sc-button-row">
                        <ActionButton tone="secondary" onClick={() => editRule(rule)}>Edit</ActionButton>
                        <ActionButton tone={rule.is_active ? 'warning' : 'success'} onClick={() => toggleRule(rule)}>
                          {rule.is_active ? 'Deactivate' : 'Activate'}
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>
    </main>
  );
}
