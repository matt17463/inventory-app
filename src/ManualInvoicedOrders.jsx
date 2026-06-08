import { useEffect, useMemo, useState } from 'react';
import {
  createManualInvoiceOrder,
  generateManualInvoiceJob,
  getManualInvoiceOrders,
  searchManualInvoiceProducts,
  updateManualInvoicePaymentStatus,
} from './lib/manualOrdersApi';

const blankLine = () => ({
  item_type: 'blank',
  product_source: 'blank',
  blank_product_id: '',
  finished_product_id: '',
  sku_base: '',
  item_name: '',
  brand: '',
  style: '',
  color: '',
  size: '',
  customer_name: '',
  logo_name: '',
  placement: '',
  quantity: 1,
  price_per_item: 0,
  artwork_note: '',
  decoration_size: '',
  notes: '',
});

const today = () => new Date().toISOString().slice(0, 10);
const money = (value) => Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

function getProductId(row) {
  return row.product_id || row.blank_product_id || row.finished_product_id || row.id || '';
}

function productLabel(row) {
  const itemType = row.item_type === 'finished' ? 'Finished' : 'Blank';
  const sku = row.sku_base || row.finished_sku || row.sku || 'No SKU';
  const name = row.name || row.item_name || '';
  const specs = [row.brand, row.style, row.color, row.size].filter(Boolean).join(' / ');
  const finishedDetails = [row.customer_name, row.logo_name, row.placement].filter(Boolean).join(' · ');
  return { itemType, sku, name, specs, finishedDetails };
}

function ProductSourceToggle({ value, onChange }) {
  return (
    <div className="manual-product-toggle" role="group" aria-label="Product source">
      <button
        type="button"
        className={value === 'blank' ? 'active' : ''}
        onClick={() => onChange('blank')}
      >
        Blank Inventory
      </button>
      <button
        type="button"
        className={value === 'finished' ? 'active' : ''}
        onClick={() => onChange('finished')}
      >
        Finished Inventory
      </button>
    </div>
  );
}

function ManualLine({ line, index, onChange, onRemove, canRemove }) {
  const [lookup, setLookup] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');

  const source = line.item_type === 'finished' ? 'finished' : 'blank';

  function updateSource(nextSource) {
    onChange(index, {
      ...line,
      item_type: nextSource,
      product_source: nextSource,
      blank_product_id: '',
      finished_product_id: '',
      sku_base: '',
      item_name: '',
      brand: '',
      style: '',
      color: '',
      size: '',
      customer_name: '',
      logo_name: '',
      placement: '',
    });
    setLookup('');
    setResults([]);
    setOpen(false);
    setSearchMessage('');
  }

  async function runSearch() {
    setLoading(true);
    setSearchMessage('');
    try {
      const rows = await searchManualInvoiceProducts({
        productSource: source,
        search: lookup,
        brand: line.brand,
        style: line.style,
        color: line.color,
        size: line.size,
        limit: 200,
      });
      setResults(rows);
      setOpen(true);
      if (!rows.length) {
        setSearchMessage(
          source === 'finished'
            ? 'No finished products matched these search terms. Try customer, logo, SKU, brand, color, or size.'
            : 'No blank products matched these search terms. Try brand, style, color, size, or SKU.'
        );
      }
    } catch (err) {
      setResults([]);
      setOpen(true);
      setSearchMessage(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function selectProduct(row) {
    const selectedSource = row.item_type === 'finished' ? 'finished' : source;
    onChange(index, {
      ...line,
      item_type: selectedSource,
      product_source: selectedSource,
      blank_product_id: selectedSource === 'blank' ? (row.blank_product_id || row.product_id || row.id || '') : '',
      finished_product_id: selectedSource === 'finished' ? (row.finished_product_id || row.product_id || row.id || '') : '',
      sku_base: row.sku_base || '',
      item_name: row.name || row.sku_base || '',
      brand: row.brand || '',
      style: row.style || '',
      color: row.color || '',
      size: row.size || '',
      customer_name: row.customer_name || '',
      logo_name: row.logo_name || '',
      placement: row.placement || line.placement || '',
      price_per_item: Number(line.price_per_item || 0) || Number(row.unit_cost || 0),
    });
    setLookup(row.sku_base || row.name || '');
    setOpen(false);
  }

  const lineTotal = Number(line.quantity || 0) * Number(line.price_per_item || 0);
  const hasSelectedProduct = source === 'finished' ? Boolean(line.finished_product_id) : Boolean(line.blank_product_id);

  return (
    <div className="manual-order-line-card sc-panel-soft">
      <div className="manual-order-line-header">
        <div>
          <h3>Line {index + 1}</h3>
          <p>
            {hasSelectedProduct
              ? `Selected ${source}: ${line.sku_base || line.item_name}`
              : `Search and select the ${source === 'finished' ? 'finished product' : 'blank product'} for this line.`}
          </p>
        </div>
        {canRemove && <button type="button" className="sc-btn sc-btn-danger" onClick={() => onRemove(index)}>Remove Line</button>}
      </div>

      <div className="manual-search-panel">
        <div className="manual-search-title-row">
          <div>
            <div className="manual-search-title">Find Product</div>
            <small>{source === 'finished' ? 'Search decorated/finished inventory.' : 'Search blank inventory.'}</small>
          </div>
          <ProductSourceToggle value={source} onChange={updateSource} />
        </div>

        <div className="manual-search-grid">
          <label className="sc-field">
            <span>{source === 'finished' ? 'Finished Product Lookup' : 'Blank Product Lookup'}</span>
            <input
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder={source === 'finished' ? 'Search SKU, customer, logo, brand, color, or size' : 'Search SKU, name, brand, style, color, or size'}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
            />
          </label>
          <label className="sc-field"><span>Brand</span><input value={line.brand} onChange={(e) => onChange(index, { ...line, brand: e.target.value })} placeholder="Gildan" /></label>
          <label className="sc-field"><span>Style</span><input value={line.style} onChange={(e) => onChange(index, { ...line, style: e.target.value })} placeholder="18000" /></label>
          <label className="sc-field"><span>Color</span><input value={line.color} onChange={(e) => onChange(index, { ...line, color: e.target.value })} placeholder="Black" /></label>
          <label className="sc-field"><span>Size</span><input value={line.size} onChange={(e) => onChange(index, { ...line, size: e.target.value })} placeholder="A2XL" /></label>
          <div className="manual-search-button-cell">
            <button type="button" className="sc-btn sc-btn-primary" onClick={runSearch} disabled={loading}>{loading ? 'Searching...' : 'Find Matches'}</button>
          </div>
        </div>

        {open && (
          <div className="manual-order-search-results sc-scroll-results">
            <div className="manual-results-header">
              <strong>{results.length} {source === 'finished' ? 'finished' : 'blank'} match{results.length === 1 ? '' : 'es'} found</strong>
              <button type="button" className="sc-text-button" onClick={() => setOpen(false)}>Hide</button>
            </div>
            {searchMessage && <div className="sc-alert sc-alert-warning">{searchMessage}</div>}
            {results.map((row) => {
              const label = productLabel(row);
              const rowKey = `${row.item_type || source}-${getProductId(row)}-${row.sku_base}`;
              return (
                <button type="button" key={rowKey} className="manual-result-card" onClick={() => selectProduct(row)}>
                  <div>
                    <strong>{label.sku}</strong>
                    <span>{label.name}</span>
                    <small>{label.specs || 'No brand/style/color/size'}{label.finishedDetails ? ` · ${label.finishedDetails}` : ''}</small>
                  </div>
                  <div className="manual-result-qty">
                    <span>{label.itemType}</span>
                    <strong>{Number(row.available_quantity ?? row.quantity_on_hand ?? 0)}</strong>
                    <small>available</small>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="manual-line-selected-grid">
        <label className="sc-field"><span>Selected SKU</span><input value={line.sku_base} onChange={(e) => onChange(index, { ...line, sku_base: e.target.value })} placeholder="Select from search" /></label>
        <label className="sc-field"><span>Item Name</span><input value={line.item_name} onChange={(e) => onChange(index, { ...line, item_name: e.target.value })} /></label>
        <label className="sc-field"><span>Quantity</span><input type="number" min="1" value={line.quantity} onChange={(e) => onChange(index, { ...line, quantity: e.target.value })} /></label>
        <label className="sc-field"><span>Price Each</span><input type="number" step="0.01" min="0" value={line.price_per_item} onChange={(e) => onChange(index, { ...line, price_per_item: e.target.value })} /></label>
        <label className="sc-field"><span>Line Total</span><input value={money(lineTotal)} readOnly /></label>
      </div>

      {source === 'finished' && (
        <div className="manual-line-selected-grid">
          <label className="sc-field"><span>Customer</span><input value={line.customer_name} onChange={(e) => onChange(index, { ...line, customer_name: e.target.value })} /></label>
          <label className="sc-field"><span>Logo / Artwork</span><input value={line.logo_name} onChange={(e) => onChange(index, { ...line, logo_name: e.target.value })} /></label>
          <label className="sc-field"><span>Placement</span><input value={line.placement} onChange={(e) => onChange(index, { ...line, placement: e.target.value })} placeholder="Left chest, full front, back" /></label>
        </div>
      )}

      <div className="manual-line-selected-grid">
        <label className="sc-field"><span>Brand</span><input value={line.brand} onChange={(e) => onChange(index, { ...line, brand: e.target.value })} /></label>
        <label className="sc-field"><span>Style</span><input value={line.style} onChange={(e) => onChange(index, { ...line, style: e.target.value })} /></label>
        <label className="sc-field"><span>Color</span><input value={line.color} onChange={(e) => onChange(index, { ...line, color: e.target.value })} /></label>
        <label className="sc-field"><span>Size</span><input value={line.size} onChange={(e) => onChange(index, { ...line, size: e.target.value })} /></label>
        {source === 'blank' && <label className="sc-field"><span>Placement</span><input value={line.placement} onChange={(e) => onChange(index, { ...line, placement: e.target.value })} placeholder="Left chest, full front, back" /></label>}
      </div>

      <div className="manual-line-selected-grid">
        <label className="sc-field"><span>Decoration Size</span><input value={line.decoration_size} onChange={(e) => onChange(index, { ...line, decoration_size: e.target.value })} placeholder="10 inch, 3.5 inch" /></label>
        <label className="sc-field sc-field-wide"><span>Artwork Note</span><input value={line.artwork_note} onChange={(e) => onChange(index, { ...line, artwork_note: e.target.value })} placeholder="Logo name, artwork code, customer instructions" /></label>
      </div>

      <label className="sc-field"><span>Internal Line Notes</span><textarea value={line.notes} onChange={(e) => onChange(index, { ...line, notes: e.target.value })} /></label>
    </div>
  );
}

export default function ManualInvoicedOrders() {
  const [orders, setOrders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [generateJob, setGenerateJob] = useState(true);
  const [order, setOrder] = useState({
    invoice_number: '',
    customer_name: '',
    organization: '',
    customer_email: '',
    customer_phone: '',
    order_date: today(),
    due_date: '',
    tax_amount: 0,
    shipping_amount: 0,
    total_payment_amount: 0,
    invoice_sent: false,
    payment_received: false,
    notes: '',
  });
  const [items, setItems] = useState([blankLine()]);

  async function loadOrders() {
    const rows = await getManualInvoiceOrders();
    setOrders(rows);
  }

  useEffect(() => { loadOrders().catch((err) => setError(err.message)); }, []);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.price_per_item || 0)), 0), [items]);
  const calculatedTotal = subtotal + Number(order.tax_amount || 0) + Number(order.shipping_amount || 0);

  useEffect(() => {
    setOrder((prev) => ({ ...prev, total_payment_amount: Number(calculatedTotal.toFixed(2)) }));
  }, [calculatedTotal]);

  function updateLine(index, next) {
    setItems((current) => current.map((line, i) => (i === index ? next : line)));
  }

  function removeLine(index) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!order.customer_name.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (!items.length || items.some((item) => Number(item.quantity || 0) <= 0)) {
      setError('Every line must have a quantity greater than zero.');
      return;
    }

    setSaving(true);
    try {
      const result = await createManualInvoiceOrder(order, items, generateJob);
      setMessage(`Manual invoice order saved. Manual order ID: ${result.manual_order_id}${result.generated?.job_id ? `, Job ID: ${result.generated.job_id}` : ''}.`);
      setOrder({ invoice_number: '', customer_name: '', organization: '', customer_email: '', customer_phone: '', order_date: today(), due_date: '', tax_amount: 0, shipping_amount: 0, total_payment_amount: 0, invoice_sent: false, payment_received: false, notes: '' });
      setItems([blankLine()]);
      await loadOrders();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function generateExisting(orderId) {
    setError('');
    setMessage('');
    try {
      const result = await generateManualInvoiceJob(orderId);
      setMessage(`Generated job #${result.job_id || result.job_id} for manual invoice order #${orderId}.`);
      await loadOrders();
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function togglePayment(row, field) {
    const invoiceSent = field === 'invoice_sent' ? !row.invoice_sent : row.invoice_sent;
    const paymentReceived = field === 'payment_received' ? !row.payment_received : row.payment_received;
    try {
      await updateManualInvoicePaymentStatus(row.id, invoiceSent, paymentReceived);
      await loadOrders();
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  return (
    <div className="sc-page-stack manual-invoice-page">
      <div className="sc-page-header-card sc-page-header-blue">
        <div>
          <div className="sc-kicker">Management</div>
          <h1>Manual Invoiced Orders</h1>
          <p>Create production-ready orders for QuickBooks/manual invoices that bypass WooCommerce. Lines can use blank inventory or finished inventory.</p>
        </div>
      </div>

      {message && <div className="sc-alert sc-alert-success">{message}</div>}
      {error && <div className="sc-alert sc-alert-error">{error}</div>}

      <form onSubmit={submit} className="manual-invoice-form">
        <section className="sc-panel">
          <div className="sc-panel-header">
            <div><h2>Customer + Invoice Details</h2><p>Enter the customer and invoice information first, then add one or more line items below.</p></div>
          </div>
          <div className="sc-form-grid sc-form-grid-4">
            <label className="sc-field"><span>Invoice Number</span><input value={order.invoice_number} onChange={(e) => setOrder({ ...order, invoice_number: e.target.value })} placeholder="QB-1048" /></label>
            <label className="sc-field"><span>Customer Name</span><input required value={order.customer_name} onChange={(e) => setOrder({ ...order, customer_name: e.target.value })} /></label>
            <label className="sc-field"><span>Organization</span><input value={order.organization} onChange={(e) => setOrder({ ...order, organization: e.target.value })} /></label>
            <label className="sc-field"><span>Email</span><input type="email" value={order.customer_email} onChange={(e) => setOrder({ ...order, customer_email: e.target.value })} /></label>
            <label className="sc-field"><span>Phone</span><input value={order.customer_phone} onChange={(e) => setOrder({ ...order, customer_phone: e.target.value })} /></label>
            <label className="sc-field"><span>Order Date</span><input type="date" value={order.order_date} onChange={(e) => setOrder({ ...order, order_date: e.target.value })} /></label>
            <label className="sc-field"><span>Due Date</span><input type="date" value={order.due_date} onChange={(e) => setOrder({ ...order, due_date: e.target.value })} /></label>
            <label className="sc-field"><span>Source</span><input value="Manual Invoice" readOnly /></label>
          </div>
        </section>

        <section className="sc-panel">
          <div className="sc-panel-header">
            <div><h2>Line Items</h2><p>Each line defaults to blank inventory. Switch to finished inventory when the customer is buying an already-decorated item.</p></div>
            <button type="button" className="sc-btn sc-btn-primary" onClick={() => setItems((current) => [...current, blankLine()])}>+ Add Line</button>
          </div>
          {items.map((line, index) => (
            <ManualLine key={index} line={line} index={index} onChange={updateLine} onRemove={removeLine} canRemove={items.length > 1} />
          ))}
        </section>

        <section className="sc-panel">
          <div className="sc-panel-header"><div><h2>Totals + Payment</h2><p>Confirm tax, shipping, payment status, and whether this should immediately generate a production job.</p></div></div>
          <div className="sc-form-grid sc-form-grid-4">
            <label className="sc-field"><span>Subtotal</span><input value={money(subtotal)} readOnly /></label>
            <label className="sc-field"><span>Tax</span><input type="number" step="0.01" min="0" value={order.tax_amount} onChange={(e) => setOrder({ ...order, tax_amount: e.target.value })} /></label>
            <label className="sc-field"><span>Shipping</span><input type="number" step="0.01" min="0" value={order.shipping_amount} onChange={(e) => setOrder({ ...order, shipping_amount: e.target.value })} /></label>
            <label className="sc-field"><span>Total Payment Amount</span><input type="number" step="0.01" min="0" value={order.total_payment_amount} onChange={(e) => setOrder({ ...order, total_payment_amount: e.target.value })} /></label>
          </div>
          <div className="manual-invoice-checks">
            <label><input type="checkbox" checked={order.invoice_sent} onChange={(e) => setOrder({ ...order, invoice_sent: e.target.checked })} /> Invoice sent</label>
            <label><input type="checkbox" checked={order.payment_received} onChange={(e) => setOrder({ ...order, payment_received: e.target.checked })} /> Payment received</label>
            <label><input type="checkbox" checked={generateJob} onChange={(e) => setGenerateJob(e.target.checked)} /> Generate job immediately</label>
          </div>
          <label className="sc-field"><span>Order Notes</span><textarea value={order.notes} onChange={(e) => setOrder({ ...order, notes: e.target.value })} /></label>
          <div className="sc-form-actions">
            <button className="sc-btn sc-btn-primary sc-btn-large" disabled={saving}>{saving ? 'Saving...' : 'Save Manual Invoice Order'}</button>
          </div>
        </section>
      </form>

      <section className="sc-panel">
        <div className="sc-panel-header"><div><h2>Recent Manual Invoiced Orders</h2><p>Track manual invoice orders, payment status, and generated production jobs.</p></div></div>
        <div className="table-wrap sc-table-wrap">
          <table className="sc-table">
            <thead>
              <tr>
                <th>ID</th><th>Invoice</th><th>Customer</th><th>Status</th><th>Units</th><th>Total</th><th>Invoice Sent</th><th>Payment</th><th>Job</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.invoice_number || `MANUAL-${row.id}`}</td>
                  <td>{row.customer_name}<br /><small>{row.organization}</small></td>
                  <td><span className="sc-status-pill">{row.status}</span></td>
                  <td>{row.total_units}</td>
                  <td>{money(row.calculated_total || row.total_payment_amount)}</td>
                  <td><input type="checkbox" checked={Boolean(row.invoice_sent)} onChange={() => togglePayment(row, 'invoice_sent')} /></td>
                  <td><input type="checkbox" checked={Boolean(row.payment_received)} onChange={() => togglePayment(row, 'payment_received')} /></td>
                  <td>{row.generated_job_id ? `#${row.generated_job_id}` : 'Not generated'}</td>
                  <td>{!row.generated_job_id && <button className="sc-btn" type="button" onClick={() => generateExisting(row.id)}>Generate Job</button>}</td>
                </tr>
              ))}
              {!orders.length && <tr><td colSpan="10">No manual invoice orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
