import { useEffect, useState } from 'react';
import { getBlankInventory } from './lib/inventoryApi';

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

      <form onSubmit={(event) => { event.preventDefault(); load(); }} className="card">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search blank inventory..."
        />
        <button type="submit">Search</button>
      </form>

      {message && <p className="message">{message}</p>}

      <table>
        <thead>
          <tr>
            <th>SKU Base</th>
            <th>Name</th>
            <th>Brand</th>
            <th>Color</th>
            <th>Size</th>
            <th>On Hand</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.blank_product_id}>
              <td>{row.sku_base}</td>
              <td>{row.name}</td>
              <td>{row.brand || ''}</td>
              <td>{row.color || ''}</td>
              <td>{row.size || ''}</td>
              <td>{row.total_quantity || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
