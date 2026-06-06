import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  addPullSheetItem,
  completeJobItem,
  deletePullSheetItem,
  deductFinishedInventoryForJobItem,
  findBlankProductsByScannedValue,
  formatBinLabel,
  formatBlankProductLabel,
  getBins,
  getFinishedMatchesForPullSheetItem,
  pullSheetStatusLabel,
  returnPullSheetItemToFinishedInventory,
  updatePullSheetItemStatus,
  updatePullSheetStatus,
} from './lib/inventoryApi';
import {
  getPullSheetItemsWithPairings,
  overrideJobItemBlankPairing,
} from './lib/pullSheetPairingApi';

const JOB_STATUSES = [
  ['draft', 'Draft'],
  ['ready_to_pull', 'Ready to Pull'],
  ['pulled', 'Pulled'],
  ['in_production', 'In Production'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
  ['reserved', 'Reserved'],
];

function valueOrDash(value) {
  return value === null || value === undefined || value === '' ? '—' : value;
}

function orderedProductLabel(item) {
  return [item.ordered_brand, item.ordered_style, item.ordered_color, item.ordered_size]
    .filter(Boolean)
    .join(' / ') || valueOrDash(item.ordered_name || item.ordered_sku);
}

function pairedBlankLabel(item) {
  return [item.paired_blank_brand, item.paired_blank_style, item.paired_blank_color, item.paired_blank_size]
    .filter(Boolean)
    .join(' / ') || valueOrDash(item.paired_blank_name || item.paired_blank_sku_base);
}

export default function PullSheetView() {
  const { jobId } = useParams();
  const [items, setItems] = useState([]);
  const [bins, setBins] = useState([]);
  const [selectedBins, setSelectedBins] = useState({});
  const [selectedFinishedBins, setSelectedFinishedBins] = useState({});
  const [finishedMatches, setFinishedMatches] = useState({});
  const [returnFinishedBins, setReturnFinishedBins] = useState({});
  const [message, setMessage] = useState('');
  const [blankSearch, setBlankSearch] = useState('');
  const [blankResults, setBlankResults] = useState([]);
  const [selectedBlank, setSelectedBlank] = useState(null);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState('');
  const [newItem, setNewItem] = useState({ quantity: 1, logo: '', placement: '', notes: '' });

  const [overrideItem, setOverrideItem] = useState(null);
  const [overrideSearch, setOverrideSearch] = useState('');
  const [overrideResults, setOverrideResults] = useState([]);
  const [overrideBlank, setOverrideBlank] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  const job = items[0] || null;

  async function load() {
    setMessage('');
    try {
      const [itemRows, binRows] = await Promise.all([
        getPullSheetItemsWithPairings(jobId),
        getBins(),
      ]);
      setItems(itemRows);
      setBins(binRows);
      setStatus(itemRows[0]?.job_status || 'ready_to_pull');

      const matchEntries = await Promise.all(
        itemRows.map(async (item) => {
          try {
            const matches = await getFinishedMatchesForPullSheetItem({
              ...item,
              job_item_id: item.job_item_id,
              blank_product_id: item.paired_blank_product_id,
              blank_sku_base: item.paired_blank_sku_base,
              blank_name: item.paired_blank_name,
              color: item.paired_blank_color,
              size: item.paired_blank_size,
            });
            return [item.job_item_id, matches];
          } catch {
            return [item.job_item_id, []];
          }
        })
      );
      setFinishedMatches(Object.fromEntries(matchEntries));
    } catch (err) {
      setMessage(err.message || 'Failed to load pull sheet.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const totals = useMemo(() => {
    const qty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const completed = items.filter((item) => item.item_status === 'completed').length;
    const review = items.filter((item) => item.pairing_status !== 'paired').length;
    const finishedAvailable = Object.values(finishedMatches).flat().reduce((sum, item) => sum + Number(item.total_quantity ?? item.quantity_on_hand ?? 0), 0);
    return { qty, completed, lines: items.length, review, finishedAvailable };
  }, [items, finishedMatches]);

  async function searchBlanks(event) {
    event.preventDefault();
    setMessage('');
    setSelectedBlank(null);
    try {
      const rows = await findBlankProductsByScannedValue(blankSearch);
      setBlankResults(rows.slice(0, 50));
      if (!rows.length) setMessage('No blank items found for that search.');
    } catch (err) {
      setMessage(err.message || 'Failed to search blank items.');
    }
  }

  async function handleAddItem(event) {
    event.preventDefault();
    if (!selectedBlank) return setMessage('Choose a blank item first.');
    setAdding(true);
    setMessage('');
    try {
      await addPullSheetItem({
        jobId,
        blankProductId: selectedBlank.id,
        quantity: newItem.quantity,
        logo: newItem.logo,
        placement: newItem.placement,
        notes: newItem.notes,
      });
      setMessage('Added item to pull sheet.');
      setBlankSearch('');
      setBlankResults([]);
      setSelectedBlank(null);
      setNewItem({ quantity: 1, logo: '', placement: '', notes: '' });
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to add pull sheet item.');
    } finally {
      setAdding(false);
    }
  }

  async function markCompleted(item) {
    const binId = selectedBins[item.job_item_id] || item.selected_bin_id;
    if (!binId) return setMessage('Choose the bin the garments were pulled from before completing this line.');
    try {
      await completeJobItem({ jobItemId: item.job_item_id, binId, notes: `Pulled ${item.quantity} for ${item.paired_blank_sku_base || item.paired_blank_name}` });
      setMessage('Line completed and inventory deducted from the selected bin.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to complete item.');
    }
  }

  async function useFinishedInventory(item, finishedProduct) {
    const binId = selectedFinishedBins[item.job_item_id] || finishedProduct.bin_id;
    if (!binId) return setMessage('Choose the finished-products bin to pull from.');
    try {
      await deductFinishedInventoryForJobItem({ jobItemId: item.job_item_id, finishedProductId: finishedProduct.finished_product_id, binId, quantity: item.quantity, notes: `Used finished inventory for ${item.paired_blank_sku_base || item.paired_blank_name}` });
      setMessage('Finished inventory was used and deducted. Pull sheet line marked completed.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to use finished inventory.');
    }
  }

  async function returnLineToFinishedInventory(item) {
    const binId = returnFinishedBins[item.job_item_id];
    if (!binId) return setMessage('Choose the finished-products bin where this completed item will be stored.');
    try {
      await returnPullSheetItemToFinishedInventory({ jobItemId: item.job_item_id, binId, quantity: item.quantity, notes: `Returned finished goods for ${item.paired_blank_sku_base || item.paired_blank_name}` });
      setMessage('Completed item was added to finished products inventory.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to return item to finished inventory.');
    }
  }

  async function markPulledOnly(item) {
    try {
      await updatePullSheetItemStatus({ jobItemId: item.job_item_id, status: 'pulled' });
      setMessage('Line marked pulled. Inventory was not deducted.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to update line.');
    }
  }

  async function removeItem(item) {
    if (!confirm('Remove this pull sheet line?')) return;
    try {
      await deletePullSheetItem(item.job_item_id);
      setMessage('Line removed.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to remove line.');
    }
  }

  async function saveStatus(nextStatus) {
    setStatus(nextStatus);
    try {
      await updatePullSheetStatus({ jobId, status: nextStatus });
      setMessage('Pull sheet status updated.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to update pull sheet status.');
    }
  }

  function openOverride(item) {
    setOverrideItem(item);
    setOverrideSearch([item.paired_blank_brand || item.ordered_brand, item.paired_blank_style || item.ordered_style, item.paired_blank_color || item.ordered_color, item.paired_blank_size || item.ordered_size].filter(Boolean).join(' '));
    setOverrideResults([]);
    setOverrideBlank(null);
    setOverrideReason('Correcting blank pairing for ordered product.');
  }

  async function searchOverrideBlanks(event) {
    event.preventDefault();
    setOverrideBlank(null);
    try {
      const rows = await findBlankProductsByScannedValue(overrideSearch);
      setOverrideResults(rows.slice(0, 75));
      if (!rows.length) setMessage('No replacement blanks found for that search.');
    } catch (err) {
      setMessage(err.message || 'Failed to search replacement blanks.');
    }
  }

  async function saveOverride() {
    if (!overrideItem || !overrideBlank) return setMessage('Choose a replacement blank first.');
    setSavingOverride(true);
    setMessage('');
    try {
      await overrideJobItemBlankPairing({ jobItemId: overrideItem.job_item_id, blankProductId: overrideBlank.id, reason: overrideReason });
      setMessage('Blank pairing was updated for this pull sheet line.');
      setOverrideItem(null);
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to update blank pairing.');
    } finally {
      setSavingOverride(false);
    }
  }

  return (
    <main className="page pullsheet-page pairing-pullsheet-page">
      <div className="page-heading-row">
        <div>
          <Link to="/pullsheets" className="back-link">← Pull Sheets</Link>
          <h1>{job?.job_name || 'Pull Sheet'}</h1>
          <p className="muted">
            {job?.customer_name || 'No customer'} {job?.woocommerce_order_id ? `• Order ${job.woocommerce_order_id}` : ''} {job?.due_date ? `• Due ${job.due_date}` : ''}
          </p>
        </div>
        <div className="pullsheet-status-card">
          <label>Status
            <select value={status} onChange={(event) => saveStatus(event.target.value)}>
              {JOB_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {message && <p className="message">{message}</p>}

      <section className="kpi-grid compact-kpis">
        <div className="kpi-card"><span>{totals.lines}</span><strong>Lines</strong><small>Ordered items</small></div>
        <div className="kpi-card"><span>{totals.qty}</span><strong>Total Qty</strong><small>Garments to pull</small></div>
        <div className="kpi-card"><span>{totals.review}</span><strong>Pairings to Review</strong><small>Warnings/missing blank</small></div>
        <div className="kpi-card"><span>{totals.completed}</span><strong>Completed</strong><small>Lines deducted</small></div>
        <div className="kpi-card"><span>{totals.finishedAvailable}</span><strong>Finished Stock</strong><small>Matching units found</small></div>
      </section>

      <section className="content-two-column">
        <section className="card elevated-card">
          <h2>Add Blank Needed for Job</h2>
          <p className="muted">Use this for manual additions. WooCommerce-generated lines should already show the ordered product and the paired blank below.</p>
          <label>Search Blank Item
            <div className="inline-action-row">
              <input value={blankSearch} onChange={(event) => setBlankSearch(event.target.value)} placeholder="Gildan 18500 Navy A2XL" />
              <button type="button" onClick={searchBlanks}>Search Blanks</button>
            </div>
          </label>
          {blankResults.length > 0 && <div className="search-result-list">{blankResults.map((product) => (
            <button type="button" key={product.id} className={selectedBlank?.id === product.id ? 'result-card selected' : 'result-card'} onClick={() => setSelectedBlank(product)}>
              <strong>{product.sku_base}</strong><span>{formatBlankProductLabel(product)}</span>
            </button>
          ))}</div>}
          {selectedBlank && <p className="selected-item-note">Selected: <strong>{formatBlankProductLabel(selectedBlank)}</strong></p>}
          <label>Quantity<input type="number" min="1" value={newItem.quantity} onChange={(event) => setNewItem((prev) => ({ ...prev, quantity: event.target.value }))} /></label>
          <label>Logo / Design<input value={newItem.logo} onChange={(event) => setNewItem((prev) => ({ ...prev, logo: event.target.value }))} placeholder="Bremerton Fastpitch" /></label>
          <label>Placement<input value={newItem.placement} onChange={(event) => setNewItem((prev) => ({ ...prev, placement: event.target.value }))} placeholder='Left chest (3.5")' /></label>
          <label>Notes<textarea value={newItem.notes} onChange={(event) => setNewItem((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Optional line notes" /></label>
          <button className="primary-action" type="button" onClick={handleAddItem} disabled={adding}>{adding ? 'Adding...' : 'Add Selected Blank to Pull Sheet'}</button>
        </section>

        <section className="card elevated-card">
          <h2>Pairing Review</h2>
          <p className="muted">Each line shows what the customer ordered and what blank the app paired to that ordered item. Use Override Blank Pairing only when the selected blank is incorrect.</p>
          <ol className="simple-steps">
            <li>Confirm the ordered SKU/name matches the customer order.</li>
            <li>Confirm the paired blank brand, style, color, and size are correct.</li>
            <li>If wrong, click Override Blank Pairing and choose the correct blank.</li>
            <li>After pairings are correct, pull from bins or use finished inventory.</li>
          </ol>
        </section>
      </section>

      <section className="card elevated-card">
        <h2>Ordered Items and Blank Pairings</h2>
        {!items.length ? <p className="muted">No items added yet.</p> : (
          <div className="pairing-card-list">
            {items.map((item) => (
              <article className={`pull-pairing-card pairing-${item.pairing_status}`} key={item.job_item_id}>
                <div className="pairing-card-header">
                  <div><h3>Qty {item.quantity}</h3><p className="muted">Line #{item.job_item_id} • {pullSheetStatusLabel(item.item_status)}</p></div>
                  <span className={`status-pill status-${item.pairing_status}`}>{item.pairing_status === 'paired' ? 'Paired' : 'Review'}</span>
                </div>

                <div className="ordered-vs-blank-grid">
                  <div className="pairing-side ordered-side">
                    <h4>Customer Ordered</h4>
                    <p><strong>{valueOrDash(item.ordered_sku)}</strong></p>
                    <p>{valueOrDash(item.ordered_name)}</p>
                    <dl>
                      <dt>Brand</dt><dd>{valueOrDash(item.ordered_brand)}</dd>
                      <dt>Style</dt><dd>{valueOrDash(item.ordered_style)}</dd>
                      <dt>Color</dt><dd>{valueOrDash(item.ordered_color)}</dd>
                      <dt>Size</dt><dd>{valueOrDash(item.ordered_size)}</dd>
                    </dl>
                  </div>

                  <div className="pairing-arrow">→</div>

                  <div className="pairing-side blank-side">
                    <h4>App Paired Blank</h4>
                    <p><strong>{valueOrDash(item.paired_blank_sku_base)}</strong></p>
                    <p>{valueOrDash(item.paired_blank_name)}</p>
                    <dl>
                      <dt>Brand</dt><dd>{valueOrDash(item.paired_blank_brand)}</dd>
                      <dt>Style</dt><dd>{valueOrDash(item.paired_blank_style)}</dd>
                      <dt>Color</dt><dd>{valueOrDash(item.paired_blank_color)}</dd>
                      <dt>Size</dt><dd>{valueOrDash(item.paired_blank_size)}</dd>
                    </dl>
                  </div>
                </div>

                <div className="pairing-warning-row">
                  <span>{item.pairing_warning}</span>
                  <button type="button" onClick={() => openOverride(item)}>Override Blank Pairing</button>
                </div>

                <div className="pairing-meta-grid">
                  <div><strong>Logo / Artwork</strong><p>{valueOrDash(item.logo || item.line_notes)}</p></div>
                  <div><strong>Placement</strong><p>{valueOrDash(item.placement)}</p></div>
                  <div><strong>Ordered Product Summary</strong><p>{orderedProductLabel(item)}</p></div>
                  <div><strong>Paired Blank Summary</strong><p>{pairedBlankLabel(item)}</p></div>
                </div>

                <div className="pull-actions-grid">
                  <label>Blank Source Bin
                    <select value={selectedBins[item.job_item_id] || item.selected_bin_id || ''} onChange={(event) => setSelectedBins((prev) => ({ ...prev, [item.job_item_id]: event.target.value }))}>
                      <option value="">Choose bin...</option>
                      {bins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin)}</option>)}
                    </select>
                  </label>
                  <button disabled={item.item_status === 'completed' || !item.paired_blank_product_id} onClick={() => markCompleted(item)}>Complete + Deduct Blank</button>
                  <button disabled={item.item_status === 'completed'} type="button" onClick={() => markPulledOnly(item)}>Mark Pulled Only</button>
                  <button type="button" className="danger-button" onClick={() => removeItem(item)}>Remove Line</button>
                </div>

                <details className="finished-stock-details">
                  <summary>Finished stock and returns</summary>
                  <div className="finished-match-panel">
                    <strong>Matching finished stock</strong>
                    {(finishedMatches[item.job_item_id] || []).length ? (finishedMatches[item.job_item_id] || []).map((match) => (
                      <div className="finished-match-card" key={`${match.finished_product_id}-${match.bin_id || 'all'}`}>
                        <span>{match.finished_sku}</span>
                        <small>{match.customer || match.customer_name || 'No customer'} • {match.logo || match.logo_name || 'No logo'} • {match.placement || 'No placement'}</small>
                        <small>{match.bin_code || 'Any bin'} {match.bin_label ? `- ${match.bin_label}` : ''} • {match.total_quantity ?? match.quantity_on_hand ?? 0} available</small>
                        <select value={selectedFinishedBins[item.job_item_id] || match.bin_id || ''} onChange={(event) => setSelectedFinishedBins((prev) => ({ ...prev, [item.job_item_id]: event.target.value }))}>
                          <option value="">Choose finished bin...</option>
                          {bins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin)}</option>)}
                        </select>
                        <button disabled={item.item_status === 'completed'} type="button" onClick={() => useFinishedInventory(item, match)}>Use Finished</button>
                      </div>
                    )) : <small>No matching finished stock.</small>}
                  </div>
                  <div className="finished-return-panel">
                    <strong>Return decorated extras</strong>
                    <select value={returnFinishedBins[item.job_item_id] || ''} onChange={(event) => setReturnFinishedBins((prev) => ({ ...prev, [item.job_item_id]: event.target.value }))}>
                      <option value="">Finished-products bin...</option>
                      {bins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin)}</option>)}
                    </select>
                    <button type="button" onClick={() => returnLineToFinishedInventory(item)}>Return Finished to Inventory</button>
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>

      {overrideItem && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card pairing-override-modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Override Blank Pairing</h2>
              <button type="button" onClick={() => setOverrideItem(null)}>×</button>
            </div>
            <p className="muted">Ordered item: <strong>{valueOrDash(overrideItem.ordered_sku)}</strong> — {valueOrDash(overrideItem.ordered_name)}</p>
            <p>Current blank: <strong>{pairedBlankLabel(overrideItem)}</strong></p>
            <form onSubmit={searchOverrideBlanks} className="override-search-form">
              <label>Search replacement blank
                <input value={overrideSearch} onChange={(event) => setOverrideSearch(event.target.value)} placeholder="Brand style color size" />
              </label>
              <button type="submit">Search</button>
            </form>
            <div className="search-result-list override-results">
              {overrideResults.map((product) => (
                <button key={product.id} type="button" className={overrideBlank?.id === product.id ? 'result-card selected' : 'result-card'} onClick={() => setOverrideBlank(product)}>
                  <strong>{product.sku_base}</strong><span>{formatBlankProductLabel(product)}</span>
                </button>
              ))}
            </div>
            <label>Override reason
              <textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Why is this blank being changed?" />
            </label>
            {overrideBlank && <p className="selected-item-note">Replacement: <strong>{formatBlankProductLabel(overrideBlank)}</strong></p>}
            <div className="modal-actions">
              <button type="button" onClick={() => setOverrideItem(null)}>Cancel</button>
              <button className="primary-action" type="button" disabled={savingOverride || !overrideBlank} onClick={saveOverride}>{savingOverride ? 'Saving...' : 'Save Override'}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
