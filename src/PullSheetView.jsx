import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { PageHeader, HelpPanel, SectionCard, StatusBadge, ActionButton, EmptyState } from './components/UIPrimitives';

function value(...items) {
  return items.find((v) => v !== undefined && v !== null && String(v).trim() !== '') || '—';
}

export default function PullSheetView() {
  const { jobId, id } = useParams();
  const resolvedJobId = jobId || id;
  const [job, setJob] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overrideRow, setOverrideRow] = useState(null);
  const [blankSearch, setBlankSearch] = useState('');
  const [blankResults, setBlankResults] = useState([]);

  async function load() {
    setLoading(true);
    setError('');
    const { data: jobData } = await supabase.from('jobs').select('*').eq('id', resolvedJobId).maybeSingle();
    setJob(jobData || null);

    const { data, error } = await supabase.rpc('sc_pull_sheet_ordered_blank_pairings', { p_job_id: Number(resolvedJobId) });
    if (error) {
      const fallback = await supabase.rpc('sc_pull_sheet_items', { p_job_id: Number(resolvedJobId) });
      if (fallback.error) setError(error.message || fallback.error.message);
      else setItems(fallback.data || []);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }

  useEffect(() => { if (resolvedJobId) load(); }, [resolvedJobId]);

  async function searchBlanks() {
    const term = String(blankSearch || '').trim();
    let query = supabase.from('blank_products').select('id, sku_base, name, brand_id, product_type_id, color_id, size_id').limit(25);
    if (term) query = query.or(`sku_base.ilike.%${term.replace(/[%_,]/g, '')}%,name.ilike.%${term.replace(/[%_,]/g, '')}%`);
    const { data, error } = await query;
    if (error) alert(error.message);
    else setBlankResults(data || []);
  }

  async function applyOverride(blankProductId) {
    if (!overrideRow) return;
    const jobItemId = overrideRow.job_item_id || overrideRow.id;
    const { error } = await supabase.rpc('override_job_item_blank_pairing', {
      p_job_item_id: Number(jobItemId),
      p_new_blank_product_id: blankProductId,
      p_reason: 'Manual override from pull sheet screen',
      p_notes: 'Changed by user through readability update pull sheet view',
    });
    if (error) {
      alert(error.message);
      return;
    }
    setOverrideRow(null);
    setBlankSearch('');
    setBlankResults([]);
    await load();
  }

  const statusTone = useMemo(() => {
    const s = String(job?.status || '').toLowerCase();
    if (s.includes('cancel')) return 'danger';
    if (s.includes('complete')) return 'success';
    return 'info';
  }, [job]);

  return (
    <main className="sc-page sc-pullsheet-detail-page">
      <PageHeader
        eyebrow="PRODUCTION PULL SHEET"
        title={`Pull Sheet ${resolvedJobId ? `#${resolvedJobId}` : ''}`}
        description="Compare what the customer ordered against the blank item the app paired to the order line."
        actions={<ActionButton tone="secondary" onClick={load}>Refresh</ActionButton>}
      />

      <HelpPanel>
        <p>Each card shows the finished product ordered by the customer on the left and the blank item the app plans to pull on the right. If the pairing is wrong, use Override Blank Pairing before production starts.</p>
      </HelpPanel>

      {job ? (
        <SectionCard title="Job Summary" actions={<StatusBadge status={job.status || 'open'} tone={statusTone} />}>
          <div className="sc-summary-grid">
            <div><span>Customer</span><strong>{value(job.customer_name, job.customer)}</strong></div>
            <div><span>WooCommerce Order</span><strong>{value(job.woocommerce_order_id)}</strong></div>
            <div><span>Source</span><strong>{value(job.source_type, job.woocommerce_order_id ? 'woocommerce' : 'manual')}</strong></div>
            <div><span>Created</span><strong>{value(job.created_at)}</strong></div>
          </div>
        </SectionCard>
      ) : null}

      {loading ? <SectionCard><p>Loading pull sheet…</p></SectionCard> : null}
      {error ? <SectionCard tone="danger"><p>{error}</p></SectionCard> : null}
      {!loading && !items.length ? <EmptyState title="No pull sheet items found" description="The job exists, but no line items were returned by the pull sheet pairing function." /> : null}

      <div className="sc-pullsheet-line-stack">
        {items.map((row, idx) => {
          const warning = row.pairing_warning || row.warning || (!row.woocommerce_variation_id ? 'Variation not captured. Verify paired blank.' : '');
          return (
            <article className="sc-pullsheet-line-card" key={row.job_item_id || row.id || idx}>
              <header className="sc-pullsheet-line-card__header">
                <div>
                  <h2>Line {idx + 1}</h2>
                  <p>Qty: <strong>{value(row.quantity, row.qty, row.quantity_needed)}</strong></p>
                </div>
                <StatusBadge status={warning ? 'Needs Review' : (row.pairing_status || 'Matched')} />
              </header>
              <div className="sc-pairing-grid">
                <section className="sc-pairing-panel sc-pairing-panel--ordered">
                  <h3>Customer Ordered Finished Product</h3>
                  <dl>
                    <dt>Product</dt><dd>{value(row.ordered_product_name, row.ordered_name, row.item_name, row.product_name)}</dd>
                    <dt>SKU</dt><dd>{value(row.ordered_sku, row.order_sku, row.variation_sku)}</dd>
                    <dt>Brand</dt><dd>{value(row.ordered_brand, row.source_brand, row.brand)}</dd>
                    <dt>Style</dt><dd>{value(row.ordered_style, row.source_style, row.product_type, row.style)}</dd>
                    <dt>Color</dt><dd>{value(row.ordered_color, row.selected_color, row.color)}</dd>
                    <dt>Size</dt><dd>{value(row.ordered_size, row.selected_size, row.size)}</dd>
                  </dl>
                </section>
                <section className="sc-pairing-panel sc-pairing-panel--blank">
                  <h3>App Paired Blank Product</h3>
                  <dl>
                    <dt>Blank</dt><dd>{value(row.blank_name, row.paired_blank_name)}</dd>
                    <dt>SKU</dt><dd>{value(row.blank_sku, row.blank_sku_base, row.paired_blank_sku_base)}</dd>
                    <dt>Brand</dt><dd>{value(row.blank_brand, row.paired_blank_brand)}</dd>
                    <dt>Style</dt><dd>{value(row.blank_style, row.paired_blank_style)}</dd>
                    <dt>Color</dt><dd>{value(row.blank_color, row.paired_blank_color)}</dd>
                    <dt>Size</dt><dd>{value(row.blank_size, row.paired_blank_size)}</dd>
                  </dl>
                </section>
              </div>
              {warning ? <div className="sc-warning-callout">{warning}</div> : null}
              <div className="sc-button-row">
                <ActionButton tone="warning" onClick={() => setOverrideRow(row)}>Override Blank Pairing</ActionButton>
                <ActionButton tone="secondary">Mark Pulled Only</ActionButton>
                <ActionButton tone="primary">Complete + Deduct Blank</ActionButton>
              </div>
            </article>
          );
        })}
      </div>

      {overrideRow ? (
        <div className="sc-modal-backdrop">
          <div className="sc-modal-card">
            <h2>Override Blank Pairing</h2>
            <p>Search for the correct blank product and select it for this pull sheet line.</p>
            <div className="sc-inline-search">
              <input value={blankSearch} onChange={(e) => setBlankSearch(e.target.value)} placeholder="Search SKU or blank product name" />
              <ActionButton tone="secondary" onClick={searchBlanks}>Search</ActionButton>
            </div>
            <div className="sc-blank-result-list">
              {blankResults.map((bp) => (
                <button key={bp.id} type="button" onClick={() => applyOverride(bp.id)}>
                  <strong>{bp.sku_base || bp.name}</strong><span>{bp.name}</span>
                </button>
              ))}
            </div>
            <div className="sc-button-row"><ActionButton tone="secondary" onClick={() => setOverrideRow(null)}>Close</ActionButton></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
