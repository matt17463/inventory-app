
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  createSupplierCatalogFeed,
  deleteSupplierCatalogFeed,
  importSupplierCatalogRows,
  listSupplierCatalogFeeds,
  updateSupplierCatalogFeed,
} from './lib/inventoryApi';
import { syncSupplierCatalogFeedIncremental } from './lib/supplierCatalogFeedSyncClient';
import { extractSupplierFilesFromZip } from './lib/zipCsvExtract';

const TEMPLATE_HEADERS = [
  'Brand', 'Style', 'Color', 'Size', 'Supplier SKU', 'UPC', 'Unit Cost', 'Case Pack Qty', 'Description', 'Notes'
];

const EMPTY_FEED = {
  supplier_name: '',
  feed_name: '',
  feed_url: '',
  source_file_name: '',
  is_active: true,
  update_blank_products: false,
  create_missing_lookups: true,
};

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

function parseSupplierZipEntry(entry) {
  const kind = String(entry.kind || '').toLowerCase();

  if (kind === 'csv' || kind === 'txt') {
    const workbook = XLSX.read(entry.text, { type: 'string' });
    return parseWorkbook(workbook);
  }

  if (kind === 'xlsx' || kind === 'xls' || kind === 'xlsm') {
    const workbook = XLSX.read(entry.arrayBuffer, { type: 'array' });
    return parseWorkbook(workbook);
  }

  return [];
}

function parseWorkbook(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  return rows.map((row, index) => ({
    source_row: index + 2,
    brand: clean(columnValue(row, ['Brand', 'Manufacturer', 'Mfg', 'Vendor Brand'])),
    style: clean(columnValue(row, ['Style', 'Style Number', 'Style #', 'Product Style', 'Item Style', 'Item Number', 'Item #'])),
    color: clean(columnValue(row, ['Color', 'Colour', 'Color Name'])),
    size: clean(columnValue(row, ['Size', 'Size Name'])),
    supplier_sku: clean(columnValue(row, ['Supplier SKU', 'Vendor SKU', 'Vendor Item', 'Item Number', 'Item #', 'SKU', 'Product SKU'])),
    upc: clean(columnValue(row, ['UPC', 'Barcode', 'GTIN', 'EAN'])),
    unit_cost: numberValue(columnValue(row, ['Unit Cost', 'Cost', 'Price', 'Net Price', 'Customer Price', 'Piece Price'])),
    case_pack_qty: numberValue(columnValue(row, ['Case Pack Qty', 'Case Pack', 'Pack Qty', 'Pack Quantity', 'Case Qty'])),
    description: clean(columnValue(row, ['Description', 'Product Name', 'Name', 'Item Description'])),
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

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

async function importRowsInChunks({
  supplierName,
  sourceFileName,
  rows,
  updateBlankProducts,
  createMissingLookups,
  onProgress,
  chunkSize = 250,
}) {
  let catalogRowsInserted = 0;
  let blankProductsUpdated = 0;
  let chunks = 0;

  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    chunks += 1;

    if (typeof onProgress === 'function') {
      onProgress({
        current: Math.min(start + chunk.length, rows.length),
        total: rows.length,
        sourceFileName,
      });
    }

    const result = await importSupplierCatalogRows({
      supplierName,
      sourceFileName,
      rows: chunk,
      updateBlankProducts,
      createMissingLookups,
    });

    catalogRowsInserted += Number(result?.catalog_rows_inserted || 0);
    blankProductsUpdated += Number(result?.blank_products_updated || 0);
  }

  return {
    catalog_rows_inserted: catalogRowsInserted,
    blank_products_updated: blankProductsUpdated,
    chunks_imported: chunks,
  };
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

  const [feeds, setFeeds] = useState([]);
  const [feedForm, setFeedForm] = useState(EMPTY_FEED);
  const [editingFeedId, setEditingFeedId] = useState(null);
  const [syncingFeedId, setSyncingFeedId] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null);

  const [zipSupplierName, setZipSupplierName] = useState('S&S Activewear');
  const [zipUploadFile, setZipUploadFile] = useState(null);
  const [zipFiles, setZipFiles] = useState([]);
  const [selectedZipFiles, setSelectedZipFiles] = useState([]);
  const [zipUpdateBlankProducts, setZipUpdateBlankProducts] = useState(false);
  const [zipCreateMissingLookups, setZipCreateMissingLookups] = useState(true);
  const [zipImportProgress, setZipImportProgress] = useState(null);
  const [zipParseStatus, setZipParseStatus] = useState('idle');

  const stats = useMemo(() => {
    const withCost = rows.filter((row) => row.unit_cost !== null).length;
    const withUpc = rows.filter((row) => row.upc).length;
    const withSupplierSku = rows.filter((row) => row.supplier_sku).length;
    return { total: rows.length, withCost, withUpc, withSupplierSku };
  }, [rows]);

  const zipStats = useMemo(() => {
    const totalRows = zipFiles.reduce((sum, file) => sum + Number(file.rows?.length || 0), 0);
    const selectedRows = zipFiles
      .filter((file) => selectedZipFiles.includes(file.fileName))
      .reduce((sum, file) => sum + Number(file.rows?.length || 0), 0);

    return {
      fileCount: zipFiles.length,
      selectedCount: selectedZipFiles.length,
      totalRows,
      selectedRows,
    };
  }, [zipFiles, selectedZipFiles]);

  async function loadFeeds() {
    try {
      const data = await listSupplierCatalogFeeds();
      setFeeds(data);
    } catch (err) {
      setMessage(err.message || 'Failed to load supplier catalog feeds.');
    }
  }

  useEffect(() => {
    loadFeeds();
  }, []);

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
      const data = await importRowsInChunks({
        supplierName,
        sourceFileName,
        rows,
        updateBlankProducts,
        createMissingLookups,
        onProgress: ({ current, total }) => setMessage(`Importing ${current} of ${total} row(s)...`),
      });

      setResult(data);
      setMessage(`Catalog import complete. ${data?.catalog_rows_inserted ?? 0} catalog row(s) saved. ${data?.blank_products_updated ?? 0} blank item(s) updated.`);
      await loadFeeds();
    } catch (err) {
      setMessage(err.message || 'Supplier catalog import failed.');
    } finally {
      setLoading(false);
    }
  }

  function updateFeedForm(field, value) {
    setFeedForm((current) => ({ ...current, [field]: value }));
  }

  function beginEditFeed(feed) {
    setEditingFeedId(feed.id);
    setFeedForm({
      supplier_name: feed.supplier_name || '',
      feed_name: feed.feed_name || '',
      feed_url: feed.feed_url || '',
      source_file_name: feed.source_file_name || '',
      is_active: feed.is_active !== false,
      update_blank_products: Boolean(feed.update_blank_products),
      create_missing_lookups: feed.create_missing_lookups !== false,
    });
  }

  function resetFeedForm() {
    setEditingFeedId(null);
    setFeedForm(EMPTY_FEED);
  }

  async function saveFeed(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (!feedForm.supplier_name.trim()) throw new Error('Supplier name is required.');
      if (!feedForm.feed_url.trim()) throw new Error('CSV feed URL is required.');
      if (!/^https?:\/\//i.test(feedForm.feed_url.trim())) throw new Error('Feed URL must start with http:// or https://.');

      if (editingFeedId) {
        await updateSupplierCatalogFeed(editingFeedId, feedForm);
        setMessage('Supplier catalog feed updated.');
      } else {
        await createSupplierCatalogFeed(feedForm);
        setMessage('Supplier catalog feed saved.');
      }

      resetFeedForm();
      await loadFeeds();
    } catch (err) {
      setMessage(err.message || 'Failed to save supplier catalog feed.');
    } finally {
      setLoading(false);
    }
  }

  async function removeFeed(feed) {
    const confirmed = window.confirm(`Delete supplier catalog feed "${feed.feed_name || feed.supplier_name}"?`);
    if (!confirmed) return;

    setLoading(true);
    setMessage('');

    try {
      await deleteSupplierCatalogFeed(feed.id);
      setMessage('Supplier catalog feed deleted.');
      await loadFeeds();
    } catch (err) {
      setMessage(err.message || 'Failed to delete supplier catalog feed.');
    } finally {
      setLoading(false);
    }
  }

  async function syncFeed(feed) {
    setSyncingFeedId(feed.id);
    setSyncProgress({ offset: 0, totalRows: 0, message: 'Starting incremental sync...' });
    setMessage(`Syncing ${feed.feed_name || feed.supplier_name} in smaller chunks...`);

    try {
      const data = await syncSupplierCatalogFeedIncremental(feed.id, {
        chunkSize: 25,
        onProgress: (progress) => {
          setSyncProgress(progress);
          setMessage(progress.message || `Imported ${progress.offset} supplier row(s)...`);
        },
      });

      setResult(data);
      setMessage(data.message || 'Supplier catalog feed synced.');
      setSyncProgress(null);
      await loadFeeds();
    } catch (err) {
      setMessage(err.message || 'Supplier catalog feed sync failed.');
      setSyncProgress(null);
      await loadFeeds();
    } finally {
      setSyncingFeedId(null);
    }
  }

  function handleZipFileSelected(event) {
    const file = event.target.files?.[0] || null;

    setZipUploadFile(file);
    setZipFiles([]);
    setSelectedZipFiles([]);
    setZipImportProgress(null);
    setZipParseStatus(file ? 'selected' : 'idle');

    if (file) {
      setMessage(`Selected ZIP file: ${file.name}. Click "Read ZIP / Show Excel/CSV Files" to prepare the import.`);
    }
  }

  async function readZipFile() {
    if (!zipUploadFile) {
      setMessage('Choose a supplier ZIP file first.');
      return;
    }

    setLoading(true);
    setZipFiles([]);
    setSelectedZipFiles([]);
    setZipImportProgress(null);
    setZipParseStatus('reading');
    setMessage(`Reading ZIP file ${zipUploadFile.name}...`);

    try {
      const extracted = await extractSupplierFilesFromZip(zipUploadFile);
      const parsedFiles = extracted.map((entry) => {
        const parsedRows = parseSupplierZipEntry(entry);
        return {
          fileName: entry.fileName,
          kind: entry.kind,
          size: entry.size,
          rows: parsedRows,
        };
      }).filter((entry) => entry.rows.length > 0);

      if (!parsedFiles.length) {
        throw new Error('Excel/CSV files were found in the ZIP, but no usable catalog rows were parsed.');
      }

      setZipFiles(parsedFiles);
      setSelectedZipFiles(parsedFiles.map((entry) => entry.fileName));
      setZipParseStatus('ready');
      setMessage(`ZIP ready. Found ${parsedFiles.length} Excel/CSV file(s) with ${parsedFiles.reduce((sum, entry) => sum + entry.rows.length, 0)} total usable row(s). The import button is now available.`);
    } catch (err) {
      setZipParseStatus('error');
      setMessage(err.message || 'Failed to read supplier ZIP file.');
    } finally {
      setLoading(false);
    }
  }

  function toggleZipFile(fileName) {
    setSelectedZipFiles((current) => current.includes(fileName)
      ? current.filter((name) => name !== fileName)
      : [...current, fileName]);
  }

  async function importSelectedZipFiles() {
    if (!zipSupplierName.trim()) {
      setMessage('Enter supplier name before importing the ZIP.');
      return;
    }

    const filesToImport = zipFiles.filter((file) => selectedZipFiles.includes(file.fileName));

    if (!filesToImport.length) {
      setMessage('Select at least one CSV file from the ZIP.');
      return;
    }

    const confirmed = window.confirm(
      `Import ${filesToImport.length} Excel/CSV file(s) from this ZIP for ${zipSupplierName}? This will add/update supplier catalog reference rows.`
    );

    if (!confirmed) return;

    setLoading(true);
    setResult(null);
    setZipImportProgress({ currentFile: '', fileIndex: 0, fileCount: filesToImport.length, current: 0, total: 0 });
    setMessage('Starting ZIP import...');

    try {
      let totalCatalogRowsInserted = 0;
      let totalBlankProductsUpdated = 0;
      let totalChunks = 0;
      const fileResults = [];

      for (let i = 0; i < filesToImport.length; i += 1) {
        const zipFile = filesToImport[i];

        setMessage(`Importing ${zipFile.fileName} (${i + 1} of ${filesToImport.length})...`);

        const fileResult = await importRowsInChunks({
          supplierName: zipSupplierName,
          sourceFileName: zipFile.fileName,
          rows: zipFile.rows,
          updateBlankProducts: zipUpdateBlankProducts,
          createMissingLookups: zipCreateMissingLookups,
          onProgress: ({ current, total }) => {
            setZipImportProgress({
              currentFile: zipFile.fileName,
              fileIndex: i + 1,
              fileCount: filesToImport.length,
              current,
              total,
            });
            setMessage(`Importing ${zipFile.fileName}: ${current} of ${total} row(s)...`);
          },
        });

        totalCatalogRowsInserted += Number(fileResult.catalog_rows_inserted || 0);
        totalBlankProductsUpdated += Number(fileResult.blank_products_updated || 0);
        totalChunks += Number(fileResult.chunks_imported || 0);
        fileResults.push({
          fileName: zipFile.fileName,
          rows: zipFile.rows.length,
          ...fileResult,
        });
      }

      const finalResult = {
        success: true,
        supplier_name: zipSupplierName,
        files_imported: filesToImport.length,
        catalog_rows_inserted: totalCatalogRowsInserted,
        blank_products_updated: totalBlankProductsUpdated,
        chunks_imported: totalChunks,
        file_results: fileResults,
      };

      setResult(finalResult);
      setMessage(`ZIP import complete. Imported ${filesToImport.length} file(s), saved ${formatNumber(totalCatalogRowsInserted)} catalog row(s).`);
      setZipImportProgress(null);
      await loadFeeds();
    } catch (err) {
      setMessage(err.message || 'Supplier ZIP import failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page phase3-page supplier-import-page-only">
      <SupplierImportScopedStyles />

      <section className="page-header">
        <div>
          <p className="eyebrow">Phase 3 · Supplier Catalog</p>
          <h1>Supplier Catalog Import</h1>
          <p>Upload supplier catalog files manually, import S&S ZIP downloads, or refresh supplier-hosted CSV feed URLs.</p>
        </div>
        <button type="button" className="secondary-button" onClick={downloadTemplate}>Download Template</button>
      </section>

      {message && <p className="message">{message}</p>}

      {syncProgress && (
        <section className="card supplier-progress-card">
          <h2>Supplier Feed Sync Progress</h2>
          <div className="supplier-progress-bar">
            <span style={{ width: '15%' }} />
          </div>
          <p>{syncProgress.offset || 0} supplier row(s) processed.</p>
        </section>
      )}

      {zipImportProgress && (
        <section className="card supplier-progress-card">
          <h2>Manual ZIP Import Progress</h2>
          <div className="supplier-progress-bar">
            <span style={{ width: `${zipImportProgress.total ? Math.min(100, (zipImportProgress.current / zipImportProgress.total) * 100) : 5}%` }} />
          </div>
          <p>
            File {zipImportProgress.fileIndex} of {zipImportProgress.fileCount}: {zipImportProgress.currentFile}
            <br />
            {formatNumber(zipImportProgress.current)} of {formatNumber(zipImportProgress.total)} row(s)
          </p>
        </section>
      )}

      <section className="card elevated-card supplier-zip-card">
        <div className="supplier-feed-header">
          <div>
            <h2>Manual Supplier ZIP Upload</h2>
            <p className="helper-text">
              Use this for S&S Activewear or any supplier whose ZIP download is blocked from server-side sync.
              Step 1: choose the ZIP. Step 2: read the ZIP. Step 3: import selected Excel/CSV files.
            </p>
          </div>
        </div>

        <div className="supplier-feed-form">
          <label>
            Supplier Name
            <input value={zipSupplierName} onChange={(event) => setZipSupplierName(event.target.value)} placeholder="S&S Activewear" />
          </label>

          <label>
            Supplier ZIP File
            <input type="file" accept=".zip" onChange={handleZipFileSelected} />
          </label>

          <label className="checkbox-line">
            <input type="checkbox" checked={zipCreateMissingLookups} onChange={(event) => setZipCreateMissingLookups(event.target.checked)} />
            Create missing lookup values
          </label>

          <label className="checkbox-line supplier-warning-check">
            <input type="checkbox" checked={zipUpdateBlankProducts} onChange={(event) => setZipUpdateBlankProducts(event.target.checked)} />
            Also update matched blank products with supplier data
          </label>
        </div>

        <div className="supplier-zip-step-actions">
          <button type="button" onClick={readZipFile} disabled={!zipUploadFile || loading}>
            {zipParseStatus === 'reading' ? 'Reading ZIP...' : 'Read ZIP / Show Excel/CSV Files'}
          </button>

          <button
            type="button"
            onClick={importSelectedZipFiles}
            disabled={loading || zipFiles.length === 0 || selectedZipFiles.length === 0}
            className={zipFiles.length > 0 && selectedZipFiles.length > 0 ? 'primary-import-button' : ''}
            title={zipFiles.length === 0 ? 'Read the ZIP first before importing.' : ''}
          >
            Import Selected Files ({selectedZipFiles.length})
          </button>
        </div>

        {zipUploadFile && zipFiles.length === 0 && (
          <p className="helper-text supplier-zip-guidance">
            File selected: <strong>{zipUploadFile.name}</strong>. The import button is disabled until the ZIP has been read and Excel/CSV files are listed.
          </p>
        )}

        {zipFiles.length > 0 && (
          <>
            <div className="supplier-zip-summary">
              <span>{formatNumber(zipStats.fileCount)} Excel/CSV file(s)</span>
              <span>{formatNumber(zipStats.totalRows)} total usable row(s)</span>
              <span>{formatNumber(zipStats.selectedRows)} selected row(s)</span>
            </div>

            <div className="responsive-table supplier-feed-table-wrap">
              <table className="data-table supplier-feed-table">
                <thead>
                  <tr>
                    <th>Import</th>
                    <th>File in ZIP</th>
                    <th>Type</th>
                    <th>Rows</th>
                    <th>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {zipFiles.map((file) => (
                    <tr key={file.fileName}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedZipFiles.includes(file.fileName)}
                          onChange={() => toggleZipFile(file.fileName)}
                        />
                      </td>
                      <td><strong>{file.fileName}</strong></td>
                      <td>{String(file.kind || '').toUpperCase()}</td>
                      <td>{formatNumber(file.rows.length)}</td>
                      <td>{formatNumber(file.size)} bytes</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="supplier-feed-actions">
              <button type="button" onClick={() => setSelectedZipFiles(zipFiles.map((file) => file.fileName))}>Select All</button>
              <button type="button" onClick={() => setSelectedZipFiles([])}>Select None</button>
            </div>
          </>
        )}
      </section>

      <section className="card elevated-card supplier-feed-card">
        <div className="supplier-feed-header">
          <div>
            <h2>Website CSV Feeds</h2>
            <p className="helper-text">
              Use this only for suppliers with URLs that can be reached by the app. For blocked S&S ZIP downloads, use Manual Supplier ZIP Upload above.
            </p>
          </div>
        </div>

        <form onSubmit={saveFeed} className="supplier-feed-form">
          <label>
            Supplier Name
            <input value={feedForm.supplier_name} onChange={(event) => updateFeedForm('supplier_name', event.target.value)} placeholder="Example: S&S Activewear" />
          </label>

          <label>
            Feed Name
            <input value={feedForm.feed_name} onChange={(event) => updateFeedForm('feed_name', event.target.value)} placeholder="Example: Daily Inventory CSV" />
          </label>

          <label className="wide-field">
            CSV Feed URL
            <input value={feedForm.feed_url} onChange={(event) => updateFeedForm('feed_url', event.target.value)} placeholder="https://supplier.com/path/catalog.csv" />
          </label>

          <label>
            Source File Label
            <input value={feedForm.source_file_name} onChange={(event) => updateFeedForm('source_file_name', event.target.value)} placeholder="Optional display label" />
          </label>

          <label className="checkbox-line">
            <input type="checkbox" checked={feedForm.is_active} onChange={(event) => updateFeedForm('is_active', event.target.checked)} />
            Active
          </label>

          <label className="checkbox-line">
            <input type="checkbox" checked={feedForm.create_missing_lookups} onChange={(event) => updateFeedForm('create_missing_lookups', event.target.checked)} />
            Create missing lookup values
          </label>

          <label className="checkbox-line supplier-warning-check">
            <input type="checkbox" checked={feedForm.update_blank_products} onChange={(event) => updateFeedForm('update_blank_products', event.target.checked)} />
            Also update matched blank products with supplier data
          </label>

          <div className="supplier-feed-actions">
            <button type="submit" disabled={loading}>
              {editingFeedId ? 'Save Feed Changes' : 'Add Feed'}
            </button>
            {editingFeedId && <button type="button" onClick={resetFeedForm}>Cancel Edit</button>}
          </div>
        </form>

        <div className="responsive-table supplier-feed-table-wrap">
          <table className="data-table supplier-feed-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Feed</th>
                <th>Status</th>
                <th>Last Sync</th>
                <th>Rows</th>
                <th>Message</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {feeds.map((feed) => (
                <tr key={feed.id}>
                  <td><strong>{feed.supplier_name}</strong></td>
                  <td>
                    <div>{feed.feed_name || feed.source_file_name || 'Website CSV'}</div>
                    <small className="supplier-feed-url">{feed.feed_url}</small>
                  </td>
                  <td>
                    <span className={`supplier-feed-status supplier-feed-status-${feed.last_sync_status || 'never'}`}>
                      {feed.last_sync_status || 'never synced'}
                    </span>
                    {!feed.is_active && <span className="supplier-feed-status supplier-feed-status-inactive">inactive</span>}
                  </td>
                  <td>{formatDate(feed.last_sync_at)}</td>
                  <td>{feed.last_row_count || 0}</td>
                  <td>{feed.last_sync_message || ''}</td>
                  <td>
                    <div className="supplier-feed-row-actions">
                      <button type="button" onClick={() => syncFeed(feed)} disabled={syncingFeedId === feed.id || !feed.is_active}>
                        {syncingFeedId === feed.id ? 'Syncing...' : 'Update from Website'}
                      </button>
                      <button type="button" onClick={() => beginEditFeed(feed)}>Edit</button>
                      <button type="button" className="danger-button" onClick={() => removeFeed(feed)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!feeds.length && (
                <tr><td colSpan="7">No supplier website CSV feeds saved yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card elevated-card">
        <h2>Manual Single File Import Settings</h2>
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
          <h2>Import / Sync Result</h2>
          <pre className="code-block">{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}

function SupplierImportScopedStyles() {
  return (
    <style>{`
      .supplier-import-page-only {
        display: grid;
        gap: 18px;
      }

      .supplier-feed-card,
      .supplier-zip-card,
      .supplier-progress-card {
        border: 1px solid rgba(37, 99, 235, 0.14);
        background:
          radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 26rem),
          #ffffff;
      }

      .supplier-zip-card {
        border-color: rgba(219, 39, 119, 0.18);
        background:
          radial-gradient(circle at top left, rgba(219, 39, 119, 0.08), transparent 26rem),
          #ffffff;
      }

      .supplier-progress-bar {
        width: 100%;
        height: 14px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(100, 116, 139, 0.16);
      }

      .supplier-progress-bar span {
        display: block;
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(135deg, #2563eb, #7c3aed);
        transition: width 0.2s ease;
      }

      .supplier-feed-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
      }

      .supplier-feed-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(220px, 1fr));
        gap: 12px;
        margin-bottom: 18px;
      }

      .supplier-feed-form .wide-field {
        grid-column: 1 / -1;
      }

      .supplier-feed-actions,
      .supplier-feed-row-actions,
      .supplier-zip-step-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-top: 12px;
      }

      .supplier-feed-actions {
        grid-column: 1 / -1;
      }

      .supplier-zip-step-actions button {
        min-height: 44px;
      }

      .supplier-zip-step-actions .primary-import-button {
        background: linear-gradient(135deg, #2563eb, #7c3aed) !important;
        color: #ffffff !important;
        box-shadow: 0 12px 26px rgba(37, 99, 235, 0.24);
      }

      .supplier-warning-check {
        color: #9a3412;
        font-weight: 800;
      }

      .supplier-feed-table {
        min-width: 980px;
      }

      .supplier-feed-url {
        display: block;
        max-width: 360px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #64748b;
      }

      .supplier-feed-status {
        display: inline-flex;
        border-radius: 999px;
        padding: 5px 9px;
        font-size: 0.74rem;
        font-weight: 900;
        background: rgba(100, 116, 139, 0.12);
        color: #475569;
        margin-right: 4px;
      }

      .supplier-feed-status-success {
        background: rgba(5, 150, 105, 0.12);
        color: #047857;
      }

      .supplier-feed-status-running {
        background: rgba(37, 99, 235, 0.12);
        color: #1d4ed8;
      }

      .supplier-feed-status-failed {
        background: rgba(225, 29, 72, 0.12);
        color: #be123c;
      }

      .supplier-feed-status-inactive {
        background: rgba(249, 115, 22, 0.12);
        color: #c2410c;
      }

      .supplier-zip-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 12px 0;
      }

      .supplier-zip-summary span {
        display: inline-flex;
        border-radius: 999px;
        padding: 8px 12px;
        background: rgba(219, 39, 119, 0.10);
        color: #be185d;
        font-weight: 900;
      }

      .supplier-zip-guidance {
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(37, 99, 235, 0.08);
      }

      @media (max-width: 760px) {
        .supplier-feed-form {
          grid-template-columns: 1fr;
        }

        .supplier-feed-header,
        .supplier-feed-actions,
        .supplier-feed-row-actions,
        .supplier-zip-step-actions {
          display: grid;
        }
      }
    `}</style>
  );
}
