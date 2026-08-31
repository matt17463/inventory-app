import { useEffect, useMemo, useState } from 'react';
import { completeOnsiteItem, getOnsiteCategories, getOnsiteCategoryMenu, getOnsiteInventoryV2 } from './lib/onsiteSalesApi';
import skilledCraftingLogo from './assets/logo.png';
import './OnsiteSales.css';

const UNCLASSIFIED = '__unclassified__';
const EMPTY_SELECTION = { item_type_id: '', brand_id: '', style_id: '', color_id: '', size_id: '' };

function labelInventory(row) {
  return [row.item_type, row.brand, row.style, row.color, row.size].filter(Boolean).join(' • ');
}

function itemKey(row) {
  return row.item_type_id == null ? UNCLASSIFIED : String(row.item_type_id);
}

function matches(row, selection, through = 'size_id') {
  const order = ['item_type_id', 'brand_id', 'style_id', 'color_id', 'size_id'];
  for (const field of order) {
    if (!selection[field]) return true;
    const rowValue = field === 'item_type_id' ? itemKey(row) : String(row[field] ?? '');
    if (rowValue !== String(selection[field])) return false;
    if (field === through) break;
  }
  return true;
}

function uniqueOptions(rows, idField, labelField, customId) {
  const map = new Map();
  rows.forEach((row) => {
    const id = customId ? customId(row) : row[idField];
    const label = row[labelField];
    if (id == null || !label) return;
    const key = String(id);
    if (!map.has(key)) map.set(key, { id: key, label: String(label) });
  });
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

function Selector({ label, value, options, placeholder, disabled, onChange }) {
  return <label>{label}<select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="">{placeholder}</option>{options.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>;
}

export default function OnsiteSales() {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(() => localStorage.getItem('sc-onsite-category') || '');
  const [categoryMenu, setCategoryMenu] = useState({ logos: [], products: [] });
  const [inventory, setInventory] = useState([]);
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [form, setForm] = useState({ blank_product_id: '', customer_name: '', player_name: '', player_number: '', personalization_color: 'White', logo_name: '', woo_product_id: '', woo_variation_id: '', label_size: '4x6', notes: '' });
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => { getOnsiteCategories().then(setCategories).catch((error) => setMessage(error.message)); }, []);
  useEffect(() => {
    if (!categoryId) { setCategoryMenu({ logos: [], products: [] }); return; }
    localStorage.setItem('sc-onsite-category', categoryId);
    getOnsiteCategoryMenu(categoryId).then(setCategoryMenu).catch((error) => setMessage(error.message));
  }, [categoryId]);
  useEffect(() => {
    getOnsiteInventoryV2('').then(setInventory).catch((error) => setMessage(error.message));
  }, [result]);

  const typeOptions = useMemo(() => uniqueOptions(inventory, 'item_type_id', 'item_type', itemKey), [inventory]);
  const afterType = useMemo(() => inventory.filter((row) => matches(row, selection, 'item_type_id')), [inventory, selection]);
  const brandOptions = useMemo(() => uniqueOptions(afterType, 'brand_id', 'brand'), [afterType]);
  const afterBrand = useMemo(() => afterType.filter((row) => !selection.brand_id || String(row.brand_id) === selection.brand_id), [afterType, selection.brand_id]);
  const styleOptions = useMemo(() => uniqueOptions(afterBrand, 'style_id', 'style'), [afterBrand]);
  const afterStyle = useMemo(() => afterBrand.filter((row) => !selection.style_id || String(row.style_id) === selection.style_id), [afterBrand, selection.style_id]);
  const colorOptions = useMemo(() => uniqueOptions(afterStyle, 'color_id', 'color'), [afterStyle]);
  const afterColor = useMemo(() => afterStyle.filter((row) => !selection.color_id || String(row.color_id) === selection.color_id), [afterStyle, selection.color_id]);
  const sizeOptions = useMemo(() => uniqueOptions(afterColor, 'size_id', 'size'), [afterColor]);
  const exactRows = useMemo(() => afterColor.filter((row) => selection.size_id && String(row.size_id) === selection.size_id), [afterColor, selection.size_id]);
  const selectedBlank = useMemo(() => inventory.find((row) => String(row.blank_product_id) === String(form.blank_product_id)), [form.blank_product_id, inventory]);

  function update(name, value) { setForm((current) => ({ ...current, [name]: value })); setResult(null); setMessage(''); }

  function selectDimension(field, value) {
    const order = ['item_type_id', 'brand_id', 'style_id', 'color_id', 'size_id'];
    const index = order.indexOf(field);
    const next = { ...selection, [field]: value };
    order.slice(index + 1).forEach((name) => { next[name] = ''; });
    setSelection(next);
    setForm((current) => ({ ...current, blank_product_id: '' }));
    setResult(null);
    setMessage('');
    if (field === 'size_id' && value) {
      const candidates = inventory.filter((row) => {
        const typeValue = itemKey(row);
        return typeValue === next.item_type_id
          && String(row.brand_id ?? '') === next.brand_id
          && String(row.style_id ?? '') === next.style_id
          && String(row.color_id ?? '') === next.color_id
          && String(row.size_id ?? '') === value;
      });
      if (candidates.length === 1) setForm((current) => ({ ...current, blank_product_id: candidates[0].blank_product_id }));
      else if (candidates.length > 1) setMessage('More than one active blank record matches this exact selection. Resolve the duplicate in Product Integrity before selling it.');
    }
  }

  function changeCategory(value) {
    setCategoryId(value);
    setCategoryMenu({ logos: [], products: [] });
    setForm((current) => ({ ...current, logo_name: '', woo_product_id: '', woo_variation_id: '' }));
    setResult(null);
    setMessage('');
  }

  function changeLogo(value) {
    const row = categoryMenu.logos.find((entry) => entry.name === value);
    setForm((current) => ({ ...current, logo_name: value, woo_product_id: row?.product_ids?.length === 1 ? String(row.product_ids[0]) : '', woo_variation_id: '' }));
    setResult(null);
    setMessage('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!categoryId) { setMessage('Choose the active WooCommerce category.'); return; }
    if (!form.blank_product_id || !selectedBlank) { setMessage('Choose Type, Brand, Style, Color, and Size for an in-stock blank.'); return; }
    if (!window.confirm(`Deduct one ${labelInventory(selectedBlank)} and create its production label?`)) return;
    setWorking(true); setMessage('Deducting inventory and creating label…');
    try {
      const completed = await completeOnsiteItem({ ...form, woo_category_id: categoryId });
      setResult(completed); setMessage('Item recorded and inventory deducted. Print the label now.');
      setSelection(EMPTY_SELECTION);
      setForm((current) => ({ ...current, blank_product_id: '', customer_name: '', player_name: '', player_number: '', notes: '' }));
    } catch (error) { setMessage(error.message); }
    finally { setWorking(false); }
  }

  return (
    <main className="page onsite-page">
      <section className="page-header no-print"><div><p className="eyebrow">Mobile production counter</p><h1>On-site Sales</h1><p>Set the event category, choose its graphic, then drill into only physical blanks that are actually available.</p></div></section>
      {message && <p className="message no-print" role="status">{message}</p>}
      <form onSubmit={submit} className="onsite-layout no-print">
        <section className="card onsite-step onsite-event"><h2>1. Event & graphic</h2><label>Active WooCommerce category<select value={categoryId} onChange={(event) => changeCategory(event.target.value)}><option value="">Choose category</option>{categories.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.count})</option>)}</select></label><label>Logo / graphic<select value={form.logo_name} disabled={!categoryId} onChange={(event) => changeLogo(event.target.value)}><option value="">No logo selected</option>{categoryMenu.logos.map((row) => <option key={row.name} value={row.name}>{row.name}</option>)}</select></label>{categoryId && !categoryMenu.logos.length ? <p className="onsite-help">No Logo/Graphic/Design attribute options were found on published products in this category.</p> : null}</section>

        <section className="card onsite-step onsite-blank"><h2>2. Physical blank</h2><p className="onsite-help">Each choice narrows the next list to blanks with positive availability after reservations.</p><div className="onsite-cascade"><Selector label="Type" value={selection.item_type_id} options={typeOptions} placeholder="Choose type" onChange={(value) => selectDimension('item_type_id', value)} /><Selector label="Brand" value={selection.brand_id} options={brandOptions} placeholder="Choose brand" disabled={!selection.item_type_id} onChange={(value) => selectDimension('brand_id', value)} /><Selector label="Style" value={selection.style_id} options={styleOptions} placeholder="Choose style" disabled={!selection.brand_id} onChange={(value) => selectDimension('style_id', value)} /><Selector label="Color" value={selection.color_id} options={colorOptions} placeholder="Choose color" disabled={!selection.style_id} onChange={(value) => selectDimension('color_id', value)} /><Selector label="Size" value={selection.size_id} options={sizeOptions} placeholder="Choose size" disabled={!selection.color_id} onChange={(value) => selectDimension('size_id', value)} /></div>{selectedBlank ? <div className="onsite-selected-blank"><strong>{labelInventory(selectedBlank)}</strong><span>{selectedBlank.available_quantity} available</span><small>{selectedBlank.sku_base}</small></div> : selection.size_id && !exactRows.length ? <p className="onsite-warning">That selection no longer has available inventory. Refresh or choose another size.</p> : null}</section>

        <section className="card onsite-step"><h2>3. Customer & production</h2><div className="onsite-fields"><label>Customer name<input value={form.customer_name} onChange={(event) => update('customer_name', event.target.value)} /></label><label>Player name<input value={form.player_name} onChange={(event) => update('player_name', event.target.value)} /></label><label>Player number<input value={form.player_number} onChange={(event) => update('player_number', event.target.value)} inputMode="numeric" /></label><label>Name / number color<input value={form.personalization_color} onChange={(event) => update('personalization_color', event.target.value)} /></label><label>Label size<select value={form.label_size} onChange={(event) => update('label_size', event.target.value)}><option value="2x3">2 × 3 inches</option><option value="4x6">4 × 6 inches</option></select></label><label className="wide">Production notes<textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label></div><button className="primary-action onsite-complete" disabled={working || !form.blank_product_id}>{working ? 'Recording…' : 'Complete item & create label'}</button></section>
      </form>
      {result && <section className={`onsite-label label-${result.label_size || form.label_size}`}><header><img className="onsite-label-logo" src={skilledCraftingLogo} alt="Skilled Crafting"/><span>{new Date(result.produced_at).toLocaleDateString()}</span></header><h2>{result.customer_name || 'On-site customer'}</h2><p>{result.blank_label}</p>{result.logo_name && <p><strong>Graphic:</strong> {result.logo_name}</p>}{result.player_name && <p><strong>Player:</strong> {result.player_name}</p>}{result.player_number && <p><strong>Number:</strong> {result.player_number} · {result.personalization_color || ''}</p>}<footer><span>Production #{result.production_number}</span><span>{result.source_bin_label}</span></footer><button type="button" className="no-print primary-action" onClick={() => window.print()}>Print label</button></section>}
    </main>
  );
}
