import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getBins,
  getPurchaseOrderDetail,
  receivePurchaseOrderItem,
  money,
} from './lib/inventoryApi';
import { isPendingStockBin } from './lib/pullSheetBinAssignmentApi';

function number(value) {
  return Number(value || 0).toLocaleString();
}

export default function ReceivePurchaseOrder() {
  const { poId } = useParams();
  const [po, setPo] = useState(null);
  const [items, setItems] = useState([]);
  const [bins, setBins] = useState([]);
  const [receiveState, setReceiveState] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadData() {
    setLoading(true);
    setMessage('');
    try {
      const [detail, binRows] = await Promise.all([
        getPurchaseOrderDetail(poId),
        getBins(),
      ]);
      setPo(detail.po);
      setItems(detail.items);
      setBins((binRows || []).filter((bin) => !isPendingStockBin(bin)));
      const next = {};
      detail.items.forEach((item) => {
        next[item.id] = {
          quantity: Math.max(Number(item.quantity_open || 0), 0),
          binId: '',
          notes: '',
        };
      });
      setReceiveState(next);
    } catch (err) {
      setMessage(err.message || 'Failed to load purchase order.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [poId]);

  const totals = useMemo(() => items.reduce((acc, item) => {
    acc.ordered += Number(item.quantity_ordered || 0);
    acc.received += Number(item.quantity_received || 0);
    acc.open += Number(item.quantity_open || 0);
    acc.value += Number(item.quantity_ordered || 0) * Number(item.unit_cost || 0);
    return acc;
  }, { ordered: 0, received: 0, open: 0, value: 0 }), [items]);

  function updateReceiveState(id, patch) {
    setReceiveState((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), ...patch },
    }));
  }

  async function receiveItem(item) {
    const state = receiveState[item.id] || {};
    setBusy(true);
    setMessage('');
    try {
      if (!state.binId) throw new Error('Choose a destination bin before receiving.');
      await receivePurchaseOrderItem({
        poItemId: item.id,
        quantity: state.quantity,
        binId: state.binId,
        notes: state.notes || `Received against ${po?.po_number || 'purchase order'}`,
      });
      setMessage(`Received ${state.quantity} unit(s) for ${item.sku_base}.`);
      await loadData();
    } catch (err) {
      setMessage(err.message || 'Failed to receive item.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page phase1-page">
      <section className="page-header phase1-header">
        <div>
          <p className="eyebrow">Purchasing Phase 1</p>
          <h1>Receive Purchase Order</h1>
          <p>{po ? `${po.po_number} · ${po.supplier_name} · ${po.status}` : 'Load a purchase order and receive items into bins.'}</p>
        </div>
        <div className="phase1-actions">
          <Link className="secondary-button" to="/purchase-orders">Back to POs</Link>
          <Link className="secondary-button" to="/waiting-on">Waiting On Dashboard</Link>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="kpi-grid phase1-kpis">
        <div className="kpi-card"><span>{number(totals.ordered)}</span><strong>Ordered</strong><small>Total PO units</small></div>
        <div className="kpi-card"><span>{number(totals.received)}</span><strong>Received</strong><small>Units already received</small></div>
        <div className="kpi-card"><span>{number(totals.open)}</span><strong>Open</strong><small>Still outstanding</small></div>
        <div className="kpi-card"><span>{money(totals.value)}</span><strong>Estimated Cost</strong><small>PO value</small></div>
      </section>

      <section className="card elevated-card table-card">
        <h2>PO Line Items</h2>
        {loading ? <p>Loading purchase order...</p> : (
          <div className="responsive-table">
            <table className="data-table phase1-table">
              <thead><tr><th>SKU</th><th>Item</th><th>Ordered</th><th>Received</th><th>Open</th><th>Unit Cost</th><th>Receive Qty</th><th>Bin</th><th>Notes</th><th>Action</th></tr></thead>
              <tbody>
                {!items.length ? <tr><td colSpan="10">No PO items found.</td></tr> : items.map((item) => {
                  const state = receiveState[item.id] || {};
                  const isClosed = Number(item.quantity_open || 0) <= 0;
                  return (
                    <tr key={item.id} className={isClosed ? 'received-row' : ''}>
                      <td><strong>{item.sku_base}</strong></td>
                      <td>{[item.brand, item.product_type, item.color, item.size].filter(Boolean).join(' / ')}</td>
                      <td>{number(item.quantity_ordered)}</td>
                      <td>{number(item.quantity_received)}</td>
                      <td><strong>{number(item.quantity_open)}</strong></td>
                      <td>{money(item.unit_cost)}</td>
                      <td><input type="number" min="0" step="1" value={state.quantity ?? 0} disabled={isClosed} onChange={(event) => updateReceiveState(item.id, { quantity: event.target.value })} /></td>
                      <td>
                        <select value={state.binId || ''} disabled={isClosed} onChange={(event) => updateReceiveState(item.id, { binId: event.target.value })}>
                          <option value="">Choose bin...</option>
                          {bins.map((bin) => <option key={bin.id} value={bin.id}>{[bin.bin_code, bin.label, bin.location].filter(Boolean).join(' - ')}</option>)}
                        </select>
                      </td>
                      <td><input value={state.notes || ''} disabled={isClosed} onChange={(event) => updateReceiveState(item.id, { notes: event.target.value })} placeholder="Optional receiving note" /></td>
                      <td><button type="button" disabled={busy || isClosed} onClick={() => receiveItem(item)}>{isClosed ? 'Received' : 'Receive'}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
