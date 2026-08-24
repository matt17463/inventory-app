import { useEffect, useRef, useState } from 'react';
import {
  createBlankProduct,
  findBlankProductsByScannedValue,
  formatBinLabel,
  formatBlankProductLabel,
  getBins,
  getBlankProductLookups,
  receiveBlankInventory,
  reserveInventory,
} from './lib/inventoryApi';
import { previewBlankProduct } from './lib/applicationIntegrityApi';

function supportsBarcodeDetector() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
}

function normalizeSkuPart(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function ScanInventory() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const [bins, setBins] = useState([]);
  const [brands, setBrands] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [manualValue, setManualValue] = useState('');
  const [foundProduct, setFoundProduct] = useState(null);
  const [matchingProducts, setMatchingProducts] = useState([]);
  const [binId, setBinId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState('receive');
  const [orderRef, setOrderRef] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [message, setMessage] = useState('');
  const [scanning, setScanning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newItem, setNewItem] = useState({
    sku_base: '',
    barcode: '',
    name: '',
    brand_id: '',
    product_type_id: '',
    color_id: '',
    size_id: '',
    image_url: '',
    unit_cost: '',
    low_stock_threshold: '',
  });

  useEffect(() => {
    Promise.all([getBins(), getBlankProductLookups()])
      .then(([binRows, lookups]) => {
        setBins(binRows);
        setBrands(lookups.brands || []);
        setColors(lookups.colors || []);
        setSizes(lookups.sizes || []);
        setProductTypes(lookups.productTypes || []);
      })
      .catch((err) => setMessage(err.message || 'Failed to load setup data.'));
    return () => stopCamera();
  }, []);

  function stopCamera() {
    setScanning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function chooseProduct(product) {
    setFoundProduct(product);
    setMessage(`Selected: ${formatBlankProductLabel(product)}`);
  }

  async function lookup(value) {
    setMessage('');
    setFoundProduct(null);
    setMatchingProducts([]);

    const products = await findBlankProductsByScannedValue(value);

    if (!products.length) {
      setMessage('No matching product found. You can create the blank item below.');
      setShowCreate(true);
      setNewItem((current) => ({
        ...current,
        sku_base: current.sku_base || normalizeSkuPart(value),
        barcode: current.barcode || String(value || '').trim(),
      }));
      return;
    }

    setMatchingProducts(products);

    if (products.length === 1) {
      chooseProduct(products[0]);
      return;
    }

    setMessage(`Found ${products.length} matching blank items. Choose the exact color/size/item below, or create a new blank item if it is missing.`);
  }

  async function startCamera() {
    setMessage('');
    if (!supportsBarcodeDetector()) {
      setMessage('BarcodeDetector is not supported here. Use Chrome/Edge on Android or enter the SKU manually.');
      return;
    }

    const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'upc_a'] });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    streamRef.current = stream;
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    setScanning(true);

    timerRef.current = setInterval(async () => {
      if (!videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0) {
          const value = codes[0].rawValue;
          setManualValue(value);
          stopCamera();
          await lookup(value);
        }
      } catch {
        // keep scanning
      }
    }, 700);
  }

  async function handleManualLookup(event) {
    event.preventDefault();
    await lookup(manualValue);
  }

  function updateNewItem(field, value) {
    setNewItem((current) => ({ ...current, [field]: value }));
  }

  function buildSkuBaseFromNewItem() {
    const brand = brands.find((item) => String(item.id) === String(newItem.brand_id));
    const type = productTypes.find((item) => String(item.id) === String(newItem.product_type_id));
    const color = colors.find((item) => String(item.id) === String(newItem.color_id));
    const size = sizes.find((item) => String(item.id) === String(newItem.size_id));

    const sku = [
      brand?.code || brand?.name,
      type?.code || type?.name,
      color?.code || color?.name,
      size?.code || size?.name,
    ]
      .map(normalizeSkuPart)
      .filter(Boolean)
      .join('-');

    if (!sku) {
      setMessage('Choose brand, product type, color, and size first.');
      return;
    }

    updateNewItem('sku_base', sku);
  }

  function buildNameFromNewItem() {
    const brand = brands.find((item) => String(item.id) === String(newItem.brand_id));
    const type = productTypes.find((item) => String(item.id) === String(newItem.product_type_id));
    const color = colors.find((item) => String(item.id) === String(newItem.color_id));
    const size = sizes.find((item) => String(item.id) === String(newItem.size_id));

    const name = [brand?.name, type?.name, color?.name, size?.name].filter(Boolean).join(' ');

    if (!name) {
      setMessage('Choose brand, product type, color, and size first.');
      return;
    }

    updateNewItem('name', name);
  }

  async function handleCreateBlankItem(event) {
    event.preventDefault();
    setMessage('');
    setCreating(true);

    try {
      const brand = brands.find((item) => String(item.id) === String(newItem.brand_id));
      const type = productTypes.find((item) => String(item.id) === String(newItem.product_type_id));
      const color = colors.find((item) => String(item.id) === String(newItem.color_id));
      const size = sizes.find((item) => String(item.id) === String(newItem.size_id));
      const preview = await previewBlankProduct({
        ...newItem,
        brand: brand?.name || brand?.code || '', style: type?.name || type?.code || '',
        color: color?.name || color?.code || '', size: size?.name || size?.code || '',
      });
      if (preview.decision === 'ambiguous') {
        throw new Error(`Creation blocked: ${preview.exact_candidate_count} exact existing records conflict with this item. Open Operations Integrity > Duplicate Workbench.`);
      }
      if (preview.decision === 'use_existing') {
        const candidate = preview.candidates?.[0];
        const matches = await findBlankProductsByScannedValue(candidate?.sku_base || newItem.sku_base);
        const product = matches.find((row) => String(row.id) === String(candidate?.blank_product_id_text)) || matches[0];
        if (!product) throw new Error('An existing match was found but could not be loaded. Open Operations Integrity > Product Identity.');
        setFoundProduct(product);
        setMatchingProducts([product]);
        setManualValue(product.sku_base || manualValue);
        setShowCreate(false);
        setMessage(`Used existing product instead of creating a duplicate: ${formatBlankProductLabel(product)}`);
        return;
      }
      const product = await createBlankProduct(newItem);
      setFoundProduct(product);
      setMatchingProducts([product]);
      setManualValue(product.sku_base || manualValue);
      setShowCreate(false);
      setMessage(`Created and selected: ${formatBlankProductLabel(product)}`);
      setNewItem({
        sku_base: '',
        barcode: '',
        name: '',
        brand_id: '',
        product_type_id: '',
        color_id: '',
        size_id: '',
        image_url: '',
        unit_cost: '',
        low_stock_threshold: '',
      });
    } catch (err) {
      setMessage(err.message || 'Failed to create blank item.');
    } finally {
      setCreating(false);
    }
  }

  async function handleAction(event) {
    event.preventDefault();
    setMessage('');

    if (!foundProduct) {
      setMessage('Choose or create a product first.');
      return;
    }

    try {
      if (mode === 'receive') {
        if (!binId) throw new Error('Choose a bin.');
        await receiveBlankInventory({ binId, blankProductId: foundProduct.id, quantity, notes: 'Barcode/QR scan receive' });
        setMessage('Inventory received into bin.');
      } else {
        await reserveInventory({
          blankProductId: foundProduct.id,
          binId: binId || null,
          quantity,
          orderRef,
          customerName,
          notes: 'Reservation created from scan page',
        });
        setMessage('Inventory reserved. This does not block online ordering.');
      }
      setQuantity(1);
    } catch (err) {
      setMessage(err.message || 'Action failed.');
    }
  }

  return (
    <main className="page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Fast Transactions</p>
          <h1>Barcode / QR Inventory Scan</h1>
          <p className="helper-text">Scan a product label or type a SKU, then receive or reserve inventory.</p>
        </div>
      </div>

      <section className="card scanner-card">
        <div>
          <h2>Scan or Type SKU</h2>
          <form onSubmit={handleManualLookup} className="inline-form">
            <input value={manualValue} onChange={(e) => setManualValue(e.target.value)} placeholder="SKU, barcode, or product search" />
            <button type="submit">Lookup</button>
            <button type="button" className="button-outline" onClick={scanning ? stopCamera : startCamera}>{scanning ? 'Stop Camera' : 'Start Camera Scan'}</button>
            <button type="button" className="button-outline" onClick={() => setShowCreate((current) => !current)}>
              {showCreate ? 'Hide Create Form' : '+ Create New Blank Item'}
            </button>
          </form>
          <video ref={videoRef} className={`scan-video ${scanning ? 'active' : ''}`} playsInline muted />
        </div>

        {foundProduct && (
          <div className="nfc-preview">
            <strong>{formatBlankProductLabel(foundProduct)}</strong>
            <span>{foundProduct.name}</span>
          </div>
        )}
      </section>

      {matchingProducts.length > 1 && (
        <section className="card">
          <h2>Choose Matching Blank Item</h2>
          <p className="helper-text">Your search matched multiple blank items. Select the exact item before receiving or reserving inventory.</p>
          <div className="result-list">
            {matchingProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                className={`result-row ${foundProduct?.id === product.id ? 'selected' : ''}`}
                onClick={() => chooseProduct(product)}
              >
                <strong>{formatBlankProductLabel(product)}</strong>
                <span>{product.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {showCreate && (
        <form onSubmit={handleCreateBlankItem} className="card">
          <h2>Create New Blank Inventory Item</h2>
          <p className="helper-text">Use this when a blank garment exists physically but is missing from the blank product list.</p>

          <label>Brand</label>
          <select value={newItem.brand_id} onChange={(e) => updateNewItem('brand_id', e.target.value)}>
            <option value="">Choose brand...</option>
            {brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <label>Product Type / Style</label>
          <select value={newItem.product_type_id} onChange={(e) => updateNewItem('product_type_id', e.target.value)}>
            <option value="">Choose product type...</option>
            {productTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <label>Color</label>
          <select value={newItem.color_id} onChange={(e) => updateNewItem('color_id', e.target.value)}>
            <option value="">Choose color...</option>
            {colors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <label>Size</label>
          <select value={newItem.size_id} onChange={(e) => updateNewItem('size_id', e.target.value)}>
            <option value="">Choose size...</option>
            {sizes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <label>Blank SKU Base</label>
          <div className="inline-form">
            <input value={newItem.sku_base} onChange={(e) => updateNewItem('sku_base', e.target.value)} placeholder="Example: GIL-18500-NAVY-YXS" required />
            <button type="button" className="button-outline" onClick={buildSkuBaseFromNewItem}>Generate SKU</button>
          </div>

          <label>Blank Item Name</label>
          <div className="inline-form">
            <input value={newItem.name} onChange={(e) => updateNewItem('name', e.target.value)} placeholder="Example: Gildan 18500 Navy YXS" required />
            <button type="button" className="button-outline" onClick={buildNameFromNewItem}>Generate Name</button>
          </div>

          <label>Barcode / UPC</label>
          <input value={newItem.barcode} onChange={(e) => updateNewItem('barcode', e.target.value)} placeholder="Optional barcode or supplier SKU" />

          <label>Unit Cost</label>
          <input type="number" step="0.01" min="0" value={newItem.unit_cost} onChange={(e) => updateNewItem('unit_cost', e.target.value)} placeholder="Optional" />

          <label>Low Stock Threshold</label>
          <input type="number" min="0" value={newItem.low_stock_threshold} onChange={(e) => updateNewItem('low_stock_threshold', e.target.value)} placeholder="Optional" />

          <label>Image URL</label>
          <input value={newItem.image_url} onChange={(e) => updateNewItem('image_url', e.target.value)} placeholder="Optional image URL" />

          <button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create and Select Blank Item'}</button>
        </form>
      )}

      <form onSubmit={handleAction} className="card">
        <h2>Inventory Action</h2>
        <label>Action</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="receive">Receive into bin</option>
          <option value="reserve">Reserve for order/job</option>
        </select>

        <label>Bin {mode === 'reserve' ? '(optional)' : ''}</label>
        <select value={binId} onChange={(e) => setBinId(e.target.value)} required={mode === 'receive'}>
          <option value="">Choose bin...</option>
          {bins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin) || `Bin ${bin.id}`}</option>)}
        </select>

        <label>Quantity</label>
        <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />

        {mode === 'reserve' && (
          <>
            <label>Order / Job Reference</label>
            <input value={orderRef} onChange={(e) => setOrderRef(e.target.value)} placeholder="Example: Woo #12345 or Job name" />
            <label>Customer</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Optional customer name" />
          </>
        )}

        <button type="submit">{mode === 'receive' ? 'Receive Inventory' : 'Reserve Inventory'}</button>
      </form>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
