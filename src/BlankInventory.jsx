import { useEffect, useState } from 'react';
import { getBlankInventory, money } from './lib/inventoryApi';

export default function BlankInventory() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setMessage('');
    setLoading(true);

    try {
      setRows(await getBlankInventory(search));
    } catch (err) {
      setMessage(err.message || 'Failed to load blank inventory.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="page">
      <h1>Blank Inventory</h1>

      <form onSubmit={(event) => { event.preventDefault(); load(); }} className="card">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by SKU, brand, style, color, size..."
        />
        <button type="submit" disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
      </form>

      {message && <p className="message">{message}</p>}

      <p className="muted">Showing {rows.length} blank inventory item{rows.length === 1 ? '' : 's'}.</p>

      <table>
        <thead>
          <tr>
            <th>SKU Base</th>
            <th>Name</th>
            <th>Brand</th>
            <th>Style</th>
            <th>Color</th>
            <th>Size</th>
            <th>On Hand</th>
            <th>Reserved</th>
            <th>Available</th>
            <th>Unit Cost</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.blank_product_id}>
              <td>{row.sku_base}</td>
              <td>{row.name}</td>
              <td>{row.brand || ''}</td>
              <td>{row.product_type || ''}</td>
              <td>{row.color || ''}</td>
              <td>{row.size || ''}</td>
              <td>{Number(row.quantity_on_hand || 0)}</td>
              <td>{Number(row.reserved_quantity || 0)}</td>
              <td>{Number(row.available_quantity || 0)}</td>
              <td>{money(row.unit_cost || 0)}</td>
              <td>{money(row.inventory_value || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
