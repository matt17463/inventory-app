import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { PageHeader, HelpPanel, SectionCard, StatusBadge, ActionButton, EmptyState } from './components/UIPrimitives';
import { applyNonInventoryRulesToJob, markJobItemNonInventory } from './lib/nonInventoryApi';

function value(...items) {
  return items.find((v) => v !== undefined && v !== null && String(v).trim() !== '') || '—';
}

function rowKey(row, idx = 0) {
  return String(row.job_item_id || row.id || idx);
}

function pickBlankProductId(row) {
  const picked = value(
    row.blank_product_id,
    row.paired_blank_id,
    row.app_paired_blank_product_id,
    row.paired_blank_product_id,
    row.matched_blank_product_id,
    ''
  );
  return picked === '—' ? '' : picked;
}

function pickJobItemId(row) {
  const picked = value(row.job_item_id, row.id, '');
  return picked === '—' ? '' : picked;
}

function rowStatus(row) {
  return String(value(row.item_status, row.status, row.job_item_status, row.line_status, '') === '—' ? '' : value(row.item_status, row.status, row.job_item_status, row.line_status, '')).toLowerCase();
}

function isClosedLine(row) {
  return /complete|void|cancel|deduct/.test(rowStatus(row));
}

function isNonInventoryLine(row) {
  return row.inventory_required === false || row.inventory_required === 'false' || row.pairing_status === 'non_inventory' || row.inventory_status === 'non_inventory';
}

function binDisplayName(bin) {
  const qty = value(bin.quantity_on_hand, bin.on_hand_quantity, bin.total_quantity, bin.quantity, bin.available_quantity, 0);
  return [
    value(bin.bin_code, bin.code, bin.bin_label, bin.label, bin.name, bin.bin_id),
    value(bin.location, '') === '—' ? '' : value(bin.location, ''),
    `Qty ${qty}`,
  ].filter(Boolean).join(' · ');
}

function toRpcBinId(binId) {
  const text = String(binId || '').trim();
  if (/^\d+$/.test(text)) return Number(text);
  return text;
}

function normalizeCatalogPullSheetRows(rows = []) {
  return rows.map((row, index) => ({
    ...row,
    line_number: row.line_number || index + 1,
    ordered_product_name: row.ordered_product_name || row.item_name || row.order_sku || row.ordered_sku,
    ordered_sku: row.ordered_sku || row.order_sku || row.sku,
    ordered_brand: row.ordered_brand || row.brand,
    ordered_style: row.ordered_style || row.product_type || row.style,
    ordered_color: row.ordered_color || row.color,
    ordered_size: row.ordered_size || row.size,
    blank_name: row.blank_name || row.paired_blank_name,
    blank_sku: row.blank_sku || row.blank_sku_base || row.paired_blank_sku_base,
    blank_color: row.blank_color || row.color,
    blank_size: row.blank_size || row.size,
    inventory_required: row.inventory_required !== undefined ? row.inventory_required : true,
    non_inventory_reason: row.non_inventory_reason || '',
    non_inventory_rule_id: row.non_inventory_rule_id || null,
    pairing_status: row.pairing_status || (row.inventory_required === false ? 'non_inventory' : (row.blank_product_id ? 'paired' : 'needs_blank_pairing')),
  }));
}

function mergePullSheetRows(primaryRows = [], fallbackRows = []) {
  const map = new Map();
  [...primaryRows, ...fallbackRows].forEach((row, index) => {
    const key = String(row.job_item_id || row.id || row.order_sku || row.ordered_sku || index);
    if (!map.has(key)) map.set(key, row);
    else map.set(key, { ...map.get(key), ...row });
  });
  return Array.from(map.values()).map((row, index) => ({ ...row, line_number: row.line_number || index + 1 }));
}

function normalizeFallbackPullSheetRows(rows = []) {
  return rows
    .filter((row) => row?.job_item_id || row?.id || row?.blank_product_id || Number(row?.quantity || 0) > 0)
    .map((row, index) => ({
      ...row,
      line_number: row.line_number || index + 1,
      ordered_product_name: row.ordered_product_name || row.ordered_name || row.item_name || row.product_name || row.blank_name || row.blank_sku_base,
      ordered_sku: row.ordered_sku || row.order_sku || row.sku || row.blank_sku_base,
      ordered_brand: row.ordered_brand || row.brand,
      ordered_style: row.ordered_style || row.product_type || row.style,
      ordered_color: row.ordered_color || row.color,
      ordered_size: row.ordered_size || row.size,
      blank_name: row.blank_name || row.paired_blank_name,
      blank_sku: row.blank_sku || row.blank_sku_base || row.paired_blank_sku_base,
      blank_color: row.blank_color || row.color,
      blank_size: row.blank_size || row.size,
      inventory_required: row.inventory_required !== undefined ? row.inventory_required : true,
    non_inventory_reason: row.non_inventory_reason || '',
    non_inventory_rule_id: row.non_inventory_rule_id || null,
    pairing_status: row.pairing_status || (row.inventory_required === false ? 'non_inventory' : (row.blank_product_id ? 'paired' : 'needs_blank_pairing')),
    }));
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
  const [sourceBinsByLine, setSourceBinsByLine] = useState({});
  const [selectedBinByLine, setSelectedBinByLine] = useState({});
  const [lineMessages, setLineMessages] = useState({});
  const [completingLine, setCompletingLine] = useState('');
  const [completingAll, setCompletingAll] = useState(false);
  const [jobStatusBusy, setJobStatusBusy] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');

  async function fetchFallbackItems() {
    const fallback = await supabase.rpc('sc_pull_sheet_items', { p_job_id: Number(resolvedJobId) });
    if (!fallback.error && Array.isArray(fallback.data) && fallback.data.length) {
      return normalizeFallbackPullSheetRows(fallback.data);
    }

    const direct = await supabase
      .from('job_items')
      .select(`
        id,
        job_id,
        quantity,
        status,
        sku,
        name,
        item_name,
        order_sku,
        brand,
        product_type,
        color,
        size,
        blank_product_id,
        selected_bin_id,
        notes,
        artwork_note,
        inventory_required,
        non_inventory_reason,
        non_inventory_rule_id,
        non_inventory_marked_at,
        placement,
        decoration_size,
        blank_products:blank_product_id(
          id,
          sku_base,
          name,
          brands:brand_id(name, code),
          product_types:product_type_id(name, code),
          colors:color_id(name, code),
          sizes:size_id(name, code)
        )
      `)
      .eq('job_id', Number(resolvedJobId))
      .order('id', { ascending: true });

    if (direct.error) {
      throw fallback.error || direct.error;
    }

    return (direct.data || []).map((row, index) => {
      const bp = row.blank_products || {};
      return {
        ...row,
        job_item_id: row.id,
        line_number: index + 1,
        ordered_product_name: row.item_name || row.name || row.order_sku || bp.name || bp.sku_base,
        ordered_sku: row.order_sku || row.sku || bp.sku_base,
        ordered_brand: row.brand || bp.brands?.name || bp.brands?.code,
        ordered_style: row.product_type || bp.product_types?.name || bp.product_types?.code,
        ordered_color: row.color || bp.colors?.name || bp.colors?.code,
        ordered_size: row.size || bp.sizes?.name || bp.sizes?.code,
        blank_name: bp.name,
        blank_sku: bp.sku_base,
        blank_brand: bp.brands?.name || bp.brands?.code,
        blank_style: bp.product_types?.name || bp.product_types?.code,
        blank_color: bp.colors?.name || bp.colors?.code,
        blank_size: bp.sizes?.name || bp.sizes?.code,
        inventory_required: row.inventory_required !== undefined ? row.inventory_required : true,
        non_inventory_reason: row.non_inventory_reason || '',
        non_inventory_rule_id: row.non_inventory_rule_id || null,
        pairing_status: row.inventory_required === false ? 'non_inventory' : (row.blank_product_id ? 'paired' : 'needs_blank_pairing'),
      };
    });
  }

  async function load() {
    setLoading(true);
    setError('');
    setBulkMessage('');
    setLineMessages({});

    try {
      const { data: jobData, error: jobError } = await supabase.from('jobs').select('*').eq('id', resolvedJobId).maybeSingle();
      if (jobError) throw jobError;
      setJob(jobData || null);

      const catalog = await supabase.rpc('sc_pull_sheet_items_catalog_v1', { p_job_id: Number(resolvedJobId) });
      if (!catalog.error && Array.isArray(catalog.data) && catalog.data.length) {
        setItems(normalizeCatalogPullSheetRows(catalog.data));
      } else {
        const primary = await supabase.rpc('sc_pull_sheet_ordered_blank_pairings', { p_job_id: Number(resolvedJobId) });
        const primaryRows = !primary.error && Array.isArray(primary.data) ? primary.data : [];
        const fallbackRows = await fetchFallbackItems();

        // Some older pairing RPCs can accidentally omit zero-on-hand lines.
        // Prefer/merge the direct job_items fallback whenever it has more complete coverage.
        const mergedRows = fallbackRows.length > primaryRows.length
          ? mergePullSheetRows(primaryRows, fallbackRows)
          : primaryRows;

        setItems(mergedRows.length ? mergedRows : fallbackRows);
        if (!mergedRows.length && !fallbackRows.length && (catalog.error || primary.error)) {
          setError(catalog.error?.message || primary.error?.message || 'No line items were returned by the pull sheet pairing function.');
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load pull sheet.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (resolvedJobId) load(); }, [resolvedJobId]);

  useEffect(() => {
    let active = true;

    async function loadSourceBins() {
      const nextBins = {};
      const nextSelected = {};

      for (let idx = 0; idx < items.length; idx += 1) {
        const row = items[idx];
        const key = rowKey(row, idx);
        const blankProductId = pickBlankProductId(row);

        if (!blankProductId) {
          nextBins[key] = [];
          continue;
        }

        const { data, error } = await supabase
          .from('bin_blank_inventory_contents')
          .select('*')
          .eq('blank_product_id', blankProductId)
          .gt('quantity_on_hand', 0)
          .order('bin_code', { ascending: true });

        if (!active) return;

        if (error) {
          nextBins[key] = [];
          setLineMessages((messages) => ({
            ...messages,
            [key]: `Could not load source bins: ${error.message}`,
          }));
        } else {
          const bins = data || [];
          nextBins[key] = bins;
          if (bins.length === 1) nextSelected[key] = String(bins[0].bin_id);
        }
      }

      if (!active) return;
      setSourceBinsByLine(nextBins);
      setSelectedBinByLine((current) => ({ ...nextSelected, ...current }));
    }

    if (items.length) loadSourceBins();
    else {
      setSourceBinsByLine({});
      setSelectedBinByLine({});
    }

    return () => { active = false; };
  }, [items]);

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

  async function markPulledOnly(row, idx) {
    const key = rowKey(row, idx);
    const jobItemId = pickJobItemId(row);
    if (!jobItemId) {
      setLineMessages((messages) => ({ ...messages, [key]: 'This line is missing a job item ID.' }));
      return;
    }

    const { error } = await supabase.from('job_items').update({ status: 'pulled' }).eq('id', Number(jobItemId));
    if (error) {
      setLineMessages((messages) => ({ ...messages, [key]: error.message || 'Could not mark line as pulled.' }));
      return;
    }

    setLineMessages((messages) => ({ ...messages, [key]: 'Marked pulled. Inventory was not changed.' }));
    await load();
  }

  async function completeAndDeduct(row, idx) {
    const key = rowKey(row, idx);
    const jobItemId = pickJobItemId(row);
    const selectedBinId = selectedBinByLine[key];

    if (!jobItemId) {
      setLineMessages((messages) => ({ ...messages, [key]: 'This line is missing a job item ID.' }));
      return;
    }

    if (!selectedBinId) {
      setLineMessages((messages) => ({ ...messages, [key]: 'Choose the blank source bin before completing this line.' }));
      return;
    }

    setCompletingLine(key);
    setLineMessages((messages) => ({ ...messages, [key]: '' }));

    const { error } = await supabase.rpc('complete_job_item', {
      p_job_item_id: Number(jobItemId),
      p_bin_id: toRpcBinId(selectedBinId),
      p_notes: 'Completed and deducted blank from pull sheet screen.',
    });

    if (error) {
      setLineMessages((messages) => ({ ...messages, [key]: error.message || 'Could not complete and deduct blank.' }));
      setCompletingLine('');
      return;
    }

    setLineMessages((messages) => ({ ...messages, [key]: 'Completed and blank inventory deducted.' }));
    setCompletingLine('');
    await load();
  }

  async function completeAllAndDeduct() {
    setBulkMessage('');

    const eligible = items
      .map((row, idx) => ({ row, idx, key: rowKey(row, idx), jobItemId: pickJobItemId(row), blankProductId: pickBlankProductId(row) }))
      .filter((entry) => entry.jobItemId && entry.blankProductId && !isClosedLine(entry.row));

    if (!eligible.length) {
      setBulkMessage('There are no open paired line items to complete.');
      return;
    }

    const missingBins = eligible.filter((entry) => !selectedBinByLine[entry.key]);
    if (missingBins.length) {
      setBulkMessage(`Choose a source bin for line${missingBins.length === 1 ? '' : 's'} ${missingBins.map((entry) => entry.idx + 1).join(', ')} before completing all.`);
      return;
    }

    const confirmed = window.confirm(`Complete and deduct blanks for ${eligible.length} line item${eligible.length === 1 ? '' : 's'}? This will reduce inventory.`);
    if (!confirmed) return;

    setCompletingAll(true);

    const successes = [];
    const failures = [];

    for (const entry of eligible) {
      const { error } = await supabase.rpc('complete_job_item', {
        p_job_item_id: Number(entry.jobItemId),
        p_bin_id: toRpcBinId(selectedBinByLine[entry.key]),
        p_notes: 'Bulk completed and deducted blank from pull sheet screen.',
      });

      if (error) failures.push(`Line ${entry.idx + 1}: ${error.message || 'failed'}`);
      else successes.push(entry.idx + 1);
    }

    setCompletingAll(false);
    setBulkMessage(failures.length
      ? `Completed ${successes.length}; ${failures.length} failed. ${failures.join(' ')}`
      : `Completed and deducted blanks for ${successes.length} line item${successes.length === 1 ? '' : 's'}.`);

    await load();
  }


  async function applyNonInventoryRulesForJob() {
    if (!resolvedJobId) return;
    setBulkMessage('');
    const confirmed = window.confirm('Apply active non-inventory rules to this pull sheet? Matching lines will no longer require blank pairing or reservation.');
    if (!confirmed) return;
    try {
      const rows = await applyNonInventoryRulesToJob(Number(resolvedJobId));
      setBulkMessage(`Applied non-inventory rules to ${rows.length} line${rows.length === 1 ? '' : 's'}.`);
      await load();
    } catch (err) {
      setBulkMessage(err.message || 'Could not apply non-inventory rules to this pull sheet.');
    }
  }

  async function markLineNonInventory(row, idx) {
    const key = rowKey(row, idx);
    const jobItemId = pickJobItemId(row);
    if (!jobItemId) {
      setLineMessages((messages) => ({ ...messages, [key]: 'This line is missing a job item ID.' }));
      return;
    }

    const reason = window.prompt('Reason to show on the pull sheet:', row.non_inventory_reason || 'No inventory tracking required for this WooCommerce item.');
    if (reason === null) return;

    const createFutureRule = window.confirm('Create a rule so future orders for this SKU are automatically treated as non-inventory?');

    try {
      await markJobItemNonInventory({
        jobItemId,
        reason: reason || 'No inventory tracking required for this WooCommerce item.',
        createFutureRule,
        ruleType: 'exact_sku',
        ruleMatchValue: value(row.ordered_sku, row.order_sku, row.sku, '') === '—' ? '' : value(row.ordered_sku, row.order_sku, row.sku, ''),
      });
      setLineMessages((messages) => ({ ...messages, [key]: 'Marked as non-inventory. This line no longer needs a blank or reservation.' }));
      await load();
    } catch (err) {
      setLineMessages((messages) => ({ ...messages, [key]: err.message || 'Could not mark line as non-inventory.' }));
    }
  }

  async function updateJobStatus(nextStatus) {
    if (!resolvedJobId) return;

    const statusLabel = nextStatus === 'voided' ? 'void this pull sheet' : 'mark this pull sheet complete';
    const confirmed = window.confirm(`Are you sure you want to ${statusLabel}? Inventory will not be changed.`);
    if (!confirmed) return;

    setJobStatusBusy(nextStatus);
    setBulkMessage('');

    const { error } = await supabase
      .from('jobs')
      .update({ status: nextStatus })
      .eq('id', Number(resolvedJobId));

    if (error) {
      setBulkMessage(error.message || 'Could not update pull sheet status.');
      setJobStatusBusy('');
      return;
    }

    setBulkMessage(`Pull sheet status changed to ${nextStatus}. Inventory was not changed.`);
    setJobStatusBusy('');
    await load();
  }

  const statusTone = useMemo(() => {
    const s = String(job?.status || '').toLowerCase();
    if (s.includes('cancel') || s.includes('void')) return 'danger';
    if (s.includes('complete')) return 'success';
    return 'info';
  }, [job]);

  const jobActions = (
    <div className="sc-button-row">
      <ActionButton tone="secondary" onClick={load}>Refresh</ActionButton>
      <ActionButton tone="secondary" disabled={!items.length} onClick={applyNonInventoryRulesForJob}>Apply Non-Inventory Rules</ActionButton>
      <ActionButton tone="primary" disabled={completingAll || !items.length} onClick={completeAllAndDeduct}>
        {completingAll ? 'Completing all…' : 'Complete All + Deduct Blanks'}
      </ActionButton>
      <ActionButton tone="success" disabled={jobStatusBusy === 'completed'} onClick={() => updateJobStatus('completed')}>
        {jobStatusBusy === 'completed' ? 'Updating…' : 'Mark Job Complete Only'}
      </ActionButton>
      <ActionButton tone="danger" disabled={jobStatusBusy === 'voided'} onClick={() => updateJobStatus('voided')}>
        {jobStatusBusy === 'voided' ? 'Updating…' : 'Void Job Only'}
      </ActionButton>
    </div>
  );

  return (
    <main className="sc-page sc-pullsheet-detail-page">
      <PageHeader
        eyebrow="PRODUCTION PULL SHEET"
        title={`Pull Sheet ${resolvedJobId ? `#${resolvedJobId}` : ''}`}
        description="Compare what the customer ordered against the blank item the app paired to the order line."
        actions={jobActions}
      />

      <HelpPanel>
        <p>Each card shows the finished product ordered by the customer on the left and the blank item the app plans to pull on the right. If the pairing is wrong, use Override Blank Pairing before production starts.</p>
      </HelpPanel>

      {bulkMessage ? <SectionCard tone={bulkMessage.toLowerCase().includes('failed') || bulkMessage.toLowerCase().includes('choose') ? 'warning' : 'default'}><p>{bulkMessage}</p></SectionCard> : null}

      {job ? (
        <SectionCard title="Job Summary" actions={<StatusBadge status={job.status || 'open'} tone={statusTone} />}>
          <div className="sc-summary-grid">
            <div><span>Customer</span><strong>{value(job.customer_name, job.customer)}</strong></div>
            <div><span>WooCommerce Order</span><strong>{value(job.woocommerce_order_id)}</strong></div>
            <div><span>Source</span><strong>{value(job.source_type, job.order_source, job.woocommerce_order_id ? 'woocommerce' : 'manual')}</strong></div>
            <div><span>Created</span><strong>{value(job.created_at)}</strong></div>
          </div>
        </SectionCard>
      ) : null}

      {loading ? <SectionCard><p>Loading pull sheet…</p></SectionCard> : null}
      {error ? <SectionCard tone="danger"><p>{error}</p></SectionCard> : null}
      {!loading && !items.length ? <EmptyState title="No pull sheet items found" description="The job exists, but no line items were returned by the pull sheet pairing function or fallback line item query." /> : null}

      <div className="sc-pullsheet-line-stack">
        {items.map((row, idx) => {
          const key = rowKey(row, idx);
          const warning = row.pairing_warning || row.warning || (!row.woocommerce_variation_id ? 'Variation not captured. Verify paired blank.' : '');
          const blankProductId = pickBlankProductId(row);
          const sourceBins = sourceBinsByLine[key] || [];
          const selectedBinId = selectedBinByLine[key] || '';
          const lineMessage = lineMessages[key] || '';
          const onHandQty = Number(row.on_hand_quantity ?? row.quantity_on_hand ?? row.total_quantity ?? 0);
          const availableQty = Number(row.available_quantity ?? onHandQty);
          const zeroOnHandWarning = blankProductId && sourceBins.length === 0 && onHandQty <= 0
            ? 'This blank is linked, but no on-hand inventory is currently in bins. Keep it on the pull sheet, receive inventory when it arrives, then deduct from a bin.'
            : '';
          const isCompleting = completingLine === key;
          const nonInventory = isNonInventoryLine(row);
          const lineStatusLabel = nonInventory ? 'No Inventory Required' : (warning ? 'Needs Review' : (row.pairing_status || rowStatus(row) || 'Matched'));

          return (
            <article className="sc-pullsheet-line-card" key={key}>
              <header className="sc-pullsheet-line-card__header">
                <div>
                  <h2>Line {idx + 1}</h2>
                  <p>Qty: <strong>{value(row.quantity, row.qty, row.quantity_needed)}</strong></p>
                </div>
                <StatusBadge status={lineStatusLabel} tone={nonInventory ? 'success' : undefined} />
              </header>
              <div className="sc-pairing-grid">
                <section className="sc-pairing-panel sc-pairing-panel--ordered">
                  <h3>Customer Ordered Finished Product</h3>
                  <dl>
                    <dt>Product</dt><dd>{value(row.ordered_product_name, row.ordered_name, row.item_name, row.product_name)}</dd>
                    <dt>SKU</dt><dd>{value(row.ordered_sku, row.order_sku, row.variation_sku, row.sku)}</dd>
                    <dt>Brand</dt><dd>{value(row.ordered_brand, row.source_brand, row.brand)}</dd>
                    <dt>Style</dt><dd>{value(row.ordered_style, row.source_style, row.product_type, row.style)}</dd>
                    <dt>Color</dt><dd>{value(row.ordered_color, row.selected_color, row.color)}</dd>
                    <dt>Size</dt><dd>{value(row.ordered_size, row.selected_size, row.size)}</dd>
                  </dl>
                </section>
                <section className="sc-pairing-panel sc-pairing-panel--blank">
                  <h3>{nonInventory ? 'No Inventory Required' : 'App Paired Blank Product'}</h3>
                  <dl>
                    <dt>Blank</dt><dd>{value(row.blank_name, row.paired_blank_name)}</dd>
                    <dt>SKU</dt><dd>{value(row.blank_sku, row.blank_sku_base, row.paired_blank_sku_base)}</dd>
                    <dt>Brand</dt><dd>{value(row.blank_brand, row.paired_blank_brand, row.job_item_brand, row.ordered_brand, row.brand)}</dd>
                    <dt>Style</dt><dd>{value(row.blank_style, row.paired_blank_style, row.job_item_style, row.ordered_style, row.product_type, row.style)}</dd>
                    <dt>Color</dt><dd>{value(row.blank_color, row.paired_blank_color, row.job_item_color, row.ordered_color, row.color)}</dd>
                    <dt>Size</dt><dd>{value(row.blank_size, row.paired_blank_size, row.job_item_size, row.ordered_size, row.size)}</dd>
                    <dt>On Hand</dt><dd>{value(row.on_hand_quantity, row.quantity_on_hand, row.total_quantity, 0)}</dd>
                    <dt>Available</dt><dd>{value(row.available_quantity, availableQty, 0)}</dd>
                    <dt>Inventory Status</dt><dd>{value(row.inventory_status, nonInventory ? 'non_inventory' : (onHandQty > 0 ? 'in_stock' : 'zero_on_hand'))}</dd>
                    <dt>Inventory Required</dt><dd>{nonInventory ? 'No' : 'Yes'}</dd>
                    {nonInventory ? <><dt>Reason</dt><dd>{value(row.non_inventory_reason, row.pairing_warning, 'No inventory tracking required')}</dd></> : null}
                  </dl>
                </section>
              </div>
              {warning ? <div className="sc-warning-callout">{warning}</div> : null}
              {zeroOnHandWarning ? <div className="sc-warning-callout">{zeroOnHandWarning}</div> : null}

              {nonInventory ? (
                <div className="sc-button-row">
                  <ActionButton tone="secondary" onClick={() => markPulledOnly(row, idx)}>Mark Done / No Inventory Action</ActionButton>
                </div>
              ) : blankProductId ? (
                <div className="sc-button-row" style={{ alignItems: 'center' }}>
                  <label style={{ display: 'grid', gap: 4, minWidth: 260 }}>
                    <span style={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase' }}>Blank Source Bin</span>
                    <select
                      value={selectedBinId}
                      onChange={(event) => setSelectedBinByLine((current) => ({ ...current, [key]: event.target.value }))}
                    >
                      <option value="">Choose bin…</option>
                      {sourceBins.map((bin) => (
                        <option key={bin.bin_id} value={bin.bin_id}>{binDisplayName(bin)}</option>
                      ))}
                    </select>
                  </label>
                  <ActionButton tone="warning" onClick={() => setOverrideRow(row)}>Override Blank Pairing</ActionButton>
                  <ActionButton tone="secondary" onClick={() => markLineNonInventory(row, idx)}>Mark Non-Inventory</ActionButton>
                  <ActionButton tone="secondary" onClick={() => markPulledOnly(row, idx)}>Mark Pulled Only</ActionButton>
                  <ActionButton tone="primary" disabled={isCompleting || isClosedLine(row)} onClick={() => completeAndDeduct(row, idx)}>
                    {isCompleting ? 'Completing…' : 'Complete + Deduct Blank'}
                  </ActionButton>
                </div>
              ) : (
                <div className="sc-button-row">
                  <ActionButton tone="warning" onClick={() => setOverrideRow(row)}>Override Blank Pairing</ActionButton>
                  <ActionButton tone="secondary" onClick={() => markLineNonInventory(row, idx)}>Mark Non-Inventory</ActionButton>
                  <ActionButton tone="secondary" onClick={() => markPulledOnly(row, idx)}>Mark Pulled Only</ActionButton>
                  <ActionButton tone="primary" disabled>Complete + Deduct Blank</ActionButton>
                </div>
              )}

              {lineMessage ? <div className="sc-warning-callout">{lineMessage}</div> : null}
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
