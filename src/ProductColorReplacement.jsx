import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  applyWooProductColorAddition,
  applyWooProductColorReplacement,
  cancelProductColorImageUploads,
  inspectWooProductColors,
  previewWooProductColorAddition,
  previewWooProductColorReplacement,
  searchWooProductsForColorReplacement,
  uploadProductColorImage,
} from './lib/productColorReplacementApi';

function n(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString() : '0';
}

export default function ProductColorReplacement() {
  const [mode, setMode] = useState('replace');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [details, setDetails] = useState(null);
  const [oldColor, setOldColor] = useState('');
  const [templateColor, setTemplateColor] = useState('');
  const [newColor, setNewColor] = useState('');
  const [preview, setPreview] = useState(null);
  const [repairOpenPullSheets, setRepairOpenPullSheets] = useState(true);
  const [imageFiles, setImageFiles] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const replacementTerms = useMemo(() => {
    const excluded = (mode === 'replace' ? oldColor : templateColor).trim().toLowerCase();
    return (details?.woo_color_terms || []).filter((row) => row.name?.trim().toLowerCase() !== excluded);
  }, [details, mode, oldColor, templateColor]);

  function resetPreview() {
    setPreview(null);
    setImageFiles({});
  }

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
    setSelectedProduct(row); setDetails(null); setOldColor(''); setTemplateColor(''); setNewColor(''); resetPreview();
    try {
      const result = await inspectWooProductColors(row.id);
      setDetails(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function runPreview() {
    if (!selectedProduct?.id || !newColor) {
      setError('Choose a product and the target color first.');
      return;
    }
    setBusy(true); setError(''); setMessage('Building a guarded preview...');
    try {
      const result = mode === 'replace'
        ? await previewWooProductColorReplacement({ productId: selectedProduct.id, oldColor, newColor })
        : await previewWooProductColorAddition({ productId: selectedProduct.id, templateColor, newColor });
      setPreview(result);
      setImageFiles({});
      setMessage(result.can_apply
        ? (mode === 'replace'
          ? `Ready: ${n(result.affected_variations)} existing variation(s) can be updated in place.`
          : `Ready: ${n(result.variations_to_create)} new variation(s) can be created from the ${result.template_color.name} matrix.`)
        : `Preview found ${n(result.blockers?.length)} blocking issue(s). Nothing has been changed.`);
    } catch (err) {
      setPreview(null);
      setError(err.message);
      setMessage('');
    } finally {
      setBusy(false);
    }
  }

  async function applyReplace() {
    if (!preview?.can_apply) return;
    const typed = window.prompt(
      `Change ${preview.affected_variations} existing variation(s) from "${preview.old_color.name}" `
      + `to "${preview.new_color.name}" while preserving IDs, SKUs, and current images?\n\nType REPLACE COLOR to continue.`
    );
    if (typed !== 'REPLACE COLOR') { setMessage('Color replacement cancelled.'); return; }

    setBusy(true); setError(''); setMessage('Updating WooCommerce variations and durable blank mappings...');
    try {
      const result = await applyWooProductColorReplacement({
        productId: selectedProduct.id,
        oldColor: preview.old_color.name,
        newColor: preview.new_color.name,
        confirmationToken: preview.confirmation_token,
        repairOpenPullSheets,
      });
      setMessage(
        `Completed: ${n(result.variations_updated)} variation(s) updated; `
        + `${n(result.image_assignments_preserved)} image assignment(s) preserved; `
        + `${n(result.open_pull_sheet_lines_repaired)} open pull-sheet line(s) repaired.`
        + ((result.warnings || []).length ? ` Warning: ${result.warnings.join(' | ')}` : '')
      );
      setDetails(await inspectWooProductColors(selectedProduct.id));
      setOldColor(''); setNewColor(''); resetPreview();
    } catch (err) {
      setError(`${err.message} Re-preview the same product before making any manual WooCommerce changes.`);
    } finally {
      setBusy(false);
    }
  }

  async function applyAdd() {
    if (!preview?.can_apply) return;
    const missingImages = (preview.image_slots || []).filter((slot) => !slot.existing_image_id && !imageFiles[slot.key]);
    if (missingImages.length) {
      setError(`Upload an image for: ${missingImages.map((slot) => slot.label).join(', ')}`);
      return;
    }

    const typed = window.prompt(
      `Create ${preview.variations_to_create} new ${preview.new_color.name} variation(s), `
      + `copying the Size × Logo matrix from ${preview.template_color.name}?\n\nType ADD COLOR to continue.`
    );
    if (typed !== 'ADD COLOR') { setMessage('Add-color operation cancelled.'); return; }

    setBusy(true); setError(''); setMessage('Uploading variation images...');
    const uploadedRefs = [];
    try {
      const uploadedImages = [];
      for (const slot of preview.image_slots || []) {
        if (slot.existing_image_id) continue;
        const file = imageFiles[slot.key];
        const reference = await uploadProductColorImage(selectedProduct.id, file);
        uploadedRefs.push(reference);
        uploadedImages.push({ slot_key: slot.key, reference });
      }

      setMessage('Creating WooCommerce variations and durable blank mappings...');
      const result = await applyWooProductColorAddition({
        productId: selectedProduct.id,
        templateColor: preview.template_color.name,
        newColor: preview.new_color.name,
        confirmationToken: preview.confirmation_token,
        uploadedImages,
      });
      setMessage(
        `Completed: ${n(result.variations_created)} new variation(s), `
        + `${n(result.existing_combinations_reconciled)} existing combination(s) verified, `
        + `${n(result.images_uploaded)} new logo image(s), and ${n(result.mappings_saved)} new durable blank mapping(s). `
        + `Run WooCommerce Sync once to populate the newly created variation rows in Supabase.`
        + ((result.warnings || []).length ? ` Warning: ${result.warnings.join(' | ')}` : '')
      );
      setDetails(await inspectWooProductColors(selectedProduct.id));
      setTemplateColor(''); setNewColor(''); resetPreview();
    } catch (err) {
      await cancelProductColorImageUploads(selectedProduct.id, uploadedRefs).catch(() => {});
      setError(`${err.message} Re-preview this product. The add-color workflow is resumable and will only show combinations still missing.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page product-color-replacement-page">
      <section className="hero-card">
        <p className="eyebrow">WooCommerce catalog maintenance</p>
        <h1>Product Color Manager</h1>
        <p>
          Replace an existing product color in place, or add a completely new color by copying an existing
          Size × Logo variation matrix. Blank mappings and WooCommerce variation images are handled in the same workflow.
        </p>
        <div className="sc-button-row">
          <Link className="secondary-button" to="/product-blank-mappings">Product-to-Blank Mappings</Link>
          <Link className="secondary-button" to="/woo-sync">WooCommerce Sync</Link>
        </div>
      </section>

      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <section className="panel">
        <h2>1. Choose workflow</h2>
        <div className="sc-button-row">
          <button type="button" className={mode === 'replace' ? 'primary-action' : 'secondary-action'} onClick={() => { setMode('replace'); resetPreview(); }}>
            Replace existing color
          </button>
          <button type="button" className={mode === 'add' ? 'primary-action' : 'secondary-action'} onClick={() => { setMode('add'); resetPreview(); }}>
            Add new color
          </button>
        </div>
        <p className="muted-text">
          {mode === 'replace'
            ? 'Use this when an existing Woo color is wrong and should become another color while keeping the same variation IDs and images.'
            : 'Use this when the product needs an additional color. Choose an existing color as the template for sizes, logos, pricing, and variation settings.'}
        </p>
      </section>

      <section className="panel">
        <h2>2. Choose WooCommerce product</h2>
        <form className="filter-row" onSubmit={runSearch}>
          <label>
            Product search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product name, SKU, or Woo product ID" />
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
          <h2>3. Configure {mode === 'replace' ? 'replacement' : 'new color'}</h2>
          <p><strong>{details.product.name}</strong> · {n(details.variation_count)} current variations</p>

          <div className="filter-row">
            {mode === 'replace' ? (
              <label>
                Existing color to replace
                <select value={oldColor} onChange={(event) => { setOldColor(event.target.value); resetPreview(); }}>
                  <option value="">Choose existing color</option>
                  {(details.variation_colors || []).map((color) => <option key={color} value={color}>{color}</option>)}
                </select>
              </label>
            ) : (
              <label>
                Template color
                <select value={templateColor} onChange={(event) => { setTemplateColor(event.target.value); resetPreview(); }}>
                  <option value="">Choose color to copy</option>
                  {(details.variation_colors || []).map((color) => <option key={color} value={color}>{color}</option>)}
                </select>
              </label>
            )}

            <label>
              {mode === 'replace' ? 'Replacement color' : 'New color to add'}
              <select value={newColor} onChange={(event) => { setNewColor(event.target.value); resetPreview(); }}>
                <option value="">Choose WooCommerce color</option>
                {replacementTerms.map((row) => <option key={row.id} value={row.name}>{row.name}</option>)}
              </select>
            </label>
          </div>

          {mode === 'add' ? (
            <div className="info-banner">
              The template color supplies the existing Size × Logo combinations and variation-level price/settings.
              The new physical blank is resolved independently for each size. You will upload <strong>one new garment/mockup
              image per Logo combination</strong>; all sizes for that logo reuse that image.
            </div>
          ) : (
            <div className="info-banner">
              Existing variation IDs, SKUs, prices, and images remain attached. Only the Color attribute and physical blank mapping change.
            </div>
          )}

          <button
            type="button"
            onClick={runPreview}
            disabled={busy || !newColor || (mode === 'replace' ? !oldColor : !templateColor)}
          >
            Preview {mode === 'replace' ? 'replacement' : 'new color'}
          </button>
        </section>
      ) : null}

      {preview ? (
        <section className="panel">
          <h2>4. Review preview</h2>
          <div className="summary-grid">
            <div className="metric-card">
              <strong>{n(mode === 'replace' ? preview.affected_variations : preview.variations_to_create)}</strong>
              <span>{mode === 'replace' ? 'variations changing' : 'variations to create'}</span>
            </div>
            <div className="metric-card">
              <strong>{n(mode === 'replace' ? preview.preserved_image_assignments : preview.image_slots?.length)}</strong>
              <span>{mode === 'replace' ? 'images preserved' : 'logo image slots'}</span>
            </div>
            <div className="metric-card">
              <strong>{n(mode === 'replace' ? preview.open_pull_sheet_lines?.length : preview.already_existing_combinations)}</strong>
              <span>{mode === 'replace' ? 'open lines affected' : 'existing combos to verify'}</span>
            </div>
            <div className="metric-card"><strong>{n(preview.blockers?.length)}</strong><span>blocking issues</span></div>
          </div>

          {preview.blockers?.length ? (
            <div className="error-banner"><strong>Do not apply yet.</strong><ul>{preview.blockers.map((row) => <li key={row}>{row}</li>)}</ul></div>
          ) : null}
          {preview.warnings?.length ? <div className="info-banner"><ul>{preview.warnings.map((row) => <li key={row}>{row}</li>)}</ul></div> : null}

          {mode === 'add' && preview.image_slots?.length ? (
            <div>
              <h3>New-color images by Logo combination</h3>
              <p>Upload one product/mockup image for each logo. The same image will be assigned to every size using that logo.</p>
              <div className="card-grid">
                {preview.image_slots.map((slot) => (
                  <div className="card" key={slot.key}>
                    <strong>{slot.label}</strong>
                    {slot.existing_image_id ? (
                      <p>Previously uploaded Woo image #{slot.existing_image_id} will be reused.</p>
                    ) : (
                      <label>
                        Variation image
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(event) => setImageFiles((current) => ({ ...current, [slot.key]: event.target.files?.[0] || null }))}
                        />
                      </label>
                    )}
                    {imageFiles[slot.key] ? <small>{imageFiles[slot.key].name}</small> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {mode === 'replace' ? (
            <label>
              <input type="checkbox" checked={repairOpenPullSheets} onChange={(event) => setRepairOpenPullSheets(event.target.checked)} />
              Repair affected active pull-sheet lines and reservations
            </label>
          ) : null}

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{mode === 'replace' ? 'Variation' : 'Template'}</th>
                  <th>SKU</th>
                  <th>Logo</th>
                  <th>{mode === 'replace' ? 'Current blank' : 'Template blank'}</th>
                  <th>Target blank</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {(preview.rows || []).map((row) => (
                  <tr key={`${row.variation_id || row.template_variation_id}-${row.action || 'replace'}`}>
                    <td>#{row.variation_id || row.template_variation_id}</td>
                    <td><code>{row.sku || row.template_sku || '—'}</code></td>
                    <td>{row.logo || '—'}</td>
                    <td><code>{row.current_blank_sku || row.template_blank_sku || '—'}</code></td>
                    <td><code>{row.target_blank_sku || '—'}</code></td>
                    <td>{row.preview_status === 'ready' ? 'Ready to create' : row.preview_status === 'ready_existing' ? 'Exists — mapping will be verified' : row.issue || row.preview_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sc-button-row">
            <button type="button" onClick={mode === 'replace' ? applyReplace : applyAdd} disabled={busy || !preview.can_apply}>
              {mode === 'replace' ? 'Apply Color Replacement' : 'Add Color and Create Variations'}
            </button>
            <button type="button" className="secondary" onClick={runPreview} disabled={busy}>Refresh Preview</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
