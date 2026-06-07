import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { PageHeader, HelpPanel, SectionCard, StatusBadge, ActionButton, FieldGrid, FormField } from './components/UIPrimitives';

function blankLine() {
  return { bin_id: '', brand_id: '', product_type_id: '', color_id: '', size_id: '', quantity: 1, unit_cost: '', artwork_note: '', note: '' };
}

function parseSizeRun(text, defaults) {
  return String(text || '').split(/\n|,/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/\s+/);
    const qty = Number(parts.pop()) || 1;
    const sizeText = parts.join(' ');
    const size = (defaults.sizes || []).find((s) => String(s.name || s.code || '').toLowerCase() === sizeText.toLowerCase() || String(s.code || '').toLowerCase() === sizeText.toLowerCase());
    return { ...blankLine(), ...defaults.values, size_id: size?.id || '', quantity: qty };
  });
}

export default function AddItemToBin() {
  const [lookups, setLookups] = useState({ bins: [], brands: [], productTypes: [], colors: [], sizes: [] });
  const [defaults, setDefaults] = useState({ bin_id: '', brand_id: '', product_type_id: '', color_id: '' });
  const [lines, setLines] = useState([blankLine()]);
  const [sizeRun, setSizeRun] = useState('');
  const [message, setMessage] = useState('');

  async function loadLookups() {
    const [bins, brands, pts, colors, sizes] = await Promise.all([
      supabase.from('bins').select('*').order('name', { ascending: true }),
      supabase.from('brands').select('*').order('name', { ascending: true }),
      supabase.from('product_types').select('*').order('name', { ascending: true }),
      supabase.from('colors').select('*').order('name', { ascending: true }),
      supabase.from('sizes').select('*').order('name', { ascending: true }),
    ]);
    setLookups({ bins: bins.data || [], brands: brands.data || [], productTypes: pts.data || [], colors: colors.data || [], sizes: sizes.data || [] });
  }
  useEffect(() => { loadLookups(); }, []);

  function applyDefaults() {
    setLines((rows) => rows.map((l) => ({ ...l, ...Object.fromEntries(Object.entries(defaults).filter(([, v]) => v)) })));
  }

  function addSizeRun() {
    const newRows = parseSizeRun(sizeRun, { values: defaults, sizes: lookups.sizes });
    if (newRows.length) setLines(newRows);
  }

  function updateLine(index, key, value) {
    setLines((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  }

  async function findOrCreateBlankProduct(line) {
    const { data: found, error } = await supabase.from('blank_products').select('*')
      .eq('brand_id', line.brand_id).eq('product_type_id', line.product_type_id).eq('color_id', line.color_id).eq('size_id', line.size_id).limit(1).maybeSingle();
    if (error) throw error;
    if (found?.id) return found.id;
    const brand = lookups.brands.find((x) => String(x.id) === String(line.brand_id));
    const style = lookups.productTypes.find((x) => String(x.id) === String(line.product_type_id));
    const color = lookups.colors.find((x) => String(x.id) === String(line.color_id));
    const size = lookups.sizes.find((x) => String(x.id) === String(line.size_id));
    const sku = [brand?.code || brand?.name, style?.code || style?.name, color?.code || color?.name, size?.code || size?.name].filter(Boolean).join('-').toUpperCase().replace(/[^A-Z0-9]+/g, '-');
    const { data: created, error: createError } = await supabase.from('blank_products').insert({
      brand_id: line.brand_id,
      product_type_id: line.product_type_id,
      color_id: line.color_id,
      size_id: line.size_id,
      sku_base: sku,
      name: `${brand?.name || ''} ${style?.name || ''} ${color?.name || ''} ${size?.name || ''}`.trim(),
      unit_cost: line.unit_cost ? Number(line.unit_cost) : null,
    }).select('*').single();
    if (createError) throw createError;
    return created.id;
  }

  async function receiveAll() {
    setMessage('');
    try {
      for (const line of lines) {
        if (!line.bin_id || !line.brand_id || !line.product_type_id || !line.color_id || !line.size_id || !line.quantity) throw new Error('Every line needs bin, brand, style, color, size, and quantity.');
        const blankProductId = await findOrCreateBlankProduct(line);
        const { error } = await supabase.rpc('receive_blank_inventory', {
          p_blank_product_id: blankProductId,
          p_bin_id: line.bin_id,
          p_quantity: Number(line.quantity),
          p_notes: [line.artwork_note, line.note].filter(Boolean).join(' | '),
          p_unit_cost: line.unit_cost ? Number(line.unit_cost) : null,
        });
        if (error) throw error;
      }
      setMessage(`Received ${lines.length} line(s) successfully.`);
      setLines([blankLine()]);
    } catch (err) {
      setMessage(err.message || String(err));
    }
  }

  const requiredLabels = useMemo(() => ['Bin / Storage Location', 'Brand', 'Style / Product Type', 'Color', 'Size', 'Quantity', 'Unit Cost', 'Artwork Note', 'Receiving Note', 'SKU Preview', 'Blank Product Match'], []);

  return (
    <main className="sc-page sc-bulk-receiving-page">
      <PageHeader eyebrow="INVENTORY" title="Add Blank Items to Bin" description="Receive one or many blank items at once using a clear card-based workflow." actions={<ActionButton tone="primary" onClick={receiveAll}>Receive All Lines</ActionButton>} />
      <HelpPanel><p>Use defaults when every line shares the same bin, brand, style, or color. Paste a size run such as “L 2 / M 2 / S 2” to quickly create multiple receiving rows.</p></HelpPanel>
      <SectionCard title="Fields Required to Save a New Blank Product" description="Each receiving line shows these categories so it is clear what must be completed.">
        <div className="sc-chip-list">{requiredLabels.map((l) => <span key={l}>{l}</span>)}</div>
      </SectionCard>
      <SectionCard title="Receiving Defaults" description="Apply common values to every line to speed up receiving.">
        <FieldGrid>
          <FormField label="Default bin"><select value={defaults.bin_id} onChange={(e) => setDefaults({ ...defaults, bin_id: e.target.value })}><option value="">Choose bin</option>{lookups.bins.map((b) => <option key={b.id} value={b.id}>{b.name || b.bin_code || b.label}</option>)}</select></FormField>
          <FormField label="Default brand"><select value={defaults.brand_id} onChange={(e) => setDefaults({ ...defaults, brand_id: e.target.value })}><option value="">Choose brand</option>{lookups.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></FormField>
          <FormField label="Default style"><select value={defaults.product_type_id} onChange={(e) => setDefaults({ ...defaults, product_type_id: e.target.value })}><option value="">Choose style</option>{lookups.productTypes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FormField>
          <FormField label="Default color"><select value={defaults.color_id} onChange={(e) => setDefaults({ ...defaults, color_id: e.target.value })}><option value="">Choose color</option>{lookups.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></FormField>
        </FieldGrid>
        <div className="sc-button-row"><ActionButton onClick={applyDefaults}>Apply Defaults to Lines</ActionButton></div>
      </SectionCard>
      <SectionCard title="Paste Size Run" description="Paste sizes and quantities from supplier/order screens.">
        <textarea value={sizeRun} onChange={(e) => setSizeRun(e.target.value)} placeholder={'L 2\nM 2\nS 2\nXL 2\nXS 2'} />
        <div className="sc-button-row"><ActionButton tone="secondary" onClick={addSizeRun}>Create Lines from Size Run</ActionButton></div>
      </SectionCard>
      <div className="sc-receiving-line-stack">
        {lines.map((line, i) => (
          <SectionCard key={i} title={`Receiving Line ${i + 1}`} actions={<ActionButton tone="danger" onClick={() => setLines((rows) => rows.filter((_, idx) => idx !== i))}>Remove</ActionButton>}>
            <FieldGrid>
              <FormField label="Bin" required><select value={line.bin_id} onChange={(e) => updateLine(i, 'bin_id', e.target.value)}><option value="">Choose bin</option>{lookups.bins.map((b) => <option key={b.id} value={b.id}>{b.name || b.bin_code || b.label}</option>)}</select></FormField>
              <FormField label="Brand" required><select value={line.brand_id} onChange={(e) => updateLine(i, 'brand_id', e.target.value)}><option value="">Choose brand</option>{lookups.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></FormField>
              <FormField label="Style / Product Type" required><select value={line.product_type_id} onChange={(e) => updateLine(i, 'product_type_id', e.target.value)}><option value="">Choose style</option>{lookups.productTypes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FormField>
              <FormField label="Color" required><select value={line.color_id} onChange={(e) => updateLine(i, 'color_id', e.target.value)}><option value="">Choose color</option>{lookups.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></FormField>
              <FormField label="Size" required><select value={line.size_id} onChange={(e) => updateLine(i, 'size_id', e.target.value)}><option value="">Choose size</option>{lookups.sizes.map((s) => <option key={s.id} value={s.id}>{s.name || s.code}</option>)}</select></FormField>
              <FormField label="Quantity" required><input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} /></FormField>
              <FormField label="Unit Cost"><input type="number" step="0.01" value={line.unit_cost} onChange={(e) => updateLine(i, 'unit_cost', e.target.value)} /></FormField>
              <FormField label="Artwork Note"><input value={line.artwork_note} onChange={(e) => updateLine(i, 'artwork_note', e.target.value)} /></FormField>
              <FormField label="Receiving / Line Note"><input value={line.note} onChange={(e) => updateLine(i, 'note', e.target.value)} /></FormField>
            </FieldGrid>
            <div className="sc-line-status-row"><StatusBadge status={line.bin_id && line.brand_id && line.product_type_id && line.color_id && line.size_id && line.quantity ? 'Ready' : 'Missing required field'} /></div>
          </SectionCard>
        ))}
      </div>
      <div className="sc-button-row"><ActionButton onClick={() => setLines((rows) => [...rows, { ...blankLine(), ...defaults }])}>Add Line</ActionButton><ActionButton tone="primary" onClick={receiveAll}>Receive All Lines</ActionButton></div>
      {message ? <SectionCard tone={message.includes('success') ? 'success' : 'warning'}><p>{message}</p></SectionCard> : null}
    </main>
  );
}
