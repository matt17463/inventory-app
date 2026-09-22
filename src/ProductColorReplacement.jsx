import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  applyWooProductColorReplacement,
  inspectWooProductColors,
  previewWooProductColorReplacement,
  searchWooProductsForColorReplacement,
} from './lib/productColorReplacementApi';

function n(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString() : '0';
}

function productLabel(row) {
  return [row?.name, row?.sku ? `SKU ${row.sku}` : '', row?.id ? `#${row.id}` : ''].filter(Boolean).join(' · ');
}

export default function ProductColorReplacement() {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [details, setDetails] = useState(null);
  const [oldColor, setOldColor] = useState('');
  const [newColor, setNewColor] = useState('');
  const [preview, setPreview] = useState(null);
  const [repairOpenPullSheets, setRepairOpenPullSheets] = useState(true);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const replacementTerms = useMemo(() => {
    const oldNormalized = oldColor.trim().toLowerCase();
    return (details?.woo_color_terms || []).filter((row) => row.name?.trim().toLowerCase() !== oldNormalized);
  }, [details, oldColor]);

  async function runSearch(event) {
    event?.preventDefault();
    if (!search.trim()) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const rows = await searchWooProductsForColorReplacement(search);
      setProducts(rows);
      if (!rows.length) setMessage('No WooCommerce products matched that search.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function chooseProduct(row) {
    setBusy(true); setError(''); setMessage('');
    setSelectedProduct(row); setDetails(null); setPreview(null); setOldColor(''); setNewColor('');
    try {
      const result = await inspectWooProductColors(row.id);
      setDetails(result);
      const colors = result.variation_colors || result.parent_color_options || [];
      if (colors.length === 1) setOldColor(colors[0]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function runPreview() {
    if (!selectedProduct?.id || !oldColor || !newColor) {
      setError('Choose a product, the existing color, and the replacement color first.');
      return;
    }
    setBusy(true); setError(''); setMessage('Building a guarded preview...');
    try {
      const result = await previewWooProductColorReplacement({
        productId: selectedProduct.id,
        oldColor,
        newColor,
      });
      setPreview(result);
      setMessage(result.can_apply
        ? `Ready: ${n(result.affected_variations)} existing variation(s) can be updated in place.`
        : `Preview found ${n(result.blockers?.length)} blocking issue(s). Nothing has been changed.`);
    } catch (err) {
      setPreview(null);
      setError(err.message);
      setMessage('');
    } finally {
      setBusy(false);
    }
  }

  async function applyReplacement() {
    if (!preview?.can_apply) {
      setError('Preview must pass before the replacement can be applied.');
      return;
    }
    const typed = window.prompt(
      `This will change ${preview.affected_variations} existing WooCommerce variation(s) from `
      + `"${preview.old_color.name}" to "${preview.new_color.name}" while preserving their IDs, SKUs, and current variation images.\n\n`
      + 'Type REPLACE COLOR to continue.',
    );
    if (typed !== 'REPLACE COLOR') {
      setMessage('Color replacement cancelled.');
      return;
    }

    setBusy(true); setError(''); setMessage('Updating WooCommerce variations and durable blank mappings...');
    try {
      const result = await applyWooProductColorReplacement({
        productId: selectedProduct.id,
        oldColor: preview.old_color.name,
        newColor: preview.new_color.name,
        confirmationToken: preview.confirmation_token,
        repairOpenPullSheets,
        reason,
      });
      const warningText = (result.warnings || []).length
        ? ` Warning: ${result.warnings.join(' | ')}`
        : '';
      setMessage(
        `Completed: ${n(result.variations_updated)} variation(s) updated in place; `
        + `${n(result.image_assignments_preserved)} image assignment(s) preserved; `
        + `${n(result.open_pull_sheet_lines_repaired)} open pull-sheet line(s) repaired.`
        + warningText
      );
      const refreshed = await inspectWooProductColors(selectedProduct.id);
      setDetails(refreshed);
      setPreview(null);
      setOldColor('');
      setNewColor('');
    } catch (err) {
      setError(
        `${err.message} If WooCommerce stopped partway through, do not recreate variations manually. `
        + 'Preview the same product again; the tool is designed to resume from the remaining old-color variations.'
      );
      setMessage('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page product-color-replacement-page">
      <section className="hero-card">
        <p className="eyebrow">WooCommerce catalog maintenance</p>
        <h1>Replace Product Color</h1>
        <p>
          Change one existing WooCommerce color to another across every matching variation without rebuilding the product.
          Existing Woo variation IDs, SKUs, prices, logo selections, sizes, and variation image assignments are preserved.
        </p>
        <div className="sc-button-row">
          <Link className="secondary-button" to="/product-blank-mappings">Product-to-Blank Mappings</Link>
          <Link className="secondary-button" to="/color-pairings">Color Pairings</Link>
        </div>
      </section>

      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <section className="panel">
        <h2>1. Choose the existing WooCommerce product</h2>
        <p>Search by product name, parent SKU, or WooCommerce product ID.</p>
        <form className="filter-row" onSubmit={runSearch}>
          <label>
            Product search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="EPO ES Gildan Tee, SKU, or product ID"
            />
          </label>
          <button type="submit" disabled={busy || !search.trim()}>Search WooCommerce</button>
        </form>

        {products.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Product</th><th>Status</th><th>Type</th><th>Action</th></tr></thead>
              <tbody>
                {products.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.name}</strong><br /><small>{row.sku || 'No parent SKU'} · Woo #{row.id}</small></td>
                    <td>{row.status || '—'}</td>
                    <td>{row.type || '—'}</td>
                    <td><button type="button" onClick={() => chooseProduct(row)} disabled={busy}>Select</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {selectedProduct && details ? (
        <section className="panel">
          <h2>2. Choose the color replacement</h2>
          <p><strong>{productLabel(selectedProduct)}</strong> · {n(details.variation_count)} total WooCommerce variations</p>
          <div className="filter-row">
            <label>
              Existing color on this product
              <select value={oldColor} onChange={(event) => { setOldColor(event.target.value); setPreview(null); }}>
                <option value="">Choose existing color</option>
                {(details.variation_colors || []).map((color) => <option key={color} value={color}>{color}</option>)}
              </select>
            </label>
            <label>
              Replacement WooCommerce color
              <select value={newColor} onChange={(event) => { setNewColor(event.target.value); setPreview(null); }}>
                <option value="">Choose replacement color</option>
                {replacementTerms.map((row) => <option key={row.id} value={row.name}>{row.name}</option>)}
              </select>
            </label>
          </div>

          <div className="info-banner">
            <strong>Variation images stay attached automatically.</strong> The tool updates each existing variation ID in place
            and deliberately does not send a new image or SKU to WooCommerce. The image already assigned to that size/logo
            variation therefore remains assigned after its color changes.
          </div>

          <label>
            Reason / note
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Example: EPO products sold as Sport Grey are fulfilled with Gildan Heather Dark Grey."
            />
          </label>

          <div className="sc-button-row">
            <button type="button" onClick={runPreview} disabled={busy || !oldColor || !newColor}>Preview replacement</button>
          </div>
        </section>
      ) : null}

      {preview ? (
        <section className="panel">
          <h2>3. Review before applying</h2>
          <div className="summary-grid">
            <div className="metric-card"><strong>{n(preview.affected_variations)}</strong><span>variations changing</span></div>
            <div className="metric-card"><strong>{n(preview.preserved_image_assignments)}</strong><span>images preserved</span></div>
            <div className="metric-card"><strong>{n(preview.open_pull_sheet_lines?.length)}</strong><span>open lines affected</span></div>
            <div className="metric-card"><strong>{n(preview.blockers?.length)}</strong><span>blocking issues</span></div>
          </div>

          {preview.blockers?.length ? (
            <div className="error-banner">
              <strong>Do not apply yet.</strong>
              <ul>{preview.blockers.map((row) => <li key={row}>{row}</li>)}</ul>
            </div>
          ) : null}

          {preview.warnings?.length ? (
            <div className="info-banner">
              <ul>{preview.warnings.map((row) => <li key={row}>{row}</li>)}</ul>
            </div>
          ) : null}

          <label>
            <input
              type="checkbox"
              checked={repairOpenPullSheets}
              onChange={(event) => setRepairOpenPullSheets(event.target.checked)}
            />
            Repair affected active pull-sheet lines and reservations after the WooCommerce update
          </label>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Variation</th><th>SKU</th><th>Color</th><th>Current blank</th><th>Replacement blank</th><th>Image</th><th>State</th></tr>
              </thead>
              <tbody>
                {(preview.rows || []).map((row) => (
                  <tr key={row.variation_id}>
                    <td>#{row.variation_id}</td>
                    <td><code>{row.sku || '—'}</code></td>
                    <td>{row.old_color} → <strong>{row.new_color}</strong></td>
                    <td><code>{row.current_blank_sku || '—'}</code></td>
                    <td><code>{row.target_blank_sku || '—'}</code></td>
                    <td>{row.image_id ? `Preserve #${row.image_id}` : 'No variation image'}</td>
                    <td>{row.preview_status === 'ready' ? 'Ready' : row.issue || row.preview_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.open_pull_sheet_lines?.length ? (
            <>
              <h3>Active pull-sheet lines</h3>
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Pull sheet</th><th>Line</th><th>Order</th><th>Variation</th><th>Qty</th><th>New blank</th></tr></thead>
                  <tbody>
                    {preview.open_pull_sheet_lines.map((row) => (
                      <tr key={row.job_item_id}>
                        <td>#{row.job_id}</td>
                        <td>{row.job_item_id}</td>
                        <td>{row.order_id || '—'}</td>
                        <td>{row.variation_id}</td>
                        <td>{row.quantity}</td>
                        <td><code>{row.target_blank_sku || '—'}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <div className="sc-button-row">
            <button type="button" onClick={applyReplacement} disabled={busy || !preview.can_apply}>Apply Color Replacement</button>
            <button type="button" className="secondary" onClick={runPreview} disabled={busy}>Refresh Preview</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
