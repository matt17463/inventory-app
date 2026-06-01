import { useEffect, useRef, useState } from 'react';
import {
  findBlankProductByScannedValue,
  formatBinLabel,
  formatBlankProductLabel,
  getBins,
  receiveBlankInventory,
  reserveInventory,
} from './lib/inventoryApi';

function supportsBarcodeDetector() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
}

export default function ScanInventory() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const [bins, setBins] = useState([]);
  const [manualValue, setManualValue] = useState('');
  const [foundProduct, setFoundProduct] = useState(null);
  const [binId, setBinId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState('receive');
  const [orderRef, setOrderRef] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [message, setMessage] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    getBins().then(setBins).catch((err) => setMessage(err.message || 'Failed to load bins.'));
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

  async function lookup(value) {
    setMessage('');
    const product = await findBlankProductByScannedValue(value);
    if (!product) {
      setFoundProduct(null);
      setMessage('No matching product found. Try SKU base, barcode, color, or size.');
      return;
    }
    setFoundProduct(product);
    setMessage(`Found: ${formatBlankProductLabel(product)}`);
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

  async function handleAction(event) {
    event.preventDefault();
    setMessage('');

    if (!foundProduct) {
      setMessage('Lookup a product first.');
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
