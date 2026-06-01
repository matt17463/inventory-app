import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function normalizeSearchValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function textSearchValue(value) {
  return String(value || '').toLowerCase();
}

/**
 * AddItemToBin.jsx
 *
 * Updated:
 * - Lists only blank clothing items from blank_products
 * - Allows creating a new blank item directly from this page
 * - Adds blank inventory to a bin using receive_blank_inventory()
 *
 * Uses bins columns:
 * - id
 * - bin_code
 * - label
 * - location
 *
 * Uses blank_products columns:
 * - id
 * - sku_base
 * - name
 * - brand_id
 * - product_type_id
 * - color_id
 * - size_id
 * - image_url
 */

export default function AddItemToBin() {
  const [bins, setBins] = useState([]);
  const [blankProducts, setBlankProducts] = useState([]);

  const [brands, setBrands] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [productTypes, setProductTypes] = useState([]);

  const [binId, setBinId] = useState('');
  const [blankProductId, setBlankProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [newSkuBase, setNewSkuBase] = useState('');
  const [newName, setNewName] = useState('');
  const [newBrandId, setNewBrandId] = useState('');
  const [newProductTypeId, setNewProductTypeId] = useState('');
  const [newColorId, setNewColorId] = useState('');
  const [newSizeId, setNewSizeId] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  function binLabel(bin) {
    return [bin.bin_code, bin.label, bin.location].filter(Boolean).join(' - ');
  }

  function productLabel(product) {
    const brand = product.brands?.code || product.brands?.name || '';
    const type = product.product_types?.code || product.product_types?.name || '';
    const color = product.colors?.code || product.colors?.name || '';
    const size = product.sizes?.code || product.sizes?.name || '';

    return [product.sku_base, product.name, brand, type, color, size]
      .filter(Boolean)
      .join(' - ');
  }

  function productMatchesSearch(product, term) {
    if (!term) return true;

    const searchableParts = [
      product.sku_base,
      product.name,
      product.brands?.name,
      product.brands?.code,
      product.product_types?.name,
      product.product_types?.code,
      product.colors?.name,
      product.colors?.code,
      product.sizes?.name,
      product.sizes?.code,
      productLabel(product),
    ];

    const lowerTerm = textSearchValue(term);
    const normalizedTerm = normalizeSearchValue(term);

    return searchableParts.some((part) => {
      const value = String(part || '');
      return (
        textSearchValue(value).includes(lowerTerm) ||
        normalizeSearchValue(value).includes(normalizedTerm)
      );
    });
  }

  async function loadBins() {
    const { data, error } = await supabase
      .from('bins')
      .select('id, bin_code, label, location')
      .order('bin_code', { ascending: true });

    if (error) throw error;
    setBins(data || []);
  }

  async function loadLookups() {
    const [brandRes, colorRes, sizeRes, typeRes] = await Promise.all([
      supabase.from('brands').select('id, name, code').order('name', { ascending: true }),
      supabase.from('colors').select('id, name, code').order('name', { ascending: true }),
      supabase.from('sizes').select('id, name, code').order('name', { ascending: true }),
      supabase.from('product_types').select('id, name, code').order('name', { ascending: true }),
    ]);

    if (brandRes.error) throw brandRes.error;
    if (colorRes.error) throw colorRes.error;
    if (sizeRes.error) throw sizeRes.error;
    if (typeRes.error) throw typeRes.error;

    setBrands(brandRes.data || []);
    setColors(colorRes.data || []);
    setSizes(sizeRes.data || []);
    setProductTypes(typeRes.data || []);
  }

  async function loadBlankProducts() {
    let query = supabase
      .from('blank_products')
      .select(`
        id,
        sku_base,
        name,
        image_url,
        brands:brand_id(name, code),
        colors:color_id(name, code),
        sizes:size_id(name, code),
        product_types:product_type_id(name, code)
      `)
      .order('name', { ascending: true });

    const term = search.trim();

    const { data, error } = await query;

    if (error) throw error;

    const rows = data || [];
    const filteredRows = term ? rows.filter((product) => productMatchesSearch(product, term)) : rows;

    setBlankProducts(filteredRows);

    if (term) {
      if (filteredRows.length === 0) {
        setMessage(`No blank items found for "${term}".`);
      } else {
        setMessage(`Found ${filteredRows.length} blank item${filteredRows.length === 1 ? '' : 's'} for "${term}".`);

        if (filteredRows.length === 1) {
          setBlankProductId(filteredRows[0].id);
        }
      }
    }
  }

  async function loadPage() {
    setMessage('');
    setLoading(true);

    try {
      await Promise.all([loadBins(), loadLookups(), loadBlankProducts()]);
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
    setMessage('');
    setLoading(true);

    try {
      await loadBlankProducts();
    } catch (err) {
      setMessage(err.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  }

  function buildSkuBase() {
    const brand = brands.find((item) => String(item.id) === String(newBrandId));
    const type = productTypes.find((item) => String(item.id) === String(newProductTypeId));
    const color = colors.find((item) => String(item.id) === String(newColorId));
    const size = sizes.find((item) => String(item.id) === String(newSizeId));

    const parts = [
      brand?.code || brand?.name,
      type?.code || type?.name,
      color?.code || color?.name,
      size?.code || size?.name,
    ]
      .filter(Boolean)
      .map((part) =>
        String(part)
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      );

    return parts.join('-');
  }

  function fillSkuBase() {
    const built = buildSkuBase();

    if (built) {
      setNewSkuBase(built);
    } else {
      setMessage('Choose brand, product type, color, and size first.');
    }
  }

  async function handleCreateBlankProduct(event) {
    event.preventDefault();
    setMessage('');

    const skuBase = newSkuBase.trim().toUpperCase();

    if (!skuBase) {
      setMessage('Enter or generate a blank SKU.');
      return;
    }

    if (!newName.trim()) {
      setMessage('Enter a blank item name.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        sku_base: skuBase,
        name: newName.trim(),
        brand_id: newBrandId ? Number(newBrandId) : null,
        product_type_id: newProductTypeId ? Number(newProductTypeId) : null,
        color_id: newColorId ? Number(newColorId) : null,
        size_id: newSizeId ? Number(newSizeId) : null,
        image_url: newImageUrl.trim() || null,
      };

      Object.keys(payload).forEach((key) => {
        if (payload[key] === null || payload[key] === '') {
          delete payload[key];
        }
      });

      const { data, error } = await supabase
        .from('blank_products')
        .upsert(payload, { onConflict: 'sku_base' })
        .select('id')
        .single();

      if (error) throw error;

      setBlankProductId(data.id);
      setSearch('');
      setMessage('New blank item created and selected.');

      setNewSkuBase('');
      setNewName('');
      setNewBrandId('');
      setNewProductTypeId('');
      setNewColorId('');
      setNewSizeId('');
      setNewImageUrl('');
      setShowCreate(false);

      await loadBlankProducts();
    } catch (err) {
      setMessage(err.message || 'Failed to create blank item.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToBin(event) {
    event.preventDefault();
    setMessage('');

    if (!binId) {
      setMessage('Choose a bin.');
      return;
    }

    if (!blankProductId) {
      setMessage('Choose or create a blank clothing item.');
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
    } catch (err) {
      setMessage(err.message || 'Failed to add item to bin.');
    } finally {
      setLoading(false);
    }
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

      <section className="card">
        <button type="button" onClick={() => setShowCreate((current) => !current)}>
          {showCreate ? 'Hide New Blank Item Form' : '+ Create New Blank Item'}
        </button>
      </section>

      {showCreate && (
        <form onSubmit={handleCreateBlankProduct} className="card">
          <h2>Create New Blank Item</h2>

          <label htmlFor="new-brand">Brand</label>
          <select
            id="new-brand"
            value={newBrandId}
            onChange={(event) => setNewBrandId(event.target.value)}
          >
            <option value="">Choose brand...</option>
            {brands.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <label htmlFor="new-type">Product Type / Style</label>
          <select
            id="new-type"
            value={newProductTypeId}
            onChange={(event) => setNewProductTypeId(event.target.value)}
          >
            <option value="">Choose product type...</option>
            {productTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <label htmlFor="new-color">Color</label>
          <select
            id="new-color"
            value={newColorId}
            onChange={(event) => setNewColorId(event.target.value)}
          >
            <option value="">Choose color...</option>
            {colors.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <label htmlFor="new-size">Size</label>
          <select
            id="new-size"
            value={newSizeId}
            onChange={(event) => setNewSizeId(event.target.value)}
          >
            <option value="">Choose size...</option>
            {sizes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <label htmlFor="new-sku">Blank SKU Base</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="new-sku"
              value={newSkuBase}
              onChange={(event) => setNewSkuBase(event.target.value)}
              placeholder="Example: BELLA-CANVAS-6405-NAVY-W3XL"
              required
            />
            <button type="button" onClick={fillSkuBase}>
              Generate
            </button>
          </div>

          <label htmlFor="new-name">Blank Item Name</label>
          <input
            id="new-name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Example: Bella Canvas 6405 Navy W3XL"
            required
          />

          <label htmlFor="new-image">Image URL</label>
          <input
            id="new-image"
            value={newImageUrl}
            onChange={(event) => setNewImageUrl(event.target.value)}
            placeholder="Optional image URL"
          />

          <button type="submit" disabled={loading}>
            Create Blank Item
          </button>
        </form>
      )}

      <form onSubmit={handleAddToBin} className="card">
        <h2>Add to Bin</h2>

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
              {binLabel(bin)}
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
        <p className="helper-text">
          {blankProducts.length} blank item{blankProducts.length === 1 ? '' : 's'} available from the current search.
        </p>

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
