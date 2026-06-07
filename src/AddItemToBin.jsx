import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';

const lineTemplate = { brand_id: '', product_type_id: '', color_id: '', size_id: '', quantity: '', unit_cost: '', bin_id: '', notes: '' };

export default function AddItemToBin() {
  const [lookups, setLookups] = useState({ brands: [], product_types: [], colors: [], sizes: [], bins: [] });
  const [defaults, setDefaults] = useState({ brand_id: '', product_type_id: '', color_id: '', bin_id: '', supplier: '', po_number: '', notes: '' });
  const [lines, setLines] = useState([{ ...lineTemplate }]);
  const [paste, setPaste] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [brands, productTypes, colors, sizes, bins] = await Promise.all([
        supabase.from('brands').select('id,name,code').order('name'),
        supabase.from('product_types').select('id,name,code').order('name'),
        supabase.from('colors').select('id,name,code').order('name'),
        supabase.from('sizes').select('id,name,code').order('name'),
        supabase.from('bins').select('id,name,code,label').order('name'),
      ]);
      setLookups({ brands: brands.data || [], product_types: productTypes.data || [], colors: colors.data || [], sizes: sizes.data || [], bins: bins.data || [] });
    }
    load();
  }, []);

  const mergedLines = useMemo(() => lines.map((l) => ({
    ...l,
    brand_id: l.brand_id || defaults.brand_id,
    product_type_id: l.product_type_id || defaults.product_type_id,
    color_id: l.color_id || defaults.color_id,
    bin_id: l.bin_id || defaults.bin_id,
  })), [lines, defaults]);

  const lookupName = (list, id) => list.find((x) => String(x.id) === String(id))?.name || '';
  const missing = (line) => ['brand_id','product_type_id','color_id','size_id','bin_id','quantity'].filter((k) => !line[k] || (k === 'quantity' && Number(line[k]) <= 0));

  function updateLine(index, patch) {
    setLines((prev) => prev.map((line, i) => i === index ? { ...line, ...patch } : line));
  }

  function parseSizeRun() {
    const parsed = paste.split(/\n|,/).map((row) => row.trim()).filter(Boolean).map((row) => {
      const parts = row.split(/\s+/);
      const qty = parts.pop();
      const sizeText = parts.join(' ');
      const size = lookups.sizes.find((s) => [s.name, s.code].filter(Boolean).map((x) => x.toUpperCase()).includes(sizeText.toUpperCase()));
      return { ...lineTemplate, size_id: size?.id || '', quantity: Number(qty) || '', unit_cost: '', notes: size ? '' : `Review size: ${sizeText}` };
    });
    if (parsed.length) setLines(parsed);
  }

  async function findBlank(line) {
    const { data } = await supabase
      .from('blank_products')
      .select('id,sku_base,name')
      .eq('brand_id', line.brand_id)
      .eq('product_type_id', line.product_type_id)
      .eq('color_id', line.color_id)
      .eq('size_id', line.size_id)
      .maybeSingle();
    return data;
  }

  async function saveAll() {
    setSaving(true);
    setMessage('');
    const valid = mergedLines.filter((line) => missing(line).length === 0);
    if (!valid.length) {
      setMessage('No complete receiving rows are ready to save.');
      setSaving(false);
      return;
    }
    let saved = 0;
    let errors = [];
    for (const line of valid) {
      try {
        const blank = await findBlank(line);
        if (!blank?.id) {
          errors.push(`No blank product match for ${lookupName(lookups.brands, line.brand_id)} / ${lookupName(lookups.product_types, line.product_type_id)} / ${lookupName(lookups.colors, line.color_id)} / ${lookupName(lookups.sizes, line.size_id)}`);
          continue;
        }
        const note = [defaults.supplier && `Supplier: ${defaults.supplier}`, defaults.po_number && `PO: ${defaults.po_number}`, defaults.notes, line.notes].filter(Boolean).join(' | ');
        const rpc = await supabase.rpc('receive_blank_inventory', {
          p_blank_product_id: blank.id,
          p_bin_id: line.bin_id,
          p_quantity: Number(line.quantity),
          p_notes: note || null,
          p_unit_cost: line.unit_cost === '' ? null : Number(line.unit_cost),
        });
        if (rpc.error) {
          const fallback = await supabase.from('blank_inventory_movements').insert({ blank_product_id: blank.id, bin_id: line.bin_id, quantity: Number(line.quantity), movement_type: 'receive', notes: note || null });
          if (fallback.error) errors.push(fallback.error.message); else saved += 1;
        } else saved += 1;
      } catch (e) { errors.push(e.message); }
    }
    setMessage(`${saved} receiving row(s) saved.${errors.length ? ` Issues: ${errors.slice(0, 3).join('; ')}` : ''}`);
    setSaving(false);
  }

  const select = (value, onChange, list, placeholder) => <select value={value || ''} onChange={(e) => onChange(e.target.value)}><option value="">{placeholder}</option>{list.map((x) => <option key={x.id} value={x.id}>{x.name || x.label || x.code}</option>)}</select>;

  return (
    <div className="sc-page-stack">
      <div className="sc-page-header-card"><div><div className="sc-kicker">Receiving</div><h2>Add Blank Items to Bin</h2><p>Receive one item or a full size run into inventory. Set defaults once, then enter size and quantity rows.</p></div></div>
      {message && <div className="sc-alert">{message}</div>}

      <section className="sc-panel">
        <div className="sc-panel-header"><div><h3>Receiving Defaults</h3><p>Defaults apply to every line unless a row overrides them.</p></div></div>
        <div className="sc-form-grid">
          <label className="sc-field"><span>Supplier</span><input value={defaults.supplier} onChange={(e) => setDefaults({ ...defaults, supplier: e.target.value })} /></label>
          <label className="sc-field"><span>PO / Order Number</span><input value={defaults.po_number} onChange={(e) => setDefaults({ ...defaults, po_number: e.target.value })} /></label>
          <label className="sc-field"><span>Default Bin</span>{select(defaults.bin_id, (v) => setDefaults({ ...defaults, bin_id: v }), lookups.bins, 'Choose bin')}</label>
          <label className="sc-field"><span>Default Brand</span>{select(defaults.brand_id, (v) => setDefaults({ ...defaults, brand_id: v }), lookups.brands, 'Choose brand')}</label>
          <label className="sc-field"><span>Default Style</span>{select(defaults.product_type_id, (v) => setDefaults({ ...defaults, product_type_id: v }), lookups.product_types, 'Choose style')}</label>
          <label className="sc-field"><span>Default Color</span>{select(defaults.color_id, (v) => setDefaults({ ...defaults, color_id: v }), lookups.colors, 'Choose color')}</label>
          <label className="sc-field sc-field-wide"><span>Receiving Notes</span><input value={defaults.notes} onChange={(e) => setDefaults({ ...defaults, notes: e.target.value })} /></label>
        </div>
      </section>

      <section className="sc-panel">
        <div className="sc-panel-header"><div><h3>Paste Size Run</h3><p>Example: L 2, M 2, S 2, XL 2, XS 2</p></div><button className="sc-btn" onClick={parseSizeRun}>Parse Size Run</button></div>
        <textarea className="sc-textarea" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'L 2\nM 2\nS 2\nXL 2\nXS 2'} />
      </section>

      <section className="sc-panel">
        <div className="sc-panel-header"><div><h3>Receiving Lines</h3><p>Each complete line will be received into the selected bin.</p></div><button className="sc-btn" onClick={() => setLines([...lines, { ...lineTemplate }])}>Add Line</button></div>
        <div className="sc-receiving-lines">
          {mergedLines.map((line, index) => {
            const missingFields = missing(line);
            return <article className="sc-receiving-card" key={index}>
              <div className="sc-card-title-row"><strong>Line {index + 1}</strong><span className={`sc-badge ${missingFields.length ? 'warning' : 'success'}`}>{missingFields.length ? `Missing ${missingFields.length}` : 'Ready'}</span></div>
              <div className="sc-form-grid compact">
                <label className="sc-field"><span>Bin</span>{select(line.bin_id, (v) => updateLine(index, { bin_id: v }), lookups.bins, 'Default / choose')}</label>
                <label className="sc-field"><span>Brand</span>{select(line.brand_id, (v) => updateLine(index, { brand_id: v }), lookups.brands, 'Default / choose')}</label>
                <label className="sc-field"><span>Style</span>{select(line.product_type_id, (v) => updateLine(index, { product_type_id: v }), lookups.product_types, 'Default / choose')}</label>
                <label className="sc-field"><span>Color</span>{select(line.color_id, (v) => updateLine(index, { color_id: v }), lookups.colors, 'Default / choose')}</label>
                <label className="sc-field"><span>Size</span>{select(line.size_id, (v) => updateLine(index, { size_id: v }), lookups.sizes, 'Choose size')}</label>
                <label className="sc-field"><span>Quantity</span><input type="number" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} /></label>
                <label className="sc-field"><span>Unit Cost</span><input type="number" step="0.01" value={line.unit_cost} onChange={(e) => updateLine(index, { unit_cost: e.target.value })} /></label>
                <label className="sc-field"><span>Line Note</span><input value={line.notes} onChange={(e) => updateLine(index, { notes: e.target.value })} /></label>
              </div>
              <div className="sc-muted">Missing: {missingFields.length ? missingFields.join(', ') : 'none'}</div>
              <button className="sc-btn sc-btn-danger sc-btn-small" onClick={() => setLines(lines.filter((_, i) => i !== index))}>Remove Line</button>
            </article>;
          })}
        </div>
        <div className="sc-form-actions"><button className="sc-btn sc-btn-primary" onClick={saveAll} disabled={saving}>{saving ? 'Saving...' : 'Receive All Complete Lines'}</button></div>
      </section>
    </div>
  );
}
