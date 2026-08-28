import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  applyBlankSubstitution,
  backfillProductBlankMappings,
  getProductBlankMappingHistory,
  getProductBlankMappingIssues,
  previewBlankSubstitution,
  searchMappingBlanks,
  setProductBlankMapping,
} from './lib/productBlankMappingApi';

function blankLabel(row) {
  if (!row) return '—';
  return [
    row.sku_base || row.name,
    row.brands?.name || row.brand,
    row.product_types?.name || row.style,
    row.colors?.name || row.color,
    row.sizes?.name || row.size,
  ].filter(Boolean).join(' · ');
}

function productLabel(row) {
  return [row.brand, row.style, row.color, row.size].filter(Boolean).join(' / ') || row.product_name || row.sku || 'WooCommerce product';
}

function sourceFor(row) {
  if (row?.woo_variation_id) return { source_kind: 'woocommerce_variation', source_key: String(row.woo_variation_id) };
  return { source_kind: 'woocommerce_sku', source_key: String(row?.sku || '') };
}

function BlankPicker({ title, search, setSearch, rows, selectedId, setSelectedId, loading }) {
  return (
    <div className="pbm-picker">
      <label><strong>{title}</strong><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SKU, brand, style, color, or size" /></label>
      <select size="6" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={loading}>
        <option value="">{loading ? 'Searching…' : 'Select a blank product'}</option>
        {rows.map((row) => <option key={row.id} value={row.id}>{blankLabel(row)}</option>)}
      </select>
    </div>
  );
}

export default function ProductBlankMappings() {
  const [issues, setIssues] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [blankSearch, setBlankSearch] = useState('');
  const [blankRows, setBlankRows] = useState([]);
  const [blankId, setBlankId] = useState('');
  const [oldSearch, setOldSearch] = useState('');
  const [newSearch, setNewSearch] = useState('');
  const [oldRows, setOldRows] = useState([]);
  const [newRows, setNewRows] = useState([]);
  const [oldId, setOldId] = useState('');
  const [newId, setNewId] = useState('');
  const [substitutionNotes, setSubstitutionNotes] = useState('');
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [blankLoading, setBlankLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [issueRows, historyRows] = await Promise.all([
        getProductBlankMappingIssues(search, 500),
        getProductBlankMappingHistory(50),
      ]);
      setIssues(issueRows || []);
      setHistory(historyRows || []);
      if (selected) setSelected((issueRows || []).find((row) => row.product_row_id === selected.product_row_id) || null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  // Initial load only; later mutations call load explicitly so active selections can be preserved.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handle = setTimeout(async () => {
      setBlankLoading(true);
      try { setBlankRows(await searchMappingBlanks(blankSearch, 100)); }
      catch (err) { setError(err.message); }
      finally { setBlankLoading(false); }
    }, 250);
    return () => clearTimeout(handle);
  }, [blankSearch]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        const [oldBlankRows, newBlankRows] = await Promise.all([
          searchMappingBlanks(oldSearch, 100), searchMappingBlanks(newSearch, 100),
        ]);
        setOldRows(oldBlankRows); setNewRows(newBlankRows);
      } catch (err) { setError(err.message); }
    }, 250);
    return () => clearTimeout(handle);
  }, [oldSearch, newSearch]);

  const matched = useMemo(() => issues.filter((row) => row.issue_status === 'matched').length, [issues]);
  const ambiguous = useMemo(() => issues.filter((row) => row.issue_status === 'ambiguous').length, [issues]);

  async function saveMapping(target = selected, explicitBlankId = blankId) {
    if (!target || !explicitBlankId) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const source = sourceFor(target);
      const result = await setProductBlankMapping({
        ...source, blank_product_id: explicitBlankId, mapping_source: 'mapping_lifecycle_review',
        notes: `Reviewed from Product-to-Blank Mappings for ${target.product_name || target.sku || source.source_key}`,
        propagate_unpaired: true,
      });
      setMessage(`Mapping saved. ${result.products_updated || 0} synced product row(s) and ${result.unpaired_lines_repaired || 0} unpaired pull-sheet line(s) repaired.`);
      setSelected(null); setBlankId(''); await load();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function backfill() {
    setLoading(true); setError(''); setMessage('');
    try {
      const result = await backfillProductBlankMappings(10000);
      setMessage(`${result.products_mapped || 0} existing WooCommerce product row(s) mapped; ${result.products_requiring_review || 0} still require review.`);
      await load();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function previewReplacement() {
    if (!oldId || !newId) { setError('Choose both the discontinued blank and its replacement.'); return; }
    setLoading(true); setError(''); setMessage('');
    try { setPreview(await previewBlankSubstitution(oldId, newId)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function applyReplacement() {
    if (!preview) { setError('Preview this substitution before applying it.'); return; }
    const warning = `Redirect future mappings from the old blank to the replacement?\n\n${preview.open_paired_lines || 0} already paired open pull-sheet line(s) will be preserved for separate review.`;
    if (!window.confirm(warning)) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const result = await applyBlankSubstitution(oldId, newId, substitutionNotes);
      setMessage(`Replacement applied: ${result.mappings_updated || 0} mapping(s), ${result.products_updated || 0} product row(s), and ${result.unpaired_lines_repaired || 0} unpaired line(s) updated. ${result.open_paired_lines_preserved || 0} already paired open line(s) were preserved.`);
      setPreview(null); setOldId(''); setNewId(''); setSubstitutionNotes(''); await load();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <main className="page pbm-page">
      <section className="hero-card">
        <p className="eyebrow">Catalog integrity</p>
        <h1>Product-to-Blank Mappings</h1>
        <p>Pair new WooCommerce and Mockup Studio variations, remember the decision for future orders, and safely redirect discontinued blanks.</p>
        <div className="sc-button-row"><button onClick={backfill} disabled={loading}>Run deterministic backfill</button><Link className="secondary-button" to="/bulk-pairing-repair">Review already paired pull sheets</Link></div>
      </section>

      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <section className="panel">
        <div className="pbm-heading"><div><h2>New and unpaired WooCommerce products</h2><p>Only a single exact Brand + Style + Color + Size match is eligible for automatic pairing.</p></div><div><strong>{issues.length}</strong> review · <strong>{matched}</strong> exact · <strong>{ambiguous}</strong> ambiguous</div></div>
        <form className="pbm-search" onSubmit={(event) => { event.preventDefault(); load(); }}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, SKU, brand, style, color, or size" /><button disabled={loading}>Search</button></form>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>Woo IDs</th><th>SKU</th><th>Match state</th><th>Action</th></tr></thead><tbody>
          {issues.map((row) => <tr key={row.product_row_id}><td><strong>{productLabel(row)}</strong><small>{row.product_name}</small></td><td>Product {row.woo_product_id || '—'}<br />Variation {row.woo_variation_id || '—'}</td><td><code>{row.sku || '—'}</code></td><td>{row.issue_status} ({row.candidate_count || 0})</td><td>{row.issue_status === 'matched' && row.deterministic_blank_product_id ? <button onClick={() => saveMapping(row, row.deterministic_blank_product_id)} disabled={loading}>Accept exact match</button> : <button className="secondary" onClick={() => { setSelected(row); setBlankSearch([row.brand, row.style, row.color, row.size].filter(Boolean).join(' ')); }}>Choose blank</button>}</td></tr>)}
          {!issues.length && !loading ? <tr><td colSpan="5">No unmapped WooCommerce product rows were found.</td></tr> : null}
        </tbody></table></div>
      </section>

      {selected ? <section className="panel"><h2>Choose a blank for {productLabel(selected)}</h2><p>This saves both the WooCommerce variation mapping and its SKU mapping when available, and repairs currently unpaired lines.</p><BlankPicker title="Blank product" search={blankSearch} setSearch={setBlankSearch} rows={blankRows} selectedId={blankId} setSelectedId={setBlankId} loading={blankLoading} /><div className="sc-button-row"><button onClick={() => saveMapping()} disabled={!blankId || loading}>Save and remember mapping</button><button className="secondary" onClick={() => setSelected(null)}>Cancel</button></div></section> : null}

      <section className="panel">
        <h2>Replace a discontinued blank</h2>
        <p>The replacement redirects future Woo mappings and product definitions. Existing on-hand inventory, completed history, reservations, and already paired open pull-sheet lines are not silently rewritten.</p>
        <div className="pbm-picker-grid"><BlankPicker title="Discontinued / old blank" search={oldSearch} setSearch={setOldSearch} rows={oldRows} selectedId={oldId} setSelectedId={(value) => { setOldId(value); setPreview(null); }} /><BlankPicker title="Replacement / new blank" search={newSearch} setSearch={setNewSearch} rows={newRows} selectedId={newId} setSelectedId={(value) => { setNewId(value); setPreview(null); }} /></div>
        <label><strong>Reason or vendor note</strong><textarea value={substitutionNotes} onChange={(event) => setSubstitutionNotes(event.target.value)} placeholder="For example: Gildan discontinued this color; replace future orders with equivalent style…" /></label>
        <div className="sc-button-row"><button onClick={previewReplacement} disabled={!oldId || !newId || loading}>Preview replacement</button>{preview ? <button onClick={applyReplacement} disabled={loading}>Apply future mapping replacement</button> : null}</div>
        {preview ? <div className="pbm-preview"><div><strong>{preview.active_mappings || 0}</strong><span>mapping keys</span></div><div><strong>{preview.products || 0}</strong><span>product rows</span></div><div><strong>{preview.finished_products || 0}</strong><span>finished definitions</span></div><div><strong>{preview.open_paired_lines || 0}</strong><span>open paired lines preserved</span></div></div> : null}
      </section>

      <section className="panel"><h2>Recent mapping history</h2><div className="table-scroll"><table className="data-table"><thead><tr><th>When</th><th>Change</th><th>Source key</th><th>Notes</th></tr></thead><tbody>{history.map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString()}</td><td>{row.event_type}</td><td>{row.source_kind || 'blank'} {row.source_key || ''}</td><td>{row.notes || '—'}</td></tr>)}{!history.length ? <tr><td colSpan="4">No mapping history yet.</td></tr> : null}</tbody></table></div></section>
    </main>
  );
}
