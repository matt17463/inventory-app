import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { importSupplierCatalogRows } from './lib/inventoryApi';

const TEMPLATE_HEADERS = [
  'Brand', 'Style', 'Color', 'Size', 'Supplier SKU', 'UPC', 'Unit Cost', 'Case Pack Qty', 'Description', 'Notes'
];

function clean(value) {
  return String(value ?? '').trim();
}

function normalize(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function columnValue(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
    const found = Object.keys(row).find((key) => normalize(key) === normalize(name));
    if (found) return row[found];
  }
  return '';
}

function numberValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/[$,]/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseWorkbook(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  return rows.map((row, index) => ({
    source_row: index + 2,
    brand: clean(columnValue(row, ['Brand', 'Manufacturer'])),
    style: clean(columnValue(row, ['Style', 'Style Number', 'Product Style', 'Item Style'])),
    color: clean(columnValue(row, ['Color', 'Colour'])),
    size: clean(columnValue(row, ['Size'])),
    supplier_sku: clean(columnValue(row, ['Supplier SKU', 'Vendor SKU', 'Vendor Item', 'Item Number', 'SKU'])),
    upc: clean(columnValue(row, ['UPC', 'Barcode', 'GTIN'])),
    unit_cost: numberValue(columnValue(row, ['Unit Cost', 'Cost', 'Price', 'Net Price'])),
    case_pack_qty: numberValue(columnValue(row, ['Case Pack Qty', 'Case Pack', 'Pack Qty', 'Pack Quantity'])),
    description: clean(columnValue(row, ['Description', 'Product Name', 'Name'])),
    notes: clean(columnValue(row, ['Notes', 'Note'])),
  })).filter((row) => row.brand || row.style || row.color || row.size || row.supplier_sku || row.upc || row.unit_cost !== null);
}

function downloadTemplate() {
  const rows = [
    {
      Brand: 'Gildan',
      Style: '18500',
      Color: 'Navy',
      Size: 'AXL',
      'Supplier SKU': 'G18500-NAVY-AXL',
      UPC: '000000000001',
      'Unit Cost': 12.5,
      'Case Pack Qty': 12,
      Description: 'Gildan 18500 Navy Adult XL',
      Notes: 'Supplier catalog row',
    },
  ];

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows, { header: TEMPLATE_HEADERS });
  XLSX.utils.book_append_sheet(workbook, sheet, 'Supplier Catalog');
  XLSX.writeFile(workbook, 'supplier-catalog-import-template.xlsx');
}

export default function SupplierCatalogImport() {
  const [supplierName, setSupplierName] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [updateBlankProducts, setUpdateBlankProducts] = useState(true);
  const [createMissingLookups, setCreateMissingLookups] = useState(true);

  const stats = useMemo(() => {
    const withCost = rows.filter((row) => row.unit_cost !== null).length;
    const withUpc = rows.filter((row) => row.upc).length;
    const withSupplierSku = rows.filter((row) => row.supplier_sku).length;
    return { total: rows.length, withCost, withUpc, withSupplierSku };
  }, [rows]);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage('Reading supplier catalog...');
    setResult(null);
    setSourceFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const parsed = parseWorkbook(workbook);
      if (!parsed.length) throw new Error('No catalog rows were found.');
      setRows(parsed);
      setMessage(`Loaded ${parsed.length} catalog row(s). Review, then import.`);
    } catch (err) {
      setRows([]);
      setMessage(err.message || 'Failed to read supplier catalog.');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!supplierName.trim()) {
      setMessage('Enter supplier name first.');
      return;
    }
    if (!rows.length) {
      setMessage('Upload a catalog file first.');
      return;
    }

    setLoading(true);
    setMessage('Importing supplier catalog...');
    setResult(null);

    try {
      const data = await importSupplierCatalogRows({
        supplierName,
        sourceFileName,
        rows,
        updateBlankProducts,
        createMissingLookups,
      });
      setResult(data);
      setMessage(`Catalog import complete. ${data?.catalog_rows_inserted ?? 0} catalog row(s) saved. ${data?.blank_products_updated ?? 0} blank item(s) updated.`);
    } catch (err) {
      setMessage(err.message || 'Supplier catalog import failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page phase3-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Phase 3 · Supplier Catalog</p>
          <h1>Supplier Catalog Import</h1>
          <p>Upload supplier pricing, UPC, vendor SKU, and case-pack data. Matched blank products can be updated automatically.</p>
        </div>
        <button type="button" className="secondary-button" onClick={downloadTemplate}>Download Template</button>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="card elevated-card">
        <h2>Import Settings</h2>
        <div className="form-grid">
          <label>
            Supplier Name
            <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Example: S&S Activewear" />
          </label>
          <label>
            Supplier Catalog File
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
          </label>
        </div>
        <label className="checkbox-line"><input type="checkbox" checked={updateBlankProducts} onChange={(event) => setUpdateBlankProducts(event.target.checked)} /> Update matched blank products with cost, UPC/barcode, supplier, and supplier SKU</label>
        <label className="checkbox-line"><input type="checkbox" checked={createMissingLookups} onChange={(event) => setCreateMissingLookups(event.target.checked)} /> Create missing brand/style/color/size lookup values</label>
      </section>

      {rows.length > 0 && (
        <>
          <section className="kpi-grid">
            <div className="kpi-card"><span>{stats.total}</span><strong>Rows</strong><small>Parsed catalog rows</small></div>
            <div className="kpi-card"><span>{stats.withCost}</span><strong>Costs</strong><small>Rows with unit cost</small></div>
            <div className="kpi-card"><span>{stats.withUpc}</span><strong>UPCs</strong><small>Rows with barcode/UPC</small></div>
            <div className="kpi-card"><span>{stats.withSupplierSku}</span><strong>Vendor SKUs</strong><small>Rows with supplier SKU</small></div>
          </section>

          <section className="card elevated-card table-card">
            <div className="import-preview-heading">
              <div><h2>Catalog Preview</h2><p className="helper-text">Showing first 250 rows.</p></div>
              <button type="button" onClick={handleImport} disabled={loading}>{loading ? 'Working...' : 'Import Catalog'}</button>
            </div>
            <div className="responsive-table">
              <table className="data-table import-table">
                <thead><tr><th>Row</th><th>Brand</th><th>Style</th><th>Color</th><th>Size</th><th>Vendor SKU</th><th>UPC</th><th>Cost</th><th>Pack</th></tr></thead>
                <tbody>
                  {rows.slice(0, 250).map((row) => (
                    <tr key={row.source_row}>
                      <td>{row.source_row}</td><td>{row.brand}</td><td>{row.style}</td><td>{row.color}</td><td>{row.size}</td><td>{row.supplier_sku}</td><td>{row.upc}</td><td>{row.unit_cost ?? ''}</td><td>{row.case_pack_qty ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {result && (
        <section className="card elevated-card">
          <h2>Import Result</h2>
          <pre className="code-block">{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
