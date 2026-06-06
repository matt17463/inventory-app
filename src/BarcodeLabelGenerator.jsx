import { useMemo, useState } from 'react';
import { getBlankProducts, getBins, formatBlankProductLabel, formatBinLabel } from './lib/inventoryApi';

function barcodeUrl(value) {
  return `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(value)}&scale=2&height=12&includetext`;
}

function qrUrl(value) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(value)}`;
}

export default function BarcodeLabelGenerator() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [bins, setBins] = useState([]);
  const [selected, setSelected] = useState({});
  const [binSelected, setBinSelected] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [includeBins, setIncludeBins] = useState(false);

  const selectedProducts = useMemo(() => rows.filter((row) => selected[row.id]), [rows, selected]);
  const selectedBins = useMemo(() => bins.filter((bin) => binSelected[bin.id]), [bins, binSelected]);

  async function searchProducts(event) {
    event?.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const [productRows, binRows] = await Promise.all([getBlankProducts(search), getBins()]);
      setRows(productRows);
      setBins(binRows);
      setMessage(`Found ${productRows.length} blank product(s).`);
    } catch (err) {
      setMessage(err.message || 'Failed to search products.');
    } finally {
      setLoading(false);
    }
  }

  function toggleAllProducts() {
    if (selectedProducts.length === rows.length) {
      setSelected({});
    } else {
      setSelected(Object.fromEntries(rows.map((row) => [row.id, true])));
    }
  }

  function printLabels() {
    window.print();
  }

  return (
    <main className="page label-page">
      <section className="page-header no-print">
        <div>
          <p className="eyebrow">Phase 3 · Labels</p>
          <h1>Barcode & Bin Label Generator</h1>
          <p>Print Code 128 labels for internal blank SKUs and QR labels for bins.</p>
        </div>
      </section>

      {message && <p className="message no-print">{message}</p>}

      <section className="card elevated-card no-print">
        <form onSubmit={searchProducts} className="inline-form-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SKU, style, color, size, brand..." />
          <button type="submit" disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
          <button type="button" onClick={toggleAllProducts}>Select Visible</button>
          <button type="button" onClick={printLabels}>Print Labels</button>
        </form>
        <label className="checkbox-line"><input type="checkbox" checked={includeBins} onChange={(event) => setIncludeBins(event.target.checked)} /> Show bin label selector</label>
      </section>

      <section className="content-two-column no-print">
        <section className="card">
          <h2>Blank Products</h2>
          <div className="responsive-table">
            <table className="data-table">
              <thead><tr><th></th><th>SKU</th><th>Product</th><th>Barcode/UPC</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><input type="checkbox" checked={!!selected[row.id]} onChange={(event) => setSelected((current) => ({ ...current, [row.id]: event.target.checked }))} /></td>
                    <td>{row.sku_base}</td>
                    <td>{formatBlankProductLabel(row)}</td>
                    <td>{row.barcode || row.upc || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {includeBins && (
          <section className="card">
            <h2>Bins</h2>
            <div className="responsive-table">
              <table className="data-table">
                <thead><tr><th></th><th>Bin</th><th>Location</th></tr></thead>
                <tbody>
                  {bins.map((bin) => (
                    <tr key={bin.id}>
                      <td><input type="checkbox" checked={!!binSelected[bin.id]} onChange={(event) => setBinSelected((current) => ({ ...current, [bin.id]: event.target.checked }))} /></td>
                      <td>{formatBinLabel(bin)}</td>
                      <td>{bin.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>

      <section className="print-label-sheet">
        {selectedProducts.map((row) => {
          const code = row.sku_base || row.barcode || row.id;
          return (
            <div className="print-label" key={row.id}>
              <strong>{row.sku_base}</strong>
              <span>{[row.brands?.name || row.brand, row.product_types?.name || row.product_type, row.colors?.name || row.color, row.sizes?.name || row.size].filter(Boolean).join(' • ')}</span>
              <img src={barcodeUrl(code)} alt={code} />
              {row.barcode && <small>UPC/Vendor: {row.barcode}</small>}
            </div>
          );
        })}

        {includeBins && selectedBins.map((bin) => {
          const url = `${window.location.origin}/bin/${bin.id}`;
          return (
            <div className="print-label bin-print-label" key={`bin-${bin.id}`}>
              <strong>{formatBinLabel(bin) || `Bin ${bin.id}`}</strong>
              <img src={qrUrl(url)} alt={url} />
              <small>{url}</small>
            </div>
          );
        })}
      </section>
    </main>
  );
}
