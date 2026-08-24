import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import {
  PageHeader,
  HelpPanel,
  SectionCard,
  StatusBadge,
  ActionButton,
  EmptyState,
  InlineEditorPanel,
} from './components/UIPrimitives';
import {
  applyNonInventoryRulesToJob,
  markJobItemNonInventory,
  setJobItemPurchasingReportInclusion,
} from './lib/nonInventoryApi';
import {
  getPendingStockBin,
  isPendingStockBin,
  saveJobItemSelectedBin,
} from './lib/pullSheetBinAssignmentApi';
import {
  completePullSheetItemDeductBlankSafe,
} from './lib/pullSheetCompletionApi';
import {
  updatePullSheetItemStatus,
  updatePullSheetStatus,
} from './lib/inventoryApi';

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

function isIncludedOnPurchasingReport(row) {
  return row.include_on_purchasing_report !== false
    && row.include_on_purchasing_report !== 'false';
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
  const [outOfStockByLine, setOutOfStockByLine] = useState({});
  const [lineMessages, setLineMessages] = useState({});
  const [completingLine, setCompletingLine] = useState('');
  const [completingAll, setCompletingAll] = useState(false);
  const [jobStatusBusy, setJobStatusBusy] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [nonInventoryDialog, setNonInventoryDialog] = useState(null);
  const [nonInventorySaving, setNonInventorySaving] = useState(false);

  const fetchJobItemsDirect = useCallback(async () => {
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
        include_on_purchasing_report,
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

    if (direct.error) throw direct.error;

    const activeRows = (direct.data || []).filter((row) => (
      !/(cancel|void|deleted)/i.test(String(row.status || ''))
    ));

    return activeRows.map((row, index) => {
      const bp = row.blank_products || {};

      return {
        ...row,
        job_item_id: row.id,
        line_number: index + 1,
        ordered_product_name:
          row.item_name
          || row.name
          || row.order_sku
          || bp.name
          || bp.sku_base,
        ordered_sku: row.order_sku || row.sku || bp.sku_base,
        ordered_brand: row.brand || bp.brands?.name || bp.brands?.code,
        ordered_style:
          row.product_type
          || bp.product_types?.name
          || bp.product_types?.code,
        ordered_color: row.color || bp.colors?.name || bp.colors?.code,
        ordered_size: row.size || bp.sizes?.name || bp.sizes?.code,
        blank_name: bp.name,
        blank_sku: bp.sku_base,
        blank_brand: bp.brands?.name || bp.brands?.code,
        blank_style: bp.product_types?.name || bp.product_types?.code,
        blank_color: bp.colors?.name || bp.colors?.code,
        blank_size: bp.sizes?.name || bp.sizes?.code,
        inventory_required:
          row.inventory_required !== undefined
            ? row.inventory_required
            : true,
        include_on_purchasing_report:
          row.include_on_purchasing_report !== undefined
            ? row.include_on_purchasing_report
            : true,
        non_inventory_reason: row.non_inventory_reason || '',
        non_inventory_rule_id: row.non_inventory_rule_id || null,
        pairing_status:
          row.inventory_required === false
            ? 'non_inventory'
            : (
                row.blank_product_id
                  ? 'paired'
                  : 'needs_blank_pairing'
              ),
      };
    });
  }, [resolvedJobId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setBulkMessage('');
    setLineMessages({});

    try {
      // Viewing a pull sheet must be read-only. Do not call assignment,
      // synchronization, pairing, or catalog RPCs from the load path.
      const [jobResult, directRows] = await Promise.all([
        supabase
          .from('jobs')
          .select('*')
          .eq('id', Number(resolvedJobId))
          .maybeSingle(),
        fetchJobItemsDirect(),
      ]);

      if (jobResult.error) throw jobResult.error;

      setJob(jobResult.data || null);
      setItems(directRows);

      if (!directRows.length) {
        setError(
          'This pull sheet exists, but it currently has no saved job-item lines.'
        );
      }
    } catch (err) {
      setError(err.message || 'Failed to load pull sheet.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [resolvedJobId, fetchJobItemsDirect]);

  useEffect(() => { if (resolvedJobId) load(); }, [resolvedJobId, load]);

  useEffect(() => {
    let active = true;

    async function loadSourceBins() {
      const nextBins = {};
      const nextSelected = {};
      const nextOutOfStock = {};
      let pendingStockBin = null;

      try {
        pendingStockBin = await getPendingStockBin();
      } catch (unassignedError) {
        if (active) {
          setBulkMessage(unassignedError.message || 'The Pending Stock bin could not be loaded.');
        }
      }

      for (let idx = 0; idx < items.length; idx += 1) {
        const row = items[idx];
        const key = rowKey(row, idx);
        const blankProductId = pickBlankProductId(row);

        if (!blankProductId || isNonInventoryLine(row)) {
          nextBins[key] = [];
          nextOutOfStock[key] = false;
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
          nextOutOfStock[key] = false;
          setLineMessages((messages) => ({
            ...messages,
            [key]: `Could not load source bins: ${error.message}`,
          }));
          continue;
        }

        // Pending Stock is virtual and must never be offered as a physical
        // source bin. A separately named Unassigned bin remains valid.
        const bins = (data || []).filter((bin) => !isPendingStockBin(bin));

        if (bins.length) {
          nextBins[key] = bins;
          nextOutOfStock[key] = false;

          const persistedBinId = String(row.selected_bin_id || '');
          const persistedStillValid = bins.some(
            (bin) => String(bin.bin_id) === persistedBinId
          );

          if (persistedStillValid) {
            nextSelected[key] = persistedBinId;
          } else if (bins.length === 1) {
            // Preselect the only physical bin for convenience, but do not save
            // anything merely because the pull sheet was opened.
            nextSelected[key] = String(bins[0].bin_id);
            setLineMessages((messages) => ({
              ...messages,
              [key]:
                'One physical source bin is available. Change the selection '
                + 'to save it, or complete the line using this bin.',
            }));
          } else if (
            pendingStockBin
            && persistedBinId === String(pendingStockBin.bin_id)
          ) {
            setLineMessages((messages) => ({
              ...messages,
              [key]:
                'Physical inventory is now available. Choose the correct '
                + 'source bin to replace the Pending Stock assignment.',
            }));
          }
          continue;
        }

        nextOutOfStock[key] = true;

        if (pendingStockBin) {
          nextBins[key] = [pendingStockBin];
          nextSelected[key] = String(pendingStockBin.bin_id);
        } else {
          nextBins[key] = [];
          setLineMessages((messages) => ({
            ...messages,
            [key]: 'This item is out of stock, but the Pending Stock bin could not be found.',
          }));
        }
      }

      if (!active) return;

      setSourceBinsByLine(nextBins);
      setOutOfStockByLine(nextOutOfStock);
      setSelectedBinByLine((current) => {
        const resolved = {};

        Object.entries(nextBins).forEach(([key, bins]) => {
          const currentValue = String(current[key] || '');
          const currentStillValid = bins.some(
            (bin) => String(bin.bin_id) === currentValue
          );

          if (currentStillValid) resolved[key] = currentValue;
          else if (nextSelected[key]) resolved[key] = nextSelected[key];
        });

        return resolved;
      });
    }

    if (items.length) loadSourceBins();
    else {
      setSourceBinsByLine({});
      setSelectedBinByLine({});
      setOutOfStockByLine({});
    }

    return () => { active = false; };
  }, [items]);

  async function searchBlanks() {
    const term = String(blankSearch || '').trim();
    let query = supabase.from('blank_products').select('id, sku_base, name, brand_id, product_type_id, color_id, size_id').eq('sc_is_archived', false).limit(25);
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

  function openOverrideEditor(row) {
    setNonInventoryDialog(null);
    setOverrideRow(row);
    setBlankSearch('');
    setBlankResults([]);
  }

  async function markPulledOnly(row, idx) {
    const key = rowKey(row, idx);
    const jobItemId = pickJobItemId(row);
    if (!jobItemId) {
      setLineMessages((messages) => ({ ...messages, [key]: 'This line is missing a job item ID.' }));
      return;
    }

    try {
      await updatePullSheetItemStatus({ jobItemId, status: 'pulled' });
    } catch (error) {
      setLineMessages((messages) => ({ ...messages, [key]: error.message || 'Could not mark line as pulled.' }));
      return;
    }

    setLineMessages((messages) => ({ ...messages, [key]: 'Marked pulled. Inventory was not changed.' }));
    await load();
  }

  async function changeSelectedBin(row, idx, nextBinId) {
    const key = rowKey(row, idx);
    const previousBinId = selectedBinByLine[key] || '';

    setSelectedBinByLine((current) => ({
      ...current,
      [key]: nextBinId,
    }));
    setLineMessages((messages) => ({
      ...messages,
      [key]: 'Saving source bin…',
    }));

    try {
      await saveJobItemSelectedBin({
        jobItemId: pickJobItemId(row),
        binId: nextBinId || null,
      });

      setItems((currentItems) => currentItems.map((item, itemIndex) => (
        rowKey(item, itemIndex) === key
          ? { ...item, selected_bin_id: nextBinId || null }
          : item
      )));
      setLineMessages((messages) => ({
        ...messages,
        [key]: nextBinId
          ? 'Source bin saved. Purchasing now uses this physical-bin assignment.'
          : 'Source bin cleared.',
      }));
    } catch (saveError) {
      setSelectedBinByLine((current) => ({
        ...current,
        [key]: previousBinId,
      }));
      setLineMessages((messages) => ({
        ...messages,
        [key]: saveError.message || 'The source bin could not be saved.',
      }));
    }
  }

  async function completeAndDeduct(row, idx) {
    const key = rowKey(row, idx);
    const jobItemId = pickJobItemId(row);
    const selectedBinId = selectedBinByLine[key];

    if (!jobItemId) {
      setLineMessages((messages) => ({ ...messages, [key]: 'This line is missing a job item ID.' }));
      return;
    }

    if (outOfStockByLine[key]) {
      setLineMessages((messages) => ({
        ...messages,
        [key]: 'This item is out of stock and assigned to Pending Stock. Receive the blank into inventory, refresh the pull sheet, and then complete the line.',
      }));
      return;
    }

    if (!selectedBinId) {
      setLineMessages((messages) => ({ ...messages, [key]: 'Choose the blank source bin before completing this line.' }));
      return;
    }

    setCompletingLine(key);
    setLineMessages((messages) => ({ ...messages, [key]: '' }));

    const result = await completePullSheetItemDeductBlankSafe({
      jobItemId,
      blankProductId: pickBlankProductId(row),
      binId: toRpcBinId(selectedBinId),
      quantity: Number(row.quantity || row.qty || row.quantity_needed || 1),
      notes: 'Completed and deducted blank from pull sheet screen.',
    });

    if (!result?.success) {
      setLineMessages((messages) => ({
        ...messages,
        [key]: result?.message || 'Could not complete and deduct blank.',
      }));
      setCompletingLine('');
      return;
    }

    setLineMessages((messages) => ({
      ...messages,
      [key]: result?.already_completed
        ? 'Completion is already recorded. No additional inventory was deducted.'
        : 'Completed and blank inventory deducted.',
    }));
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

    const outOfStockEntries = eligible.filter((entry) => outOfStockByLine[entry.key]);
    const inStockEntries = eligible.filter((entry) => !outOfStockByLine[entry.key]);

    if (!inStockEntries.length) {
      setBulkMessage(`${outOfStockEntries.length} open paired line item${outOfStockEntries.length === 1 ? ' is' : 's are'} out of stock and assigned to Pending Stock. Receive inventory before completing and deducting.`);
      return;
    }

    const missingBins = inStockEntries.filter((entry) => !selectedBinByLine[entry.key]);
    if (missingBins.length) {
      setBulkMessage(`Choose a source bin for line${missingBins.length === 1 ? '' : 's'} ${missingBins.map((entry) => entry.idx + 1).join(', ')} before completing all.`);
      return;
    }

    const skippedText = outOfStockEntries.length
      ? ` ${outOfStockEntries.length} out-of-stock line item${outOfStockEntries.length === 1 ? '' : 's'} will remain assigned to Pending Stock.`
      : '';
    const confirmed = window.confirm(`Complete and deduct blanks for ${inStockEntries.length} in-stock line item${inStockEntries.length === 1 ? '' : 's'}? This will reduce inventory.${skippedText}`);
    if (!confirmed) return;

    setCompletingAll(true);

    const successes = [];
    const failures = [];

    for (const entry of inStockEntries) {
      const result = await completePullSheetItemDeductBlankSafe({
        jobItemId: entry.jobItemId,
        blankProductId: entry.blankProductId,
        binId: toRpcBinId(selectedBinByLine[entry.key]),
        quantity: Number(
          entry.row.quantity
          || entry.row.qty
          || entry.row.quantity_needed
          || 1
        ),
        notes: 'Bulk completed and deducted blank from pull sheet screen.',
      });

      if (!result?.success) {
        failures.push(
          `Line ${entry.idx + 1}: ${result?.message || 'failed'}`
        );
      } else {
        successes.push(entry.idx + 1);
      }
    }

    setCompletingAll(false);
    const unassignedSummary = outOfStockEntries.length
      ? ` ${outOfStockEntries.length} out-of-stock line item${outOfStockEntries.length === 1 ? ' remains' : 's remain'} assigned to Pending Stock.`
      : '';

    setBulkMessage(failures.length
      ? `Completed ${successes.length}; ${failures.length} failed. ${failures.join(' ')}${unassignedSummary}`
      : `Completed and deducted blanks for ${successes.length} line item${successes.length === 1 ? '' : 's'}.${unassignedSummary}`);

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

  function openNonInventoryDialog(row, idx) {
    const key = rowKey(row, idx);
    const jobItemId = pickJobItemId(row);

    if (!jobItemId) {
      setLineMessages((messages) => ({
        ...messages,
        [key]: 'This line is missing a job item ID.',
      }));
      return;
    }

    const orderedSku = value(row.ordered_sku, row.order_sku, row.sku, '');

    setOverrideRow(null);
    setBlankSearch('');
    setBlankResults([]);
    setNonInventoryDialog({
      row,
      idx,
      key,
      jobItemId,
      reason:
        row.non_inventory_reason
        || 'No inventory tracking required for this WooCommerce item.',
      createFutureRule: false,
      includeOnPurchasingReport: isIncludedOnPurchasingReport(row),
      ruleMatchValue: orderedSku === '—' ? '' : orderedSku,
    });
  }

  async function saveNonInventoryDialog(event) {
    event.preventDefault();
    if (!nonInventoryDialog) return;

    const {
      jobItemId,
      key,
      reason,
      createFutureRule,
      includeOnPurchasingReport,
      ruleMatchValue,
    } = nonInventoryDialog;

    setNonInventorySaving(true);

    try {
      await markJobItemNonInventory({
        jobItemId,
        reason:
          String(reason || '').trim()
          || 'No inventory tracking required for this WooCommerce item.',
        createFutureRule,
        ruleType: 'exact_sku',
        ruleMatchValue,
        includeOnPurchasingReport,
      });

      setLineMessages((messages) => ({
        ...messages,
        [key]: includeOnPurchasingReport
          ? 'Marked non-inventory and included on the Purchasing Report.'
          : 'Marked non-inventory and excluded from the Purchasing Report.',
      }));
      setNonInventoryDialog(null);
      await load();
    } catch (err) {
      setLineMessages((messages) => ({
        ...messages,
        [key]: err.message || 'Could not mark the line as non-inventory.',
      }));
    } finally {
      setNonInventorySaving(false);
    }
  }

  async function changePurchasingReportInclusion(row, idx, include) {
    const key = rowKey(row, idx);
    const jobItemId = pickJobItemId(row);

    if (!jobItemId) {
      setLineMessages((messages) => ({
        ...messages,
        [key]: 'This line is missing a job item ID.',
      }));
      return;
    }

    setItems((currentItems) => currentItems.map((item, itemIndex) => (
      rowKey(item, itemIndex) === key
        ? { ...item, include_on_purchasing_report: include }
        : item
    )));
    setLineMessages((messages) => ({
      ...messages,
      [key]: 'Saving purchasing-report setting…',
    }));

    try {
      await setJobItemPurchasingReportInclusion({
        jobItemId,
        includeOnPurchasingReport: include,
      });

      setLineMessages((messages) => ({
        ...messages,
        [key]: include
          ? 'Included on the Purchasing Report.'
          : 'Excluded from the Purchasing Report.',
      }));
    } catch (err) {
      setItems((currentItems) => currentItems.map((item, itemIndex) => (
        rowKey(item, itemIndex) === key
          ? { ...item, include_on_purchasing_report: !include }
          : item
      )));
      setLineMessages((messages) => ({
        ...messages,
        [key]: err.message || 'Could not update the purchasing-report setting.',
      }));
    }
  }

  async function updateJobStatus(nextStatus) {
    if (!resolvedJobId) return;

    const statusLabel = nextStatus === 'voided' ? 'void this pull sheet' : 'mark this pull sheet complete';
    const confirmed = window.confirm(`Are you sure you want to ${statusLabel}? Inventory will not be changed.`);
    if (!confirmed) return;

    setJobStatusBusy(nextStatus);
    setBulkMessage('');

    try {
      await updatePullSheetStatus({ jobId: resolvedJobId, status: nextStatus });
    } catch (error) {
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
          const outOfStock = Boolean(outOfStockByLine[key]);
          const assignedToPendingStock = outOfStock && sourceBins.some(
            (bin) => isPendingStockBin(bin) && String(bin.bin_id) === String(selectedBinId)
          );
          const zeroOnHandWarning = blankProductId && outOfStock
            ? 'Out of stock — automatically assigned to Pending Stock. Receive the blank into inventory and refresh this pull sheet before completing and deducting.'
            : '';
          const isCompleting = completingLine === key;
          const nonInventory = isNonInventoryLine(row);
          const includedOnPurchasingReport = isIncludedOnPurchasingReport(row);
          const lineStatusLabel = nonInventory
            ? 'No Inventory Required'
            : (outOfStock ? 'Out of Stock — Pending Stock' : (warning ? 'Needs Review' : (row.pairing_status || rowStatus(row) || 'Matched')));

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
                    {nonInventory ? (
                      <>
                        <dt>Purchasing Report</dt>
                        <dd>{includedOnPurchasingReport ? 'Included' : 'Excluded'}</dd>
                        <dt>Reason</dt>
                        <dd>{value(row.non_inventory_reason, row.pairing_warning, 'No inventory tracking required')}</dd>
                      </>
                    ) : null}
                  </dl>
                </section>
              </div>
              {warning ? <div className="sc-warning-callout">{warning}</div> : null}
              {zeroOnHandWarning ? <div className="sc-warning-callout">{zeroOnHandWarning}</div> : null}

              {nonInventory ? (
                <div className="sc-non-inventory-line-controls">
                  <label className="sc-purchasing-report-toggle">
                    <input
                      type="checkbox"
                      checked={includedOnPurchasingReport}
                      onChange={(event) => changePurchasingReportInclusion(
                        row,
                        idx,
                        event.target.checked
                      )}
                    />
                    <span>
                      <strong>Include on Purchasing Report</strong>
                      <small>
                        Turn this off for fees, services, customer-supplied items,
                        or anything that does not need to be ordered.
                      </small>
                    </span>
                  </label>
                  <div className="sc-button-row">
                    <ActionButton tone="secondary" onClick={() => openNonInventoryDialog(row, idx)}>
                      Edit Non-Inventory Settings
                    </ActionButton>
                    <ActionButton tone="secondary" onClick={() => markPulledOnly(row, idx)}>
                      Mark Done / No Inventory Action
                    </ActionButton>
                  </div>
                </div>
              ) : blankProductId ? (
                <div className="sc-button-row" style={{ alignItems: 'center' }}>
                  <label style={{ display: 'grid', gap: 4, minWidth: 260 }}>
                    <span style={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase' }}>{outOfStock ? 'Assigned Bin' : 'Blank Source Bin'}</span>
                    <select
                      value={selectedBinId}
                      disabled={assignedToPendingStock}
                      onChange={(event) => changeSelectedBin(row, idx, event.target.value)}
                    >
                      {!outOfStock ? <option value="">Choose bin…</option> : null}
                      {sourceBins.map((bin) => (
                        <option key={bin.bin_id} value={bin.bin_id}>{binDisplayName(bin)}</option>
                      ))}
                    </select>
                  </label>
                  <ActionButton tone="warning" onClick={() => openOverrideEditor(row)}>Override Blank Pairing</ActionButton>
                  <ActionButton tone="secondary" onClick={() => openNonInventoryDialog(row, idx)}>Mark Non-Inventory</ActionButton>
                  <ActionButton tone="secondary" onClick={() => markPulledOnly(row, idx)}>Mark Pulled Only</ActionButton>
                  <ActionButton tone="primary" disabled={isCompleting || isClosedLine(row) || outOfStock} onClick={() => completeAndDeduct(row, idx)}>
                    {isCompleting ? 'Completing…' : (outOfStock ? 'Awaiting Stock' : 'Complete + Deduct Blank')}
                  </ActionButton>
                </div>
              ) : (
                <div className="sc-button-row">
                  <ActionButton tone="warning" onClick={() => openOverrideEditor(row)}>Override Blank Pairing</ActionButton>
                  <ActionButton tone="secondary" onClick={() => openNonInventoryDialog(row, idx)}>Mark Non-Inventory</ActionButton>
                  <ActionButton tone="secondary" onClick={() => markPulledOnly(row, idx)}>Mark Pulled Only</ActionButton>
                  <ActionButton tone="primary" disabled>Complete + Deduct Blank</ActionButton>
                </div>
              )}

              {nonInventoryDialog?.key === key ? (
                <InlineEditorPanel
                  title="Non-Inventory Line Settings"
                  description="These settings apply only to the pull-sheet line immediately above."
                  className="sc-pullsheet-inline-editor"
                >
                  <form onSubmit={saveNonInventoryDialog}>
                    <p>
                      This line will stay on the pull sheet but will not reserve or
                      deduct blank inventory. Choose separately whether it should
                      create purchasing demand.
                    </p>

                    <label className="sc-field">
                      <span>Reason shown on pull sheet</span>
                      <textarea
                        rows={3}
                        autoFocus
                        value={nonInventoryDialog.reason}
                        onChange={(event) => setNonInventoryDialog((current) => ({
                          ...current,
                          reason: event.target.value,
                        }))}
                      />
                    </label>

                    <label className="sc-purchasing-report-toggle">
                      <input
                        type="checkbox"
                        checked={nonInventoryDialog.includeOnPurchasingReport}
                        onChange={(event) => setNonInventoryDialog((current) => ({
                          ...current,
                          includeOnPurchasingReport: event.target.checked,
                        }))}
                      />
                      <span>
                        <strong>Include this item on the Purchasing Report</strong>
                        <small>
                          Checked: the linked blank remains a purchasing need.
                          Unchecked: this line is removed from purchasing demand.
                        </small>
                      </span>
                    </label>

                    <label className="sc-purchasing-report-toggle">
                      <input
                        type="checkbox"
                        checked={nonInventoryDialog.createFutureRule}
                        onChange={(event) => setNonInventoryDialog((current) => ({
                          ...current,
                          createFutureRule: event.target.checked,
                        }))}
                      />
                      <span>
                        <strong>Create a rule for future orders with this SKU</strong>
                        <small>
                          The future rule remembers both the non-inventory setting
                          and the purchasing-report choice.
                        </small>
                      </span>
                    </label>

                    <div className="sc-button-row sc-inline-editor__actions">
                      <ActionButton type="submit" tone="primary" disabled={nonInventorySaving}>
                        {nonInventorySaving ? 'Saving…' : 'Save Non-Inventory Settings'}
                      </ActionButton>
                      <ActionButton
                        type="button"
                        tone="secondary"
                        disabled={nonInventorySaving}
                        onClick={() => setNonInventoryDialog(null)}
                      >
                        Cancel
                      </ActionButton>
                    </div>
                  </form>
                </InlineEditorPanel>
              ) : null}

              {overrideRow && rowKey(overrideRow) === key ? (
                <InlineEditorPanel
                  title="Override Blank Pairing"
                  description="Search for the correct blank for the pull-sheet line immediately above."
                  className="sc-pullsheet-inline-editor"
                >
                  <div className="sc-inline-search">
                    <input
                      autoFocus
                      value={blankSearch}
                      onChange={(event) => setBlankSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          searchBlanks();
                        }
                      }}
                      placeholder="Search SKU or blank product name"
                    />
                    <ActionButton tone="secondary" onClick={searchBlanks}>Search</ActionButton>
                  </div>
                  <div className="sc-blank-result-list">
                    {blankResults.map((blankProduct) => (
                      <button
                        key={blankProduct.id}
                        type="button"
                        onClick={() => applyOverride(blankProduct.id)}
                      >
                        <strong>{blankProduct.sku_base || blankProduct.name}</strong>
                        <span>{blankProduct.name}</span>
                      </button>
                    ))}
                    {!blankResults.length ? (
                      <p className="sc-muted">Enter a SKU or product name, then select Search.</p>
                    ) : null}
                  </div>
                  <div className="sc-button-row sc-inline-editor__actions">
                    <ActionButton tone="secondary" onClick={() => setOverrideRow(null)}>
                      Cancel
                    </ActionButton>
                  </div>
                </InlineEditorPanel>
              ) : null}

              {lineMessage ? <div className="sc-warning-callout">{lineMessage}</div> : null}
            </article>
          );
        })}
      </div>

    </main>
  );
}
