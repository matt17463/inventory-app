import { useEffect, useMemo, useState } from 'react';
import {
  createManualInvoiceOrder,
  generateManualInvoiceJob,
  getManualInvoiceOrders,
  searchBlanksForManualInvoice,
  updateManualInvoicePaymentStatus,
} from './lib/manualOrdersApi';

const blankLine = () => ({
  blank_product_id: '',
  sku_base: '',
  item_name: '',
  brand: '',
  style: '',
  color: '',
  size: '',
  quantity: 1,
  price_per_item: 0,
  artwork_note: '',
  placement: '',
  decoration_size: '',
  notes: '',
});

const today = () => new Date().toISOString().slice(0, 10);
const money = (value) => Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

function ManualLineRow({ line, index, onChange, onRemove, canRemove }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function runSearch() {
    setLoading(true);
    try {
      const rows = await searchBlanksForManualInvoice(search || `${line.brand} ${line.style} ${line.color} ${line.size}`);
      setResults(rows);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  function selectBlank(row) {
    onChange(index, {
      ...line,
      blank_product_id: row.blank_product_id,
      sku_base: row.sku_base || '',
      item_name: row.name || row.sku_base || '',
      brand: row.brand || '',
      style: row.style || '',
      color: row.color || '',
      size: row.size || '',
    });
    setSearch(`${row.sku_base || ''} ${row.brand || ''} ${row.style || ''} ${row.color || ''} ${row.size || ''}`.trim());
    setOpen(false);
  }

  const lineTotal = Number(line.quantity || 0) * Number(line.price_per_item || 0);

  return (
    <tr>
      <td data-label="Blank Lookup">
        <div className="manual-line-lookup">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search blank/SKU" />
          <button type="button" className="button" onClick={runSearch} disabled={loading}>{loading ? '...' : 'Find'}</button>
        </div>
        {open && (
          <div className="manual-line-search-results">
            {results.length === 0 ? <p>No blank items found.</p> : results.map((row) => (
              <button type="button" key={row.blank_product_id} onClick={() => selectBlank(row)}>
                <strong>{row.sku_base}</strong><br />
                <span>{row.brand} / {row.style} / {row.color} / {row.size}</span><br />
                <small>Available: {row.available_quantity}</small>
              </button>
            ))}
          </div>
        )}
      </td>
      <td data-label="Brand"><input value={line.brand} onChange={(e) => onChange(index, { ...line, brand: e.target.value })} /></td>
      <td data-label="Style"><input value={line.style} onChange={(e) => onChange(index, { ...line, style: e.target.value })} /></td>
      <td data-label="Color"><input value={line.color} onChange={(e) => onChange(index, { ...line, color: e.target.value })} /></td>
      <td data-label="Size"><input value={line.size} onChange={(e) => onChange(index, { ...line, size: e.target.value })} /></td>
      <td data-label="Qty"><input type="number" min="1" value={line.quantity} onChange={(e) => onChange(index, { ...line, quantity: e.target.value })} /></td>
      <td data-label="Price"><input type="number" step="0.01" min="0" value={line.price_per_item} onChange={(e) => onChange(index, { ...line, price_per_item: e.target.value })} /></td>
      <td data-label="Placement">
        <select value={line.placement} onChange={(e) => onChange(index, { ...line, placement: e.target.value })}>
          <option value="">Choose...</option>
          <option>Left Chest</option><option>Full Front</option><option>Full Back</option><option>Sleeve</option><option>Hat Front</option><option>Other</option>
        </select>
      </td>
      <td data-label="Artwork / Notes"><input value={line.artwork_note} onChange={(e) => onChange(index, { ...line, artwork_note: e.target.value })} placeholder="Logo/artwork note" /></td>
      <td data-label="Total"><strong>{money(lineTotal)}</strong></td>
      <td data-label="Actions">{canRemove && <button type="button" className="button danger" onClick={() => onRemove(index)}>Remove</button>}</td>
    </tr>
  );
}

export default function ManualInvoicedOrders() {
  const [orders, setOrders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [generateJob, setGenerateJob] = useState(true);
  const [order, setOrder] = useState({
    invoice_number: '', customer_name: '', organization: '', customer_email: '', customer_phone: '', order_date: today(), due_date: '',
    tax_amount: 0, shipping_amount: 0, total_payment_amount: 0, invoice_sent: false, payment_received: false, notes: '',
  });
  const [items, setItems] = useState([blankLine()]);

  async function loadOrders() { setOrders(await getManualInvoiceOrders()); }
  useEffect(() => { loadOrders().catch((err) => setError(err.message)); }, []);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.price_per_item || 0)), 0), [items]);
  const calculatedTotal = subtotal + Number(order.tax_amount || 0) + Number(order.shipping_amount || 0);
  useEffect(() => { setOrder((prev) => ({ ...prev, total_payment_amount: Number(calculatedTotal.toFixed(2)) })); }, [calculatedTotal]);

  function updateLine(index, next) { setItems((current) => current.map((line, i) => (i === index ? next : line))); }
  function removeLine(index) { setItems((current) => current.filter((_, i) => i !== index)); }

  async function submit(e) {
    e.preventDefault(); setError(''); setMessage('');
    if (!order.customer_name.trim()) return setError('Customer name is required.');
    if (!items.length || items.some((item) => Number(item.quantity || 0) <= 0)) return setError('Every line must have a quantity greater than zero.');
    setSaving(true);
    try {
      const result = await createManualInvoiceOrder(order, items, generateJob);
      setMessage(`Manual invoice order saved. Manual order ID: ${result.manual_order_id}${result.generated?.job_id ? `, Job ID: ${result.generated.job_id}` : ''}.`);
      setOrder({ invoice_number: '', customer_name: '', organization: '', customer_email: '', customer_phone: '', order_date: today(), due_date: '', tax_amount: 0, shipping_amount: 0, total_payment_amount: 0, invoice_sent: false, payment_received: false, notes: '' });
      setItems([blankLine()]);
      await loadOrders();
    } catch (err) { setError(err.message || String(err)); } finally { setSaving(false); }
  }

  async function generateExisting(orderId) {
    setError(''); setMessage('');
    try { const result = await generateManualInvoiceJob(orderId); setMessage(`Generated job #${result.job_id} for manual invoice order #${orderId}.`); await loadOrders(); }
    catch (err) { setError(err.message || String(err)); }
  }

  async function togglePayment(row, field) {
    const invoiceSent = field === 'invoice_sent' ? !row.invoice_sent : row.invoice_sent;
    const paymentReceived = field === 'payment_received' ? !row.payment_received : row.payment_received;
    try { await updateManualInvoicePaymentStatus(row.id, invoiceSent, paymentReceived); await loadOrders(); }
    catch (err) { setError(err.message || String(err)); }
  }

  return (
    <main className="page manual-invoice-page">
      <section className="page-header"><div><p className="eyebrow">Orders</p><h1>Manual Invoiced Orders</h1><p>Create production-ready orders for QuickBooks/manual invoices that bypass WooCommerce.</p></div></section>
      {message && <div className="notice success">{message}</div>}{error && <div className="notice error">{error}</div>}

      <form onSubmit={submit} className="card manual-invoice-form manual-invoice-layout">
        <section className="manual-section"><h2>Customer + Invoice Details</h2><div className="grid four">
          <label>Invoice Number<input value={order.invoice_number} onChange={(e) => setOrder({ ...order, invoice_number: e.target.value })} placeholder="QB-1048" /></label>
          <label>Customer Name<input required value={order.customer_name} onChange={(e) => setOrder({ ...order, customer_name: e.target.value })} /></label>
          <label>Organization<input value={order.organization} onChange={(e) => setOrder({ ...order, organization: e.target.value })} /></label>
          <label>Email<input type="email" value={order.customer_email} onChange={(e) => setOrder({ ...order, customer_email: e.target.value })} /></label>
          <label>Phone<input value={order.customer_phone} onChange={(e) => setOrder({ ...order, customer_phone: e.target.value })} /></label>
          <label>Order Date<input type="date" value={order.order_date} onChange={(e) => setOrder({ ...order, order_date: e.target.value })} /></label>
          <label>Due Date<input type="date" value={order.due_date} onChange={(e) => setOrder({ ...order, due_date: e.target.value })} /></label>
          <label>Source<input value="Manual Invoice" readOnly /></label>
        </div></section>

        <section className="manual-section"><div className="sc-panel-header"><div><h2>Line Items</h2><p className="helper-text">Use the dropdown/search table to add multiple item lines quickly.</p></div><button type="button" className="button primary" onClick={() => setItems((current) => [...current, blankLine()])}>+ Add Item</button></div>
          <div className="sc-responsive-table-wrap"><table className="manual-line-table"><thead><tr><th>Blank Lookup</th><th>Brand</th><th>Style</th><th>Color</th><th>Size</th><th>Qty</th><th>Price</th><th>Placement</th><th>Artwork</th><th>Total</th><th></th></tr></thead><tbody>{items.map((line, index) => <ManualLineRow key={index} line={line} index={index} onChange={updateLine} onRemove={removeLine} canRemove={items.length > 1} />)}</tbody></table></div>
        </section>

        <section className="manual-section manual-totals-card"><h2>Totals + Payment</h2><div className="grid four">
          <label>Subtotal<input value={money(subtotal)} readOnly /></label>
          <label>Tax<input type="number" step="0.01" min="0" value={order.tax_amount} onChange={(e) => setOrder({ ...order, tax_amount: e.target.value })} /></label>
          <label>Shipping<input type="number" step="0.01" min="0" value={order.shipping_amount} onChange={(e) => setOrder({ ...order, shipping_amount: e.target.value })} /></label>
          <label>Total Payment Amount<input type="number" step="0.01" min="0" value={order.total_payment_amount} onChange={(e) => setOrder({ ...order, total_payment_amount: e.target.value })} /></label>
        </div><div className="manual-invoice-checks"><label><input type="checkbox" checked={order.invoice_sent} onChange={(e) => setOrder({ ...order, invoice_sent: e.target.checked })} /> Invoice sent</label><label><input type="checkbox" checked={order.payment_received} onChange={(e) => setOrder({ ...order, payment_received: e.target.checked })} /> Payment received</label><label><input type="checkbox" checked={generateJob} onChange={(e) => setGenerateJob(e.target.checked)} /> Generate job and reserve inventory immediately</label></div><label>Order Notes<textarea value={order.notes} onChange={(e) => setOrder({ ...order, notes: e.target.value })} /></label></section>
        <div className="manual-invoice-actions"><button className="button primary" disabled={saving}>{saving ? 'Saving...' : 'Save Manual Invoice Order'}</button></div>
      </form>

      <section className="card"><h2>Recent Manual Invoiced Orders</h2><div className="table-wrap"><table><thead><tr><th>ID</th><th>Invoice</th><th>Customer</th><th>Status</th><th>Units</th><th>Total</th><th>Invoice Sent</th><th>Payment</th><th>Job</th><th>Actions</th></tr></thead><tbody>{orders.map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.invoice_number || `MANUAL-${row.id}`}</td><td>{row.customer_name}<br /><small>{row.organization}</small></td><td>{row.status}</td><td>{row.total_units}</td><td>{money(row.calculated_total || row.total_payment_amount)}</td><td><input type="checkbox" checked={Boolean(row.invoice_sent)} onChange={() => togglePayment(row, 'invoice_sent')} /></td><td><input type="checkbox" checked={Boolean(row.payment_received)} onChange={() => togglePayment(row, 'payment_received')} /></td><td>{row.generated_job_id ? `#${row.generated_job_id}` : 'Not generated'}</td><td>{!row.generated_job_id && <button className="button" type="button" onClick={() => generateExisting(row.id)}>Generate Job</button>}</td></tr>)}{!orders.length && <tr><td colSpan="10">No manual invoice orders yet.</td></tr>}</tbody></table></div></section>
    </main>
  );
}
