import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import SupplierConfirmationReceiving from './SupplierConfirmationReceiving';
import { createBlankProduct, updateBlankProduct } from './lib/inventoryApi';
import { requireUnitCost } from './lib/unitCost';

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

function normalizeId(value) {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text || ['undefined', 'null', 'blank_product_id', 'bin_id'].includes(text.toLowerCase())) return '';
  return text;
}

function dbId(value) {
  const text = normalizeId(value);
  if (!text) return null;
  return /^\d+$/.test(text) ? Number(text) : text;
}

function skuPiece(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/&/g, 'AND')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeBin(row) {
  if (!row) return null;
  const id = normalizeId(row.id);
  const code = row.bin_code || row.code || row.name || row.label || id;
  const label = row.label || row.name || row.title || code;
  const location = row.location || row.area || row.zone || '';
  const display_name = row.display_name || [code, label !== code ? label : '', location].filter(Boolean).join(' · ');
  return { ...row, id, bin_code: code, label, location, display_name };
}

function normalizeLookup(row) {
  if (!row) return null;
  const id = normalizeId(row.id);
  return {
    ...row,
    id,
    name: row.name || row.label || row.title || row.code || id,
    code: row.code || row.slug || '',
  };
}

async function loadBins() {
  const rpc = await supabase.rpc('sc_receiving_bins_v4');
  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data.map(normalizeBin).filter((b) => b?.id);
  }

  const direct = await supabase.from('bins').select('*');
  if (direct.error) throw new Error(`Could not load bins: ${direct.error.message}. Run receiving_malformed_array_v4_fix.sql and confirm sc_receiving_bins_v4() works.`);
  return (direct.data || []).map(normalizeBin).filter((b) => b?.id).sort((a, b) => a.display_name.localeCompare(b.display_name));
}

async function loadLookupTable(tableName) {
  const res = await supabase.from(tableName).select('*');
  if (res.error) throw new Error(`Could not load ${tableName}: ${res.error.message}`);
  return (res.data || []).map(normalizeLookup).filter((x) => x?.id).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function pairingRuleId(rule, prefix) {
  return normalizeId(rule?.[`${prefix}_color_id`] ?? rule?.[`${prefix}_color_id_text`]);
}

async function loadReceivingColors() {
  const [colorResult, pairingResult] = await Promise.all([
    supabase.from('sc_active_colors').select('id,name,code').order('name'),
    supabase.rpc('sc_get_color_pairing_rules', { p_status: 'active' }),
  ]);
  if (colorResult.error) {
    throw new Error(`Could not load active colors: ${colorResult.error.message}. Run the color lifecycle SQL migrations, then retry.`);
  }
  const rulesUnavailable = pairingResult.error && /does not exist|not find|schema cache/i.test(pairingResult.error.message || '');
  if (pairingResult.error && !rulesUnavailable) throw pairingResult.error;
  const sourceIds = new Set((pairingResult.data || [])
    .filter((rule) => pairingRuleId(rule, 'source') !== pairingRuleId(rule, 'canonical'))
    .map((rule) => pairingRuleId(rule, 'source')).filter(Boolean));
  return (colorResult.data || [])
    .filter((color) => !sourceIds.has(normalizeId(color.id)))
    .map(normalizeLookup).filter((color) => color?.id)
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

export default function AddItemToBin() {
  const [lookups, setLookups] = useState({ brands: [], product_types: [], colors: [], sizes: [], bins: [] });
  const [defaults, setDefaults] = useState({
    brand_id: '',
    product_type_id: '',
    color_id: '',
    bin_id: '',
    supplier: '',
    po_number: '',
    notes: '',
    auto_create_missing_blanks: true,
  });
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
        loadReceivingColors(),
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

  useEffect(() => { loadAllLookups(); }, []);

  const mergedLines = useMemo(() => lines.map((l) => ({
    ...l,
    brand_id: l.brand_id || defaults.brand_id,
    product_type_id: l.product_type_id || defaults.product_type_id,
    color_id: l.color_id || defaults.color_id,
    bin_id: l.bin_id || defaults.bin_id,
  })), [lines, defaults]);

  const lookupRow = (list, id) => list.find((x) => String(x.id) === String(id));
  const lookupName = (list, id) => lookupRow(list, id)?.name || '';
  const lookupCodeOrName = (list, id) => {
    const row = lookupRow(list, id);
    return row?.code || row?.name || '';
  };

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
        return { ...lineTemplate, size_id: size?.id || '', quantity: Number(qty) || '', notes: size ? '' : `Review size: ${sizeText}` };
      });
    if (parsed.length) setLines(parsed);
  }

  function blankDescription(line) {
    return `${lookupName(lookups.brands, line.brand_id)} / ${lookupName(lookups.product_types, line.product_type_id)} / ${lookupName(lookups.colors, line.color_id)} / ${lookupName(lookups.sizes, line.size_id)}`;
  }

  function buildBlankSku(line) {
    const parts = [
      lookupCodeOrName(lookups.brands, line.brand_id) || line.brand,
      lookupCodeOrName(lookups.product_types, line.product_type_id) || line.style,
      lookupCodeOrName(lookups.colors, line.color_id),
      lookupCodeOrName(lookups.sizes, line.size_id),
    ].map(skuPiece).filter(Boolean);

    return parts.join('-');
  }

  function buildBlankName(line) {
    return [
      lookupName(lookups.brands, line.brand_id) || line.brand,
      lookupName(lookups.product_types, line.product_type_id) || line.style,
      lookupName(lookups.colors, line.color_id),
      lookupName(lookups.sizes, line.size_id),
    ].filter(Boolean).join(' ');
  }

  async function findBlank(line) {
    const { data, error } = await supabase
      .from('blank_products')
      .select('id, sku_base, name, brand_id, product_type_id, color_id, size_id')
      .eq('sc_is_archived', false)
      .eq('brand_id', dbId(line.brand_id))
      .eq('product_type_id', dbId(line.product_type_id))
      .eq('color_id', dbId(line.color_id))
      .eq('size_id', dbId(line.size_id))
      .limit(1);

    if (error) throw error;
    return Array.isArray(data) ? data[0] : null;
  }

  async function findBlankBySku(skuBase) {
    if (!skuBase) return null;

    const { data, error } = await supabase
      .from('blank_products')
      .select('id, sku_base, name, brand_id, product_type_id, color_id, size_id')
      .eq('sc_is_archived', false)
      .eq('sku_base', skuBase)
      .limit(1);

    if (error) throw error;
    return Array.isArray(data) ? data[0] : null;
  }

  async function updateBlankAttributes(blank, line, skuBase, name) {
    const patch = {
      sku_base: blank.sku_base || skuBase,
      name: blank.name || name || skuBase,
      brand_id: dbId(line.brand_id),
      product_type_id: dbId(line.product_type_id),
      color_id: dbId(line.color_id),
      size_id: dbId(line.size_id),
    };

    Object.keys(patch).forEach((key) => {
      if (patch[key] === null || patch[key] === '') delete patch[key];
    });

    return updateBlankProduct(blank.id, patch);
  }

  async function createMissingBlank(line) {
    const skuBase = buildBlankSku(line);
    const name = buildBlankName(line) || skuBase;

    if (!skuBase || !name) {
      throw new Error(`Could not build a blank product SKU/name for ${blankDescription(line)}.`);
    }

    const existingBySku = await findBlankBySku(skuBase);
    if (existingBySku?.id) {
      return updateBlankAttributes(existingBySku, line, skuBase, name);
    }

    const unitCost = requireUnitCost(
      line.unit_cost,
      line.supplier_sku || blankDescription(line) || 'this new blank product',
    );

    const payload = {
      sku_base: skuBase,
      name,
      brand_id: dbId(line.brand_id),
      product_type_id: dbId(line.product_type_id),
      color_id: dbId(line.color_id),
      size_id: dbId(line.size_id),
      unit_cost: unitCost,
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === null || payload[key] === '') delete payload[key];
    });

    try {
      return await createBlankProduct(payload);
    } catch (error) {
      // Guarded creation may report a concurrent or pre-existing product.
      const retry = await findBlankBySku(skuBase);
      if (retry?.id) return updateBlankAttributes(retry, line, skuBase, name);
      throw error;
    }
  }

  async function findOrCreateBlank(line) {
    const existing = await findBlank(line);
    if (existing?.id) return { blank: existing, created: false };

    if (!defaults.auto_create_missing_blanks) {
      return { blank: null, created: false };
    }

    const created = await createMissingBlank(line);
    return { blank: created, created: true };
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
    let createdBlanks = 0;
    const errors = [];

    for (const line of valid) {
      try {
        const { blank, created } = await findOrCreateBlank(line);
        const blankId = normalizeId(blank?.id);
        const binId = normalizeId(line.bin_id);

        if (!blankId) {
          errors.push(`No blank product match for ${blankDescription(line)}`);
          continue;
        }

        if (created) createdBlanks += 1;

        if (!binId) {
          errors.push('Missing valid bin id. Refresh bins and choose the bin again.');
          continue;
        }

        const note = [defaults.supplier && `Supplier: ${defaults.supplier}`, defaults.po_number && `PO: ${defaults.po_number}`, defaults.notes, line.notes].filter(Boolean).join(' | ');

        const rpcPayload = {
          p_blank_product_id_text: blankId,
          p_bin_id_text: binId,
          p_quantity: Number(line.quantity),
          p_unit_cost: line.unit_cost === '' ? null : Number(line.unit_cost),
          p_notes: note || null,
        };

        const rpc = await supabase.rpc('sc_receive_blank_inventory_v4', rpcPayload);
        if (rpc.error) throw new Error(rpc.error.message || 'Receiving RPC failed.');

        if (rpc.data && rpc.data.success === false) {
          throw new Error(rpc.data.message || 'Receiving RPC returned success=false.');
        }

        saved += 1;
      } catch (err) {
        errors.push(err.message || String(err));
      }
    }

    setMessage(`${saved} receiving row(s) saved.${createdBlanks ? ` Created ${createdBlanks} missing blank product${createdBlanks === 1 ? '' : 's'}.` : ''}${errors.length ? ` Issues: ${errors.slice(0, 4).join('; ')}` : ''}`);
    setSaving(false);
  }

  const select = (value, onChange, list, placeholder, type = 'lookup') => (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {list.map((x) => (
        <option key={x.id} value={x.id}>{type === 'bin' ? (x.display_name || x.label || x.bin_code || x.id) : (x.name || x.label || x.code || x.id)}</option>
      ))}
    </select>
  );

  return (
    <div className="sc-page-stack add-bin-page">
      <div className="sc-page-header-card receiving-hero">
        <div>
          <div className="sc-kicker">Receiving</div>
          <h2>Add Blank Items to Bin</h2>
          <p>Receive one blank item or a full size run into inventory. Set defaults once, then enter size and quantity rows.</p>
        </div>
        <button className="sc-btn" onClick={loadAllLookups} disabled={loading}>{loading ? 'Loading...' : 'Refresh Lists'}</button>
      </div>

      {message && <div className="sc-alert">{message}</div>}

      <section className="sc-panel">
        <div className="sc-panel-header"><div><h3>Receiving Defaults</h3><p>Choose the default bin, brand, style, and color. Lines can still override these values.</p></div></div>
        <div className="sc-form-grid">
          <label className="sc-field"><span>Supplier</span><input value={defaults.supplier} onChange={(e) => setDefaults({ ...defaults, supplier: e.target.value })} /></label>
          <label className="sc-field"><span>PO / Order Number</span><input value={defaults.po_number} onChange={(e) => setDefaults({ ...defaults, po_number: e.target.value })} /></label>
          <label className="sc-field"><span>Default Bin</span>{select(defaults.bin_id, (v) => setDefaults({ ...defaults, bin_id: v }), lookups.bins, loading ? 'Loading bins...' : 'Choose bin', 'bin')}</label>
          <label className="sc-field"><span>Default Brand</span>{select(defaults.brand_id, (v) => setDefaults({ ...defaults, brand_id: v }), lookups.brands, 'Choose brand')}</label>
          <label className="sc-field"><span>Default Style</span>{select(defaults.product_type_id, (v) => setDefaults({ ...defaults, product_type_id: v }), lookups.product_types, 'Choose style')}</label>
          <label className="sc-field"><span>Default Color</span>{select(defaults.color_id, (v) => setDefaults({ ...defaults, color_id: v }), lookups.colors, 'Choose color')}</label>
          <label className="sc-field sc-field-wide"><span>Receiving Notes</span><input value={defaults.notes} onChange={(e) => setDefaults({ ...defaults, notes: e.target.value })} /></label>
          <label className="sc-field sc-field-wide">
            <span>Missing Blank Products</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={Boolean(defaults.auto_create_missing_blanks)}
                onChange={(e) => setDefaults({ ...defaults, auto_create_missing_blanks: e.target.checked })}
              />
              Create missing blank products while receiving
            </label>
          </label>
        </div>
      </section>

      <SupplierConfirmationReceiving
        lookups={lookups}
        defaultBinId={defaults.bin_id}
        resolveBlank={findOrCreateBlank}
        refreshLookups={loadAllLookups}
      />

      <section className="sc-panel">
        <div className="sc-panel-header"><div><h3>Paste Size Run</h3><p>Example: L 2, M 2, S 2, XL 2, XS 2. One line per size also works.</p></div><button className="sc-btn" onClick={parseSizeRun}>Parse Size Run</button></div>
        <textarea className="sc-textarea" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'L 2\nM 2\nS 2\nXL 2\nXS 2'} />
      </section>

      <section className="sc-panel">
        <div className="sc-panel-header"><div><h3>Receiving Lines</h3><p>Each complete line will be received into the selected bin.</p></div><button className="sc-btn" onClick={() => setLines([...lines, { ...lineTemplate }])}>Add Line</button></div>
        <div className="sc-receiving-lines">
          {mergedLines.map((line, index) => {
            const missingFields = missing(line);
            return (
              <article className="sc-receiving-card" key={index}>
                <div className="sc-card-title-row"><strong>Line {index + 1}</strong><span className={`sc-badge ${missingFields.length ? 'warning' : 'success'}`}>{missingFields.length ? `Missing: ${missingFields.join(', ')}` : 'Ready'}</span></div>
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
                <div className="sc-receiving-line-actions"><button className="sc-btn sc-btn-danger sc-btn-small" onClick={() => setLines(lines.filter((_, i) => i !== index))} disabled={lines.length === 1}>Remove Line</button></div>
              </article>
            );
          })}
        </div>
        <div className="sc-form-actions"><button className="sc-btn sc-btn-primary" onClick={saveAll} disabled={saving || loading}>{saving ? 'Saving...' : 'Receive All Complete Lines'}</button></div>
      </section>
    </div>
  );
}
