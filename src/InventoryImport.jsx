import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  importBlankInventoryRow,
  importFinishedInventoryRow,
} from './lib/inventoryApi';

const BLANK_SHEET_NAMES = ['Blank Inventory', 'Blanks', 'Blank'];
const FINISHED_SHEET_NAMES = ['Finished Inventory', 'Finished', 'Finished Products'];

const BLANK_COLUMNS = ['Brand', 'Style', 'Color', 'Size', 'Quantity', 'Bin', 'SKU (optional)', 'Notes'];
const FINISHED_COLUMNS = [
  'Customer',
  'Logo',
  'Brand',
  'Style',
  'Color',
  'Size',
  'Quantity',
  'Bin',
  'Finished SKU (optional)',
  'Blank SKU (optional)',
  'Placement',
  'Decoration Size',
  'Notes',
];

function clean(value) {
  return String(value ?? '').trim();
}

function normalize(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function numberValue(value) {
  if (typeof value === 'number') return value;
  const parsed = Number(clean(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function findSheetName(workbook, names) {
  const normalizedNames = names.map(normalize);
  return workbook.SheetNames.find((sheetName) => normalizedNames.includes(normalize(sheetName)));
}

function columnValue(row, possibleNames) {
  for (const name of possibleNames) {
    if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];

    const found = Object.keys(row).find((key) => normalize(key) === normalize(name));
    if (found) return row[found];
  }

  return '';
}

function parseSheet(workbook, sheetName, inventoryType) {
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  return rows
    .map((row, index) => {
      const quantity = numberValue(columnValue(row, ['Quantity', 'Qty', 'Count']));
      const common = {
        inventoryType,
        sheetName,
        sourceRowNumber: index + 2,
        brand: clean(columnValue(row, ['Brand'])),
        style: clean(columnValue(row, ['Style', 'Product Style', 'Product Type'])),
        color: clean(columnValue(row, ['Color', 'Colour'])),
        size: clean(columnValue(row, ['Size'])),
        quantity,
        bin: clean(columnValue(row, ['Bin', 'Bin Code', 'Location'])),
        notes: clean(columnValue(row, ['Notes', 'Note'])),
      };

      if (inventoryType === 'finished') {
        return {
          ...common,
          customer: clean(columnValue(row, ['Customer', 'Customer Name'])),
          logo: clean(columnValue(row, ['Logo', 'Logo Type', 'Logo Name'])),
          finishedSku: clean(columnValue(row, ['Finished SKU (optional)', 'Finished SKU', 'Finished Sku', 'Finished Product SKU', 'SKU'])),
          blankSku: clean(columnValue(row, ['Blank SKU (optional)', 'Blank SKU', 'Blank Sku', 'Blank Product SKU', 'SKU Base'])),
          placement: clean(columnValue(row, ['Placement', 'Location', 'Logo Location'])),
          decorationSize: clean(columnValue(row, ['Decoration Size', 'Logo Size'])),
        };
      }

      return {
        ...common,
        sku: clean(columnValue(row, ['SKU (optional)', 'SKU', 'Blank SKU', 'Blank Sku', 'SKU Base'])),
      };
    })
    .filter((row) =>
      row.brand || row.style || row.color || row.size || row.quantity || row.bin ||
      row.sku || row.finishedSku || row.blankSku || row.customer || row.logo
    );
}

function validateBlank(row) {
  const errors = [];
  if (!Number.isFinite(row.quantity) || row.quantity <= 0) errors.push('Quantity must be greater than zero.');
  if (!row.bin) errors.push('Bin is required.');

  if (!row.sku && (!row.brand || !row.style || !row.color || !row.size)) {
    errors.push('Blank rows need SKU or Brand + Style + Color + Size.');
  }

  return errors;
}

function validateFinished(row) {
  const errors = [];
  if (!Number.isFinite(row.quantity) || row.quantity <= 0) errors.push('Quantity must be greater than zero.');
  if (!row.bin) errors.push('Bin is required.');
  if (!row.customer) errors.push('Customer is required.');
  if (!row.logo) errors.push('Logo is required.');

  if (!row.blankSku && (!row.brand || !row.style || !row.color || !row.size)) {
    errors.push('Finished rows need Blank SKU or Brand + Style + Color + Size to identify the underlying blank.');
  }

  return errors;
}

function validateRows(rows) {
  return rows.map((row) => {
    const errors = row.inventoryType === 'finished'
      ? validateFinished(row)
      : validateBlank(row);

    return {
      ...row,
      status: errors.length ? 'error' : 'ready',
      errors,
    };
  });
}

function downloadBrowserTemplate() {
  const blankRows = [
    {
      Brand: 'Gildan',
      Style: '18500',
      Color: 'Navy',
      Size: 'AXL',
      Quantity: 24,
      Bin: 'A01',
      'SKU (optional)': '',
      Notes: 'Initial blank inventory count',
    },
  ];

  const finishedRows = [
    {
      Customer: 'Sidney Glen Dolphins',
      Logo: 'Primary Dolphin Logo',
      Brand: 'Gildan',
      Style: '18500',
      Color: 'Navy',
      Size: 'AXL',
      Quantity: 4,
      Bin: 'FIN-01',
      'Finished SKU (optional)': '',
      'Blank SKU (optional)': '',
      Placement: 'Left Chest',
      'Decoration Size': '3.5 in',
      Notes: 'Extra finished inventory',
    },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(blankRows, { header: BLANK_COLUMNS }), 'Blank Inventory');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finishedRows, { header: FINISHED_COLUMNS }), 'Finished Inventory');
  XLSX.writeFile(wb, 'skilled-crafting-two-tab-inventory-import-template.xlsx');
}

function rowInputSummary(row) {
  if (row.inventoryType === 'finished') {
    return [row.customer, row.logo, row.finishedSku || row.blankSku || row.style, row.color, row.size]
      .filter(Boolean)
      .join(' / ');
  }

  return [row.sku || row.style, row.brand, row.color, row.size]
    .filter(Boolean)
    .join(' / ');
}

export default function InventoryImport() {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [createMissingBins, setCreateMissingBins] = useState(true);
  const [createMissingFinishedProducts, setCreateMissingFinishedProducts] = useState(true);
  const [results, setResults] = useState([]);

  const counts = useMemo(() => {
    const readyRows = rows.filter((row) => row.status === 'ready');
    const errorRows = rows.filter((row) => row.status !== 'ready');
    const blankRows = rows.filter((row) => row.inventoryType === 'blank');
    const finishedRows = rows.filter((row) => row.inventoryType === 'finished');
    const units = readyRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

    return {
      total: rows.length,
      ready: readyRows.length,
      errors: errorRows.length,
      blanks: blankRows.length,
      finished: finishedRows.length,
      units,
    };
  }, [rows]);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setRows([]);
    setResults([]);
    setFileName(file.name);
    setMessage('Reading workbook...');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      const blankSheet = findSheetName(workbook, BLANK_SHEET_NAMES);
      const finishedSheet = findSheetName(workbook, FINISHED_SHEET_NAMES);

      if (!blankSheet && !finishedSheet) {
        throw new Error('Workbook must include a "Blank Inventory" sheet, a "Finished Inventory" sheet, or both.');
      }

      const parsed = [
        ...parseSheet(workbook, blankSheet, 'blank'),
        ...parseSheet(workbook, finishedSheet, 'finished'),
      ];

      if (!parsed.length) throw new Error('No import rows were found.');

      const validated = validateRows(parsed);
      setRows(validated);
      setMessage(`Loaded ${validated.length} row(s) from ${file.name}. Review before importing.`);
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

    setImporting(true);
    setMessage('Importing ready rows...');
    setResults([]);

    const output = [];

    for (const row of readyRows) {
      try {
        if (row.inventoryType === 'finished') {
          await importFinishedInventoryRow({
            customer: row.customer,
            logo: row.logo,
            brand: row.brand,
            style: row.style,
            color: row.color,
            size: row.size,
            quantity: row.quantity,
            bin: row.bin,
            finishedSku: row.finishedSku,
            blankSku: row.blankSku,
            placement: row.placement,
            decorationSize: row.decorationSize,
            notes: [row.notes, `Import file ${fileName} ${row.sheetName} row ${row.sourceRowNumber}`].filter(Boolean).join(' | '),
            createMissingBin: createMissingBins,
            createMissingFinishedProduct: createMissingFinishedProducts,
          });
        } else {
          await importBlankInventoryRow({
            brand: row.brand,
            style: row.style,
            color: row.color,
            size: row.size,
            quantity: row.quantity,
            bin: row.bin,
            sku: row.sku,
            notes: [row.notes, `Import file ${fileName} ${row.sheetName} row ${row.sourceRowNumber}`].filter(Boolean).join(' | '),
            createMissingBin: createMissingBins,
          });
        }

        output.push({ row, status: 'Imported', message: 'Success' });
      } catch (err) {
        output.push({ row, status: 'Error', message: err.message || 'Import failed.' });
      }
    }

    setResults(output);

    const imported = output.filter((item) => item.status === 'Imported').length;
    const failed = output.length - imported;
    setMessage(`Import complete. Imported ${imported} row(s). ${failed} row(s) failed.`);
    setImporting(false);
  }

  return (
    <main className="page import-page">
      <section className="page-header import-header">
        <div>
          <p className="eyebrow">Inventory Import</p>
          <h1>Two-tab blank and finished inventory import</h1>
          <p>
            Upload one workbook with separate <strong>Blank Inventory</strong> and <strong>Finished Inventory</strong> tabs.
            Blank items match by SKU or Brand + Style + Color + Size. Finished items match/create by Finished SKU or
            Customer + Logo + Brand + Style + Color + Size.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={downloadBrowserTemplate}>
          Download Template
        </button>
      </section>

      <section className="content-two-column import-instructions-grid">
        <div className="card elevated-card">
          <h2>Blank Inventory tab</h2>
          <p className="helper-text">{BLANK_COLUMNS.join(' • ')}</p>
          <p>
            Use this tab for undecorated inventory. Add SKU when the same style/color/size could match more than one blank product.
          </p>
        </div>

        <div className="card elevated-card">
          <h2>Finished Inventory tab</h2>
          <p className="helper-text">{FINISHED_COLUMNS.join(' • ')}</p>
          <p>
            Use this tab for decorated inventory. Customer and Logo are required. Placement and Decoration Size are optional but recommended.
          </p>
        </div>
      </section>

      <section className="card elevated-card import-upload-card">
        <label>
          Upload Excel workbook
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} disabled={loading || importing} />
        </label>

        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={createMissingBins}
            onChange={(event) => setCreateMissingBins(event.target.checked)}
          />
          Create missing bins automatically
        </label>

        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={createMissingFinishedProducts}
            onChange={(event) => setCreateMissingFinishedProducts(event.target.checked)}
          />
          Create missing finished products automatically
        </label>

        {message && <p className="message">{message}</p>}
      </section>

      {rows.length ? (
        <>
          <section className="kpi-grid import-kpis">
            <div className="kpi-card"><span>{counts.total}</span><strong>Total rows</strong><small>Parsed from workbook</small></div>
            <div className="kpi-card"><span>{counts.ready}</span><strong>Ready</strong><small>Can be imported</small></div>
            <div className="kpi-card"><span>{counts.errors}</span><strong>Needs review</strong><small>Fix before import</small></div>
            <div className="kpi-card"><span>{counts.units}</span><strong>Ready units</strong><small>Blank + finished</small></div>
            <div className="kpi-card"><span>{counts.blanks}</span><strong>Blank rows</strong><small>Blank Inventory tab</small></div>
            <div className="kpi-card"><span>{counts.finished}</span><strong>Finished rows</strong><small>Finished Inventory tab</small></div>
          </section>

          <section className="card elevated-card table-card">
            <div className="import-preview-heading">
              <div>
                <h2>Import Preview</h2>
                <p className="helper-text">Rows with validation errors will not be sent to Supabase.</p>
              </div>
              <button type="button" onClick={handleImport} disabled={!counts.ready || importing || loading}>
                {importing ? 'Importing...' : `Import ${counts.ready} Ready Rows`}
              </button>
            </div>

            <div className="responsive-table">
              <table className="data-table import-table">
                <thead>
                  <tr>
                    <th>Sheet</th>
                    <th>Row</th>
                    <th>Status</th>
                    <th>Type</th>
                    <th>Input</th>
                    <th>Quantity</th>
                    <th>Bin</th>
                    <th>Notes / Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.sheetName}-${row.sourceRowNumber}`} className={row.status === 'ready' ? 'import-ready-row' : 'import-error-row'}>
                      <td>{row.sheetName}</td>
                      <td>{row.sourceRowNumber}</td>
                      <td><strong>{row.status === 'ready' ? 'Ready' : 'Review'}</strong></td>
                      <td>{row.inventoryType}</td>
                      <td>{rowInputSummary(row)}</td>
                      <td>{Number.isFinite(row.quantity) ? row.quantity : '—'}</td>
                      <td>{row.bin || '—'}</td>
                      <td>{row.errors?.length ? row.errors.join(' ') : row.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {results.length ? (
        <section className="card elevated-card table-card">
          <h2>Import Results</h2>
          <div className="responsive-table">
            <table className="data-table import-table">
              <thead>
                <tr>
                  <th>Sheet</th>
                  <th>Row</th>
                  <th>Status</th>
                  <th>Input</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={`result-${result.row.sheetName}-${result.row.sourceRowNumber}`} className={result.status === 'Imported' ? 'import-ready-row' : 'import-error-row'}>
                    <td>{result.row.sheetName}</td>
                    <td>{result.row.sourceRowNumber}</td>
                    <td><strong>{result.status}</strong></td>
                    <td>{rowInputSummary(result.row)}</td>
                    <td>{result.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
