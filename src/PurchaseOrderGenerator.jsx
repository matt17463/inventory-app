import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createPurchaseOrderFromItems,
  getPurchaseOrderRecommendations,
  money,
} from './lib/inventoryApi';

function number(value) {
  return Number(value || 0).toLocaleString();
}

function reportNeed(row) {
  return Number(
    row?.report_recommended_order_quantity
    ?? row?.recommended_order_quantity
    ?? 0
  );
}

function openPoCoverage(row) {
  return Number(row?.open_po_quantity || 0);
}

function stillToOrder(row) {
  return Number(
    row?.quantity_to_order
    ?? row?.recommended_order_quantity
    ?? 0
  );
}

export default function PurchaseOrderGenerator() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function loadRows() {
    setLoading(true);
    setMessage('');
    try {
      const data = await getPurchaseOrderRecommendations(search);
      setRows(data);
      const next = {};
      data.forEach((row) => {
        if (stillToOrder(row) > 0) {
          next[row.blank_product_id] = {
            checked: false,
            quantity: stillToOrder(row),
            unit_cost: Number(row.unit_cost || 0),
            supplier_sku: row.supplier_sku || '',
          };
        }
      });
      setSelected(next);
    } catch (err) {
      setMessage(err.message || 'Failed to load purchasing recommendations. Run the Phase 1 SQL first.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRows = useMemo(() => {
    return rows
      .filter((row) => selected[row.blank_product_id]?.checked)
      .map((row) => ({ ...row, ...selected[row.blank_product_id] }));
  }, [rows, selected]);

  const totals = useMemo(() => {
    return selectedRows.reduce((acc, row) => {
      const qty = Number(row.quantity || 0);
      const cost = Number(row.unit_cost || 0);
      acc.lines += 1;
      acc.units += qty;
      acc.value += qty * cost;
      return acc;
    }, { lines: 0, units: 0, value: 0 });
  }, [selectedRows]);

  function updateSelected(id, patch) {
    setSelected((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        ...patch,
      },
    }));
  }

  function selectAllVisible() {
    const next = { ...selected };
    rows.forEach((row) => {
      if (stillToOrder(row) > 0) {
        next[row.blank_product_id] = {
          ...(next[row.blank_product_id] || {}),
          checked: true,
          quantity: next[row.blank_product_id]?.quantity || stillToOrder(row),
          unit_cost: next[row.blank_product_id]?.unit_cost ?? Number(row.unit_cost || 0),
          supplier_sku: next[row.blank_product_id]?.supplier_sku ?? row.supplier_sku ?? '',
        };
      }
    });
    setSelected(next);
  }

  async function createPo() {
    setSaving(true);
    setMessage('');
    try {
      if (!supplierName.trim()) throw new Error('Enter supplier/vendor name.');
      if (!selectedRows.length) throw new Error('Select at least one item.');

      const items = selectedRows.map((row) => ({
        blank_product_id: row.blank_product_id,
        quantity_ordered: Number(row.quantity || 0),
        unit_cost: Number(row.unit_cost || 0),
        supplier_sku: row.supplier_sku || null,
      })).filter((item) => item.quantity_ordered > 0);

      if (!items.length) throw new Error('Selected lines must have quantity greater than zero.');

      const result = await createPurchaseOrderFromItems({
        supplierName,
        expectedAt,
        notes,
        items,
      });

      setMessage(`Created ${result.po_number || 'purchase order'}.`);
      navigate(`/purchase-orders/${result.purchase_order_id}/receive`);
    } catch (err) {
      setMessage(err.message || 'Failed to create purchase order.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page phase1-page">
      <section className="page-header phase1-header">
        <div>
          <p className="eyebrow">Purchasing Phase 1</p>
          <h1>Create Purchase Order</h1>
          <p>Uses the same recommendations as the Purchasing Report, then subtracts quantities already covered by open purchase orders.</p>
        </div>
        <Link className="secondary-button" to="/purchase-orders">View Purchase Orders</Link>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="kpi-grid phase1-kpis">
        <div className="kpi-card"><span>{number(totals.lines)}</span><strong>Selected Lines</strong><small>Items on PO</small></div>
        <div className="kpi-card"><span>{number(totals.units)}</span><strong>Selected Units</strong><small>Total quantity</small></div>
        <div className="kpi-card"><span>{money(totals.value)}</span><strong>Estimated Cost</strong><small>Qty × unit cost</small></div>
      </section>

      <section className="card elevated-card phase1-form-card">
        <div className="form-grid">
          <label>Supplier / Vendor<input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Example: S&S Activewear" /></label>
          <label>Expected Arrival<input type="date" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)} /></label>
          <label>Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional PO notes" /></label>
        </div>
        <div className="inline-form-row">
          <button type="button" onClick={createPo} disabled={saving || !selectedRows.length}>{saving ? 'Creating...' : `Create PO (${totals.lines})`}</button>
          <button type="button" className="secondary-button" onClick={selectAllVisible}>Select All Visible</button>
          <button type="button" className="secondary-button" onClick={() => setSelected({})}>Clear Selection</button>
        </div>
      </section>

      <section className="card elevated-card purchasing-controls">
        <div className="search-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') loadRows(); }} placeholder="Search SKU, brand, style, color, size, supplier..." />
          <button type="button" onClick={loadRows}>Search</button>
        </div>
      </section>

      <section className="card elevated-card table-card">
        <h2>Purchasing Report Items</h2>
        <p className="helper-text">
          Every Recommended Orders item is shown here. Still To Order equals Purchasing Report Need minus quantities already on open purchase orders.
        </p>
        {loading ? <p>Loading recommendations...</p> : (
          <div className="responsive-table">
            <table className="data-table phase1-table">
              <thead>
                <tr>
                  <th>Select</th><th>SKU</th><th>Item</th><th>Supplier</th><th>On Hand</th><th>Reserved</th><th>Available</th><th>Threshold</th><th>Report Need</th><th>On Open PO</th><th>Still To Order</th><th>Status</th><th>Order Qty</th><th>Unit Cost</th><th>Supplier SKU</th>
                </tr>
              </thead>
              <tbody>
                {!rows.length ? <tr><td colSpan="15">No purchasing report items found.</td></tr> : rows.map((row) => {
                  const state = selected[row.blank_product_id] || {};
                  const remaining = stillToOrder(row);
                  const covered = remaining <= 0;

                  return (
                    <tr key={row.blank_product_id} className={covered ? 'covered-row' : 'shortage-row'}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!state.checked}
                          disabled={covered}
                          onChange={(event) => updateSelected(row.blank_product_id, { checked: event.target.checked })}
                        />
                      </td>
                      <td><strong>{row.sku_base}</strong></td>
                      <td>
                        {[row.brand, row.product_type, row.color, row.size].filter(Boolean).join(' / ')}
                        {Number(row.pending_stock_quantity || 0) > 0 && (
                          <><br /><small className="warning-text">Unreserved Pending Stock: {number(row.pending_stock_quantity)}</small></>
                        )}
                        {Number(row.non_inventory_purchase_quantity || 0) > 0 && (
                          <><br /><small className="warning-text">Non-Inventory Purchasing: {number(row.non_inventory_purchase_quantity)}</small></>
                        )}
                      </td>
                      <td>{row.supplier_name || 'Not assigned'}</td>
                      <td>{number(row.quantity_on_hand)}</td>
                      <td>{number(row.reserved_quantity)}</td>
                      <td>{number(row.available_quantity)}</td>
                      <td>{number(row.low_stock_threshold)}</td>
                      <td><strong>{number(reportNeed(row))}</strong></td>
                      <td>{number(openPoCoverage(row))}</td>
                      <td><strong>{number(remaining)}</strong></td>
                      <td>
                        {covered
                          ? (
                            row.next_purchase_order_id
                              ? <Link to={`/purchase-orders/${row.next_purchase_order_id}/receive`}>Covered by {row.next_po_number || 'Open PO'}</Link>
                              : 'Covered by Open PO'
                          )
                          : 'Needs PO'}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={covered}
                          value={state.quantity ?? remaining}
                          onChange={(event) => updateSelected(row.blank_product_id, { quantity: event.target.value })}
                        />
                      </td>
                      <td><input type="number" min="0" step="0.01" value={state.unit_cost ?? row.unit_cost ?? 0} onChange={(event) => updateSelected(row.blank_product_id, { unit_cost: event.target.value })} /></td>
                      <td><input value={state.supplier_sku ?? row.supplier_sku ?? ''} onChange={(event) => updateSelected(row.blank_product_id, { supplier_sku: event.target.value })} /></td>
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
