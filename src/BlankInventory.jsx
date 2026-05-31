import { useEffect, useState } from 'react';
import { getBlankProducts } from './lib/inventoryApi';

export default function BlankInventory() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setMessage('');
    try {
      setRows(await getBlankProducts(search));
    } catch (err) {
      setMessage(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="page">
      <h1>Blank Inventory</h1>

      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="card">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search blanks..." />
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
              <td>{row.brand}</td>
              <td>{row.color}</td>
              <td>{row.size}</td>
              <td>{row.total_quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
