import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { replaceBlankProductMaster } from './lib/inventoryApi';

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
        brand: clean(columnValue(row, ['Brand'])),
        style: clean(columnValue(row, ['Style', 'Product Style', 'Product Type'])),
        color: clean(columnValue(row, ['Color', 'Colour'])),
        size: clean(columnValue(row, ['Size'])),
        quantity: integerValue(columnValue(row, ['Quantity', 'Qty', 'Count']), 0),
        bin: clean(columnValue(row, ['Bin', 'Bin Code', 'Location'])),
        unitCost: numberValue(columnValue(row, ['Unit Cost', 'Cost', 'Blank Cost']), 0),
        lowStockThreshold: integerValue(columnValue(row, [
          'Low Stock Threshold',
          'Low Stock Threshhold',
          'Low Stock',
          'Threshold',
          'Reorder Point',
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
        imageUrl: clean(columnValue(row, ['Image URL (optional)', 'Image URL', 'Image'])),
        supplier: clean(columnValue(row, ['Supplier (optional)', 'Supplier', 'Vendor'])),
        supplierSku: clean(columnValue(row, ['Supplier SKU (optional)', 'Supplier SKU', 'Vendor SKU'])),
        notes: clean(columnValue(row, ['Notes', 'Note'])),
      };

      if (!parsed.skuBase) parsed.skuBase = buildSkuBase(parsed);
      if (!parsed.name) {
        parsed.name = [parsed.brand, parsed.style, parsed.color, parsed.size].filter(Boolean).join(' ');
      }

      return parsed;
    })
    .filter((row) =>
      row.brand || row.style || row.color || row.size || row.skuBase || row.quantity || row.bin
    );
}

function validateRows(rows) {
  const seen = new Set();

  return rows.map((row) => {
    const errors = [];

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

    const duplicateKey = normalize(row.skuBase);
    if (duplicateKey && seen.has(duplicateKey)) {
      errors.push(`Duplicate SKU Base in upload: ${row.skuBase}`);
    }
    if (duplicateKey) seen.add(duplicateKey);

    return {
      ...row,
      status: errors.length ? 'error' : 'ready',
      errors,
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
      Notes: 'Master blank product row',
    },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows, { header: MASTER_COLUMNS }), 'Blank Products');
  XLSX.writeFile(wb, 'skilled-crafting-blank-product-master-template.xlsx');
}

export default function InventoryImport() {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

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
    setConfirmReplace(false);
    setFileName(file.name);
    setMessage('Reading blank product master workbook...');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = findSheetName(workbook, MASTER_SHEET_NAMES);

      if (!sheetName) {
        throw new Error('Workbook does not contain a readable sheet.');
      }

      const parsed = parseMasterSheet(workbook, sheetName);
      if (!parsed.length) throw new Error('No blank product master rows were found.');

      const validated = validateRows(parsed);
      setRows(validated);
      setMessage(`Loaded ${validated.length} blank product row(s) from ${file.name}. Review before replacing Supabase blank products.`);
    } catch (err) {
      setMessage(err.message || 'Failed to read workbook.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReplaceMaster() {
    const readyRows = rows.filter((row) => row.status === 'ready');

    if (!readyRows.length) {
      setMessage('No ready rows to import.');
      return;
    }

    if (!confirmReplace) {
      setMessage('Check the confirmation box before replacing the blank product master.');
      return;
    }

    setImporting(true);
    setResult(null);
    setMessage('Replacing Supabase blank product master. Do not close this page...');

    try {
      const response = await replaceBlankProductMaster({
        rows: readyRows,
        sourceFileName: fileName,
      });

      setResult(response);
      setMessage(
        `Blank product master replaced. Inserted ${response?.inserted_blank_products ?? 0} blank products and ` +
        `${response?.inserted_inventory_movements ?? 0} initial inventory movement(s).`
      );
    } catch (err) {
      setMessage(err.message || 'Blank product master import failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="page import-page">
      <section className="page-header import-header">
        <div>
          <p className="eyebrow">Blank Product Master</p>
          <h1>Replace Supabase blank products from spreadsheet</h1>
          <p>
            This import replaces the Supabase <strong>blank_products</strong> catalog. After import,
            Supabase becomes the source of truth for blank products. WooCommerce sync will only link
            WooCommerce products/finished products to these blanks by Brand + Style + Color + Size.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={downloadBrowserTemplate}>
          Download Template
        </button>
      </section>

      <section className="warning-card">
        <h2>Important</h2>
        <p>
          This is a replacement import, not an incremental receiving transaction. It clears the current
          blank product master, clears existing blank inventory movement quantities, and rebuilds the
          master from the uploaded spreadsheet.
        </p>
      </section>

      <section className="card elevated-card import-upload-card">
        <h2>Required spreadsheet columns</h2>
        <p className="helper-text">
          Brand • Style • Color • Size • Quantity • Bin • Unit Cost • Low Stock Threshold
        </p>
        <p className="helper-text">
          Optional: SKU Base, Barcode, Product Name, Image URL, Supplier, Supplier SKU, Notes.
          The import also accepts the typo <strong>Low Stock Threshhold</strong>.
        </p>

        <label>
          Upload blank product master workbook
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
            <div className="metric-card"><strong>{counts.totalUnits}</strong><span>Initial units</span></div>
            <div className="metric-card"><strong>{counts.withBins}</strong><span>Rows with bin quantities</span></div>
          </section>

          <section className="card elevated-card">
            <div className="import-actions">
              <label className="checkbox-line danger-check">
                <input
                  type="checkbox"
                  checked={confirmReplace}
                  onChange={(event) => setConfirmReplace(event.target.checked)}
                  disabled={importing}
                />
                I understand this will replace all Supabase blank products and reset blank inventory quantities.
              </label>

              <button
                type="button"
                className="danger-button"
                disabled={importing || loading || counts.ready === 0 || counts.errors > 0 || !confirmReplace}
                onClick={handleReplaceMaster}
              >
                {importing ? 'Replacing Master...' : `Replace Blank Product Master (${counts.ready} rows)`}
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
                    <th>Qty</th>
                    <th>Bin</th>
                    <th>Unit Cost</th>
                    <th>Low Stock</th>
                    <th>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 500).map((row) => (
                    <tr key={`${row.sourceRowNumber}-${row.skuBase}`} className={row.status === 'ready' ? '' : 'error-row'}>
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
                      <td>{row.errors?.join(' ')}</td>
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
          <pre className="result-json">{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
