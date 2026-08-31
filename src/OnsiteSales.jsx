import { useEffect, useMemo, useState } from 'react';
import { completeOnsiteItem, getOnsiteCategories, getOnsiteProductOptions, getOnsiteProducts, searchOnsiteInventory } from './lib/onsiteSalesApi';
import skilledCraftingLogo from './assets/logo.png';
import './OnsiteSales.css';

function option(row, name) {
  const wanted = String(name).toLowerCase();
  return row?.attributes?.find((item) => String(item.name || '').toLowerCase().includes(wanted))?.option || '';
}

function labelInventory(row) {
  return [row.brand, row.style, row.color, row.size].filter(Boolean).join(' • ');
}

export default function OnsiteSales() {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(() => localStorage.getItem('sc-onsite-category') || '');
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [productOptions, setProductOptions] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [form, setForm] = useState({ blank_product_id: '', customer_name: '', player_name: '', player_number: '', personalization_color: 'White', logo_name: '', woo_variation_id: '', label_size: '4x6', notes: '' });
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => { getOnsiteCategories().then(setCategories).catch((error) => setMessage(error.message)); }, []);
  useEffect(() => {
    if (!categoryId) { setProducts([]); return; }
    localStorage.setItem('sc-onsite-category', categoryId);
    getOnsiteProducts(categoryId).then(setProducts).catch((error) => setMessage(error.message));
  }, [categoryId]);
  useEffect(() => {
    if (!productId) { setProductOptions(null); return; }
    getOnsiteProductOptions(productId).then(setProductOptions).catch((error) => setMessage(error.message));
  }, [productId]);
  useEffect(() => {
    const timer = window.setTimeout(() => searchOnsiteInventory(inventorySearch).then(setInventory).catch((error) => setMessage(error.message)), 250);
    return () => window.clearTimeout(timer);
  }, [inventorySearch, result]);

  const selectedBlank = useMemo(() => inventory.find((row) => String(row.blank_product_id) === String(form.blank_product_id)), [form.blank_product_id, inventory]);
  const logos = useMemo(() => {
    const attribute = productOptions?.attributes?.find((row) => /logo|graphic|design/i.test(row.name || ''));
    return attribute?.options || [];
  }, [productOptions]);

  function update(name, value) { setForm((current) => ({ ...current, [name]: value })); setResult(null); setMessage(''); }
  async function submit(event) {
    event.preventDefault();
    if (!form.blank_product_id) { setMessage('Choose an in-stock blank item.'); return; }
    if (!window.confirm(`Deduct one ${labelInventory(selectedBlank)} and create its production label?`)) return;
    setWorking(true); setMessage('Deducting inventory and creating label…');
    try {
      const completed = await completeOnsiteItem({ ...form, woo_category_id: categoryId, woo_product_id: productId });
      setResult(completed); setMessage('Item recorded and inventory deducted. Print the label now.');
    } catch (error) { setMessage(error.message); }
    finally { setWorking(false); }
  }

  return (
    <main className="page onsite-page">
      <section className="page-header no-print"><div><p className="eyebrow">Mobile production counter</p><h1>On-site Sales</h1><p>Choose the merchandise menu, consume one physical blank, and print a production label in one transaction.</p></div></section>
      {message && <p className="message no-print" role="status">{message}</p>}
      <form onSubmit={submit} className="onsite-layout no-print">
        <section className="card onsite-step"><h2>1. Event menu</h2><label>Active WooCommerce category<select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setProductId(''); }}><option value="">Choose category</option>{categories.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.count})</option>)}</select></label><label>Finished item / design menu<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Inventory-only / no Woo item</option>{products.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label>Woo variation (optional)<select value={form.woo_variation_id} onChange={(event) => update('woo_variation_id', event.target.value)}><option value="">Choose from physical inventory below</option>{(productOptions?.variations || []).map((row) => <option key={row.id} value={row.id}>{[option(row, 'color'), option(row, 'size'), option(row, 'logo')].filter(Boolean).join(' / ')} — {row.sku}</option>)}</select></label></section>
        <section className="card onsite-step"><h2>2. Physical blank</h2><input value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} placeholder="Search tee, hoodie, Gildan 6400, red…"/><div className="onsite-inventory-grid">{inventory.map((row) => <button key={row.blank_product_id} type="button" className={String(form.blank_product_id) === String(row.blank_product_id) ? 'selected' : ''} onClick={() => update('blank_product_id', row.blank_product_id)}><strong>{labelInventory(row)}</strong><span>{row.available_quantity} available</span><small>{row.sku_base}</small></button>)}</div></section>
        <section className="card onsite-step"><h2>3. Decoration & customer</h2><div className="onsite-fields"><label>Logo / graphic<select value={form.logo_name} onChange={(event) => update('logo_name', event.target.value)}><option value="">No logo selected</option>{logos.map((name) => <option key={name}>{name}</option>)}</select></label><label>Customer name<input value={form.customer_name} onChange={(event) => update('customer_name', event.target.value)} /></label><label>Player name<input value={form.player_name} onChange={(event) => update('player_name', event.target.value)} /></label><label>Player number<input value={form.player_number} onChange={(event) => update('player_number', event.target.value)} inputMode="numeric" /></label><label>Name / number color<input value={form.personalization_color} onChange={(event) => update('personalization_color', event.target.value)} /></label><label>Label size<select value={form.label_size} onChange={(event) => update('label_size', event.target.value)}><option value="2x3">2 × 3 inches</option><option value="4x6">4 × 6 inches</option></select></label><label className="wide">Production notes<textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label></div><button className="primary-action onsite-complete" disabled={working || !form.blank_product_id}>{working ? 'Recording…' : 'Complete item & create label'}</button></section>
      </form>
      {result && <section className={`onsite-label label-${result.label_size || form.label_size}`}><header><img className="onsite-label-logo" src={skilledCraftingLogo} alt="Skilled Crafting"/><span>{new Date(result.produced_at).toLocaleDateString()}</span></header><h2>{result.customer_name || 'On-site customer'}</h2><p>{result.blank_label}</p>{result.logo_name && <p><strong>Graphic:</strong> {result.logo_name}</p>}{result.player_name && <p><strong>Player:</strong> {result.player_name}</p>}{result.player_number && <p><strong>Number:</strong> {result.player_number} · {result.personalization_color || ''}</p>}<footer><span>Production #{result.production_number}</span><span>{result.source_bin_label}</span></footer><button type="button" className="no-print primary-action" onClick={() => window.print()}>Print label</button></section>}
    </main>
  );
}
