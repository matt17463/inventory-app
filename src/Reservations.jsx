import { useEffect, useState } from 'react';
import {
  formatBinLabel,
  formatBlankProductLabel,
  getBins,
  getBlankProducts,
  getReservations,
  releaseReservation,
  reserveInventory,
} from './lib/inventoryApi';

export default function Reservations() {
  const [reservations, setReservations] = useState([]);
  const [bins, setBins] = useState([]);
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('active');
  const [search, setSearch] = useState('');
  const [blankProductId, setBlankProductId] = useState('');
  const [binId, setBinId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [orderRef, setOrderRef] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const [resRows, binRows, productRows] = await Promise.all([getReservations(status), getBins(), getBlankProducts(search)]);
      setReservations(resRows);
      setBins(binRows);
      setProducts(productRows);
    } catch (err) {
      setMessage(err.message || 'Failed to load reservations.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function searchProducts(event) {
    event.preventDefault();
    setProducts(await getBlankProducts(search));
  }

  async function submitReservation(event) {
    event.preventDefault();
    setMessage('');
    try {
      await reserveInventory({ blankProductId, binId: binId || null, quantity, orderRef, customerName, notes });
      setMessage('Reservation created. This is an internal hold only and does not block online orders.');
      setBlankProductId('');
      setQuantity(1);
      setOrderRef('');
      setCustomerName('');
      setNotes('');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to reserve inventory.');
    }
  }

  async function release(id) {
    try {
      await releaseReservation({ reservationId: id, notes: 'Released from app' });
      setMessage('Reservation released.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to release reservation.');
    }
  }

  return (
    <main className="page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Internal Holds</p>
          <h1>Inventory Reservations</h1>
          <p className="helper-text">Reserve blanks for jobs without changing WooCommerce backorder/out-of-stock behavior.</p>
        </div>
      </div>

      <section className="card">
        <h2>Create Reservation</h2>
        <form onSubmit={searchProducts} className="inline-form">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product" />
          <button type="submit">Search Products</button>
        </form>

        <form onSubmit={submitReservation} className="bin-add-form">
          <select value={blankProductId} onChange={(e) => setBlankProductId(e.target.value)} required>
            <option value="">Choose product...</option>
            {products.map((product) => <option key={product.id} value={product.id}>{formatBlankProductLabel(product)}</option>)}
          </select>
          <select value={binId} onChange={(e) => setBinId(e.target.value)}>
            <option value="">Any bin / not assigned</option>
            {bins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin) || `Bin ${bin.id}`}</option>)}
          </select>
          <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          <input value={orderRef} onChange={(e) => setOrderRef(e.target.value)} placeholder="Order/job ref" />
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer" />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          <button type="submit">Reserve</button>
        </form>
      </section>

      <section className="card wide-card">
        <div className="page-heading-row compact-heading">
          <h2>Reservations</h2>
          <select className="small-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="released">Released</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="responsive-table">
          <table>
            <thead><tr><th>Product</th><th>Bin</th><th>Qty</th><th>Order</th><th>Customer</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {reservations.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.sku_base}</strong><br />{row.name || row.blank_product_name}</td>
                  <td>{row.bin_label || row.bin_code || row.bin_id || 'Any'}</td>
                  <td>{row.quantity_reserved}</td>
                  <td>{row.order_ref || ''}</td>
                  <td>{row.customer_name || row.customer || ''}</td>
                  <td>{row.status}</td>
                  <td>{row.status === 'active' && <button type="button" onClick={() => release(row.id)}>Release</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
