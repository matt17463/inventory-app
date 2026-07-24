import { useEffect, useMemo, useState } from 'react';
import {
  createManualInvoiceOrder,
  generateManualInvoiceJob,
  createMissingBlankProductForManualInvoice,
  ensureBlankProductForManualSizeRun,
  getManualInvoiceReceivingLookups,
  getManualInvoiceOrders,
  getManualInvoiceOrderItems,
  searchManualInvoiceProducts,
  updateManualInvoiceOrder,
  updateManualInvoicePaymentStatus,
  receiveManualInvoiceBlankLine,
  receiveManualInvoiceOrderBlanks,
  getManualInvoiceBlankReceiptSummary,
  setManualInvoiceLineReceivedQuantity,
  previewVoidManualInvoiceOrder,
  voidManualInvoiceOrder,
  syncManualInvoiceGeneratedPullsheet,
} from './lib/manualOrdersApi';

const blankLine = () => ({
  manual_order_item_id: '',
  generated_job_item_id: '',
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

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeForCompare(value) {
  return normalizeText(value).toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

function skuPiece(value) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/&/g, 'AND')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function lookupById(list = [], id) {
  return list.find((row) => String(row.id) === String(id));
}

function lookupName(list = [], id) {
  const row = lookupById(list, id);
  return row?.name || row?.label || row?.code || '';
}

function lookupCodeOrName(list = [], id) {
  const row = lookupById(list, id);
  return row?.code || row?.name || row?.label || '';
}

function findSizeFromText(sizes = [], sizeText = '') {
  const wanted = normalizeForCompare(sizeText);
  if (!wanted) return null;
  return sizes.find((size) => {
    const options = [size.name, size.code, size.label, size.title].filter(Boolean);
    return options.some((option) => normalizeForCompare(option) === wanted);
  }) || null;
}

function parseSizeRunRows(text = '', sizes = []) {
  return String(text || '')
    .split(/\n|,/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      let sizeText = '';
      let quantityText = '';

      const trailingQty = row.match(/^(.+?)[\s,:;xX*\-]+(\d+(?:\.\d+)?)$/);
      const leadingQty = row.match(/^(\d+(?:\.\d+)?)[\s,:;xX*\-]+(.+)$/);

      if (trailingQty) {
        sizeText = trailingQty[1].trim();
        quantityText = trailingQty[2].trim();
      } else if (leadingQty) {
        quantityText = leadingQty[1].trim();
        sizeText = leadingQty[2].trim();
      } else {
        const parts = row.split(/\s+/);
        quantityText = parts.pop() || '';
        sizeText = parts.join(' ').trim();
      }

      const size = findSizeFromText(sizes, sizeText);
      return {
        original: row,
        size_id: size?.id || '',
        size_name: size?.name || size?.code || sizeText,
        quantity: Number(quantityText) || 0,
        unresolved_size: !size,
      };
    });
}

function buildSkuFromParts(brand, style, color, size) {
  return [brand, style, color, size].map(skuPiece).filter(Boolean).join('-');
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
  const [quickLookups, setQuickLookups] = useState({ brands: [], product_types: [], colors: [], sizes: [] });
  const [quickRun, setQuickRun] = useState({
    brand_id: '',
    product_type_id: '',
    color_id: '',
    paste: '',
    price_per_item: '',
    placement: '',
    decoration_size: '',
    artwork_note: '',
    notes: '',
    replace_existing: false,
  });
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickMessage, setQuickMessage] = useState('');
  const [receiveDefaults, setReceiveDefaults] = useState({
    bin_id: '',
    supplier: '',
    po_number: '',
    unit_cost: '',
    notes: '',
  });
  const [receiveBusy, setReceiveBusy] = useState(false);
  const [receiveMessage, setReceiveMessage] = useState('');
  const [receiveQuantities, setReceiveQuantities] = useState({});
  const [receiveProcessed, setReceiveProcessed] = useState({});
  const [hideProcessedReceiveLines, setHideProcessedReceiveLines] = useState(false);
  const [receiptSummary, setReceiptSummary] = useState({});
  const [receiptSummaryBusy, setReceiptSummaryBusy] = useState(false);
  const [voidingOrderId, setVoidingOrderId] = useState(null);
  const [syncingOrderId, setSyncingOrderId] = useState(null);

  async function loadOrders() {
    const rows = await getManualInvoiceOrders();
    setOrders(rows || []);
  }

  async function loadQuickLookups() {
    const rows = await getManualInvoiceReceivingLookups();
    setQuickLookups(rows || { brands: [], product_types: [], colors: [], sizes: [], bins: [] });
  }

  useEffect(() => {
    loadOrders().catch((err) => setError(err.message));
    loadQuickLookups().catch((err) => setError(err.message || String(err)));
  }, []);

  useEffect(() => {
    setReceiveQuantities((current) => {
      const next = { ...current };
      items.forEach((line, index) => {
        const key = receiveLineKey(line, index);
        if (next[key] === undefined || next[key] === null || next[key] === '') {
          next[key] = String(Number(line.quantity || 0));
        }
      });
      return next;
    });
  }, [items]);

  useEffect(() => {
    setReceiveProcessed({});
  }, [editingOrderId, receiveDefaults.bin_id]);

  useEffect(() => {
    if (!editingOrderId) {
      setReceiptSummary({});
      return;
    }

    loadReceiptSummaryForCurrentOrder().catch((err) => setError(err.message || String(err)));
  }, [editingOrderId, receiveDefaults.bin_id]);

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

  function updateQuickRun(patchValues) {
    setQuickRun((prev) => ({ ...prev, ...patchValues }));
  }

  function quickSelect(value, onChange, list, placeholder) {
    return (
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {list.map((row) => (
          <option key={row.id} value={row.id}>{row.name || row.label || row.code || row.id}</option>
        ))}
      </select>
    );
  }

  function previewQuickSizeRows() {
    return parseSizeRunRows(quickRun.paste, quickLookups.sizes);
  }

  async function addQuickSizeRunLines(replaceExisting = false) {
    setQuickBusy(true);
    setQuickMessage('');
    setError('');

    try {
      const brand = lookupName(quickLookups.brands, quickRun.brand_id);
      const brandCode = lookupCodeOrName(quickLookups.brands, quickRun.brand_id) || brand;
      const style = lookupName(quickLookups.product_types, quickRun.product_type_id);
      const styleCode = lookupCodeOrName(quickLookups.product_types, quickRun.product_type_id) || style;
      const color = lookupName(quickLookups.colors, quickRun.color_id);
      const colorCode = lookupCodeOrName(quickLookups.colors, quickRun.color_id) || color;
      const parsed = previewQuickSizeRows();

      if (!quickRun.brand_id || !quickRun.product_type_id || !quickRun.color_id) {
        throw new Error('Choose a default Brand, Style, and Color before creating size-run line items.');
      }

      if (!parsed.length) {
        throw new Error('Paste a size run first. Example: L 2, M 2, S 2, XL 2, XS 2.');
      }

      const badQty = parsed.filter((row) => Number(row.quantity || 0) <= 0);
      if (badQty.length) {
        throw new Error(`Every size-run row needs a quantity greater than zero. Check: ${badQty.map((row) => row.original).join(', ')}`);
      }

      const newLines = [];
      let createdOrResolved = 0;
      const unresolvedSizes = [];

      for (const row of parsed) {
        if (row.unresolved_size) unresolvedSizes.push(row.size_name);

        const size = row.size_name;
        const sizeCode = lookupCodeOrName(quickLookups.sizes, row.size_id) || size;
        const fallbackSku = buildSkuFromParts(brandCode, styleCode, colorCode, sizeCode);
        const fallbackName = [brand, style, color, size].filter(Boolean).join(' ');

        const result = await ensureBlankProductForManualSizeRun({
          brand_id: quickRun.brand_id,
          product_type_id: quickRun.product_type_id,
          color_id: quickRun.color_id,
          size_id: row.size_id,
          brand,
          style,
          color,
          size,
          sku_base: fallbackSku,
          name: fallbackName,
          unit_cost: Number(quickRun.price_per_item || 0),
          notes: quickRun.notes,
        });

        if (result?.success === false) {
          throw new Error(result?.message || `Could not create/select blank product for ${fallbackName}.`);
        }

        const product = result?.product || result || {};
        if (product.blank_product_id || product.id) createdOrResolved += 1;

        newLines.push({
          ...blankLine(),
          item_type: 'blank',
          product_source: 'blank',
          blank_product_id: String(product.blank_product_id || product.id || ''),
          sku_base: product.sku_base || fallbackSku,
          item_name: product.name || fallbackName,
          brand: product.brand || brand,
          style: product.style || style,
          color: product.color || color,
          size: product.size || size,
          quantity: Number(row.quantity || 0),
          price_per_item: quickRun.price_per_item === '' ? 0 : Number(quickRun.price_per_item || 0),
          placement: quickRun.placement,
          decoration_size: quickRun.decoration_size,
          artwork_note: quickRun.artwork_note,
          notes: quickRun.notes,
        });
      }

      setItems((current) => {
        const shouldReplace = replaceExisting || Boolean(quickRun.replace_existing);
        if (shouldReplace) return newLines;
        const hasOnlyEmptyLine = current.length === 1 && !current[0].sku_base && !current[0].item_name && !current[0].brand && !current[0].style && !current[0].color && !current[0].size;
        return hasOnlyEmptyLine ? newLines : [...current, ...newLines];
      });

      setQuickMessage(
        `Added ${newLines.length} line item${newLines.length === 1 ? '' : 's'} from the size run.${createdOrResolved ? ` Created/selected ${createdOrResolved} blank product${createdOrResolved === 1 ? '' : 's'}.` : ''}${unresolvedSizes.length ? ` Review newly-created size label${unresolvedSizes.length === 1 ? '' : 's'}: ${unresolvedSizes.join(', ')}.` : ''}`
      );
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setQuickBusy(false);
    }
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
        const shouldSyncPullsheet = Boolean(generateJob && editingGeneratedJobId);
        const result = await updateManualInvoiceOrder(editingOrderId, order, items, {
          regenerateJob: shouldSyncPullsheet,
          syncGeneratedPullsheet: shouldSyncPullsheet,
          cancelRemovedLines: true,
          recreateReservations: true,
        });
        const syncResult = result?.job_sync_result || result?.job_result;
        const warningCount = Array.isArray(syncResult?.warnings) ? syncResult.warnings.length : 0;
        setMessage(
          `Manual invoice order #${editingOrderId} updated.` +
          (syncResult?.generated_job_id
            ? ` Pull sheet #${syncResult.generated_job_id} synced: ${Number(syncResult.updated_items || 0)} updated, ${Number(syncResult.created_items || 0)} added, ${Number(syncResult.cancelled_items || 0)} removed/cancelled.${warningCount ? ` ${warningCount} warning(s) need review.` : ''}`
            : '')
        );
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
    setReceiveQuantities({});
    setReceiptSummary({});
    setReceiveMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function mapExistingItem(item) {
    const itemType = item.item_type === 'finished' || item.product_source === 'finished' || item.finished_product_id ? 'finished' : 'blank';

    return {
      ...blankLine(),
      manual_order_item_id: item.id || item.manual_order_item_id || '',
      generated_job_item_id: item.generated_job_item_id || '',
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

  function updateReceiveDefaults(patchValues) {
    setReceiveDefaults((prev) => ({ ...prev, ...patchValues }));
  }


  function receiveLineKey(line, index) {
    return String(line?.manual_order_item_id || line?.id || `current-${index}`);
  }

  function receiveQuantityForLine(line, index) {
    const key = receiveLineKey(line, index);
    const stored = receiveQuantities[key];
    return stored === undefined || stored === null || stored === '' ? String(Number(line?.quantity || 0)) : String(stored);
  }

  function updateReceiveQuantity(line, index, value) {
    const key = receiveLineKey(line, index);
    setReceiveQuantities((current) => ({ ...current, [key]: value }));
  }

  function receiptSummaryForLine(line, index) {
    return receiptSummary[receiveLineKey(line, index)] || null;
  }

  function processedReceiveForLine(line, index) {
    return receiveProcessed[receiveLineKey(line, index)] || null;
  }

  function receivedQuantityForLine(line, index) {
    const summary = receiptSummaryForLine(line, index);
    const processed = processedReceiveForLine(line, index);
    return Number(summary?.received_quantity ?? processed?.received_quantity ?? processed?.quantity ?? 0);
  }

  function isReceiveLineProcessed(line, index) {
    const target = Number(receiveQuantityForLine(line, index) || 0);
    if (target <= 0) return false;
    return receivedQuantityForLine(line, index) >= target;
  }

  function markReceiveLineProcessed(line, index, result, requestedQuantity) {
    const key = receiveLineKey(line, index);
    const target = Number(result?.target_quantity ?? requestedQuantity ?? 0);
    const received = Number(result?.target_quantity ?? result?.quantity ?? requestedQuantity ?? 0);
    setReceiveProcessed((current) => ({
      ...current,
      [key]: {
        processed_at: new Date().toISOString(),
        target_quantity: target,
        received_quantity: received,
        quantity: Number(result?.quantity ?? requestedQuantity ?? 0),
        delta_quantity: Number(result?.delta_quantity ?? result?.quantity ?? requestedQuantity ?? 0),
      },
    }));
  }

  async function loadReceiptSummaryForCurrentOrder() {
    if (!editingOrderId) return;
    setReceiptSummaryBusy(true);
    try {
      const rows = await getManualInvoiceBlankReceiptSummary(editingOrderId, receiveDefaults.bin_id || '');
      const next = {};
      (rows || []).forEach((row) => {
        if (row.manual_order_item_id !== null && row.manual_order_item_id !== undefined) {
          next[String(row.manual_order_item_id)] = row;
        }
      });
      setReceiptSummary(next);
    } finally {
      setReceiptSummaryBusy(false);
    }
  }

  function receiveBinSelect() {
    const bins = quickLookups.bins || [];
    return quickSelect(
      receiveDefaults.bin_id,
      (value) => updateReceiveDefaults({ bin_id: value }),
      bins.map((bin) => ({ ...bin, name: bin.display_name || bin.label || bin.bin_code || bin.name || bin.id })),
      'Choose receiving bin'
    );
  }

  function isReceivableLine(line) {
    const source = line.item_type === 'finished' || line.product_source === 'finished' ? 'finished' : 'blank';
    const hasBlank = Boolean(line.blank_product_id);
    const hasFinished = Boolean(line.finished_product_id);
    const hasAttributes = Boolean(line.brand && line.style && line.color && line.size);
    return Number(line.quantity || 0) > 0 && (hasBlank || hasFinished || hasAttributes || source === 'blank');
  }

  function receiveLineLabel(line, index) {
    return line.sku_base || line.item_name || buildAttributeName(line) || `Line ${index + 1}`;
  }

  async function receiveSingleLine(index) {
    const line = items[index];
    if (!line) return;
    setError('');
    setReceiveMessage('');

    if (!receiveDefaults.bin_id) {
      setError('Choose a receiving bin before receiving blanks from a manual invoice.');
      return;
    }

    if (!isReceivableLine(line)) {
      setError(`Line ${index + 1} is not ready to receive. Confirm product/attributes and quantity.`);
      return;
    }

    const requestedQuantity = Number(receiveQuantityForLine(line, index) || 0);
    if (requestedQuantity < 0) {
      setError(`Line ${index + 1} cannot have a negative received quantity.`);
      return;
    }

    setReceiveBusy(true);
    try {
      const args = {
        manualOrderId: editingOrderId || null,
        manualOrderItemId: line.manual_order_item_id || null,
        line,
        binId: receiveDefaults.bin_id,
        targetQuantity: requestedQuantity,
        quantity: requestedQuantity,
        unitCost: receiveDefaults.unit_cost,
        notes: receiveDefaults.notes,
        supplier: receiveDefaults.supplier,
        poNumber: receiveDefaults.po_number,
      };

      const result = editingOrderId && line.manual_order_item_id
        ? await setManualInvoiceLineReceivedQuantity(args)
        : await receiveManualInvoiceBlankLine(args);

      const product = result?.product || result?.blank_product || {};
      setItems((current) => current.map((currentLine, lineIndex) => {
        if (lineIndex !== index) return currentLine;
        return {
          ...currentLine,
          blank_product_id: String(result?.blank_product_id || product.blank_product_id || product.id || currentLine.blank_product_id || ''),
          sku_base: product.sku_base || result?.sku_base || currentLine.sku_base,
          item_name: product.name || result?.blank_name || currentLine.item_name,
          brand: product.brand || currentLine.brand,
          style: product.style || currentLine.style,
          color: product.color || currentLine.color,
          size: product.size || currentLine.size,
        };
      }));

      markReceiveLineProcessed(line, index, result, requestedQuantity);

      if (editingOrderId && line.manual_order_item_id) {
        setReceiveMessage(`Set received quantity for ${receiveLineLabel(line, index)} to ${Number(result?.target_quantity ?? requestedQuantity)} item(s). Adjustment: ${Number(result?.delta_quantity || 0)}.`);
        await loadReceiptSummaryForCurrentOrder();
        await loadOrders();
      } else {
        setReceiveMessage(`Received ${Number(result?.quantity || requestedQuantity || 0)} blank item(s) for ${receiveLineLabel(line, index)} into the selected bin.`);
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setReceiveBusy(false);
    }
  }

  async function receiveAllCurrentLines() {
    setError('');
    setReceiveMessage('');

    if (!receiveDefaults.bin_id) {
      setError('Choose a receiving bin before receiving blanks from a manual invoice.');
      return;
    }

    const readyIndexes = items
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => isReceivableLine(line));

    if (!readyIndexes.length) {
      setError('No manual invoice lines are ready to receive. Add blank lines or fill Brand, Style, Color, Size, and Quantity first.');
      return;
    }

    setReceiveBusy(true);
    try {
      let receivedLines = 0;
      let receivedQuantity = 0;
      let adjustmentQuantity = 0;
      const updatedLines = [...items];
      const issues = [];

      for (const { line, index } of readyIndexes) {
        const requestedQuantity = Number(receiveQuantityForLine(line, index) || 0);
        if (requestedQuantity < 0) {
          issues.push(`Line ${index + 1}: received quantity cannot be negative`);
          continue;
        }

        try {
          const args = {
            manualOrderId: editingOrderId || null,
            manualOrderItemId: line.manual_order_item_id || null,
            line,
            binId: receiveDefaults.bin_id,
            targetQuantity: requestedQuantity,
            quantity: requestedQuantity,
            unitCost: receiveDefaults.unit_cost,
            notes: receiveDefaults.notes,
            supplier: receiveDefaults.supplier,
            poNumber: receiveDefaults.po_number,
          };

          const result = editingOrderId && line.manual_order_item_id
            ? await setManualInvoiceLineReceivedQuantity(args)
            : await receiveManualInvoiceBlankLine(args);

          const product = result?.product || result?.blank_product || {};
          updatedLines[index] = {
            ...updatedLines[index],
            blank_product_id: String(result?.blank_product_id || product.blank_product_id || product.id || updatedLines[index].blank_product_id || ''),
            sku_base: product.sku_base || result?.sku_base || updatedLines[index].sku_base,
            item_name: product.name || result?.blank_name || updatedLines[index].item_name,
            brand: product.brand || updatedLines[index].brand,
            style: product.style || updatedLines[index].style,
            color: product.color || updatedLines[index].color,
            size: product.size || updatedLines[index].size,
          };
          markReceiveLineProcessed(line, index, result, requestedQuantity);
          receivedLines += 1;
          receivedQuantity += Number(result?.quantity || requestedQuantity || 0);
          adjustmentQuantity += Number(result?.delta_quantity ?? result?.quantity ?? requestedQuantity ?? 0);
        } catch (lineError) {
          issues.push(`Line ${index + 1}: ${lineError.message || String(lineError)}`);
        }
      }

      setItems(updatedLines);

      if (editingOrderId) {
        await loadReceiptSummaryForCurrentOrder();
        await loadOrders();
        setReceiveMessage(`Applied received quantity targets for manual invoice order #${editingOrderId}. ${receivedLines} line(s) processed. Net inventory adjustment: ${adjustmentQuantity}.${issues.length ? ` Issues: ${issues.slice(0, 3).join('; ')}` : ''}`);
      } else {
        setReceiveMessage(`Received ${receivedQuantity} blank item(s) across ${receivedLines} line(s).${issues.length ? ` Issues: ${issues.slice(0, 3).join('; ')}` : ''}`);
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setReceiveBusy(false);
    }
  }

  async function receiveExisting(row) {
    await editExisting(row);
    setReceiveMessage(`Manual invoice order #${row.id} loaded. Choose a receiving bin, then receive all lines or individual line items.`);
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

  function isVoidedManualOrder(row) {
    const status = String(row?.status || '').toLowerCase();
    return status === 'voided' || status === 'cancelled' || status === 'canceled';
  }

  async function syncExistingPullsheet(row) {
    setError('');
    setMessage('');

    if (!row?.id || !row?.generated_job_id || isVoidedManualOrder(row)) return;

    setSyncingOrderId(row.id);

    try {
      const result = await syncManualInvoiceGeneratedPullsheet(row.id, {
        cancelRemovedLines: true,
        recreateReservations: true,
      });
      const warningCount = Array.isArray(result?.warnings) ? result.warnings.length : 0;
      setMessage(
        `Manual invoice order #${row.id} synced to pull sheet #${result?.generated_job_id || row.generated_job_id}. ` +
        `${Number(result?.updated_items || 0)} updated, ${Number(result?.created_items || 0)} added, ${Number(result?.cancelled_items || 0)} removed/cancelled.` +
        (warningCount ? ` ${warningCount} warning(s) need review.` : '')
      );
      await loadOrders();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSyncingOrderId(null);
    }
  }

  async function voidExisting(row) {
    setError('');
    setMessage('');

    if (!row?.id || isVoidedManualOrder(row)) return;

    setVoidingOrderId(row.id);

    try {
      const preview = await previewVoidManualInvoiceOrder(row.id);

      if (preview?.success === false) {
        throw new Error(preview.message || 'Manual invoice order could not be checked before voiding.');
      }

      if (Number(preview?.received_quantity || 0) !== 0) {
        throw new Error(
          `Manual invoice order #${row.id} has received blank inventory (${Number(preview.received_quantity || 0)} item${Number(preview.received_quantity || 0) === 1 ? '' : 's'}). Reverse the receiving first by setting received quantities back to 0, then void the order.`
        );
      }

      const reason = window.prompt(
        `Void manual invoice order #${row.id}?\n\nThis will cancel its generated job/items and release reservations.\n\nEnter the reason for voiding this manual order:`
      );

      if (reason === null) return;

      const trimmedReason = String(reason || '').trim();
      if (!trimmedReason) {
        throw new Error('A reason is required to void a manual invoice order.');
      }

      const confirmed = window.confirm(
        `Confirm void manual invoice order #${row.id}?\n\nThis cannot be used if blanks have already been received. The order will remain in history with status voided.`
      );

      if (!confirmed) return;

      const result = await voidManualInvoiceOrder({
        manualOrderId: row.id,
        reason: trimmedReason,
        voidedBy: 'inventory_app',
        cancelGeneratedJob: true,
        releaseReservations: true,
      });

      if (editingOrderId === row.id) {
        resetForm();
      }

      setMessage(
        `Manual invoice order #${row.id} voided.${result?.generated_job_id ? ` Job #${result.generated_job_id} was cancelled.` : ''}${Number(result?.reservations_released || 0) ? ` Released reservations: ${result.reservations_released}.` : ''}`
      );
      await loadOrders();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setVoidingOrderId(null);
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

        .manual-size-run-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          align-items: end;
        }
        .manual-size-run-preview {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }
        .manual-size-run-pill {
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 999px;
          padding: 6px 10px;
          background: rgba(14, 165, 233, 0.08);
          font-weight: 800;
        }
        .manual-size-run-pill.warning {
          background: rgba(245, 158, 11, 0.14);
        }
        .manual-size-run-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          margin-top: 12px;
        }
        .manual-receive-line-list {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }
        .manual-receive-line-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          border-radius: 16px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.72);
        }
        .manual-receive-line-card small {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-weight: 700;
        }
        .manual-receive-qty-field {
          min-width: 150px;
          margin: 0;
        }
        .manual-receive-qty-field input {
          max-width: 140px;
        }
        .manual-order-voided-row {
          opacity: 0.68;
          background: rgba(148, 163, 184, 0.10);
        }
        .manual-order-voided-row .sc-status-pill {
          background: #e5e7eb;
          color: #374151;
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
          <span> Saving will update the existing order and, when “Refresh generated job after update” is checked, sync the corrections to the linked pull sheet.</span>
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

        <section className="sc-panel manual-size-run-section">
          <div className="sc-panel-header">
            <div>
              <h2>Quick Size Run Line Builder</h2>
              <p>Choose one blank product family, paste sizes and quantities, and create all matching manual invoice line items at once.</p>
            </div>
          </div>

          {quickMessage && <div className="sc-alert sc-alert-success">{quickMessage}</div>}

          <div className="manual-size-run-grid">
            <label className="sc-field"><span>Default Brand</span>{quickSelect(quickRun.brand_id, (v) => updateQuickRun({ brand_id: v }), quickLookups.brands, 'Choose brand')}</label>
            <label className="sc-field"><span>Default Style</span>{quickSelect(quickRun.product_type_id, (v) => updateQuickRun({ product_type_id: v }), quickLookups.product_types, 'Choose style')}</label>
            <label className="sc-field"><span>Default Color</span>{quickSelect(quickRun.color_id, (v) => updateQuickRun({ color_id: v }), quickLookups.colors, 'Choose color')}</label>
            <label className="sc-field"><span>Price Each</span><input type="number" min="0" step="0.01" value={quickRun.price_per_item} onChange={(e) => updateQuickRun({ price_per_item: e.target.value })} placeholder="0.00" /></label>
            <label className="sc-field"><span>Placement</span><input value={quickRun.placement} onChange={(e) => updateQuickRun({ placement: e.target.value })} placeholder="Left chest, full front, back" /></label>
            <label className="sc-field"><span>Decoration Size</span><input value={quickRun.decoration_size} onChange={(e) => updateQuickRun({ decoration_size: e.target.value })} placeholder="10 inch, 3.5 inch" /></label>
            <label className="sc-field sc-field-wide"><span>Artwork Note</span><input value={quickRun.artwork_note} onChange={(e) => updateQuickRun({ artwork_note: e.target.value })} placeholder="Logo name, artwork code, customer instructions" /></label>
            <label className="sc-field sc-field-wide"><span>Internal Line Notes</span><input value={quickRun.notes} onChange={(e) => updateQuickRun({ notes: e.target.value })} /></label>
          </div>

          <label className="sc-field sc-field-wide" style={{ marginTop: 12 }}>
            <span>Paste Size Run</span>
            <textarea
              value={quickRun.paste}
              onChange={(e) => updateQuickRun({ paste: e.target.value })}
              placeholder={'L 2\nM 2\nS 2\nXL 2\nXS 2'}
            />
          </label>

          <div className="manual-size-run-preview" aria-label="Size run preview">
            {previewQuickSizeRows().map((row, index) => (
              <span key={`${row.original}-${index}`} className={`manual-size-run-pill ${row.unresolved_size ? 'warning' : ''}`}>
                {row.size_name || 'Unknown size'} × {row.quantity || '?'}{row.unresolved_size ? ' · new/review' : ''}
              </span>
            ))}
          </div>

          <div className="manual-size-run-actions">
            <button type="button" className="sc-btn sc-btn-primary" disabled={quickBusy} onClick={() => addQuickSizeRunLines(false)}>
              {quickBusy ? 'Creating...' : 'Add Size Run Lines'}
            </button>
            <button type="button" className="sc-btn" disabled={quickBusy} onClick={() => addQuickSizeRunLines(true)}>
              Replace Current Lines with Size Run
            </button>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800 }}>
              <input type="checkbox" checked={Boolean(quickRun.replace_existing)} onChange={(e) => updateQuickRun({ replace_existing: e.target.checked })} />
              Replace existing lines by default
            </label>
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

        <section className="sc-panel manual-invoice-receive-panel">
          <div className="sc-panel-header">
            <div>
              <h2>Receive Corresponding Blanks</h2>
              <p>Receive or adjust the blank quantities for this manual invoice into a bin. For saved invoices, entering a lower target quantity creates a reversing inventory adjustment.</p>
            </div>
            <button type="button" className="sc-btn sc-btn-primary" disabled={receiveBusy} onClick={receiveAllCurrentLines}>
              {receiveBusy ? 'Applying...' : editingOrderId ? 'Apply All Received Qty Targets' : 'Receive All Entered Qty'}
            </button>
          </div>

          {receiveMessage && <div className="sc-alert sc-alert-success">{receiveMessage}</div>}

          <div className="sc-form-grid sc-form-grid-5">
            <label className="sc-field"><span>Receiving Bin</span>{receiveBinSelect()}</label>
            <label className="sc-field"><span>Supplier</span><input value={receiveDefaults.supplier} onChange={(e) => updateReceiveDefaults({ supplier: e.target.value })} placeholder="Optional" /></label>
            <label className="sc-field"><span>PO / Order #</span><input value={receiveDefaults.po_number} onChange={(e) => updateReceiveDefaults({ po_number: e.target.value })} placeholder="Optional" /></label>
            <label className="sc-field"><span>Unit Cost Override</span><input type="number" min="0" step="0.01" value={receiveDefaults.unit_cost} onChange={(e) => updateReceiveDefaults({ unit_cost: e.target.value })} placeholder="Optional" /></label>
            <label className="sc-field"><span>Receiving Notes</span><input value={receiveDefaults.notes} onChange={(e) => updateReceiveDefaults({ notes: e.target.value })} placeholder="Optional" /></label>
          </div>

          {editingOrderId && receiptSummaryBusy && <div className="sc-alert">Loading received quantities...</div>}

          <div className="manual-receive-controls" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', margin: '12px 0' }}>
            <div className="sc-muted" style={{ fontSize: 13 }}>
              Processed lines turn green when their received quantity matches the target for the selected bin.
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800 }}>
              <input
                type="checkbox"
                checked={hideProcessedReceiveLines}
                onChange={(e) => setHideProcessedReceiveLines(e.target.checked)}
              />
              Hide processed lines
            </label>
          </div>

          <div className="manual-receive-line-list">
            {items.map((line, index) => {
              const ready = isReceivableLine(line);
              const summary = receiptSummaryForLine(line, index);
              const processed = processedReceiveForLine(line, index);
              const targetQty = receiveQuantityForLine(line, index);
              const receivedSoFar = receivedQuantityForLine(line, index);
              const processedLine = isReceiveLineProcessed(line, index);
              if (hideProcessedReceiveLines && processedLine) return null;
              return (
                <div
                  className={`manual-receive-line-card ${processedLine ? 'manual-receive-line-card-processed' : ''}`}
                  key={`receive-${index}-${line.manual_order_item_id || line.sku_base || line.item_name}`}
                  style={processedLine ? { borderColor: '#15803d', background: '#ecfdf3', boxShadow: '0 0 0 1px rgba(21,128,61,0.18)' } : undefined}
                >
                  <div>
                    <strong>Line {index + 1}: {receiveLineLabel(line, index)}</strong>
                    <small>
                      Ordered Qty {Number(line.quantity || 0)} · {[line.brand, line.style, line.color, line.size].filter(Boolean).join(' / ') || 'No attributes'}
                      {line.manual_order_item_id ? ` · saved line #${line.manual_order_item_id}` : ' · unsaved/current line'}
                      {` · Received in selected bin: ${receivedSoFar}`}
                      {processedLine ? ' · RECEIVED/PROCESSED' : ''}
                      {summary?.latest_received_at ? ` · Last receipt: ${new Date(summary.latest_received_at).toLocaleString()}` : ''}
                      {processed?.processed_at && !summary?.latest_received_at ? ` · Processed: ${new Date(processed.processed_at).toLocaleString()}` : ''}
                    </small>
                  </div>
                  <label className="sc-field manual-receive-qty-field">
                    <span>{editingOrderId ? 'Target Received Qty' : 'Receive Qty'}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={targetQty}
                      onChange={(e) => updateReceiveQuantity(line, index, e.target.value)}
                    />
                  </label>
                  <button type="button" className={processedLine ? 'sc-btn sc-btn-small sc-btn-success' : 'sc-btn sc-btn-small'} disabled={receiveBusy || !ready} onClick={() => receiveSingleLine(index)}>
                    {processedLine ? 'Update Received Qty' : (editingOrderId ? 'Set Received Qty' : 'Receive This Qty')}
                  </button>
                </div>
              );
            })}
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
              {orders.map((row) => {
                const rowVoided = isVoidedManualOrder(row);
                return (
                  <tr key={row.id} className={rowVoided ? 'manual-order-voided-row' : ''}>
                    <td>{row.id}</td>
                    <td>{row.invoice_number || `MANUAL-${row.id}`}</td>
                    <td>{row.customer_name}<br /><small>{row.organization}</small></td>
                    <td><span className="sc-status-pill">{row.status}</span></td>
                    <td>{row.total_units}</td>
                    <td>{money(row.calculated_total || row.total_payment_amount)}</td>
                    <td><input type="checkbox" checked={Boolean(row.invoice_sent)} disabled={rowVoided} onChange={() => togglePayment(row, 'invoice_sent')} /></td>
                    <td><input type="checkbox" checked={Boolean(row.payment_received)} disabled={rowVoided} onChange={() => togglePayment(row, 'payment_received')} /></td>
                    <td>{row.generated_job_id ? `#${row.generated_job_id}` : 'Not generated'}</td>
                    <td>
                      <div className="manual-order-row-actions">
                        <button className="sc-btn" type="button" onClick={() => editExisting(row)} disabled={rowVoided}>Edit Order</button>
                        <button className="sc-btn" type="button" onClick={() => receiveExisting(row)} disabled={rowVoided}>Receive Blanks</button>
                        {!row.generated_job_id && !rowVoided && <button className="sc-btn" type="button" onClick={() => generateExisting(row.id)}>Generate Job</button>}
                        {row.generated_job_id && !rowVoided && (
                          <button
                            className="sc-btn"
                            type="button"
                            onClick={() => syncExistingPullsheet(row)}
                            disabled={syncingOrderId === row.id}
                            title="Sync the saved manual invoice lines to the existing pull sheet/job."
                          >
                            {syncingOrderId === row.id ? 'Syncing...' : 'Sync Pull Sheet'}
                          </button>
                        )}
                        {!rowVoided && (
                          <button
                            className="sc-btn sc-btn-danger"
                            type="button"
                            onClick={() => voidExisting(row)}
                            disabled={voidingOrderId === row.id}
                            title="Void this manual invoice order. Orders with received blanks must be reversed first."
                          >
                            {voidingOrderId === row.id ? 'Voiding...' : 'Void Order'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!orders.length && <tr><td colSpan="10">No manual invoice orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
