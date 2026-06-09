
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  createSupplierCatalogFeed,
  deleteSupplierCatalogFeed,
  importSupplierCatalogRows,
  listSupplierCatalogFeeds,
  syncSupplierCatalogFeed,
  updateSupplierCatalogFeed,
} from './lib/inventoryApi';

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

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
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

  const stats = useMemo(() => {
    const withCost = rows.filter((row) => row.unit_cost !== null).length;
    const withUpc = rows.filter((row) => row.upc).length;
    const withSupplierSku = rows.filter((row) => row.supplier_sku).length;
    return { total: rows.length, withCost, withUpc, withSupplierSku };
  }, [rows]);

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
      const data = await importSupplierCatalogRows({
        supplierName,
        sourceFileName,
        rows,
        updateBlankProducts,
        createMissingLookups,
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
    setMessage(`Syncing ${feed.feed_name || feed.supplier_name}...`);

    try {
      const data = await syncSupplierCatalogFeed(feed.id);
      setResult(data);
      setMessage(data.message || 'Supplier catalog feed synced.');
      await loadFeeds();
    } catch (err) {
      setMessage(err.message || 'Supplier catalog feed sync failed.');
      await loadFeeds();
    } finally {
      setSyncingFeedId(null);
    }
  }

  return (
    <main className="page phase3-page supplier-import-page-only">
      <SupplierImportScopedStyles />

      <section className="page-header">
        <div>
          <p className="eyebrow">Phase 3 · Supplier Catalog</p>
          <h1>Supplier Catalog Import</h1>
          <p>Upload supplier catalog files manually or save supplier-hosted CSV feed URLs and refresh them with a button.</p>
        </div>
        <button type="button" className="secondary-button" onClick={downloadTemplate}>Download Template</button>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="card elevated-card supplier-feed-card">
        <div className="supplier-feed-header">
          <div>
            <h2>Website CSV Feeds</h2>
            <p className="helper-text">
              Save supplier-hosted CSV URLs here. The button downloads the supplier file through a Netlify function,
              parses it, and imports rows into the supplier catalog reference library.
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
        <h2>Manual File Import Settings</h2>
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

      .supplier-feed-card {
        border: 1px solid rgba(37, 99, 235, 0.14);
        background:
          radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 26rem),
          #ffffff;
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
      .supplier-feed-row-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }

      .supplier-feed-actions {
        grid-column: 1 / -1;
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

      @media (max-width: 760px) {
        .supplier-feed-form {
          grid-template-columns: 1fr;
        }

        .supplier-feed-header,
        .supplier-feed-actions,
        .supplier-feed-row-actions {
          display: grid;
        }
      }
    `}</style>
  );
}
