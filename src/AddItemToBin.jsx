import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';

const lineTemplate = {
  brand_id: '',
  product_type_id: '',
  color_id: '',
  size_id: '',
  quantity: '',
  unit_cost: '',
  bin_id: '',
  notes: '',
};

function normalizeBin(row) {
  if (!row) return null;
  const id = row.id == null ? '' : String(row.id);
  const code = row.bin_code || row.code || row.name || row.label || id;
  const label = row.label || row.name || row.title || code;
  const location = row.location || row.area || row.zone || '';
  const display_name = row.display_name || [code, label !== code ? label : '', location].filter(Boolean).join(' · ');
  return { ...row, id, bin_code: code, label, location, display_name };
}

function normalizeLookup(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id == null ? '' : String(row.id),
    name: row.name || row.label || row.title || row.code || row.id,
    code: row.code || row.slug || '',
  };
}

async function loadBins() {
  const rpc = await supabase.rpc('sc_receiving_bins');
  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data.map(normalizeBin).filter((b) => b?.id);
  }

  const direct = await supabase.from('bins').select('*');
  if (direct.error) throw new Error(`Could not load bins: ${direct.error.message}`);
  return (direct.data || []).map(normalizeBin).filter((b) => b?.id).sort((a, b) => a.display_name.localeCompare(b.display_name));
}

async function loadLookupTable(tableName) {
  const res = await supabase.from(tableName).select('*');
  if (res.error) throw new Error(`Could not load ${tableName}: ${res.error.message}`);
  return (res.data || []).map(normalizeLookup).filter((x) => x?.id).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export default function AddItemToBin() {
  const [lookups, setLookups] = useState({ brands: [], product_types: [], colors: [], sizes: [], bins: [] });
  const [defaults, setDefaults] = useState({ brand_id: '', product_type_id: '', color_id: '', bin_id: '', supplier: '', po_number: '', notes: '' });
  const [lines, setLines] = useState([{ ...lineTemplate }]);
  const [paste, setPaste] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadAllLookups() {
    setLoading(true);
    setMessage('');
    try {
      const [brands, productTypes, colors, sizes, bins] = await Promise.all([
        loadLookupTable('brands'),
        loadLookupTable('product_types'),
        loadLookupTable('colors'),
        loadLookupTable('sizes'),
        loadBins(),
      ]);
      setLookups({ brands, product_types: productTypes, colors, sizes, bins });
      if (!bins.length) setMessage('No bins were found. Add bins on the Bins page or check Supabase RLS/read access for the bins table.');
    } catch (err) {
      setMessage(err.message || 'Could not load receiving options.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllLookups();
  }, []);

  const mergedLines = useMemo(() => lines.map((l) => ({
    ...l,
    brand_id: l.brand_id || defaults.brand_id,
    product_type_id: l.product_type_id || defaults.product_type_id,
    color_id: l.color_id || defaults.color_id,
    bin_id: l.bin_id || defaults.bin_id,
  })), [lines, defaults]);

  const lookupName = (list, id) => list.find((x) => String(x.id) === String(id))?.name || '';
  const missing = (line) => ['bin_id', 'brand_id', 'product_type_id', 'color_id', 'size_id', 'quantity'].filter((k) => !line[k] || (k === 'quantity' && Number(line[k]) <= 0));

  function updateLine(index, patch) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function parseSizeRun() {
    const parsed = paste
      .split(/\n|,/)
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => {
        const parts = row.split(/\s+/);
        const qty = parts.pop();
        const sizeText = parts.join(' ');
        const size = lookups.sizes.find((s) => [s.name, s.code].filter(Boolean).map((x) => String(x).toUpperCase()).includes(sizeText.toUpperCase()));
        return {
          ...lineTemplate,
          size_id: size?.id || '',
          quantity: Number(qty) || '',
          notes: size ? '' : `Review size: ${sizeText}`,
        };
      });
    if (parsed.length) setLines(parsed);
  }

  async function findBlank(line) {
    const { data, error } = await supabase
      .from('blank_products')
      .select('id,sku_base,name')
      .eq('brand_id', line.brand_id)
      .eq('product_type_id', line.product_type_id)
      .eq('color_id', line.color_id)
      .eq('size_id', line.size_id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function saveAll() {
    setSaving(true);
    setMessage('');
    const valid = mergedLines.filter((line) => missing(line).length === 0);

    if (!valid.length) {
      setMessage('No complete receiving rows are ready to save. Choose a bin and complete brand, style, color, size, and quantity.');
      setSaving(false);
      return;
    }

    let saved = 0;
    const errors = [];

    for (const line of valid) {
      try {
        const blank = await findBlank(line);
        if (!blank?.id) {
          errors.push(`No blank product match for ${lookupName(lookups.brands, line.brand_id)} / ${lookupName(lookups.product_types, line.product_type_id)} / ${lookupName(lookups.colors, line.color_id)} / ${lookupName(lookups.sizes, line.size_id)}`);
          continue;
        }

        const note = [
          defaults.supplier && `Supplier: ${defaults.supplier}`,
          defaults.po_number && `PO: ${defaults.po_number}`,
          defaults.notes,
          line.notes,
        ].filter(Boolean).join(' | ');

        const rpc = await supabase.rpc('receive_blank_inventory', {
          p_blank_product_id: blank.id,
          p_bin_id: line.bin_id,
          p_quantity: Number(line.quantity),
          p_notes: note || null,
          p_unit_cost: line.unit_cost === '' ? null : Number(line.unit_cost),
        });

        if (rpc.error) {
          const fallback = await supabase.from('blank_inventory_movements').insert({
            blank_product_id: blank.id,
            bin_id: line.bin_id,
            quantity: Number(line.quantity),
            movement_type: 'receive',
            notes: note || null,
          });
          if (fallback.error) errors.push(fallback.error.message);
          else saved += 1;
        } else {
          saved += 1;
        }
      } catch (err) {
        errors.push(err.message || String(err));
      }
    }

    setMessage(`${saved} receiving row(s) saved.${errors.length ? ` Issues: ${errors.slice(0, 3).join('; ')}` : ''}`);
    setSaving(false);
  }

  const select = (value, onChange, list, placeholder, type = 'lookup') => (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {list.map((x) => (
        <option key={x.id} value={x.id}>
          {type === 'bin' ? (x.display_name || x.label || x.bin_code || x.id) : (x.name || x.label || x.code || x.id)}
        </option>
      ))}
    </select>
  );

  return (
    <div className="sc-page-stack add-bin-page">
      <div className="sc-page-header-card">
        <div>
          <div className="sc-kicker">Receiving</div>
          <h2>Add Blank Items to Bin</h2>
          <p>Receive one blank item or a full size run into inventory. Set defaults once, then enter size and quantity rows.</p>
        </div>
        <button className="sc-btn" onClick={loadAllLookups} disabled={loading}>{loading ? 'Loading...' : 'Refresh Lists'}</button>
      </div>

      {message && <div className="sc-alert">{message}</div>}

      <section className="sc-panel">
        <div className="sc-panel-header">
          <div>
            <h3>Receiving Defaults</h3>
            <p>Choose the default bin, brand, style, and color. Lines can still override these values.</p>
          </div>
        </div>
        <div className="sc-form-grid">
          <label className="sc-field"><span>Supplier</span><input value={defaults.supplier} onChange={(e) => setDefaults({ ...defaults, supplier: e.target.value })} /></label>
          <label className="sc-field"><span>PO / Order Number</span><input value={defaults.po_number} onChange={(e) => setDefaults({ ...defaults, po_number: e.target.value })} /></label>
          <label className="sc-field"><span>Default Bin</span>{select(defaults.bin_id, (v) => setDefaults({ ...defaults, bin_id: v }), lookups.bins, loading ? 'Loading bins...' : 'Choose bin', 'bin')}</label>
          <label className="sc-field"><span>Default Brand</span>{select(defaults.brand_id, (v) => setDefaults({ ...defaults, brand_id: v }), lookups.brands, 'Choose brand')}</label>
          <label className="sc-field"><span>Default Style</span>{select(defaults.product_type_id, (v) => setDefaults({ ...defaults, product_type_id: v }), lookups.product_types, 'Choose style')}</label>
          <label className="sc-field"><span>Default Color</span>{select(defaults.color_id, (v) => setDefaults({ ...defaults, color_id: v }), lookups.colors, 'Choose color')}</label>
          <label className="sc-field sc-field-wide"><span>Receiving Notes</span><input value={defaults.notes} onChange={(e) => setDefaults({ ...defaults, notes: e.target.value })} /></label>
        </div>
      </section>

      <section className="sc-panel">
        <div className="sc-panel-header">
          <div><h3>Paste Size Run</h3><p>Example: L 2, M 2, S 2, XL 2, XS 2. One line per size also works.</p></div>
          <button className="sc-btn" onClick={parseSizeRun}>Parse Size Run</button>
        </div>
        <textarea className="sc-textarea" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'L 2\nM 2\nS 2\nXL 2\nXS 2'} />
      </section>

      <section className="sc-panel">
        <div className="sc-panel-header">
          <div><h3>Receiving Lines</h3><p>Each complete line will be received into the selected bin.</p></div>
          <button className="sc-btn" onClick={() => setLines([...lines, { ...lineTemplate }])}>Add Line</button>
        </div>

        <div className="sc-receiving-lines">
          {mergedLines.map((line, index) => {
            const missingFields = missing(line);
            return (
              <article className="sc-receiving-card" key={index}>
                <div className="sc-card-title-row">
                  <strong>Line {index + 1}</strong>
                  <span className={`sc-badge ${missingFields.length ? 'warning' : 'success'}`}>{missingFields.length ? `Missing: ${missingFields.join(', ')}` : 'Ready'}</span>
                </div>
                <div className="sc-form-grid compact">
                  <label className="sc-field"><span>Bin</span>{select(line.bin_id, (v) => updateLine(index, { bin_id: v }), lookups.bins, defaults.bin_id ? 'Using default bin' : 'Choose bin', 'bin')}</label>
                  <label className="sc-field"><span>Brand</span>{select(line.brand_id, (v) => updateLine(index, { brand_id: v }), lookups.brands, 'Default / choose')}</label>
                  <label className="sc-field"><span>Style</span>{select(line.product_type_id, (v) => updateLine(index, { product_type_id: v }), lookups.product_types, 'Default / choose')}</label>
                  <label className="sc-field"><span>Color</span>{select(line.color_id, (v) => updateLine(index, { color_id: v }), lookups.colors, 'Default / choose')}</label>
                  <label className="sc-field"><span>Size</span>{select(line.size_id, (v) => updateLine(index, { size_id: v }), lookups.sizes, 'Choose size')}</label>
                  <label className="sc-field"><span>Quantity</span><input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} /></label>
                  <label className="sc-field"><span>Unit Cost</span><input type="number" step="0.01" min="0" value={line.unit_cost} onChange={(e) => updateLine(index, { unit_cost: e.target.value })} /></label>
                  <label className="sc-field"><span>Line Note</span><input value={line.notes} onChange={(e) => updateLine(index, { notes: e.target.value })} /></label>
                </div>
                <div className="sc-receiving-line-actions">
                  <button className="sc-btn sc-btn-danger sc-btn-small" onClick={() => setLines(lines.filter((_, i) => i !== index))} disabled={lines.length === 1}>Remove Line</button>
                </div>
              </article>
            );
          })}
        </div>
        <div className="sc-form-actions"><button className="sc-btn sc-btn-primary" onClick={saveAll} disabled={saving || loading}>{saving ? 'Saving...' : 'Receive All Complete Lines'}</button></div>
      </section>
    </div>
  );
}
