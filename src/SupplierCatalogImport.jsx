import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  clearSupplierCatalogImportedData,
  importSupplierCatalogRowsControlled,
} from './lib/supplierCatalogApi';
import { extractSupplierFilesFromZip } from './lib/zipCsvExtract';
import { resolveImportColors, saveImportColorAliases } from './lib/colorLifecycleApi';

function clean(value) { return String(value ?? '').trim(); }
function norm(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function numberValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/[$,]/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}
function columnValue(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
    const found = Object.keys(row).find((key) => norm(key) === norm(name));
    if (found) return row[found];
  }
  return '';
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
function parseEntry(entry) {
  const kind = String(entry.kind || '').toLowerCase();
  if (kind === 'csv' || kind === 'txt') return parseWorkbook(XLSX.read(entry.text, { type: 'string' }));
  return parseWorkbook(XLSX.read(entry.arrayBuffer, { type: 'array' }));
}
function parseList(value) { return String(value || '').split(/[\n,]+/).map((x) => x.trim()).filter(Boolean); }
function rowAllowed(row, brands, styles) {
  const brandOk = !brands.length || brands.some((brand) => norm(row.brand).includes(norm(brand)));
  const styleOk = !styles.length || styles.some((style) => norm(row.style).includes(norm(style)));
  return brandOk && styleOk;
}
function filterRows(rows, brands, styles) { return rows.filter((row) => rowAllowed(row, brands, styles)); }
function fmt(value) { return Number(value || 0).toLocaleString(); }
async function importInChunks({ supplierName, sourceFileName, rows, updateBlankProducts, createMissingLookups, keepLatestOnly, allowedBrands, allowedStyles, onProgress }) {
  let upserted = 0, inserted = 0, updated = 0, blankUpdates = 0, chunks = 0;
  for (let start = 0; start < rows.length; start += 250) {
    const chunk = rows.slice(start, start + 250);
    chunks += 1;
    onProgress?.({ current: Math.min(start + chunk.length, rows.length), total: rows.length, sourceFileName });
    const result = await importSupplierCatalogRowsControlled({ supplierName, sourceFileName, rows: chunk, updateBlankProducts, createMissingLookups, keepLatestOnly, allowedBrands, allowedStyles });
    upserted += Number(result?.catalog_rows_upserted || 0);
    inserted += Number(result?.catalog_rows_inserted || 0);
    updated += Number(result?.catalog_rows_updated || 0);
    blankUpdates += Number(result?.blank_products_updated || 0);
  }
  return { catalog_rows_upserted: upserted, catalog_rows_inserted: inserted, catalog_rows_updated: updated, blank_products_updated: blankUpdates, chunks_imported: chunks };
}

export default function SupplierCatalogImport() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [supplierName, setSupplierName] = useState('S&S Activewear');
  const [brandFilter, setBrandFilter] = useState('Gildan, Bella+Canvas, Adidas, District, Sport-Tek');
  const [styleFilter, setStyleFilter] = useState('');
  const [keepLatestOnly, setKeepLatestOnly] = useState(true);
  const [createMissingLookups, setCreateMissingLookups] = useState(true);
  const [updateBlankProducts, setUpdateBlankProducts] = useState(false);
  const [zipFile, setZipFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState([]);
  const [progress, setProgress] = useState(null);
  const [clearSupplier, setClearSupplier] = useState('');
  const [clearMode, setClearMode] = useState('all_imported');
  const [colorReview, setColorReview] = useState(null);

  const brands = useMemo(() => parseList(brandFilter), [brandFilter]);
  const styles = useMemo(() => parseList(styleFilter), [styleFilter]);
  const stats = useMemo(() => {
    const selectedFiles = files.filter((file) => selected.includes(file.fileName));
    const rawRows = selectedFiles.reduce((sum, file) => sum + file.rows.length, 0);
    const filteredRows = selectedFiles.reduce((sum, file) => sum + filterRows(file.rows, brands, styles).length, 0);
    return { fileCount: files.length, selectedCount: selected.length, rawRows, filteredRows };
  }, [files, selected, brands, styles]);

  async function readZip() {
    if (!zipFile) { setMessage('Choose a supplier ZIP first.'); return; }
    setBusy(true); setFiles([]); setSelected([]); setMessage('Reading ZIP and previewing files...');
    try {
      const extracted = await extractSupplierFilesFromZip(zipFile);
      const parsed = extracted.map((entry) => ({ ...entry, rows: parseEntry(entry) })).filter((entry) => entry.rows.length > 0);
      if (!parsed.length) throw new Error('Files were found, but no usable supplier rows were parsed.');
      setFiles(parsed); setMessage(`Preview ready. Found ${parsed.length} supported file(s). Select only the files you want to import.`);
    } catch (err) { setMessage(err.message || 'Failed to read ZIP.'); }
    finally { setBusy(false); }
  }
  async function doImport() {
    const chosen = files.filter((file) => selected.includes(file.fileName)).map((file) => ({ ...file, filteredRows: filterRows(file.rows, brands, styles) })).filter((file) => file.filteredRows.length > 0);
    if (!supplierName.trim()) { setMessage('Supplier name is required.'); return; }
    if (!chosen.length) { setMessage('Select at least one file with rows after filtering.'); return; }
    setBusy(true); setResult(null);
    try {
      setMessage('Matching supplier colors to active WooCommerce colors...');
      const distinctColors = [...new Set(chosen.flatMap((file) => file.filteredRows.map((row) => row.color)).filter(Boolean))];
      const colorResult = await resolveImportColors(supplierName, distinctColors);
      const unresolved = (colorResult.resolved || []).filter((row) => !row.resolved);
      if (unresolved.length) {
        setColorReview({ sourceSystem: colorResult.source_system, rows: unresolved, activeColors: colorResult.active_colors || [] });
        setMessage(`${unresolved.length} supplier color(s) need pairing before the import can continue.`);
        return;
      }
      setColorReview(null);
      const canonicalByKey = new Map((colorResult.resolved || []).map((row) => [norm(row.source_value), row.canonical_color_name]));
      const canonicalChosen = chosen.map((file) => ({
        ...file, filteredRows: file.filteredRows.map((row) => ({ ...row, color: canonicalByKey.get(norm(row.color)) || row.color })),
      }));
      if (!window.confirm(`Import ${fmt(stats.filteredRows)} selected row(s) from ${canonicalChosen.length} file(s) using the reviewed WooCommerce color pairings?`)) return;
      const total = { catalog_rows_upserted: 0, catalog_rows_inserted: 0, catalog_rows_updated: 0, blank_products_updated: 0, chunks_imported: 0, file_results: [] };
      for (let i = 0; i < canonicalChosen.length; i += 1) {
        const file = canonicalChosen[i];
        const fileResult = await importInChunks({ supplierName, sourceFileName: file.fileName, rows: file.filteredRows, updateBlankProducts, createMissingLookups, keepLatestOnly, allowedBrands: brands, allowedStyles: styles, onProgress: ({ current, total: rowTotal }) => { setProgress({ file: file.fileName, fileIndex: i + 1, fileCount: chosen.length, current, total: rowTotal }); setMessage(`Importing ${file.fileName}: ${fmt(current)} of ${fmt(rowTotal)} row(s)...`); } });
        total.catalog_rows_upserted += fileResult.catalog_rows_upserted; total.catalog_rows_inserted += fileResult.catalog_rows_inserted; total.catalog_rows_updated += fileResult.catalog_rows_updated; total.blank_products_updated += fileResult.blank_products_updated; total.chunks_imported += fileResult.chunks_imported; total.file_results.push({ fileName: file.fileName, rows: file.filteredRows.length, ...fileResult });
      }
      setResult({ success: true, supplierName, ...total }); setMessage(`Import complete. Upserted ${fmt(total.catalog_rows_upserted)} supplier catalog row(s).`); setProgress(null);
    } catch (err) { setMessage(err.message || 'Supplier catalog import failed.'); }
    finally { setBusy(false); }
  }
  async function saveColorReview() {
    const incomplete = (colorReview?.rows || []).filter((row) => !row.color_id);
    if (incomplete.length) { setMessage(`Choose a WooCommerce color for ${incomplete[0].source_value}.`); return; }
    setBusy(true); setMessage('Saving supplier color pairings...');
    try {
      const saved = await saveImportColorAliases(colorReview.sourceSystem, colorReview.rows);
      setColorReview(null);
      setMessage(`Saved ${fmt(saved.saved_pairings)} color pairing(s). Click Import Selected Files again to continue.`);
    } catch (err) { setMessage(err.message || 'Supplier color pairings could not be saved.'); }
    finally { setBusy(false); }
  }
  async function clearData() {
    if (!window.confirm('Clear supplier catalog imported data? This does not delete blanks, inventory, WooCommerce products, bins, jobs, or orders.')) return;
    if (window.prompt('Type CLEAR SUPPLIER CATALOG to confirm.') !== 'CLEAR SUPPLIER CATALOG') { setMessage('Clear cancelled.'); return; }
    setBusy(true); setMessage('Clearing supplier catalog imported data...');
    try { const data = await clearSupplierCatalogImportedData({ supplierName: clearSupplier.trim() || null, clearMode }); setResult(data); setMessage(data?.message || 'Supplier catalog imported data cleared.'); }
    catch (err) { setMessage(err.message || 'Failed to clear supplier catalog data.'); }
    finally { setBusy(false); }
  }

  return <main className="page supplier-import-page-only"><SupplierImportStyles />
    <section className="page-header"><div><p className="eyebrow">Supplier Catalog</p><h1>Supplier Catalog Import</h1><p>Preview massive supplier files, choose exactly what to keep, and import selected files/brands/styles without loading everything into active inventory.</p></div></section>
    {message && <p className="message">{message}</p>}
    {colorReview && <section className="card elevated-card"><h2>Pair Unrecognized Supplier Colors</h2><p className="helper-text">Choose the existing WooCommerce color that each supplier value should use. These choices will be remembered for future imports from this supplier.</p><div className="responsive-table"><table className="data-table"><thead><tr><th>Supplier color</th><th>Pair to existing WooCommerce color</th></tr></thead><tbody>{colorReview.rows.map((row, index) => <tr key={row.source_key}><td><strong>{row.source_value}</strong><br /><small>{row.match_method}</small></td><td><select value={row.color_id || ''} onChange={(event) => setColorReview((current) => ({ ...current, rows: current.rows.map((item, rowIndex) => rowIndex === index ? { ...item, color_id: event.target.value } : item) }))}><option value="">Choose existing color...</option>{colorReview.activeColors.map((color) => <option key={color.id} value={color.id}>{color.name}{color.code && color.code !== color.name ? ` (${color.code})` : ''}</option>)}</select></td></tr>)}</tbody></table></div><div className="button-row"><button disabled={busy} onClick={saveColorReview}>Save Pairings</button><button disabled={busy} onClick={() => setColorReview(null)}>Cancel</button></div></section>}
    <section className="card elevated-card danger-panel"><h2>Clear Existing Supplier Catalog Imported Data</h2><p className="helper-text">Clears supplier catalog/reference rows only. It does not delete blank inventory, WooCommerce products, bins, jobs, orders, or finished inventory.</p><div className="form-grid"><label>Supplier Optional<input value={clearSupplier} onChange={(e) => setClearSupplier(e.target.value)} placeholder="Leave blank for all suppliers" /></label><label>Clear Mode<select value={clearMode} onChange={(e) => setClearMode(e.target.value)}><option value="all_imported">Clear supplier catalog items and imports</option><option value="catalog_items_only">Clear catalog items only</option><option value="archived_only">Clear archived catalog items only</option></select></label></div><button className="danger-button" disabled={busy} onClick={clearData}>Clear Supplier Catalog Imported Data</button></section>
    {progress && <section className="card"><h2>Import Progress</h2><p>File {progress.fileIndex} of {progress.fileCount}: {progress.file}</p><p>{fmt(progress.current)} of {fmt(progress.total)} row(s)</p></section>}
    <section className="card elevated-card"><h2>Manual Supplier ZIP Upload</h2><p className="helper-text">Download the supplier ZIP yourself, then upload it here. Nothing is saved until you select files and click Import.</p><div className="form-grid"><label>Supplier Name<input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} /></label><label>Supplier ZIP<input type="file" accept=".zip" onChange={(e) => { setZipFile(e.target.files?.[0] || null); setFiles([]); setSelected([]); }} /></label><label>Brand Filter Optional<textarea value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} placeholder="Gildan, Bella+Canvas, Adidas" /></label><label>Style Filter Optional<textarea value={styleFilter} onChange={(e) => setStyleFilter(e.target.value)} placeholder="18500, 6405, 3001" /></label></div><label className="checkbox-line"><input type="checkbox" checked={createMissingLookups} onChange={(e) => setCreateMissingLookups(e.target.checked)} /> Create missing lookup values</label><label className="checkbox-line"><input type="checkbox" checked={keepLatestOnly} onChange={(e) => setKeepLatestOnly(e.target.checked)} /> Keep only latest import per supplier</label><label className="checkbox-line warning"><input type="checkbox" checked={updateBlankProducts} onChange={(e) => setUpdateBlankProducts(e.target.checked)} /> Also update matched blank products with supplier data</label><div className="button-row"><button disabled={!zipFile || busy} onClick={readZip}>Read ZIP / Preview Files</button><button disabled={busy || !selected.length} onClick={doImport}>Import Selected Files ({selected.length})</button></div></section>
    {files.length > 0 && <section className="card table-card"><div className="summary-pills"><span>{fmt(stats.fileCount)} files</span><span>{fmt(stats.selectedCount)} selected</span><span>{fmt(stats.rawRows)} raw selected rows</span><span>{fmt(stats.filteredRows)} rows after filters</span></div><div className="button-row"><button onClick={() => setSelected(files.map((file) => file.fileName))}>Select All</button><button onClick={() => setSelected([])}>Select None</button></div><div className="responsive-table"><table className="data-table"><thead><tr><th>Import</th><th>File</th><th>Type</th><th>Rows</th><th>Rows After Filters</th><th>Size</th></tr></thead><tbody>{files.map((file) => { const after = filterRows(file.rows, brands, styles).length; return <tr key={file.fileName}><td><input type="checkbox" checked={selected.includes(file.fileName)} onChange={() => setSelected((current) => current.includes(file.fileName) ? current.filter((name) => name !== file.fileName) : [...current, file.fileName])} /></td><td><strong>{file.fileName}</strong></td><td>{String(file.kind || '').toUpperCase()}</td><td>{fmt(file.rows.length)}</td><td>{fmt(after)}</td><td>{fmt(file.size)} bytes</td></tr>; })}</tbody></table></div></section>}
    {result && <section className="card"><h2>Result</h2><pre className="code-block">{JSON.stringify(result, null, 2)}</pre></section>}
  </main>;
}
function SupplierImportStyles(){return <style>{`.supplier-import-page-only{display:grid;gap:18px}.danger-panel{border-color:rgba(225,29,72,.22)!important;background:radial-gradient(circle at top left,rgba(225,29,72,.08),transparent 26rem),#fff}.form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.button-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.checkbox-line{display:flex;gap:8px;align-items:center;font-weight:800;margin-top:8px}.warning{color:#9a3412}.summary-pills{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}.summary-pills span{display:inline-flex;border-radius:999px;padding:8px 12px;background:rgba(37,99,235,.1);color:#1d4ed8;font-weight:900}.supplier-import-page-only textarea{min-height:80px}@media(max-width:760px){.button-row{display:grid}}`}</style>}
