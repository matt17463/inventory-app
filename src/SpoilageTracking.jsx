import { useEffect, useState } from 'react';
import { getBins, getBlankProducts, searchFinishedProductsForReceiving, getSpoilageReport, recordBlankSpoilage, recordFinishedSpoilage } from './lib/inventoryApi';

const REASONS = ['Misprint', 'Damaged blank', 'Wrong size pulled', 'Vendor defect', 'Test print', 'Customer cancellation', 'Other'];

export default function SpoilageTracking() {
  const [type, setType] = useState('blank');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [bins, setBins] = useState([]);
  const [binId, setBinId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('Misprint');
  const [notes, setNotes] = useState('');
  const [report, setReport] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadBins() { setBins(await getBins()); }
  async function loadReport() { setReport(await getSpoilageReport('')); }

  useEffect(() => { loadBins().catch((err) => setMessage(err.message)); loadReport().catch(() => {}); }, []);

  async function searchProducts() {
    try {
      const data = type === 'blank' ? await getBlankProducts(search) : await searchFinishedProductsForReceiving(search);
      setProducts(data);
      setProductId('');
    } catch (err) {
      setMessage(err.message || 'Search failed.');
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (type === 'blank') {
        await recordBlankSpoilage({ blankProductId: productId, binId, quantity, reason, notes });
      } else {
        await recordFinishedSpoilage({ finishedProductId: productId, binId, quantity, reason, notes });
      }
      setMessage('Spoilage recorded and inventory deducted.');
      setQuantity('1'); setNotes(''); setProductId(''); setProducts([]);
      await loadReport();
    } catch (err) {
      setMessage(err.message || 'Failed to record spoilage.');
    } finally {
      setBusy(false);
    }
  }

  function productLabel(product) {
    if (type === 'blank') return [product.sku_base, product.name, product.brand || product.brands?.name, product.color || product.colors?.name, product.size || product.sizes?.name].filter(Boolean).join(' - ');
    return [product.finished_sku || product.sku, product.finished_name || product.name, product.customer || product.customer_name, product.logo || product.logo_name].filter(Boolean).join(' - ');
  }

  return (
    <main className="page phase2-page">
      <section className="page-header"><div><p className="eyebrow">Phase 2</p><h1>Spoilage / Misprint Tracking</h1><p>Record misprints, damaged blanks, vendor defects, and test prints while deducting inventory.</p></div></section>
      {message && <p className="message">{message}</p>}
      <section className="card elevated-card">
        <form onSubmit={submit} className="phase2-form-grid">
          <label>Inventory Type<select value={type} onChange={(e) => { setType(e.target.value); setProducts([]); setProductId(''); }}><option value="blank">Blank</option><option value="finished">Finished</option></select></label>
          <label>Search Product<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU, product, color, size..." /></label>
          <button type="button" onClick={searchProducts}>Search</button>
          <label>Product<select value={productId} onChange={(e) => setProductId(e.target.value)} required><option value="">Choose product...</option>{products.map((product) => <option key={product.id || product.finished_product_id} value={product.id || product.finished_product_id}>{productLabel(product)}</option>)}</select></label>
          <label>Bin<select value={binId} onChange={(e) => setBinId(e.target.value)} required><option value="">Choose bin...</option>{bins.map((bin) => <option key={bin.id} value={bin.id}>{[bin.bin_code, bin.label, bin.location].filter(Boolean).join(' - ')}</option>)}</select></label>
          <label>Quantity<input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></label>
          <label>Reason<select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Record Spoilage'}</button>
        </form>
      </section>

      <section className="card elevated-card table-card">
        <h2>Recent Spoilage</h2>
        <div className="responsive-table"><table className="data-table"><thead><tr><th>Date</th><th>Type</th><th>Product</th><th>Bin</th><th>Qty</th><th>Reason</th><th>Notes</th></tr></thead><tbody>
          {report.slice(0, 100).map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString()}</td><td>{row.inventory_type}</td><td>{row.blank_sku || row.finished_sku}</td><td>{row.bin_code || row.bin_label}</td><td>{row.quantity}</td><td>{row.reason}</td><td>{row.notes}</td></tr>)}
          {!report.length && <tr><td colSpan="7">No spoilage recorded.</td></tr>}
        </tbody></table></div>
      </section>
    </main>
  );
}
