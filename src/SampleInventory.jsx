import { useEffect, useState } from 'react';
import {
  addSampleInventory,
  createBlankProduct,
  formatBlankProductLabel,
  getBlankProductLookups,
  getBlankProducts,
  getSampleInventory,
} from './lib/inventoryApi';

function buildSkuFromLookups({ brands, productTypes, colors, sizes, brandId, productTypeId, colorId, sizeId }) {
  const brand = brands.find((item) => String(item.id) === String(brandId));
  const type = productTypes.find((item) => String(item.id) === String(productTypeId));
  const color = colors.find((item) => String(item.id) === String(colorId));
  const size = sizes.find((item) => String(item.id) === String(sizeId));

  return [brand?.code || brand?.name, type?.code || type?.name, color?.code || color?.name, size?.code || size?.name]
    .filter(Boolean)
    .map((part) => String(part).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .join('-');
}

export default function SampleInventory() {
  const [samples, setSamples] = useState([]);
  const [blankProducts, setBlankProducts] = useState([]);
  const [lookups, setLookups] = useState({ brands: [], colors: [], sizes: [], productTypes: [] });
  const [search, setSearch] = useState('');
  const [sampleSearch, setSampleSearch] = useState('');
  const [blankProductId, setBlankProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [newProduct, setNewProduct] = useState({
    sku_base: '',
    name: '',
    brand_id: '',
    product_type_id: '',
    color_id: '',
    size_id: '',
    image_url: '',
  });

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const [lookupRows, productRows, sampleRows] = await Promise.all([
        getBlankProductLookups(),
        getBlankProducts(search),
        getSampleInventory(sampleSearch),
      ]);
      setLookups(lookupRows);
      setBlankProducts(productRows);
      setSamples(sampleRows);
    } catch (err) {
      setMessage(err.message || 'Failed to load sample inventory. Run the sample inventory SQL first.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(event) {
    event.preventDefault();
    await load();
  }

  function updateNew(field, value) {
    setNewProduct((current) => ({ ...current, [field]: value }));
  }

  function generateSku() {
    const sku = buildSkuFromLookups({
      ...lookups,
      brandId: newProduct.brand_id,
      productTypeId: newProduct.product_type_id,
      colorId: newProduct.color_id,
      sizeId: newProduct.size_id,
    });
    if (!sku) {
      setMessage('Choose brand, style, color, and size first.');
      return;
    }
    setNewProduct((current) => ({
      ...current,
      sku_base: sku,
      name: current.name || sku.replace(/-/g, ' '),
    }));
  }

  async function handleCreateBlank(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const created = await createBlankProduct(newProduct);
      setBlankProductId(created.id);
      setShowCreate(false);
      setMessage('Blank product created and selected for sample inventory.');
      setNewProduct({ sku_base: '', name: '', brand_id: '', product_type_id: '', color_id: '', size_id: '', image_url: '' });
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to create blank product.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSample(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await addSampleInventory({ blankProductId, quantity, notes });
      setMessage('Sample inventory added.');
      setQuantity(1);
      setNotes('');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to add sample inventory.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Samples</p>
          <h1>Sample Inventory</h1>
          <p className="helper-text">Sample items are stored separately from bin inventory and do not affect blank inventory quantities.</p>
        </div>
      </div>

      {message && <p className="message">{message}</p>}

      <form onSubmit={handleSearch} className="card">
        <h2>Find Blank Product</h2>
        <label htmlFor="sample-blank-search">Search blank products</label>
        <input id="sample-blank-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Brand, style, color, size, SKU..." />
        <button type="submit" disabled={loading}>Search</button>
      </form>

      <section className="card">
        <button type="button" onClick={() => setShowCreate((current) => !current)}>
          {showCreate ? 'Hide New Blank Product Form' : '+ Create New Blank Product'}
        </button>
      </section>

      {showCreate && (
        <form onSubmit={handleCreateBlank} className="card">
          <h2>Create Blank Product for Samples</h2>
          <label>Brand</label>
          <select value={newProduct.brand_id} onChange={(e) => updateNew('brand_id', e.target.value)}><option value="">Choose...</option>{lookups.brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <label>Style / Product Type</label>
          <select value={newProduct.product_type_id} onChange={(e) => updateNew('product_type_id', e.target.value)}><option value="">Choose...</option>{lookups.productTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <label>Color</label>
          <select value={newProduct.color_id} onChange={(e) => updateNew('color_id', e.target.value)}><option value="">Choose...</option>{lookups.colors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <label>Size</label>
          <select value={newProduct.size_id} onChange={(e) => updateNew('size_id', e.target.value)}><option value="">Choose...</option>{lookups.sizes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <label>Blank SKU Base</label>
          <div className="inline-form"><input value={newProduct.sku_base} onChange={(e) => updateNew('sku_base', e.target.value)} required /><button type="button" onClick={generateSku}>Generate</button></div>
          <label>Name</label>
          <input value={newProduct.name} onChange={(e) => updateNew('name', e.target.value)} required />
          <label>Image URL</label>
          <input value={newProduct.image_url} onChange={(e) => updateNew('image_url', e.target.value)} />
          <button type="submit" disabled={loading}>Create Blank Product</button>
        </form>
      )}

      <form onSubmit={handleAddSample} className="card">
        <h2>Add Sample Item</h2>
        <label>Blank product</label>
        <select value={blankProductId} onChange={(event) => setBlankProductId(event.target.value)} required>
          <option value="">Choose blank product...</option>
          {blankProducts.map((product) => <option key={product.id} value={product.id}>{formatBlankProductLabel(product)}</option>)}
        </select>
        <p className="helper-text">{blankProducts.length} blank products available from current search.</p>
        <label>Sample quantity</label>
        <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
        <label>Notes</label>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Example: showroom sample, vendor swatch, test print sample" />
        <button type="submit" disabled={loading}>Add to Sample Inventory</button>
      </form>

      <section className="card">
        <h2>Current Sample Inventory</h2>
        <form onSubmit={handleSearch} className="inline-form">
          <input value={sampleSearch} onChange={(event) => setSampleSearch(event.target.value)} placeholder="Search samples..." />
          <button type="submit" disabled={loading}>Search Samples</button>
        </form>
        <div className="table-scroll">
          <table>
            <thead><tr><th>SKU</th><th>Name</th><th>Brand</th><th>Style</th><th>Color</th><th>Size</th><th>Qty</th><th>Notes</th></tr></thead>
            <tbody>
              {samples.map((row) => (
                <tr key={row.id}><td>{row.sku_base}</td><td>{row.name}</td><td>{row.brand}</td><td>{row.product_type}</td><td>{row.color}</td><td>{row.size}</td><td>{row.quantity}</td><td>{row.notes}</td></tr>
              ))}
              {samples.length === 0 && <tr><td colSpan="8">No sample inventory found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
