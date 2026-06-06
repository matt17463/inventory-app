import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';

function clean(value) {
  return String(value || '').trim();
}

function normalizeCode(value) {
  return clean(value)
    .toUpperCase()
    .replace(/&/g, 'AND')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function lookupLabel(item) {
  if (!item) return '';
  return item.name || item.code || '';
}

function lookupCode(item) {
  if (!item) return '';
  return item.code || item.name || '';
}

function makeRow(overrides = {}) {
  return {
    rowKey: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    brandId: '',
    productTypeId: '',
    colorId: '',
    sizeId: '',
    binId: '',
    quantity: 1,
    unitCost: '',
    notes: '',
    artworkNote: '',
    blankProductId: '',
    matchStatus: 'not_checked',
    matchMessage: '',
    ...overrides,
  };
}

export default function AddItemToBin() {
  const [bins, setBins] = useState([]);
  const [brands, setBrands] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [blankProducts, setBlankProducts] = useState([]);

  const [defaultBinId, setDefaultBinId] = useState('');
  const [defaultBrandId, setDefaultBrandId] = useState('');
  const [defaultProductTypeId, setDefaultProductTypeId] = useState('');
  const [defaultColorId, setDefaultColorId] = useState('');
  const [defaultNotes, setDefaultNotes] = useState('');
  const [quickSizeText, setQuickSizeText] = useState('L 2\nM 2\nS 2\nXL 2\nXS 2');

  const [rows, setRows] = useState([makeRow()]);
  const [createMissing, setCreateMissing] = useState(true);
  const [updateUnitCost, setUpdateUnitCost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState([]);

  function binLabel(bin) {
    return [bin.bin_code, bin.label, bin.location].filter(Boolean).join(' - ');
  }

  function productLabel(product) {
    const brand = product.brands?.code || product.brands?.name || '';
    const type = product.product_types?.code || product.product_types?.name || '';
    const color = product.colors?.code || product.colors?.name || '';
    const size = product.sizes?.code || product.sizes?.name || '';
    return [product.sku_base, product.name, brand, type, color, size].filter(Boolean).join(' - ');
  }

  function getLookup(list, id) {
    return list.find((item) => String(item.id) === String(id)) || null;
  }

  function buildSkuBase(row) {
    const brand = getLookup(brands, row.brandId);
    const type = getLookup(productTypes, row.productTypeId);
    const color = getLookup(colors, row.colorId);
    const size = getLookup(sizes, row.sizeId);
    const parts = [lookupCode(brand), lookupCode(type), lookupCode(color), lookupCode(size)]
      .filter(Boolean)
      .map(normalizeCode);
    return parts.join('-');
  }

  function buildBlankName(row) {
    const brand = getLookup(brands, row.brandId);
    const type = getLookup(productTypes, row.productTypeId);
    const color = getLookup(colors, row.colorId);
    const size = getLookup(sizes, row.sizeId);
    return [lookupLabel(brand), lookupLabel(type), lookupLabel(color), lookupLabel(size)].filter(Boolean).join(' ');
  }

  function findMatchingBlankProduct(row) {
    return blankProducts.find((product) => (
      String(product.brand_id || '') === String(row.brandId || '') &&
      String(product.product_type_id || '') === String(row.productTypeId || '') &&
      String(product.color_id || '') === String(row.colorId || '') &&
      String(product.size_id || '') === String(row.sizeId || '')
    ));
  }

  async function loadPage() {
    setLoading(true);
    setMessage('');
    try {
      const [binRes, brandRes, colorRes, sizeRes, typeRes, blankRes] = await Promise.all([
        supabase.from('bins').select('id, bin_code, label, location').order('bin_code', { ascending: true }),
        supabase.from('brands').select('id, name, code').order('name', { ascending: true }),
        supabase.from('colors').select('id, name, code').order('name', { ascending: true }),
        supabase.from('sizes').select('id, name, code').order('name', { ascending: true }),
        supabase.from('product_types').select('id, name, code').order('name', { ascending: true }),
        supabase
          .from('blank_products')
          .select(`
            id,
            sku_base,
            name,
            unit_cost,
            image_url,
            brand_id,
            product_type_id,
            color_id,
            size_id,
            brands:brand_id(name, code),
            colors:color_id(name, code),
            sizes:size_id(name, code),
            product_types:product_type_id(name, code)
          `),
      ]);

      for (const response of [binRes, brandRes, colorRes, sizeRes, typeRes, blankRes]) {
        if (response.error) throw response.error;
      }

      setBins(binRes.data || []);
      setBrands(brandRes.data || []);
      setColors(colorRes.data || []);
      setSizes(sizeRes.data || []);
      setProductTypes(typeRes.data || []);
      setBlankProducts(blankRes.data || []);
    } catch (err) {
      setMessage(err.message || 'Failed to load receiving data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  const totals = useMemo(() => {
    const unitCount = rows.reduce((sum, row) => sum + Math.max(0, Number(row.quantity || 0)), 0);
    const costTotal = rows.reduce((sum, row) => {
      const qty = Math.max(0, Number(row.quantity || 0));
      const cost = Number(row.unitCost || 0);
      return sum + (Number.isFinite(cost) ? qty * cost : 0);
    }, 0);
    return { unitCount, costTotal };
  }, [rows]);

  function updateRow(rowKey, patch) {
    setRows((current) => current.map((row) => {
      if (row.rowKey !== rowKey) return row;
      return { ...row, ...patch, matchStatus: 'not_checked', matchMessage: '', blankProductId: patch.blankProductId ?? '' };
    }));
  }

  function addRow(overrides = {}) {
    setRows((current) => [...current, makeRow({
      binId: defaultBinId,
      brandId: defaultBrandId,
      productTypeId: defaultProductTypeId,
      colorId: defaultColorId,
      notes: defaultNotes,
      ...overrides,
    })]);
  }

  function removeRow(rowKey) {
    setRows((current) => current.length === 1 ? current : current.filter((row) => row.rowKey !== rowKey));
  }

  function applyDefaultsToExistingRows() {
    setRows((current) => current.map((row) => ({
      ...row,
      binId: defaultBinId || row.binId,
      brandId: defaultBrandId || row.brandId,
      productTypeId: defaultProductTypeId || row.productTypeId,
      colorId: defaultColorId || row.colorId,
      notes: defaultNotes || row.notes,
      matchStatus: 'not_checked',
      matchMessage: '',
      blankProductId: '',
    })));
  }

  function addQuickSizeRun() {
    const lines = quickSizeText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const newRows = lines.map((line) => {
      const parts = line.split(/[\s,=xX*]+/).filter(Boolean);
      const sizeToken = parts[0] || '';
      const qtyToken = parts[1] || '1';
      const matchedSize = sizes.find((size) => {
        const candidates = [size.name, size.code].map((value) => normalizeCode(value));
        return candidates.includes(normalizeCode(sizeToken));
      });

      return makeRow({
        binId: defaultBinId,
        brandId: defaultBrandId,
        productTypeId: defaultProductTypeId,
        colorId: defaultColorId,
        sizeId: matchedSize?.id || '',
        quantity: Number(qtyToken) > 0 ? Number(qtyToken) : 1,
        notes: defaultNotes,
      });
    });

    if (!newRows.length) {
      setMessage('Enter at least one size/quantity line. Example: XL 2');
      return;
    }

    setRows((current) => {
      const hasOnlyEmptyStarter = current.length === 1 && !current[0].brandId && !current[0].productTypeId && !current[0].colorId && !current[0].sizeId;
      return hasOnlyEmptyStarter ? newRows : [...current, ...newRows];
    });
    setMessage(`Added ${newRows.length} receiving row${newRows.length === 1 ? '' : 's'} from the size run.`);
  }

  function checkMatches() {
    setRows((current) => current.map((row) => {
      if (!row.brandId || !row.productTypeId || !row.colorId || !row.sizeId) {
        return { ...row, matchStatus: 'incomplete', matchMessage: 'Choose brand, style, color, and size.' };
      }
      const match = findMatchingBlankProduct(row);
      if (match) {
        return { ...row, blankProductId: match.id, matchStatus: 'matched', matchMessage: productLabel(match) };
      }
      return {
        ...row,
        blankProductId: '',
        matchStatus: createMissing ? 'will_create' : 'missing',
        matchMessage: createMissing ? `Will create ${buildSkuBase(row)}` : 'No blank product exists for this combination.',
      };
    }));
  }

  async function createBlankProductForRow(row) {
    const payload = {
      sku_base: buildSkuBase(row),
      name: buildBlankName(row),
      brand_id: row.brandId || null,
      product_type_id: row.productTypeId || null,
      color_id: row.colorId || null,
      size_id: row.sizeId || null,
    };

    const { data, error } = await supabase
      .from('blank_products')
      .upsert(payload, { onConflict: 'sku_base' })
      .select(`
        id,
        sku_base,
        name,
        unit_cost,
        image_url,
        brand_id,
        product_type_id,
        color_id,
        size_id,
        brands:brand_id(name, code),
        colors:color_id(name, code),
        sizes:size_id(name, code),
        product_types:product_type_id(name, code)
      `)
      .single();

    if (error) throw error;
    setBlankProducts((current) => {
      const exists = current.some((item) => String(item.id) === String(data.id));
      return exists ? current.map((item) => String(item.id) === String(data.id) ? data : item) : [...current, data];
    });
    return data;
  }

  async function receiveRows(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setResults([]);

    const output = [];
    try {
      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 1;
        try {
          if (!row.binId) throw new Error('Choose a bin.');
          if (!row.brandId || !row.productTypeId || !row.colorId || !row.sizeId) throw new Error('Choose brand, style, color, and size.');
          if (!Number(row.quantity) || Number(row.quantity) <= 0) throw new Error('Quantity must be greater than zero.');

          let blankProduct = findMatchingBlankProduct(row);
          let created = false;

          if (!blankProduct) {
            if (!createMissing) throw new Error('No matching blank product exists. Enable create missing blank products or add it first.');
            blankProduct = await createBlankProductForRow(row);
            created = true;
          }

          const combinedNotes = [
            row.notes || defaultNotes,
            row.artworkNote ? `Artwork note: ${row.artworkNote}` : '',
            `Batch receiving row ${rowNumber}`,
          ].filter(Boolean).join('\n');

          const { error: receiveError } = await supabase.rpc('receive_blank_inventory', {
            p_bin_id: Number(row.binId),
            p_blank_product_id: blankProduct.id,
            p_quantity: Number(row.quantity),
            p_notes: combinedNotes || null,
          });
          if (receiveError) throw receiveError;

          if (updateUnitCost && clean(row.unitCost)) {
            const { error: costError } = await supabase
              .from('blank_products')
              .update({ unit_cost: Number(row.unitCost) })
              .eq('id', blankProduct.id);
            if (costError) {
              output.push({ rowNumber, status: 'warning', input: buildBlankName(row), result: `Received, but unit cost was not updated: ${costError.message}` });
            }
          }

          output.push({
            rowNumber,
            status: 'received',
            input: buildBlankName(row),
            result: `${created ? 'Created blank product and received' : 'Received'} ${row.quantity} unit(s) into bin.`,
          });
        } catch (err) {
          output.push({ rowNumber, status: 'error', input: buildBlankName(row) || `Row ${rowNumber}`, result: err.message || 'Failed.' });
        }
      }

      setResults(output);
      const received = output.filter((item) => item.status === 'received' || item.status === 'warning').length;
      const failed = output.filter((item) => item.status === 'error').length;
      setMessage(`Batch complete. ${received} row${received === 1 ? '' : 's'} received. ${failed} row${failed === 1 ? '' : 's'} failed.`);
      if (!failed) {
        setRows([makeRow({ binId: defaultBinId, brandId: defaultBrandId, productTypeId: defaultProductTypeId, colorId: defaultColorId, notes: defaultNotes })]);
      }
      await loadPage();
    } finally {
      setLoading(false);
    }
  }

  function statusClass(status) {
    if (status === 'matched' || status === 'received') return 'ok';
    if (status === 'will_create' || status === 'warning') return 'warn';
    if (status === 'missing' || status === 'incomplete' || status === 'error') return 'bad';
    return '';
  }

  return (
    <main className="page bulk-receive-page">
      <div className="page-header-row">
        <div>
          <p className="eyebrow">Warehouse Receiving</p>
          <h1>Add Blank Items to Bin</h1>
          <p className="helper-text">Receive one item, a full size run, or a supplier order group without entering each product on a separate page.</p>
        </div>
        <button type="button" onClick={loadPage} disabled={loading}>Refresh Data</button>
      </div>

      {message && <p className="message">{message}</p>}

      <section className="card bulk-defaults-card">
        <h2>Order / Group Defaults</h2>
        <p className="helper-text">Use this section for supplier-order groups like one brand/style/color with several sizes.</p>
        <div className="bulk-grid four">
          <label>
            Default Bin
            <select value={defaultBinId} onChange={(event) => setDefaultBinId(event.target.value)}>
              <option value="">Choose bin...</option>
              {bins.map((bin) => <option key={bin.id} value={bin.id}>{binLabel(bin)}</option>)}
            </select>
          </label>
          <label>
            Brand
            <select value={defaultBrandId} onChange={(event) => setDefaultBrandId(event.target.value)}>
              <option value="">Choose brand...</option>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          </label>
          <label>
            Style / Product Type
            <select value={defaultProductTypeId} onChange={(event) => setDefaultProductTypeId(event.target.value)}>
              <option value="">Choose style...</option>
              {productTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </label>
          <label>
            Color
            <select value={defaultColorId} onChange={(event) => setDefaultColorId(event.target.value)}>
              <option value="">Choose color...</option>
              {colors.map((color) => <option key={color.id} value={color.id}>{color.name}</option>)}
            </select>
          </label>
        </div>
        <label>
          Default Notes
          <textarea value={defaultNotes} onChange={(event) => setDefaultNotes(event.target.value)} placeholder="Supplier order number, receiving note, invoice reference, etc." />
        </label>
        <div className="bulk-actions-row">
          <button type="button" onClick={applyDefaultsToExistingRows}>Apply Defaults to Rows</button>
          <button type="button" onClick={() => addRow()}>+ Add Line</button>
          <button type="button" onClick={checkMatches}>Check Matches</button>
        </div>
      </section>

      <section className="card quick-size-card">
        <h2>Quick Size Run</h2>
        <p className="helper-text">Paste one size and quantity per line, then add rows. Example: <code>XL 2</code></p>
        <div className="bulk-grid two">
          <textarea value={quickSizeText} onChange={(event) => setQuickSizeText(event.target.value)} rows={6} />
          <div className="quick-size-help">
            <p><strong>Current group:</strong></p>
            <p>{lookupLabel(getLookup(brands, defaultBrandId)) || 'No brand'} / {lookupLabel(getLookup(productTypes, defaultProductTypeId)) || 'No style'} / {lookupLabel(getLookup(colors, defaultColorId)) || 'No color'}</p>
            <button type="button" onClick={addQuickSizeRun}>Add Size Run Rows</button>
          </div>
        </div>
      </section>

      <form onSubmit={receiveRows} className="card bulk-lines-card">
        <div className="bulk-lines-header">
          <div>
            <h2>Receiving Lines</h2>
            <p className="helper-text">Rows can use different bins, brands, styles, colors, sizes, quantities, and artwork/receiving notes.</p>
          </div>
          <div className="bulk-summary-pill">
            <strong>{rows.length}</strong> rows · <strong>{totals.unitCount}</strong> units · <strong>${totals.costTotal.toFixed(2)}</strong> cost
          </div>
        </div>

        <div className="bulk-options">
          <label><input type="checkbox" checked={createMissing} onChange={(event) => setCreateMissing(event.target.checked)} /> Create missing blank products automatically</label>
          <label><input type="checkbox" checked={updateUnitCost} onChange={(event) => setUpdateUnitCost(event.target.checked)} /> Update blank product unit cost from line price</label>
        </div>

        <div className="bulk-table-wrap">
          <table className="bulk-receive-table">
            <thead>
              <tr>
                <th>Bin</th>
                <th>Brand</th>
                <th>Style</th>
                <th>Color</th>
                <th>Size</th>
                <th>Qty</th>
                <th>Unit Cost</th>
                <th>Artwork / Notes</th>
                <th>Match</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.rowKey}>
                  <td>
                    <select value={row.binId} onChange={(event) => updateRow(row.rowKey, { binId: event.target.value })} required>
                      <option value="">Bin...</option>
                      {bins.map((bin) => <option key={bin.id} value={bin.id}>{binLabel(bin)}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={row.brandId} onChange={(event) => updateRow(row.rowKey, { brandId: event.target.value })} required>
                      <option value="">Brand...</option>
                      {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={row.productTypeId} onChange={(event) => updateRow(row.rowKey, { productTypeId: event.target.value })} required>
                      <option value="">Style...</option>
                      {productTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={row.colorId} onChange={(event) => updateRow(row.rowKey, { colorId: event.target.value })} required>
                      <option value="">Color...</option>
                      {colors.map((color) => <option key={color.id} value={color.id}>{color.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={row.sizeId} onChange={(event) => updateRow(row.rowKey, { sizeId: event.target.value })} required>
                      <option value="">Size...</option>
                      {sizes.map((size) => <option key={size.id} value={size.id}>{size.name}</option>)}
                    </select>
                  </td>
                  <td><input type="number" min="1" value={row.quantity} onChange={(event) => updateRow(row.rowKey, { quantity: event.target.value })} required /></td>
                  <td><input type="number" min="0" step="0.01" value={row.unitCost} onChange={(event) => updateRow(row.rowKey, { unitCost: event.target.value })} placeholder="0.00" /></td>
                  <td>
                    <input value={row.artworkNote} onChange={(event) => updateRow(row.rowKey, { artworkNote: event.target.value })} placeholder="Artwork note" />
                    <input value={row.notes} onChange={(event) => updateRow(row.rowKey, { notes: event.target.value })} placeholder="Line note" />
                  </td>
                  <td>
                    <span className={`bulk-status ${statusClass(row.matchStatus)}`}>{row.matchStatus.replace(/_/g, ' ')}</span>
                    {row.matchMessage && <small>{row.matchMessage}</small>}
                    {row.matchStatus === 'not_checked' && <small>{buildSkuBase(row) || `Line ${index + 1}`}</small>}
                  </td>
                  <td><button type="button" className="danger-light" onClick={() => removeRow(row.rowKey)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bulk-actions-row end">
          <button type="button" onClick={() => addRow()}>+ Add Another Line</button>
          <button type="button" onClick={checkMatches}>Check Matches</button>
          <button type="submit" disabled={loading}>{loading ? 'Receiving...' : 'Receive All Lines'}</button>
        </div>
      </form>

      {results.length > 0 && (
        <section className="card">
          <h2>Batch Results</h2>
          <table className="bulk-receive-table results-table">
            <thead><tr><th>Row</th><th>Status</th><th>Input</th><th>Result</th></tr></thead>
            <tbody>
              {results.map((result) => (
                <tr key={`${result.rowNumber}-${result.status}`}>
                  <td>{result.rowNumber}</td>
                  <td><span className={`bulk-status ${statusClass(result.status)}`}>{result.status}</span></td>
                  <td>{result.input}</td>
                  <td>{result.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
