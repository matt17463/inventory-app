import { useEffect, useMemo, useState } from 'react';
import {
  createManualInvoiceOrder,
  generateManualInvoiceJob,
  createMissingBlankProductForManualInvoice,
  getManualInvoiceOrders,
  getManualInvoiceOrderItems,
  searchManualInvoiceProducts,
  updateManualInvoiceOrder,
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

function buildAttributeName(line) {
  return [line.brand, line.style, line.color, line.size]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
}

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
    <div className="manual-product-toggle manual-product-toggle-compact" role="group" aria-label="Product source">
      <button
        type="button"
        className={value === 'blank' ? 'active' : ''}
        onClick={() => onChange('blank')}
      >
        Blank
      </button>
      <button
        type="button"
        className={value === 'finished' ? 'active' : ''}
        onClick={() => onChange('finished')}
      >
        Finished
      </button>
    </div>
  );
}

function ManualLineRow({ line, index, onChange, onRemove, canRemove }) {
  const [lookup, setLookup] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');

  const source = line.item_type === 'finished' ? 'finished' : 'blank';
  const hasSelectedProduct = source === 'finished' ? Boolean(line.finished_product_id) : Boolean(line.blank_product_id);
  const lineTotal = Number(line.quantity || 0) * Number(line.price_per_item || 0);

  function patch(patchValues) {
    onChange(index, { ...line, ...patchValues });
  }

  function patchAttribute(patchValues) {
    onChange(index, {
      ...line,
      ...patchValues,
      blank_product_id: '',
      finished_product_id: '',
      sku_base: '',
      item_name: '',
    });

    setLookup('');
    setResults([]);
    setOpen(false);
    setSearchMessage('');
  }

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
      setResults(rows || []);
      setOpen(true);
      if (!rows?.length) {
        setSearchMessage(
          source === 'finished'
            ? 'No finished products matched these search terms. Try customer, logo, placement, SKU, brand, style, color, size, notes, or any attribute.'
            : 'No blank products matched these search terms. Try SKU, UPC/barcode, brand, style, color, size, name, notes, or any attribute/variation.'
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
      sku_base: row.sku_base || row.finished_sku || row.sku || '',
      item_name: row.name || row.item_name || row.sku_base || '',
      brand: row.brand || '',
      style: row.style || '',
      color: row.color || '',
      size: row.size || '',
      customer_name: row.customer_name || '',
      logo_name: row.logo_name || '',
      placement: row.placement || line.placement || '',
      price_per_item: Number(line.price_per_item || 0) || Number(row.unit_cost || row.price_per_item || 0),
    });
    setLookup(row.sku_base || row.finished_sku || row.sku || row.name || '');
    setOpen(false);
    setDetailsOpen(true);
  }

  async function createMissingBlankProduct() {
    setLoading(true);
    setSearchMessage('');

    try {
      const attributeName = buildAttributeName(line);

      const payload = {
        // Intentionally blank: the database should generate the SKU from the
        // visible Brand + Style + Color + Size fields. This prevents stale
        // lookup SKUs, such as KELLYGREEN, from overriding a changed color.
        sku_base: '',
        name: attributeName,
        brand: line.brand,
        style: line.style,
        color: line.color,
        size: line.size,
        unit_cost: Number(line.price_per_item || 0),
        notes: line.notes || line.artwork_note || '',
      };

      if (!payload.brand || !payload.style || !payload.color || !payload.size) {
        setSearchMessage('Before creating a blank product, fill in Brand, Style, Color, and Size on this line.');
        return;
      }

      const confirmed = window.confirm(
        `Create missing blank product for ${payload.brand} ${payload.style} ${payload.color} ${payload.size}?`
      );

      if (!confirmed) return;

      const created = await createMissingBlankProductForManualInvoice(payload);

      if (!created?.success) {
        throw new Error(created?.message || 'Blank product was not created.');
      }

      const product = created.product || created;
      selectProduct({
        item_type: 'blank',
        product_id: product.blank_product_id || product.id,
        blank_product_id: product.blank_product_id || product.id,
        sku_base: product.sku_base || payload.sku_base,
        name: product.name || payload.name,
        brand: product.brand || payload.brand,
        style: product.style || payload.style,
        color: product.color || payload.color,
        size: product.size || payload.size,
        unit_cost: product.unit_cost || payload.unit_cost || 0,
      });

      setSearchMessage(`Created and selected blank product ${product.sku_base || payload.sku_base}.`);
    } catch (err) {
      setSearchMessage(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="manual-line-table-row sc-panel-soft">
      <div className="manual-line-row-title">
        <div>
          <strong>Line {index + 1}</strong>
          {hasSelectedProduct ? (
            <span className="manual-line-selected-label">Selected: {line.sku_base || line.item_name}</span>
          ) : (
            <span className="manual-line-missing-label">Choose {source === 'finished' ? 'finished product' : 'blank product'}</span>
          )}
        </div>
        <div className="manual-line-row-actions">
          <button type="button" className="sc-btn sc-btn-muted" onClick={() => setDetailsOpen((v) => !v)}>
            {detailsOpen ? 'Hide Details' : 'Line Details'}
          </button>
          {canRemove && <button type="button" className="sc-btn sc-btn-danger" onClick={() => onRemove(index)}>Remove Line</button>}
        </div>
      </div>

      <div className="manual-line-table-grid" role="group" aria-label={`Manual invoice line ${index + 1}`}>
        <label className="sc-field manual-line-source-cell">
          <span>Source</span>
          <ProductSourceToggle value={source} onChange={updateSource} />
        </label>

        <label className="sc-field manual-line-lookup-cell">
          <span>{source === 'finished' ? 'Finished Product Lookup' : 'Blank Product Lookup'}</span>
          <div className="manual-inline-search">
            <input
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder={source === 'finished' ? 'SKU, customer, logo, placement, brand, style, color, size, notes' : 'SKU, UPC, barcode, brand, style, color, size, name, notes, any attribute'}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
            />
            <button type="button" className="sc-btn sc-btn-primary" onClick={runSearch} disabled={loading}>{loading ? '...' : 'Find'}</button>
            {source === 'blank' && (
              <button type="button" className="sc-btn" onClick={createMissingBlankProduct} disabled={loading}>
                Create Blank
              </button>
            )}
          </div>
        </label>

        <label className="sc-field"><span>Brand</span><input value={line.brand} onChange={(e) => patchAttribute({ brand: e.target.value })} placeholder="Gildan" /></label>
        <label className="sc-field"><span>Style</span><input value={line.style} onChange={(e) => patchAttribute({ style: e.target.value })} placeholder="18000" /></label>
        <label className="sc-field"><span>Color</span><input value={line.color} onChange={(e) => patchAttribute({ color: e.target.value })} placeholder="Black" /></label>
        <label className="sc-field"><span>Size</span><input value={line.size} onChange={(e) => patchAttribute({ size: e.target.value })} placeholder="A2XL" /></label>
        <label className="sc-field"><span>Qty</span><input type="number" min="1" value={line.quantity} onChange={(e) => patch({ quantity: e.target.value })} /></label>
        <label className="sc-field"><span>Price Each</span><input type="number" step="0.01" min="0" value={line.price_per_item} onChange={(e) => patch({ price_per_item: e.target.value })} /></label>
        <label className="sc-field"><span>Total</span><input value={money(lineTotal)} readOnly /></label>
      </div>

      {open && (
        <div className="manual-order-search-results manual-order-search-results-table sc-scroll-results">
          <div className="manual-results-header">
            <strong>{results.length} {source === 'finished' ? 'finished' : 'blank'} match{results.length === 1 ? '' : 'es'} found</strong>
            <button type="button" className="sc-text-button" onClick={() => setOpen(false)}>Hide</button>
          </div>
          {searchMessage && (
            <div className="sc-alert sc-alert-warning manual-missing-blank-alert">
              <span>{searchMessage}</span>
              {source === 'blank' && results.length === 0 && (
                <button
                  type="button"
                  className="sc-btn sc-btn-primary"
                  onClick={createMissingBlankProduct}
                  disabled={loading}
                >
                  Create Missing Blank Product
                </button>
              )}
            </div>
          )}
          <div className="manual-results-grid-list">
            {results.map((row) => {
              const label = productLabel(row);
              const rowKey = `${row.item_type || source}-${getProductId(row)}-${row.sku_base || row.sku || row.name}`;
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
        </div>
      )}

      {detailsOpen && (
        <div className="manual-line-detail-drawer">
          <div className="manual-line-detail-grid">
            <label className="sc-field"><span>Selected SKU</span><input value={line.sku_base} onChange={(e) => patch({ sku_base: e.target.value })} placeholder="Select from search" /></label>
            <label className="sc-field"><span>Item Name</span><input value={line.item_name} onChange={(e) => patch({ item_name: e.target.value })} /></label>
            <label className="sc-field"><span>Placement</span><input value={line.placement} onChange={(e) => patch({ placement: e.target.value })} placeholder="Left chest, full front, back" /></label>
            <label className="sc-field"><span>Decoration Size</span><input value={line.decoration_size} onChange={(e) => patch({ decoration_size: e.target.value })} placeholder="10 inch, 3.5 inch" /></label>
            {source === 'finished' && (
              <>
                <label className="sc-field"><span>Customer</span><input value={line.customer_name} onChange={(e) => patch({ customer_name: e.target.value })} /></label>
                <label className="sc-field"><span>Logo / Artwork</span><input value={line.logo_name} onChange={(e) => patch({ logo_name: e.target.value })} /></label>
              </>
            )}
            <label className="sc-field sc-field-wide"><span>Artwork Note</span><input value={line.artwork_note} onChange={(e) => patch({ artwork_note: e.target.value })} placeholder="Logo name, artwork code, customer instructions" /></label>
            <label className="sc-field sc-field-wide"><span>Internal Line Notes</span><textarea value={line.notes} onChange={(e) => patch({ notes: e.target.value })} /></label>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManualInvoicedOrders() {
  const [orders, setOrders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [generateJob, setGenerateJob] = useState(true);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editingGeneratedJobId, setEditingGeneratedJobId] = useState(null);
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
    setOrders(rows || []);
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
      if (editingOrderId) {
        const result = await updateManualInvoiceOrder(editingOrderId, order, items, {
          regenerateJob: Boolean(generateJob && editingGeneratedJobId),
        });
        setMessage(`Manual invoice order #${editingOrderId} updated.${result?.job_result?.job_id ? ` Job refreshed: #${result.job_result.job_id}.` : ''}`);
      } else {
        const result = await createManualInvoiceOrder(order, items, generateJob);
        setMessage(`Manual invoice order saved. Manual order ID: ${result.manual_order_id}${result.generated?.job_id ? `, Job ID: ${result.generated.job_id}` : ''}.`);
      }

      resetForm();
      await loadOrders();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setEditingOrderId(null);
    setEditingGeneratedJobId(null);
    setGenerateJob(true);
    setOrder({
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
    setItems([blankLine()]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function mapExistingItem(item) {
    const itemType = item.item_type === 'finished' || item.product_source === 'finished' || item.finished_product_id ? 'finished' : 'blank';

    return {
      ...blankLine(),
      item_type: itemType,
      product_source: itemType,
      blank_product_id: itemType === 'blank' ? String(item.blank_product_id || '') : '',
      finished_product_id: itemType === 'finished' ? String(item.finished_product_id || '') : '',
      sku_base: item.sku_base || item.finished_sku || item.sku || '',
      item_name: item.item_name || item.name || '',
      brand: item.brand || '',
      style: item.style || '',
      color: item.color || '',
      size: item.size || '',
      customer_name: item.customer_name || '',
      logo_name: item.logo_name || '',
      placement: item.placement || '',
      quantity: Number(item.quantity || 1),
      price_per_item: Number(item.price_per_item || 0),
      artwork_note: item.artwork_note || '',
      decoration_size: item.decoration_size || '',
      notes: item.notes || '',
    };
  }

  async function editExisting(row) {
    setError('');
    setMessage('');

    try {
      const detailItems = await getManualInvoiceOrderItems(row.id);
      setEditingOrderId(row.id);
      setEditingGeneratedJobId(row.generated_job_id || null);
      setGenerateJob(Boolean(row.generated_job_id));
      setOrder({
        invoice_number: row.invoice_number || '',
        customer_name: row.customer_name || '',
        organization: row.organization || '',
        customer_email: row.customer_email || '',
        customer_phone: row.customer_phone || '',
        order_date: row.order_date || today(),
        due_date: row.due_date || '',
        tax_amount: Number(row.tax_amount || 0),
        shipping_amount: Number(row.shipping_amount || 0),
        total_payment_amount: Number(row.total_payment_amount || row.calculated_total || 0),
        invoice_sent: Boolean(row.invoice_sent),
        payment_received: Boolean(row.payment_received),
        notes: row.notes || '',
      });
      setItems((detailItems || []).length ? detailItems.map(mapExistingItem) : [blankLine()]);
      setMessage(`Editing manual invoice order #${row.id}. Make changes above, then click Update Manual Invoice Order.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function generateExisting(orderId) {
    setError('');
    setMessage('');
    try {
      const result = await generateManualInvoiceJob(orderId);
      setMessage(`Generated job #${result.job_id || result.generated_job_id || 'new'} for manual invoice order #${orderId}.`);
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
      <style>{`
        .manual-edit-banner {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }
        .manual-order-row-actions,
        .manual-missing-blank-alert {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .manual-missing-blank-alert span {
          flex: 1 1 280px;
        }
      `}</style>
      <div className="sc-page-header-card sc-page-header-blue">
        <div>
          <div className="sc-kicker">Management</div>
          <h1>Manual Invoiced Orders</h1>
          <p>Create production-ready orders for QuickBooks/manual invoices that bypass WooCommerce. Lines can use blank inventory or finished inventory.</p>
        </div>
      </div>

      {message && <div className="sc-alert sc-alert-success">{message}</div>}
      {error && <div className="sc-alert sc-alert-error">{error}</div>}
      {editingOrderId && (
        <div className="sc-alert sc-alert-warning manual-edit-banner">
          <strong>Editing previous manual invoice order #{editingOrderId}.</strong>
          <span> Saving will update the existing order and replace its line items with the current form lines.</span>
          <button type="button" className="sc-btn" onClick={resetForm}>Cancel Edit</button>
        </div>
      )}

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

        <section className="sc-panel manual-line-table-section">
          <div className="sc-panel-header">
            <div>
              <h2>Line Items</h2>
              <p>Use the table-style entry below to add blanks or finished products. Each line defaults to blank inventory.</p>
            </div>
            <button type="button" className="sc-btn sc-btn-primary" onClick={() => setItems((current) => [...current, blankLine()])}>+ Add Line</button>
          </div>
          <div className="manual-line-table-head" aria-hidden="true">
            <span>Source</span>
            <span>Product Lookup</span>
            <span>Brand</span>
            <span>Style</span>
            <span>Color</span>
            <span>Size</span>
            <span>Qty</span>
            <span>Price</span>
            <span>Total</span>
          </div>
          <div className="manual-line-table-list">
            {items.map((line, index) => (
              <ManualLineRow key={index} line={line} index={index} onChange={updateLine} onRemove={removeLine} canRemove={items.length > 1} />
            ))}
          </div>
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
            <label><input type="checkbox" checked={generateJob} onChange={(e) => setGenerateJob(e.target.checked)} /> {editingOrderId ? 'Refresh generated job after update' : 'Generate job immediately'}</label>
          </div>
          <label className="sc-field"><span>Order Notes</span><textarea value={order.notes} onChange={(e) => setOrder({ ...order, notes: e.target.value })} /></label>
          <div className="sc-form-actions">
            <button className="sc-btn sc-btn-primary sc-btn-large" disabled={saving}>{saving ? 'Saving...' : (editingOrderId ? 'Update Manual Invoice Order' : 'Save Manual Invoice Order')}</button>
            {editingOrderId && <button type="button" className="sc-btn sc-btn-large" onClick={resetForm}>Cancel Edit</button>}
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
                  <td>
                    <div className="manual-order-row-actions">
                      <button className="sc-btn" type="button" onClick={() => editExisting(row)}>Edit Order</button>
                      {!row.generated_job_id && <button className="sc-btn" type="button" onClick={() => generateExisting(row.id)}>Generate Job</button>}
                    </div>
                  </td>
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
