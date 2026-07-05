import { useEffect, useState } from 'react';
import { getBlankInventory } from './lib/inventoryApi';

function qty(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function statusLabel(row) {
  const status = String(row.inventory_status || '').replace(/_/g, ' ');
  if (status) return status;
  return qty(row.quantity_on_hand ?? row.total_quantity) > 0 ? 'in stock' : 'zero on hand';
}

export default function BlankInventory() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setMessage('');
    try {
      setRows(await getBlankInventory(search));
    } catch (err) {
      setMessage(err.message || 'Failed to load blank inventory.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="page">
      <h1>Blank Inventory</h1>
      <p className="muted">
        This list is catalog-first: products stay visible even when the on-hand quantity is zero.
      </p>

      <form onSubmit={(event) => { event.preventDefault(); load(); }} className="card">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search SKU, product, brand, style, color, size, or status..."
        />
        <button type="submit">Search</button>
      </form>

      {message && <p className="message">{message}</p>}

      <table>
        <thead>
          <tr>
            <th>Woo SKU</th>
            <th>Blank SKU</th>
            <th>Name</th>
            <th>Brand</th>
            <th>Style</th>
            <th>Color</th>
            <th>Size</th>
            <th>On Hand</th>
            <th>Available</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.product_row_id || row.blank_product_id || row.sku_base || index}>
              <td>{row.woo_sku || row.sku || ''}</td>
              <td>{row.blank_sku || row.sku_base || ''}</td>
              <td>{row.name || row.blank_product_name || row.woo_product_name || ''}</td>
              <td>{row.brand || ''}</td>
              <td>{row.product_type || row.style || ''}</td>
              <td>{row.color || ''}</td>
              <td>{row.size || ''}</td>
              <td>{qty(row.quantity_on_hand ?? row.on_hand_quantity ?? row.total_quantity)}</td>
              <td>{qty(row.available_quantity ?? row.quantity_on_hand ?? row.on_hand_quantity ?? row.total_quantity)}</td>
              <td>{statusLabel(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
