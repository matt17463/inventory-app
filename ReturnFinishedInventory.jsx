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
  getPullSheetItems,
  pullSheetStatusLabel,
  returnPullSheetItemToFinishedInventory,
  updatePullSheetItemStatus,
  updatePullSheetStatus,
} from './lib/inventoryApi';

const JOB_STATUSES = [
  ['draft', 'Draft'],
  ['ready_to_pull', 'Ready to Pull'],
  ['pulled', 'Pulled'],
  ['in_production', 'In Production'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

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
  const [newItem, setNewItem] = useState({
    quantity: 1,
    logo: '',
    placement: '',
    notes: '',
  });

  const job = items[0] || null;

  async function load() {
    setMessage('');
    try {
      const [itemRows, binRows] = await Promise.all([
        getPullSheetItems(jobId),
        getBins(),
      ]);
      setItems(itemRows);
      setBins(binRows);
      setStatus(itemRows[0]?.job_status || 'ready_to_pull');

      const matchEntries = await Promise.all(
        itemRows.map(async (item) => {
          try {
            const matches = await getFinishedMatchesForPullSheetItem(item);
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
    const finishedAvailable = Object.values(finishedMatches).flat().reduce((sum, item) => sum + Number(item.total_quantity ?? item.quantity_on_hand ?? 0), 0);
    return { qty, completed, lines: items.length, finishedAvailable };
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

    if (!selectedBlank) {
      setMessage('Choose a blank item first.');
      return;
    }

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

    if (!binId) {
      setMessage('Choose the bin the garments were pulled from before completing this line.');
      return;
    }

    try {
      await completeJobItem({
        jobItemId: item.job_item_id,
        binId,
        notes: `Pulled ${item.quantity} for ${item.blank_sku_base || item.blank_name}`,
      });
      setMessage('Line completed and inventory deducted from the selected bin.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to complete item.');
    }
  }

  async function useFinishedInventory(item, finishedProduct) {
    const binId = selectedFinishedBins[item.job_item_id] || finishedProduct.bin_id;

    if (!binId) {
      setMessage('Choose the finished-products bin to pull from.');
      return;
    }

    try {
      await deductFinishedInventoryForJobItem({
        jobItemId: item.job_item_id,
        finishedProductId: finishedProduct.finished_product_id,
        binId,
        quantity: item.quantity,
        notes: `Used finished inventory for ${item.blank_sku_base || item.blank_name}`,
      });
      setMessage('Finished inventory was used and deducted. Pull sheet line marked completed.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to use finished inventory.');
    }
  }

  async function returnLineToFinishedInventory(item) {
    const binId = returnFinishedBins[item.job_item_id];

    if (!binId) {
      setMessage('Choose the finished-products bin where this completed item will be stored.');
      return;
    }

    try {
      await returnPullSheetItemToFinishedInventory({
        jobItemId: item.job_item_id,
        binId,
        quantity: item.quantity,
        notes: `Returned finished goods for ${item.blank_sku_base || item.blank_name}`,
      });
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

  return (
    <main className="page pullsheet-page">
      <div className="page-heading-row">
        <div>
          <Link to="/pullsheets" className="back-link">← Pull Sheets</Link>
          <h1>{job?.job_name || 'Pull Sheet'}</h1>
          <p className="muted">
            {job?.customer_name || 'No customer'} {job?.woocommerce_order_id ? `• Order ${job.woocommerce_order_id}` : ''} {job?.due_date ? `• Due ${job.due_date}` : ''}
          </p>
        </div>

        <div className="pullsheet-status-card">
          <label>
            Status
            <select value={status} onChange={(event) => saveStatus(event.target.value)}>
              {JOB_STATUSES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {message && <p className="message">{message}</p>}

      <section className="kpi-grid compact-kpis">
        <div className="kpi-card"><span>{totals.lines}</span><strong>Lines</strong><small>Blank items</small></div>
        <div className="kpi-card"><span>{totals.qty}</span><strong>Total Qty</strong><small>Garments to pull</small></div>
        <div className="kpi-card"><span>{totals.completed}</span><strong>Completed</strong><small>Lines deducted</small></div>
        <div className="kpi-card"><span>{totals.finishedAvailable}</span><strong>Finished Stock</strong><small>Matching units found</small></div>
        <div className="kpi-card"><span>{pullSheetStatusLabel(status)}</span><strong>Status</strong><small>Current stage</small></div>
      </section>

      <section className="content-two-column">
        <section className="card elevated-card">
          <h2>Add Blank Needed for Job</h2>
          <p className="muted">Search your blank inventory, choose the exact color/size, enter the job quantity, logo, and placement, then add it to this pull sheet.</p>

          <label>
            Search Blank Item
            <div className="inline-action-row">
              <input
                value={blankSearch}
                onChange={(event) => setBlankSearch(event.target.value)}
                placeholder="Gildan 18500 Navy A2XL"
              />
              <button type="button" onClick={searchBlanks}>Search Blanks</button>
            </div>
          </label>

          {blankResults.length > 0 && (
            <div className="search-result-list">
              {blankResults.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  className={selectedBlank?.id === product.id ? 'result-card selected' : 'result-card'}
                  onClick={() => setSelectedBlank(product)}
                >
                  <strong>{product.sku_base}</strong>
                  <span>{formatBlankProductLabel(product)}</span>
                </button>
              ))}
            </div>
          )}

          {selectedBlank && (
            <p className="selected-item-note">Selected: <strong>{formatBlankProductLabel(selectedBlank)}</strong></p>
          )}

          <label>
            Quantity
            <input
              type="number"
              min="1"
              value={newItem.quantity}
              onChange={(event) => setNewItem((prev) => ({ ...prev, quantity: event.target.value }))}
            />
          </label>

          <label>
            Logo / Design
            <input
              value={newItem.logo}
              onChange={(event) => setNewItem((prev) => ({ ...prev, logo: event.target.value }))}
              placeholder="Bremerton Fastpitch"
            />
          </label>

          <label>
            Placement
            <input
              value={newItem.placement}
              onChange={(event) => setNewItem((prev) => ({ ...prev, placement: event.target.value }))}
              placeholder='Left chest (3.5")'
            />
          </label>

          <label>
            Notes
            <textarea
              value={newItem.notes}
              onChange={(event) => setNewItem((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Optional line notes"
            />
          </label>

          <button className="primary-action" type="button" onClick={handleAddItem} disabled={adding}>
            {adding ? 'Adding...' : 'Add Selected Blank to Pull Sheet'}
          </button>
        </section>

        <section className="card elevated-card">
          <h2>Pulling Instructions</h2>
          <p className="muted">
            A pull sheet line is the blank garment needed for a job. For each line, you can either use a matching finished product already in stock, or pull a blank garment from blank inventory.
          </p>
          <ol className="simple-steps">
            <li>Add one line for each blank garment/color/size needed.</li>
            <li>If a matching decorated item is already available, choose its finished-products bin and click Use Finished.</li>
            <li>If no finished stock exists, choose the blank source bin and click Complete + Deduct Blank.</li>
            <li>If you decorate extras for future orders, choose the finished-products bin and click Return Finished to Inventory.</li>
          </ol>
        </section>
      </section>

      <section className="card elevated-card">
        <h2>Pull Sheet Items</h2>

        {!items.length ? (
          <p className="muted">No items added yet.</p>
        ) : (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Qty</th>
                  <th>Blank</th>
                  <th>Color</th>
                  <th>Size</th>
                  <th>Logo</th>
                  <th>Placement</th>
                  <th>Status</th>
                  <th>Bin</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.job_item_id}>
                    <td><strong>{item.quantity}</strong></td>
                    <td>{item.blank_sku_base}<br /><span className="muted">{item.blank_name}</span></td>
                    <td>{item.color || ''}</td>
                    <td>{item.size || ''}</td>
                    <td>{item.logo || ''}</td>
                    <td>{item.placement || ''}</td>
                    <td><span className={`status-pill status-${item.item_status}`}>{pullSheetStatusLabel(item.item_status)}</span></td>
                    <td>
                      <select
                        value={selectedBins[item.job_item_id] || item.selected_bin_id || ''}
                        onChange={(event) =>
                          setSelectedBins((prev) => ({
                            ...prev,
                            [item.job_item_id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose bin...</option>
                        {bins.map((bin) => (
                          <option key={bin.id} value={bin.id}>
                            {formatBinLabel(bin)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="button-stack pullsheet-actions">
                      <button disabled={item.item_status === 'completed'} onClick={() => markCompleted(item)}>
                        Complete + Deduct Blank
                      </button>

                      <div className="finished-match-panel">
                        <strong>Finished stock</strong>
                        {(finishedMatches[item.job_item_id] || []).length ? (
                          (finishedMatches[item.job_item_id] || []).map((match) => (
                            <div className="finished-match-card" key={`${match.finished_product_id}-${match.bin_id || 'all'}`}>
                              <span>{match.finished_sku}</span>
                              <small>{match.customer || match.customer_name || 'No customer'} • {match.logo || match.logo_name || 'No logo'} • {match.placement || 'No placement'}</small>
                              <small>{match.bin_code || 'Any bin'} {match.bin_label ? `- ${match.bin_label}` : ''} • {match.total_quantity ?? match.quantity_on_hand ?? 0} available</small>
                              <select
                                value={selectedFinishedBins[item.job_item_id] || match.bin_id || ''}
                                onChange={(event) =>
                                  setSelectedFinishedBins((prev) => ({
                                    ...prev,
                                    [item.job_item_id]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Choose finished bin...</option>
                                {bins.map((bin) => (
                                  <option key={bin.id} value={bin.id}>{formatBinLabel(bin)}</option>
                                ))}
                              </select>
                              <button disabled={item.item_status === 'completed'} type="button" onClick={() => useFinishedInventory(item, match)}>
                                Use Finished
                              </button>
                            </div>
                          ))
                        ) : (
                          <small>No matching finished stock.</small>
                        )}
                      </div>

                      <div className="finished-return-panel">
                        <strong>Return decorated extras</strong>
                        <select
                          value={returnFinishedBins[item.job_item_id] || ''}
                          onChange={(event) =>
                            setReturnFinishedBins((prev) => ({
                              ...prev,
                              [item.job_item_id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Finished-products bin...</option>
                          {bins.map((bin) => (
                            <option key={bin.id} value={bin.id}>{formatBinLabel(bin)}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => returnLineToFinishedInventory(item)}>
                          Return Finished to Inventory
                        </button>
                      </div>

                      <button disabled={item.item_status === 'completed'} type="button" onClick={() => markPulledOnly(item)}>
                        Mark Pulled Only
                      </button>
                      <button type="button" className="danger-button" onClick={() => removeItem(item)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
