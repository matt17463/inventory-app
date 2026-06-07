import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { PageHeader, HelpPanel, SectionCard, StatusBadge, ActionButton, MetricCard, EmptyState, ResponsiveTable } from './components/UIPrimitives';

const FILTERS = [
  ['all', 'All issues'],
  ['missing_barcode', 'Missing barcode'],
  ['missing_unit_cost', 'Missing cost'],
  ['missing_supplier', 'Missing supplier'],
  ['missing_color', 'Missing color'],
  ['missing_size', 'Missing size'],
  ['missing_blank_product_link', 'Missing blank link'],
  ['excluded_from_blank_mapping', 'Excluded products'],
];

export default function ProductDataHealth() {
  const [summary, setSummary] = useState([]);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(selected = filter) {
    setLoading(true); setError('');
    const [summaryResult, reportResult] = await Promise.all([
      supabase.rpc('phase6_product_data_health_summary'),
      supabase.rpc('phase6_product_data_health_report', { p_issue_type: selected }),
    ]);
    if (summaryResult.error) setError(summaryResult.error.message);
    else setSummary(summaryResult.data || []);
    if (reportResult.error) setError(reportResult.error.message);
    else setRows(reportResult.data || []);
    setLoading(false);
  }

  useEffect(() => { load('all'); }, []);

  const totalIssues = useMemo(() => rows.length, [rows]);

  return (
    <main className="sc-page sc-product-health-page">
      <PageHeader
        eyebrow="TOOLS & ADMIN"
        title="Product Data Health"
        description="Find products with missing attributes, cost, barcode, supplier data, or mapping problems. Excluded non-blank products are shown separately from true blank apparel issues."
        actions={<ActionButton tone="secondary" onClick={() => load(filter)}>Refresh</ActionButton>}
      />
      <HelpPanel>
        <p>Use this page as a cleanup checklist. True issues should be repaired. Excluded products are usually mugs, sublimation items, parent products, fees, or other non-blank products intentionally left out of blank inventory mapping.</p>
      </HelpPanel>
      <div className="sc-metric-grid">
        <MetricCard label="Visible Issues" value={totalIssues} tone={totalIssues ? 'warning' : 'success'} note="Based on the selected filter" />
        {summary.slice(0, 5).map((s) => <MetricCard key={s.issue_type || s.metric_key} label={(s.issue_type || s.metric_label || 'Issue').replace(/_/g, ' ')} value={s.issue_count || s.count || s.metric_value || 0} tone="default" />)}
      </div>
      <SectionCard title="Report Filter" description="Choose the attribute or data problem you want to inspect.">
        <div className="sc-filter-chip-row">
          {FILTERS.map(([value, label]) => (
            <button key={value} className={filter === value ? 'active' : ''} onClick={() => { setFilter(value); load(value); }}>{label}</button>
          ))}
        </div>
      </SectionCard>
      {loading ? <SectionCard><p>Loading product data health…</p></SectionCard> : null}
      {error ? <SectionCard tone="danger"><p>{error}</p></SectionCard> : null}
      {!loading && !rows.length ? <EmptyState title="No rows found" description="This filter has no current data health issues." /> : null}
      {rows.length ? (
        <SectionCard title="Product Data Report" description="Review products and decide whether to repair, map, or exclude them.">
          <ResponsiveTable>
            <thead><tr><th>Issue</th><th>Product</th><th>SKU</th><th>Brand</th><th>Style</th><th>Color</th><th>Size</th><th>Note</th></tr></thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id || idx}>
                  <td><StatusBadge status={r.issue_type || r.mapping_status || 'issue'} /></td>
                  <td>{r.product_name || r.name || r.item_name || '—'}</td>
                  <td><code>{r.sku || r.order_sku || '—'}</code></td>
                  <td>{r.brand_name || r.brand || r.source_brand || '—'}</td>
                  <td>{r.style_name || r.product_type_name || r.style || '—'}</td>
                  <td>{r.color_name || r.color || '—'}</td>
                  <td>{r.size_name || r.size || '—'}</td>
                  <td>{r.issue_note || r.note || r.reason || ''}</td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </SectionCard>
      ) : null}
    </main>
  );
}
