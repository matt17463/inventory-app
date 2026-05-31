import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

/**
 * AddItemToBin.jsx
 *
 * This page only displays blank clothing items from blank_products.
 * It does NOT display WooCommerce finished/decorated products.
 *
 * Place this file at:
 * src/AddItemToBin.jsx
 */

export default function AddItemToBin() {
  const [bins, setBins] = useState([]);
  const [blankProducts, setBlankProducts] = useState([]);
  const [binId, setBinId] = useState('');
  const [blankProductId, setBlankProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadBins() {
    const { data, error } = await supabase
      .from('bins')
      .select('id, bin_code, description')
      .order('bin_code', { ascending: true });

    if (error) throw error;
    setBins(data || []);
  }

  async function loadBlankProducts() {
    let query = supabase
      .from('blank_products')
      .select(`
        id,
        sku_base,
        name,
        image_url,
        brands:brand_id(name),
        colors:color_id(name),
        sizes:size_id(name),
        product_types:product_type_id(name)
      `)
      .order('name', { ascending: true });

    const term = search.trim();

    if (term) {
      query = query.or(`sku_base.ilike.%${term}%,name.ilike.%${term}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    setBlankProducts(data || []);
  }

  async function loadPage() {
    setMessage('');
    setLoading(true);

    try {
      await Promise.all([loadBins(), loadBlankProducts()]);
    } catch (err) {
      setMessage(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(event) {
    event.preventDefault();
    await loadPage();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (!binId) {
      setMessage('Choose a bin.');
      return;
    }

    if (!blankProductId) {
      setMessage('Choose a blank clothing item.');
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      setMessage('Quantity must be greater than zero.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.rpc('receive_blank_inventory', {
        p_bin_id: Number(binId),
        p_blank_product_id: blankProductId,
        p_quantity: Number(quantity),
        p_notes: notes || null,
      });

      if (error) throw error;

      setMessage('Blank item added to bin inventory.');
      setQuantity(1);
      setNotes('');
      await loadBlankProducts();
    } catch (err) {
      setMessage(err.message || 'Failed to add item to bin.');
    } finally {
      setLoading(false);
    }
  }

  function productLabel(product) {
    const brand = product.brands?.name || '';
    const type = product.product_types?.name || '';
    const color = product.colors?.name || '';
    const size = product.sizes?.name || '';

    return [product.sku_base, product.name, brand, type, color, size]
      .filter(Boolean)
      .join(' - ');
  }

  return (
    <main className="page">
      <h1>Add Blank Item to Bin</h1>

      <form onSubmit={handleSearch} className="card">
        <label htmlFor="blank-search">Search blank clothing</label>
        <input
          id="blank-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search blank SKU or name"
        />
        <button type="submit" disabled={loading}>
          Search
        </button>
      </form>

      <form onSubmit={handleSubmit} className="card">
        <label htmlFor="bin">Bin</label>
        <select
          id="bin"
          value={binId}
          onChange={(event) => setBinId(event.target.value)}
          required
        >
          <option value="">Choose bin...</option>
          {bins.map((bin) => (
            <option key={bin.id} value={bin.id}>
              {bin.bin_code}
              {bin.description ? ` - ${bin.description}` : ''}
            </option>
          ))}
        </select>

        <label htmlFor="blank-product">Blank clothing item</label>
        <select
          id="blank-product"
          value={blankProductId}
          onChange={(event) => setBlankProductId(event.target.value)}
          required
        >
          <option value="">Choose blank item...</option>
          {blankProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {productLabel(product)}
            </option>
          ))}
        </select>

        <label htmlFor="quantity">Quantity received</label>
        <input
          id="quantity"
          type="number"
          min="1"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />

        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional receiving notes"
        />

        <button type="submit" disabled={loading}>
          Add Item to Bin
        </button>
      </form>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
