import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { appendBlankProductsFromSpreadsheet } from './lib/inventoryApi';

const MASTER_SHEET_NAMES = [
  'Blank Products',
  'Blank Product Master',
  'Blank Inventory',
  'Inventory Master',
  'Sheet1',
];

const MASTER_COLUMNS = [
  'Brand',
  'Style',
  'Color',
  'Size',
  'Quantity',
  'Bin',
  'Unit Cost',
  'Low Stock Threshold',
  'SKU Base (optional)',
  'Barcode (optional)',
  'Product Name (optional)',
  'Image URL (optional)',
  'Supplier (optional)',
  'Supplier SKU (optional)',
  'Notes',
];

function clean(value) {
  return String(value ?? '').trim();
}

function normalize(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function numberValue(value, fallback = 0) {
  if (value === '' || value == null) return fallback;
  if (typeof value === 'number') return value;
  const parsed = Number(clean(value).replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function integerValue(value, fallback = null) {
  if (value === '' || value == null) return fallback;
  const parsed = Number(clean(value).replace(/[,]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
}

function findSheetName(workbook, names) {
  const normalizedNames = names.map(normalize);
  return workbook.SheetNames.find((sheetName) => normalizedNames.includes(normalize(sheetName))) || workbook.SheetNames[0];
}

function columnValue(row, possibleNames) {
  for (const name of possibleNames) {
    if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
    const found = Object.keys(row).find((key) => normalize(key) === normalize(name));
    if (found) return row[found];
  }
  return '';
}

function buildSkuBase(row) {
  const parts = [row.brand, row.style, row.color, row.size]
    .map((part) => clean(part).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean);
  return parts.join('-');
}

function parseMasterSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  return rows
    .map((row, index) => {
      const parsed = {
        sourceRowNumber: index + 2,
        brand: clean(columnValue(row, ['Brand', 'Product Brand', 'Vendor Brand'])),
        style: clean(columnValue(row, ['Style', 'Product Style', 'Product Type', 'Style Number', 'Style #'])),
        color: clean(columnValue(row, ['Color', 'Colour', 'Product Color'])),
        size: clean(columnValue(row, ['Size', 'Product Size'])),
        quantity: integerValue(columnValue(row, [
          'Quantity',
          'Qty',
          'Count',
          'On Hand',
          'On Hand Qty',
          'Quantity On Hand',
          'Received Qty',
          'Qty Received',
        ]), 0),
        bin: clean(columnValue(row, ['Bin', 'Bin Code', 'Bin Location', 'Location'])),
        unitCost: numberValue(columnValue(row, ['Unit Cost', 'Cost', 'Blank Cost', 'Wholesale Cost']), 0),
        lowStockThreshold: integerValue(columnValue(row, [
          'Low Stock Threshold',
          'Low Stock Threshhold',
          'Low Stock',
          'Threshold',
          'Reorder Point',
          'Minimum Stock',
          'Min Stock',
        ]), null),
        skuBase: clean(columnValue(row, [
          'SKU Base (optional)',
          'SKU Base',
          'Blank SKU',
          'Blank SKU Base',
          'SKU',
        ])),
        barcode: clean(columnValue(row, ['Barcode (optional)', 'Barcode', 'UPC'])),
        name: clean(columnValue(row, ['Product Name (optional)', 'Product Name', 'Name', 'Description'])),
        imageUrl: clean(columnValue(row, ['Image URL (optional)', 'Image URL', 'Image', 'Image Url'])),
        supplier: clean(columnValue(row, ['Supplier (optional)', 'Supplier', 'Vendor'])),
        supplierSku: clean(columnValue(row, ['Supplier SKU (optional)', 'Supplier SKU', 'Vendor SKU', 'Supplier Style'])),
        notes: clean(columnValue(row, ['Notes', 'Note', 'Receiving Notes'])),
      };

      if (!parsed.skuBase) parsed.skuBase = buildSkuBase(parsed);
      if (!parsed.name) parsed.name = [parsed.brand, parsed.style, parsed.color, parsed.size].filter(Boolean).join(' ');

      return parsed;
    })
    .filter((row) => row.brand || row.style || row.color || row.size || row.skuBase || row.quantity || row.bin);
}

function validateRows(rows) {
  return rows.map((row) => {
    const errors = [];
    const warnings = [];

    if (!row.brand) errors.push('Brand is required.');
    if (!row.style) errors.push('Style is required.');
    if (!row.color) errors.push('Color is required.');
    if (!row.size) errors.push('Size is required.');
    if (!row.skuBase) errors.push('SKU Base could not be generated.');
    if (!Number.isFinite(row.quantity) || row.quantity < 0) errors.push('Quantity must be zero or greater.');
    if (row.quantity > 0 && !row.bin) errors.push('Bin is required when Quantity is greater than zero.');
    if (!Number.isFinite(row.unitCost) || row.unitCost < 0) errors.push('Unit Cost must be zero or greater.');
    if (row.lowStockThreshold !== null && (!Number.isFinite(row.lowStockThreshold) || row.lowStockThreshold < 0)) {
      errors.push('Low Stock Threshold must be blank or zero or greater.');
    }
    if (Number(row.quantity || 0) === 0) {
      warnings.push('Quantity is zero. This will update/create the blank product catalog record but will not add inventory units.');
    }

    return {
      ...row,
      status: errors.length ? 'error' : 'ready',
      errors,
      warnings,
    };
  });
}

function downloadBrowserTemplate() {
  const rows = [
    {
      Brand: 'Gildan',
      Style: '18500',
      Color: 'Navy',
      Size: 'AXL',
      Quantity: 24,
      Bin: 'AXL1',
      'Unit Cost': 8.25,
      'Low Stock Threshold': 12,
      'SKU Base (optional)': '',
      'Barcode (optional)': '',
      'Product Name (optional)': '',
      'Image URL (optional)': '',
      'Supplier (optional)': 'S&S Activewear',
      'Supplier SKU (optional)': '',
      Notes: 'Receiving row. Quantity will be added to inventory.',
    },
    {
      Brand: 'Gildan',
      Style: '18500',
      Color: 'Navy',
      Size: 'AL',
      Quantity: 12,
      Bin: 'AL1',
      'Unit Cost': 8.25,
      'Low Stock Threshold': 12,
      'SKU Base (optional)': '',
      'Barcode (optional)': '',
      'Product Name (optional)': '',
      'Image URL (optional)': '',
      'Supplier (optional)': 'S&S Activewear',
      'Supplier SKU (optional)': '',
      Notes: 'Existing products are updated and quantity is received into the selected bin.',
    },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows, { header: MASTER_COLUMNS }), 'Blank Products');
  XLSX.writeFile(wb, 'skilled-crafting-blank-inventory-import-template.xlsx');
}

function resultNumber(result, key) {
  const value = result?.[key];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export default function InventoryImport() {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [confirmImport, setConfirmImport] = useState(false);

  const counts = useMemo(() => {
    const readyRows = rows.filter((row) => row.status === 'ready');
    const errorRows = rows.filter((row) => row.status !== 'ready');
    const totalUnits = readyRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const withBins = readyRows.filter((row) => Number(row.quantity || 0) > 0 && row.bin).length;

    return {
      total: rows.length,
      ready: readyRows.length,
      errors: errorRows.length,
      totalUnits,
      withBins,
    };
  }, [rows]);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setRows([]);
    setResult(null);
    setConfirmImport(false);
    setFileName(file.name);
    setMessage('Reading blank inventory import workbook...');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = findSheetName(workbook, MASTER_SHEET_NAMES);
      if (!sheetName) throw new Error('Workbook does not contain a readable sheet.');

      const parsed = parseMasterSheet(workbook, sheetName);
      if (!parsed.length) throw new Error('No blank inventory rows were found.');

      const validated = validateRows(parsed);
      setRows(validated);
      setMessage(
        `Loaded ${validated.length} row(s) from ${file.name}. Existing blank products will be updated; quantities greater than zero will be received into the selected bin.`
      );
    } catch (err) {
      setMessage(err.message || 'Failed to read workbook.');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    const readyRows = rows.filter((row) => row.status === 'ready');
    if (!readyRows.length) {
      setMessage('No ready rows to import.');
      return;
    }
    if (!confirmImport) {
      setMessage('Check the confirmation box before importing inventory.');
      return;
    }

    setImporting(true);
    setResult(null);
    setMessage('Importing blank products and receiving inventory quantities. Do not close this page...');

    try {
      const response = await appendBlankProductsFromSpreadsheet({ rows: readyRows, sourceFileName: fileName });
      setResult(response);
      setMessage(
        `Inventory import complete. Created ${resultNumber(response, 'inserted_blank_products')} blank product(s), ` +
        `updated ${resultNumber(response, 'updated_blank_products')} existing blank product(s), and received ` +
        `${resultNumber(response, 'total_quantity_received')} unit(s) through ${resultNumber(response, 'inserted_inventory_movements')} inventory movement(s).`
      );
    } catch (err) {
      setMessage(err.message || 'Blank inventory import failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="page import-page">
      <section className="page-header import-header">
        <div>
          <p className="eyebrow">Blank Inventory Import</p>
          <h1>Import or update blank products and quantities</h1>
          <p>
            Upload a spreadsheet to create missing blank products, update existing blank product details, and add inventory quantities into bins.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={downloadBrowserTemplate}>
          Download Template
        </button>
      </section>

      <section className="warning-card">
        <h2>How quantity works</h2>
        <p>
          Quantity is treated as a <strong>received/additional quantity</strong>. If a spreadsheet row already exists as a blank product,
          the import updates its catalog details and adds the quantity to the selected bin through an inventory movement. It does not erase
          previous inventory history.
        </p>
      </section>

      <section className="card elevated-card import-upload-card">
        <h2>Required spreadsheet columns</h2>
        <p className="helper-text">
          Required: Brand • Style • Color • Size. Quantity is required if you want to add inventory units. Bin is required when Quantity is greater than zero.
        </p>
        <p className="helper-text">
          Optional: Unit Cost, Low Stock Threshold, SKU Base, Barcode, Product Name, Image URL, Supplier, Supplier SKU, Notes.
        </p>

        <label>
          Upload blank inventory workbook
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} disabled={loading || importing} />
        </label>

        {message && <p className="message">{message}</p>}
      </section>

      {rows.length > 0 && (
        <>
          <section className="summary-grid">
            <div className="metric-card"><strong>{counts.total}</strong><span>Total rows</span></div>
            <div className="metric-card"><strong>{counts.ready}</strong><span>Ready rows</span></div>
            <div className="metric-card"><strong>{counts.errors}</strong><span>Needs review</span></div>
            <div className="metric-card"><strong>{counts.totalUnits}</strong><span>Units to receive</span></div>
            <div className="metric-card"><strong>{counts.withBins}</strong><span>Rows with bin quantities</span></div>
          </section>

          <section className="card elevated-card">
            <div className="import-actions">
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={confirmImport}
                  onChange={(event) => setConfirmImport(event.target.checked)}
                  disabled={importing}
                />
                I understand this import will create/update blank products and add received quantities to inventory movements.
              </label>

              <button
                type="button"
                className="primary-button"
                disabled={importing || loading || counts.ready === 0 || counts.errors > 0 || !confirmImport}
                onClick={handleImport}
              >
                {importing ? 'Importing Inventory...' : `Import / Update Inventory (${counts.ready} rows)`}
              </button>
            </div>
          </section>

          <section className="card elevated-card import-preview">
            <h2>Preview</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Row</th>
                    <th>SKU Base</th>
                    <th>Brand</th>
                    <th>Style</th>
                    <th>Color</th>
                    <th>Size</th>
                    <th>Qty to Receive</th>
                    <th>Bin</th>
                    <th>Unit Cost</th>
                    <th>Low Stock</th>
                    <th>Issues / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 500).map((row) => (
                    <tr key={`${row.sourceRowNumber}-${row.skuBase}-${row.bin}`} className={row.status === 'ready' ? '' : 'error-row'}>
                      <td>{row.status === 'ready' ? 'Ready' : 'Review'}</td>
                      <td>{row.sourceRowNumber}</td>
                      <td>{row.skuBase}</td>
                      <td>{row.brand}</td>
                      <td>{row.style}</td>
                      <td>{row.color}</td>
                      <td>{row.size}</td>
                      <td>{row.quantity}</td>
                      <td>{row.bin}</td>
                      <td>{Number(row.unitCost || 0).toFixed(2)}</td>
                      <td>{row.lowStockThreshold ?? ''}</td>
                      <td>{[...(row.errors || []), ...(row.warnings || [])].join(' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 500 && <p className="helper-text">Showing first 500 rows only.</p>}
          </section>
        </>
      )}

      {result && (
        <section className="card elevated-card">
          <h2>Import Result</h2>
          <div className="summary-grid">
            <div className="metric-card"><strong>{resultNumber(result, 'inserted_blank_products')}</strong><span>Products created</span></div>
            <div className="metric-card"><strong>{resultNumber(result, 'updated_blank_products')}</strong><span>Products updated</span></div>
            <div className="metric-card"><strong>{resultNumber(result, 'total_quantity_received')}</strong><span>Units received</span></div>
            <div className="metric-card"><strong>{resultNumber(result, 'inserted_inventory_movements')}</strong><span>Movements saved</span></div>
            <div className="metric-card"><strong>{resultNumber(result, 'skipped_rows')}</strong><span>Rows skipped</span></div>
          </div>
          <pre className="result-json">{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
