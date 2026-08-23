import { useEffect, useMemo, useState } from 'react';
import { formatBinLabel, getBins, getBlankItemsInBin, transferBlankInventory } from './lib/inventoryApi';

const rowKey = (item) => String(item?.blank_product_id || '');
const itemLabel = (item) => [item?.sku_base, item?.name, item?.brand, item?.style, item?.color, item?.size]
  .filter(Boolean)
  .join(' / ');
const isUnallocatedBin = (bin) => /un[\s_-]*allocated/.test(
  [bin?.bin_code, bin?.label, bin?.location].filter(Boolean).join(' ').toLowerCase()
);

export default function TransferInventory() {
  const [bins, setBins] = useState([]);
  const [fromBinId, setFromBinId] = useState('');
  const [toBinId, setToBinId] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [blankProductId, setBlankProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [rowDestinations, setRowDestinations] = useState({});
  const [rowBusyId, setRowBusyId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDestinationId, setBulkDestinationId] = useState('');
  const [allocationNotes, setAllocationNotes] = useState('');

  const selectedItem = useMemo(
    () => items.find((item) => String(item.blank_product_id) === String(blankProductId)) || null,
    [items, blankProductId]
  );
  const sourceBin = useMemo(
    () => bins.find((bin) => String(bin.id) === String(fromBinId)) || null,
    [bins, fromBinId]
  );
  const destinationBins = useMemo(
    () => bins.filter((bin) => String(bin.id) !== String(fromBinId)),
    [bins, fromBinId]
  );
  const assignedItems = useMemo(
    () => items.filter((item) => {
      const destinationId = rowDestinations[rowKey(item)];
      return destinationId && String(destinationId) !== String(fromBinId);
    }),
    [fromBinId, items, rowDestinations]
  );
  const pageBusy = busy || bulkBusy || Boolean(rowBusyId);

  async function loadBins() {
    try {
      const rows = await getBins();
      setBins(rows);
      setFromBinId((current) => {
        if (current) return current;
        const unallocated = rows.find(isUnallocatedBin);
        return unallocated ? String(unallocated.id) : '';
      });
    } catch (err) {
      setMessage(err.message || 'Failed to load bins.');
    }
  }

  async function loadItems(binId = fromBinId, term = search) {
    setBlankProductId('');
    if (!binId) {
      setItems([]);
      return [];
    }

    setItemsLoading(true);
    setMessage('');
    try {
      const rows = await getBlankItemsInBin(binId, term);
      setItems(rows);
      setRowDestinations((current) => {
        const next = {};
        rows.forEach((item) => {
          const key = rowKey(item);
          if (current[key] && String(current[key]) !== String(binId)) next[key] = current[key];
        });
        return next;
      });
      if (rows.length === 1) setBlankProductId(String(rows[0].blank_product_id));
      setMessage(rows.length
        ? `Loaded ${rows.length} item${rows.length === 1 ? '' : 's'} from the selected source bin.`
        : 'No items with on-hand quantity were found in the selected source bin.');
      return rows;
    } catch (err) {
      setItems([]);
      setMessage(err.message || 'Failed to load items in selected bin.');
      return [];
    } finally {
      setItemsLoading(false);
    }
  }

  useEffect(() => { loadBins(); }, []);
  useEffect(() => {
    setSearch('');
    setRowDestinations({});
    setBulkDestinationId('');
    setToBinId('');
    loadItems(fromBinId, '');
    // Reload only when the source bin changes; loadItems intentionally receives explicit values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromBinId]);

  async function runSearch(event) {
    event.preventDefault();
    await loadItems(fromBinId, search);
  }

  async function clearSearch() {
    setSearch('');
    await loadItems(fromBinId, '');
  }

  function setRowDestination(blankProductIdValue, destinationId) {
    setRowDestinations((current) => ({ ...current, [String(blankProductIdValue)]: destinationId }));
  }

  function applyDestinationToVisibleItems() {
    if (!bulkDestinationId) {
      setMessage('Choose a destination bin to apply to the visible items.');
      return;
    }
    setRowDestinations((current) => {
      const next = { ...current };
      items.forEach((item) => { next[rowKey(item)] = bulkDestinationId; });
      return next;
    });
    setMessage(`Destination applied to ${items.length} visible item${items.length === 1 ? '' : 's'}. Review the assignments, then select Transfer All Assigned.`);
  }

  async function transferEntireItem(item) {
    const key = rowKey(item);
    const destinationId = rowDestinations[key];
    const availableQuantity = Number(item.on_hand_quantity || 0);
    if (!destinationId) return setMessage('Choose a destination bin for this item.');
    if (!availableQuantity || availableQuantity <= 0) return setMessage('This item no longer has inventory available. Refresh the source bin.');

    setRowBusyId(key);
    setMessage('');
    try {
      await transferBlankInventory({
        fromBinId,
        toBinId: destinationId,
        blankProductId: item.blank_product_id,
        quantity: availableQuantity,
        notes: allocationNotes || `Allocated all inventory from ${formatBinLabel(sourceBin)}`,
      });
      await loadItems(fromBinId, search);
      setMessage(`${availableQuantity} unit${availableQuantity === 1 ? '' : 's'} of ${itemLabel(item)} transferred successfully.`);
    } catch (err) {
      setMessage(err.message || 'Transfer failed.');
    } finally {
      setRowBusyId('');
    }
  }

  async function transferAllAssigned() {
    if (!assignedItems.length) return setMessage('Assign at least one visible item to a destination bin first.');
    const totalQuantity = assignedItems.reduce((sum, item) => sum + Number(item.on_hand_quantity || 0), 0);
    if (!window.confirm(`Transfer all ${totalQuantity} units across ${assignedItems.length} assigned item${assignedItems.length === 1 ? '' : 's'}?`)) return;

    setBulkBusy(true);
    const failures = [];
    let completed = 0;
    for (const item of assignedItems) {
      const destinationId = rowDestinations[rowKey(item)];
      const availableQuantity = Number(item.on_hand_quantity || 0);
      if (!destinationId || availableQuantity <= 0) continue;
      setMessage(`Transferring ${completed + 1} of ${assignedItems.length}: ${itemLabel(item)}...`);
      try {
        await transferBlankInventory({
          fromBinId,
          toBinId: destinationId,
          blankProductId: item.blank_product_id,
          quantity: availableQuantity,
          notes: allocationNotes || `Bulk allocated from ${formatBinLabel(sourceBin)}`,
        });
        completed += 1;
      } catch (err) {
        failures.push(`${itemLabel(item)}: ${err.message || 'Transfer failed'}`);
      }
    }
    await loadItems(fromBinId, search);
    setBulkBusy(false);
    if (failures.length) {
      setMessage(`${completed} item${completed === 1 ? '' : 's'} transferred. ${failures.length} failed: ${failures.join(' | ')}`);
    } else {
      setMessage(`${completed} assigned item${completed === 1 ? '' : 's'} transferred successfully.`);
      setAllocationNotes('');
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (!fromBinId) throw new Error('Choose the source bin.');
      if (!toBinId) throw new Error('Choose the destination bin.');
      if (String(fromBinId) === String(toBinId)) throw new Error('Source and destination bins must be different.');
      if (!blankProductId) throw new Error('Choose an item from the source bin.');
      const qty = Number(quantity || 0);
      if (!qty || qty <= 0) throw new Error('Quantity must be greater than zero.');
      if (selectedItem && qty > Number(selectedItem.on_hand_quantity || 0)) {
        throw new Error(`The source bin only has ${selectedItem.on_hand_quantity} available.`);
      }
      await transferBlankInventory({ fromBinId, toBinId, blankProductId, quantity: qty, notes });
      await loadItems(fromBinId, search);
      setMessage('Transfer completed.');
      setQuantity(1);
      setNotes('');
    } catch (err) {
      setMessage(err.message || 'Transfer failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="page-header"><div><p className="eyebrow">Inventory</p><h1>Transfer Items Between Bins</h1><p>Choose a source bin to view every blank and its full available quantity.</p></div></section>
      {message && <p className="message">{message}</p>}

      <section className="card elevated-card">
        <div className="form-grid">
          <label>Source Bin<select value={fromBinId} onChange={(event) => setFromBinId(event.target.value)} disabled={pageBusy}><option value="">Choose source bin...</option>{bins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin)}</option>)}</select></label>
          <label>Search Source Bin<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="SKU, brand, style, color, size..." disabled={!fromBinId || itemsLoading || pageBusy} /></label>
        </div>
        <div className="button-row compact-row">
          <button type="button" onClick={runSearch} disabled={!fromBinId || itemsLoading || pageBusy}>{itemsLoading ? 'Searching...' : 'Search Bin Items'}</button>
          <button type="button" className="secondary-button" onClick={clearSearch} disabled={!fromBinId || itemsLoading || pageBusy || !search}>Clear Search</button>
          <button type="button" className="secondary-button" onClick={() => loadItems(fromBinId, search)} disabled={!fromBinId || itemsLoading || pageBusy}>Refresh Quantities</button>
        </div>
      </section>

      {fromBinId && <section className="card elevated-card table-card">
        <div className="section-heading-row">
          <div><p className="eyebrow">{isUnallocatedBin(sourceBin) ? 'Unallocated Items' : 'Quick Allocation'}</p><h2>Transfer Full Quantities</h2><p className="muted">Choose a destination on each row. Transfer All moves the entire displayed on-hand quantity.</p></div>
          <div><strong>{items.length}</strong> item{items.length === 1 ? '' : 's'} · <strong>{items.reduce((sum, item) => sum + Number(item.on_hand_quantity || 0), 0)}</strong> total units</div>
        </div>
        <div className="form-grid">
          <label>Apply One Destination to All Visible Items<select value={bulkDestinationId} onChange={(event) => setBulkDestinationId(event.target.value)} disabled={pageBusy || !items.length}><option value="">Choose destination...</option>{destinationBins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin)}</option>)}</select></label>
          <label>Transfer Notes<input value={allocationNotes} onChange={(event) => setAllocationNotes(event.target.value)} placeholder="Optional note applied to quick transfers" disabled={pageBusy} /></label>
        </div>
        <div className="button-row compact-row">
          <button type="button" className="secondary-button" onClick={applyDestinationToVisibleItems} disabled={pageBusy || !items.length || !bulkDestinationId}>Apply Destination to Visible Items</button>
          <button type="button" onClick={transferAllAssigned} disabled={pageBusy || !assignedItems.length}>{bulkBusy ? 'Transferring Assigned Items...' : `Transfer All Assigned (${assignedItems.length})`}</button>
        </div>
        <div className="responsive-table"><table className="data-table"><thead><tr><th>Item</th><th>Full Quantity</th><th>Destination Bin</th><th>Action</th></tr></thead><tbody>
          {itemsLoading ? <tr><td colSpan="4">Loading source-bin inventory...</td></tr> : items.length === 0 ? <tr><td colSpan="4">No on-hand items found in this source bin.</td></tr> : items.map((item) => {
            const key = rowKey(item);
            const availableQuantity = Number(item.on_hand_quantity || 0);
            const destinationId = rowDestinations[key] || '';
            return <tr key={key}>
              <td><strong>{item.sku_base || item.name || 'Blank item'}</strong><br /><small>{itemLabel(item)}</small></td>
              <td><strong>{availableQuantity}</strong> unit{availableQuantity === 1 ? '' : 's'}</td>
              <td><select value={destinationId} onChange={(event) => setRowDestination(item.blank_product_id, event.target.value)} disabled={pageBusy} aria-label={`Destination bin for ${itemLabel(item)}`}><option value="">Choose destination...</option>{destinationBins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin)}</option>)}</select></td>
              <td><button type="button" onClick={() => transferEntireItem(item)} disabled={pageBusy || !destinationId || availableQuantity <= 0}>{rowBusyId === key ? 'Transferring...' : `Transfer All ${availableQuantity}`}</button></td>
            </tr>;
          })}
        </tbody></table></div>
      </section>}

      <form onSubmit={submit} className="card elevated-card">
        <div className="section-heading-row"><div><p className="eyebrow">Optional</p><h2>Transfer a Partial Quantity</h2><p className="muted">Use this form when you do not want to move all units of an item.</p></div></div>
        <div className="form-grid">
          <label>Destination Bin<select value={toBinId} onChange={(event) => setToBinId(event.target.value)} required disabled={!fromBinId || pageBusy}><option value="">Choose destination bin...</option>{destinationBins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin)}</option>)}</select></label>
          <label>Item in Source Bin<select value={blankProductId} onChange={(event) => setBlankProductId(event.target.value)} required disabled={!fromBinId || itemsLoading || pageBusy}><option value="">{!fromBinId ? 'Choose source bin first...' : itemsLoading ? 'Loading items...' : items.length ? 'Choose item from source bin...' : 'No on-hand items found in this bin'}</option>{items.map((item) => <option key={item.blank_product_id} value={item.blank_product_id}>{itemLabel(item)} / {item.on_hand_quantity} on hand</option>)}</select></label>
        </div>
        {selectedItem && <p className="muted">Selected: {itemLabel(selectedItem)} · {selectedItem.on_hand_quantity} on hand</p>}
        <div className="form-grid">
          <label>Quantity<input type="number" min="1" max={selectedItem?.on_hand_quantity || undefined} value={quantity} onChange={(event) => setQuantity(event.target.value)} required disabled={pageBusy} /></label>
          <label>Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" disabled={pageBusy} /></label>
        </div>
        <button type="submit" disabled={pageBusy || itemsLoading || !fromBinId}>{busy ? 'Transferring...' : 'Transfer Partial Quantity'}</button>
      </form>
    </main>
  );
}
