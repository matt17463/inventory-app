import React, { useEffect, useMemo, useState } from 'react';
import { getSupplierReceivingHistory, parseSupplierConfirmation, supplierReceivingAction } from './lib/supplierReceivingApi';

function optionLabel(row, type) {
  if (type === 'bin') return row.display_name || row.label || row.bin_code || row.id;
  return [row.name || row.label || row.code || row.id, row.code && row.code !== row.name ? `(${row.code})` : ''].filter(Boolean).join(' ');
}

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `receive-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function statusText(value) {
  return String(value || '').replaceAll('_', ' ');
}

function missingReceivingFields(row) {
  const missing = [];
  if (!row.bin_id) missing.push('Bin');
  if (!row.brand_id && !row.brand) missing.push('Brand');
  if (!row.product_type_id && !row.style) missing.push('Style');
  if (!row.color_id) missing.push('Color');
  if (!row.size_id) missing.push('Size');
  if (!row.blank_product_id && String(row.unit_cost ?? '').trim() === '') missing.push('Unit Cost');
  if (String(row.unit_cost ?? '').trim() !== '' && (!Number.isFinite(Number(row.unit_cost)) || Number(row.unit_cost) < 0)) {
    missing.push('Valid Unit Cost');
  }
  return missing;
}

export default function SupplierConfirmationReceiving({ lookups, defaultBinId, resolveBlank, refreshLookups }) {
  const [file, setFile] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [rows, setRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [autoCreateLookups, setAutoCreateLookups] = useState(true);
  const [rowFilter, setRowFilter] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [bulkChoice, setBulkChoice] = useState({ bin_id: '', color_id: '', size_id: '' });
  const [receiveRequestKey, setReceiveRequestKey] = useState(() => idempotencyKey());

  async function loadHistory({ quiet = false } = {}) {
    try {
      const result = await getSupplierReceivingHistory();
      setHistory(result.history || []);
    } catch (error) {
      if (!quiet) setMessage(error.message);
    }
  }

  useEffect(() => { loadHistory({ quiet: true }); }, []);

  useEffect(() => {
    if (!defaultBinId) return;
    setRows((current) => current.map((row) => ({ ...row, bin_id: row.bin_id || defaultBinId })));
  }, [defaultBinId]);

  const selected = useMemo(() => rows.filter((row) => row.selected && Number(row.receive_now) > 0), [rows]);
  const selectedIssues = useMemo(() => selected
    .map((row) => ({ row, missing: missingReceivingFields(row) }))
    .filter((item) => item.missing.length), [selected]);
  const readySelected = useMemo(() => selected.filter((row) => missingReceivingFields(row).length === 0), [selected]);
  const selectedUnits = selected.reduce((sum, row) => sum + Number(row.receive_now || 0), 0);
  const readyUnits = readySelected.reduce((sum, row) => sum + Number(row.receive_now || 0), 0);
  const visibleRows = useMemo(() => {
    const term = rowFilter.trim().toLowerCase();
    return rows.map((row, index) => ({ row, index })).filter(({ row }) => {
      if (reviewOnly && missingReceivingFields(row).length === 0) return false;
      if (!term) return true;
      return [row.supplier_sku, row.description, row.brand, row.style, row.color, row.size]
        .filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [rows, rowFilter, reviewOnly]);

  function updateRow(index, patch) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function select(value, onChange, list, placeholder, type = 'lookup') {
    return (
      <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {list.map((row) => <option key={row.id} value={row.id}>{optionLabel(row, type)}</option>)}
      </select>
    );
  }

  async function parseFile() {
    if (!file) { setMessage('Choose a supplier confirmation PDF first.'); return; }
    setBusy('parse'); setMessage('');
    try {
      const result = await parseSupplierConfirmation(file);
      const parsed = result.confirmation;
      setConfirmation(parsed);
      setReceiveRequestKey(idempotencyKey());
      setRows((parsed.lines || []).map((row) => ({
        ...row,
        selected: Number(row.remaining_quantity) > 0,
        receive_now: Number(row.remaining_quantity || 0),
        bin_id: defaultBinId || '',
        remember_mapping: true,
      })));
      await supplierReceivingAction({
        action: 'save_draft', confirmation: parsed,
        rows: (parsed.lines || []).map((row) => ({ ...row, receive_now: Number(row.remaining_quantity || 0) })),
      });
      setMessage(parsed.duplicate_order
        ? `Order ${parsed.order_number} was imported before. Previously received quantities are shown; only remaining units can be received.`
        : `${parsed.total_lines} lines and ${parsed.total_units} units were read. Review yellow/red rows before receiving.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  }

  function applyBulkChoice() {
    const patch = Object.fromEntries(Object.entries(bulkChoice).filter(([, value]) => value));
    if (!Object.keys(patch).length) { setMessage('Choose a bin, color, or size to apply.'); return; }
    setRows((current) => current.map((row) => row.selected ? { ...row, ...patch, blank_product_id: '' } : row));
    setMessage(`Bulk choices applied to ${rows.filter((row) => row.selected).length} selected row(s).`);
  }

  async function receiveSelected() {
    if (!confirmation) return;
    setBusy('receive'); setMessage('');
    try {
      if (selectedIssues.length) {
        const examples = selectedIssues.slice(0, 5)
          .map(({ row, missing }) => `${row.supplier_sku || 'Supplier line'}: ${missing.join(', ')}`)
          .join('; ');
        throw new Error(`${selectedIssues.length} selected line(s) still need review. ${examples}${selectedIssues.length > 5 ? `; plus ${selectedIssues.length - 5} more` : ''}. Correct those fields or use “Select Ready Rows” to receive only completed lines.`);
      }
      let rowsToPrepare = selected;
      let createdLookups = [];
      if (autoCreateLookups) {
        const lookupResult = await supplierReceivingAction({ action: 'ensure_lookups', rows: selected });
        rowsToPrepare = lookupResult.rows || selected;
        createdLookups = lookupResult.created_lookups || [];
        const resolvedByKey = new Map(rowsToPrepare.map((row) => [row.supplier_line_key, row]));
        setRows((current) => current.map((row) => ({ ...row, ...(resolvedByKey.get(row.supplier_line_key) || {}) })));
      }
      const prepared = [];
      for (const row of rowsToPrepare) {
        if (!row.bin_id) throw new Error(`${row.supplier_sku}: choose a receiving bin.`);
        let blankId = row.blank_product_id;
        let created = false;
        if (!blankId) {
          if (!row.brand_id || !row.product_type_id || !row.color_id || !row.size_id) {
            throw new Error(`${row.supplier_sku}: complete Brand, Style, Color, and Size.`);
          }
          const resolved = await resolveBlank(row);
          blankId = resolved.blank?.id;
          created = Boolean(resolved.created);
        }
        if (!blankId) throw new Error(`${row.supplier_sku}: no blank product mapping was found. Enable creation or correct the four item fields.`);
        prepared.push({ ...row, blank_product_id: String(blankId), blank_created: created });
      }
      const result = await supplierReceivingAction({
        action: 'commit', idempotency_key: receiveRequestKey, confirmation, rows: prepared, notes,
      });
      const received = Number(result.receipt?.received_units || 0);
      setReceiveRequestKey(idempotencyKey());
      setMessage(`${result.duplicate_request ? 'This receiving request was already processed. ' : ''}${received} unit(s) received into inventory.${createdLookups.length ? ` Created ${createdLookups.map((item) => `${item.type} ${item.name}`).join(', ')}.` : ''}${result.errors?.length ? ` Review: ${result.errors.join('; ')}` : ''}${result.warnings?.length ? ` Mapping warnings: ${result.warnings.join('; ')}` : ''}`);
      await loadHistory({ quiet: true });
      if (createdLookups.length && refreshLookups) await refreshLookups();
      if (file) await parseFile();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  }

  async function openDocument(entry) {
    try {
      const result = await supplierReceivingAction({
        action: 'document_url', document_path: entry.document_path,
        document_storage_provider: entry.document_storage_provider,
        document_storage_bucket: entry.document_storage_bucket,
      });
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) { setMessage(error.message); }
  }

  async function rollback(receipt) {
    const reason = window.prompt('Reason for rolling back this receipt:', 'Receiving entry correction');
    if (reason == null) return;
    setBusy(`rollback-${receipt.id}`); setMessage('');
    try {
      await supplierReceivingAction({ action: 'rollback', receipt_id: receipt.id, reason });
      setMessage(`Receipt from ${new Date(receipt.created_at).toLocaleString()} was rolled back.`);
      await loadHistory({ quiet: true });
    } catch (error) { setMessage(error.message); }
    finally { setBusy(''); }
  }

  return (
    <section className="sc-panel supplier-confirmation-panel">
      <div className="sc-panel-header">
        <div>
          <h3>Import Supplier Order Confirmation</h3>
          <p>Upload an S&amp;S Activewear or Momentec PDF, review its matches, enter actual quantities received, and then add them to inventory. Supplier colors are matched to the existing WooCommerce color list and active color-pairing rules.</p>
        </div>
      </div>
      <div className="supplier-upload-row">
        <label className="sc-field"><span>Order confirmation PDF</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => { setFile(event.target.files?.[0] || null); setReceiveRequestKey(idempotencyKey()); }} /></label>
        <button className="sc-btn sc-btn-primary" onClick={parseFile} disabled={!file || Boolean(busy)}>{busy === 'parse' ? 'Reading PDF…' : 'Read Confirmation'}</button>
      </div>
      {message && <div className="sc-alert">{message}</div>}

      {confirmation && (
        <>
          <div className="supplier-order-summary">
            <strong>{confirmation.supplier_name}</strong><span>Order {confirmation.order_number}</span>
            <span>PO {confirmation.po_number || 'not supplied'}</span><span>{confirmation.total_lines} lines</span><span>{confirmation.total_units} units ordered</span>
            <span>${Number(confirmation.subtotal || 0).toFixed(2)}</span>
          </div>
          <div className="supplier-bulk-actions">
            <button className="sc-btn sc-btn-small" onClick={() => setRows(rows.map((row) => ({ ...row, selected: Number(row.remaining_quantity) > 0 })))}>Select Remaining</button>
            <button className="sc-btn sc-btn-small" onClick={() => setRows(rows.map((row) => ({ ...row, selected: Number(row.remaining_quantity) > 0 && missingReceivingFields(row).length === 0 })))}>Select Ready Rows</button>
            <button className="sc-btn sc-btn-small" onClick={() => setRows(rows.map((row) => ({ ...row, selected: false })))}>Clear Selection</button>
            <button className="sc-btn sc-btn-small" disabled={!defaultBinId} onClick={() => setRows(rows.map((row) => ({ ...row, bin_id: defaultBinId })))}>Apply Default Bin to All</button>
            <label className="supplier-auto-lookup-toggle"><input type="checkbox" checked={autoCreateLookups} onChange={(event) => setAutoCreateLookups(event.target.checked)} /> Create missing Brands and Styles when receiving</label>
          </div>
          <div className="sc-toolbar supplier-review-toolbar">
            <input className="sc-search-input" value={rowFilter} onChange={(event) => setRowFilter(event.target.value)} placeholder="Filter supplier SKU, product, color, or size…" />
            <label><input type="checkbox" checked={reviewOnly} onChange={(event) => setReviewOnly(event.target.checked)} /> Show review rows only</label>
            {select(bulkChoice.bin_id, (value) => setBulkChoice((current) => ({ ...current, bin_id: value })), lookups.bins, 'Bulk bin', 'bin')}
            {select(bulkChoice.color_id, (value) => setBulkChoice((current) => ({ ...current, color_id: value })), lookups.colors, 'Bulk color')}
            {select(bulkChoice.size_id, (value) => setBulkChoice((current) => ({ ...current, size_id: value })), lookups.sizes, 'Bulk size')}
            <button type="button" className="sc-btn sc-btn-small" onClick={applyBulkChoice}>Apply to Selected</button>
          </div>
          <div className="supplier-receiving-table-wrap">
            <table className="supplier-receiving-table">
              <thead><tr><th>Use</th><th>Match</th><th>Supplier item</th><th>Brand / Style</th><th>Color / Size</th><th>Ordered</th><th>Received</th><th>Receive now</th><th>Bin</th><th>Cost</th><th>Remember</th></tr></thead>
              <tbody>{visibleRows.map(({ row, index }) => {
                const remaining = Number(row.remaining_quantity || 0);
                const missingFields = missingReceivingFields(row);
                const ready = remaining > 0 && missingFields.length === 0;
                return (
                  <tr key={`${row.supplier_line_key}-${index}`} className={`supplier-match-${ready ? 'matched' : row.match_status}`}>
                    <td><input type="checkbox" checked={Boolean(row.selected)} disabled={remaining <= 0} onChange={(event) => updateRow(index, { selected: event.target.checked })} /></td>
                    <td><span className={`sc-badge ${ready ? 'success' : row.match_status === 'review' ? 'warning' : 'danger'}`}>{ready ? 'ready' : row.match_status}</span><small>{ready ? 'ready to receive' : `Missing: ${missingFields.join(', ') || statusText(row.match_method)}`}</small></td>
                    <td><strong>{row.supplier_sku}</strong><small>{row.description}</small></td>
                    <td>{select(row.brand_id, (value) => updateRow(index, { brand_id: value, blank_product_id: '' }), lookups.brands, row.brand || 'Choose brand')}{select(row.product_type_id, (value) => updateRow(index, { product_type_id: value, blank_product_id: '' }), lookups.product_types, row.style || 'Choose style')}</td>
                    <td>{select(row.color_id, (value) => updateRow(index, { color_id: value, blank_product_id: '', color_match_method: value ? 'manual pairing — will be remembered' : 'choose existing WooCommerce color' }), lookups.colors, row.color || 'Choose color')}<small>{row.color_match_method || 'choose existing WooCommerce color'}</small>{select(row.size_id, (value) => updateRow(index, { size_id: value, blank_product_id: '' }), lookups.sizes, row.size || 'Choose size')}</td>
                    <td>{row.ordered_quantity}</td><td>{row.previously_received || 0}</td>
                    <td><input type="number" min="0" max={remaining} value={row.receive_now} onChange={(event) => updateRow(index, { receive_now: Math.min(remaining, Math.max(0, Number(event.target.value))) })} /></td>
                    <td>{select(row.bin_id, (value) => updateRow(index, { bin_id: value }), lookups.bins, 'Choose bin', 'bin')}</td>
                    <td><input type="number" min="0" step="0.01" value={row.unit_cost} onChange={(event) => updateRow(index, { unit_cost: event.target.value })} /></td>
                    <td><input type="checkbox" checked={row.remember_mapping !== false} title="Remember the supplier SKU and supplier color pairing for future imports" onChange={(event) => updateRow(index, { remember_mapping: event.target.checked })} /></td>
                  </tr>
                );
              })}{visibleRows.length === 0 && <tr><td colSpan="11" className="sc-empty-cell">No supplier lines match this filter.</td></tr>}</tbody>
            </table>
          </div>
          <div className="supplier-receive-footer">
            <label className="sc-field"><span>Receipt note</span><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Packing slip, shortage, or receiving note" /></label>
            <div className="supplier-readiness-summary">
              <strong>{readySelected.length} selected row(s) ready · {readyUnits} unit(s)</strong>
              {selectedIssues.length > 0 && <small>{selectedIssues.length} selected row(s) still need review</small>}
            </div>
            <button className="sc-btn sc-btn-primary" onClick={receiveSelected} disabled={!selected.length || Boolean(busy)}>{busy === 'receive' ? 'Receiving…' : `Receive ${selectedUnits} Selected Unit(s)`}</button>
          </div>
        </>
      )}

      <details className="supplier-history" onToggle={(event) => event.currentTarget.open && loadHistory({ quiet: true })}>
        <summary>Supplier receiving history ({history.length})</summary>
        <div className="supplier-history-list">
          {history.length === 0 && <p>No supplier confirmations have been received yet.</p>}
          {history.map((entry) => (
            <article key={entry.id}>
              <div><strong>{entry.supplier_name} — Order {entry.order_number}</strong><span className="sc-badge">{statusText(entry.status)}</span></div>
              <p>{entry.received_units} of {entry.ordered_units} units received · {new Date(entry.created_at).toLocaleString()}</p>
              <div className="supplier-history-actions">
                {entry.document_path && <button className="sc-btn sc-btn-small" onClick={() => openDocument(entry)}>Open Original PDF</button>}
                {(entry.receipts || []).filter((receipt) => receipt.status !== 'rolled_back' && Number(receipt.received_units) > 0).map((receipt) => (
                  <button className="sc-btn sc-btn-danger sc-btn-small" key={receipt.id} disabled={Boolean(busy)} onClick={() => rollback(receipt)}>Rollback {receipt.received_units} units from {new Date(receipt.created_at).toLocaleDateString()}</button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}
