import { useEffect, useState } from 'react';
import { getSupplierCatalogReview } from './lib/inventoryApi';

export default function SupplierCatalogReview() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const data = await getSupplierCatalogReview(search);
      setRows(data);
      setMessage(`Loaded ${data.length} supplier catalog row(s).`);
    } catch (err) {
      setMessage(err.message || 'Failed to load supplier catalog review.');
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Phase 3 · Supplier Data</p>
          <h1>Supplier Catalog Review</h1>
          <p>Review imported supplier catalog rows, matched blank products, UPCs, vendor SKUs, and unit costs.</p>
        </div>
      </section>
      {message && <p className="message">{message}</p>}
      <section className="card elevated-card">
        <form onSubmit={(event) => { event.preventDefault(); load(); }} className="inline-form-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplier, SKU, UPC, brand, style, color, size..." />
          <button type="submit">Search</button>
          <button type="button" onClick={() => { setSearch(''); setTimeout(load, 0); }}>Clear</button>
        </form>
      </section>
      <section className="card table-card">
        <div className="responsive-table">
          <table className="data-table">
            <thead><tr><th>Supplier</th><th>Brand</th><th>Style</th><th>Color</th><th>Size</th><th>Vendor SKU</th><th>UPC</th><th>Cost</th><th>Matched Blank</th><th>Imported</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.supplier_name}</td><td>{row.brand}</td><td>{row.style}</td><td>{row.color}</td><td>{row.size}</td><td>{row.supplier_sku}</td><td>{row.upc}</td><td>{row.unit_cost}</td><td>{row.blank_sku_base || 'Unmatched'}</td><td>{row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="10">No supplier catalog rows found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
