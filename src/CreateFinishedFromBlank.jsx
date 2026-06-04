import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  createFinishedProductFromBlank,
  formatBinLabel,
  getBins,
} from './lib/inventoryApi';

function formatBlankLabel(blank) {
  return [
    blank.sku_base,
    blank.brand,
    blank.style,
    blank.color,
    blank.size,
    blank.on_hand_quantity != null ? `On hand: ${blank.on_hand_quantity}` : null,
  ].filter(Boolean).join(' / ');
}

function formatFinishedLabel(finished) {
  return [
    finished.finished_sku || finished.sku,
    finished.name,
    finished.customer_name,
    finished.logo_name,
    finished.brand,
    finished.style,
    finished.color,
    finished.size,
    finished.finished_on_hand != null ? `On hand: ${finished.finished_on_hand}` : null,
  ].filter(Boolean).join(' / ');
}

async function rpcSearchBlankProducts(search) {
  const { data, error } = await supabase.rpc('search_blank_products_for_finished_creation', {
    p_search: String(search || '').trim(),
    p_limit: 5000,
  });

  if (error) throw error;
  return data || [];
}

async function rpcSearchFinishedProducts(search) {
  const { data, error } = await supabase.rpc('search_finished_products_for_pairing', {
    p_search: String(search || '').trim(),
    p_limit: 5000,
  });

  if (error) throw error;
  return data || [];
}

async function getCustomersForDropdown() {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, code, customer_key')
    .order('name', { ascending: true })
    .limit(5000);

  if (error) throw error;
  return data || [];
}

async function getLogosForDropdown() {
  const { data, error } = await supabase
    .from('logos')
    .select('id, name, code')
    .order('name', { ascending: true })
    .limit(5000);

  if (error) throw error;
  return data || [];
}

async function getBlankSourceBins(blankProductId) {
  if (!blankProductId) return [];

  const { data, error } = await supabase.rpc('get_blank_product_source_bins', {
    p_blank_product_id: blankProductId,
  });

  if (error) throw error;
  return data || [];
}

function lookupName(rows, id) {
  const row = rows.find((item) => String(item.id) === String(id));
  return row?.name || '';
}

export default function CreateFinishedFromBlank() {
  const [search, setSearch] = useState('');
  const [blankProducts, setBlankProducts] = useState([]);
  const [bins, setBins] = useState([]);
  const [sourceBins, setSourceBins] = useState([]);
  const [blankProductId, setBlankProductId] = useState('');

  const [customers, setCustomers] = useState([]);
  const [logos, setLogos] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [logoId, setLogoId] = useState('');

  const [existingFinishedSearch, setExistingFinishedSearch] = useState('');
  const [existingFinishedProducts, setExistingFinishedProducts] = useState([]);
  const [existingFinishedProductId, setExistingFinishedProductId] = useState('');

  const [finishedBinId, setFinishedBinId] = useState('');
  const [blankBinId, setBlankBinId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [decorationType, setDecorationType] = useState('');
  const [placement, setPlacement] = useState('');
  const [decorationSize, setDecorationSize] = useState('');
  const [deductBlank, setDeductBlank] = useState(true);
  const [productionSource, setProductionSource] = useState('manual_production');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedBlank = useMemo(
    () => blankProducts.find((row) => String(row.blank_product_id || row.id) === String(blankProductId)),
    [blankProducts, blankProductId]
  );

  const selectedExistingFinished = useMemo(
    () => existingFinishedProducts.find((row) => String(row.finished_product_id || row.id) === String(existingFinishedProductId)),
    [existingFinishedProducts, existingFinishedProductId]
  );

  const usingExistingFinishedProduct = Boolean(existingFinishedProductId);

  async function loadInitial() {
    setMessage('');
    try {
      const [binRows, customerRows, logoRows] = await Promise.all([
        getBins(),
        getCustomersForDropdown(),
        getLogosForDropdown(),
      ]);

      setBins(binRows);
      setCustomers(customerRows);
      setLogos(logoRows);
    } catch (err) {
      setMessage(err.message || 'Failed to load page data.');
    }
  }

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    async function loadSourceBins() {
      setBlankBinId('');
      setSourceBins([]);

      if (!blankProductId) return;

      try {
        const rows = await getBlankSourceBins(blankProductId);
        setSourceBins(rows);
      } catch (err) {
        setMessage(err.message || 'Failed to load source bins for selected blank.');
      }
    }

    loadSourceBins();
  }, [blankProductId]);

  async function runSearch(event) {
    event.preventDefault();
    setMessage('');
    setBlankProductId('');

    try {
      const rows = await rpcSearchBlankProducts(search);
      setBlankProducts(rows);

      if (rows.length === 1) {
        setBlankProductId(rows[0].blank_product_id || rows[0].id);
      }

      setMessage(`Found ${rows.length} blank product(s).`);
    } catch (err) {
      setMessage(err.message || 'Blank product search failed.');
    }
  }

  async function runExistingFinishedSearch(event) {
    event.preventDefault();
    setMessage('');
    setExistingFinishedProductId('');

    try {
      const rows = await rpcSearchFinishedProducts(existingFinishedSearch);
      setExistingFinishedProducts(rows);

      if (rows.length === 1) {
        setExistingFinishedProductId(rows[0].finished_product_id || rows[0].id);
      }

      setMessage(`Found ${rows.length} existing finished product(s).`);
    } catch (err) {
      setMessage(err.message || 'Existing finished product search failed.');
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const customerName = lookupName(customers, customerId);
      const logoName = lookupName(logos, logoId);

      if (!usingExistingFinishedProduct && !customerName) {
        throw new Error('Choose a customer.');
      }

      if (!usingExistingFinishedProduct && !logoName) {
        throw new Error('Choose a logo/design.');
      }

      if (deductBlank && !blankBinId) {
        throw new Error('Choose a source bin that contains the selected blank item.');
      }

      const result = await createFinishedProductFromBlank({
        blankProductId,
        existingFinishedProductId: existingFinishedProductId || null,
        finishedBinId,
        quantity: Number(quantity),
        customerName,
        logoName,
        customerId: customerId || null,
        logoId: logoId || null,
        decorationType: usingExistingFinishedProduct ? null : decorationType,
        placement: usingExistingFinishedProduct ? null : placement,
        decorationSize: usingExistingFinishedProduct ? null : decorationSize,
        productionSource,
        notes,
        deductBlank,
        blankBinId: deductBlank ? blankBinId : null,
      });

      setMessage(
        `Finished inventory received. Match method: ${result?.match_method || 'unknown'}`
      );

      setQuantity(1);
      setNotes('');
    } catch (err) {
      setMessage(err.message || 'Failed to create or receive finished product.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Finished Inventory</p>
          <h1>Create Finished Product from Blank</h1>
          <p>Create finished inventory outside of an order or pullsheet.</p>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <form onSubmit={runSearch} className="card elevated-card">
        <h2>Find Blank Product</h2>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search blank SKU, brand, style, color, size..."
        />
        <button type="submit">Search Blanks</button>
      </form>

      <form onSubmit={submit} className="card elevated-card">
        <h2>Finished Product Details</h2>

        <label>Blank product</label>
        <select value={blankProductId} onChange={(event) => setBlankProductId(event.target.value)} required={!existingFinishedProductId || deductBlank}>
          <option value="">Choose blank product...</option>
          {blankProducts.map((blank) => (
            <option key={blank.blank_product_id || blank.id} value={blank.blank_product_id || blank.id}>
              {formatBlankLabel(blank)}
            </option>
          ))}
        </select>

        {selectedBlank && (
          <p className="helper-text">
            Selected blank: <strong>{formatBlankLabel(selectedBlank)}</strong>
          </p>
        )}

        <section className="nested-card">
          <h3>Optional Manual Pairing</h3>
          <p className="helper-text">
            If this finished item already exists from WooCommerce or a previous manual entry, search and select it here.
            When selected, the system adds inventory to that existing finished product instead of creating a new one.
          </p>

          <div className="inline-form-row">
            <input
              value={existingFinishedSearch}
              onChange={(event) => setExistingFinishedSearch(event.target.value)}
              placeholder="Search existing finished product by SKU, customer, logo, brand, color, size..."
            />
            <button type="button" onClick={runExistingFinishedSearch}>Search Existing Finished</button>
          </div>

          <label>Pair to existing finished product</label>
          <select value={existingFinishedProductId} onChange={(event) => setExistingFinishedProductId(event.target.value)}>
            <option value="">No manual pairing — auto-match or create new</option>
            {existingFinishedProducts.map((finished) => (
              <option key={finished.finished_product_id || finished.id} value={finished.finished_product_id || finished.id}>
                {formatFinishedLabel(finished)}
              </option>
            ))}
          </select>

          {selectedExistingFinished && (
            <p className="helper-text">
              Manual pairing selected. Inventory will be added to: <strong>{formatFinishedLabel(selectedExistingFinished)}</strong>
            </p>
          )}
        </section>

        {!usingExistingFinishedProduct && (
          <div className="form-grid">
            <label>
              Customer
              <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
                <option value="">Choose customer...</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Logo / Design
              <select value={logoId} onChange={(event) => setLogoId(event.target.value)} required>
                <option value="">Choose logo/design...</option>
                {logos.map((logo) => (
                  <option key={logo.id} value={logo.id}>
                    {logo.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Decoration Type
              <input value={decorationType} onChange={(event) => setDecorationType(event.target.value)} placeholder="Optional: Screen Print, DTF, Embroidery" />
            </label>

            <label>
              Placement
              <input value={placement} onChange={(event) => setPlacement(event.target.value)} placeholder="Optional: Left Chest, Full Front" />
            </label>

            <label>
              Decoration Size
              <input value={decorationSize} onChange={(event) => setDecorationSize(event.target.value)} placeholder="Optional: 3.5 in, 10 in" />
            </label>
          </div>
        )}

        {usingExistingFinishedProduct && (
          <p className="helper-text">
            Customer, logo, decoration type, placement, and decoration size are taken from the selected WooCommerce finished product.
          </p>
        )}

        <div className="form-grid">
          <label>
            Quantity
            <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
          </label>

          <label>
            Production Source
            <select value={productionSource} onChange={(event) => setProductionSource(event.target.value)}>
              <option value="manual_production">Manual Production</option>
              <option value="overstock_production">Overstock Production</option>
              <option value="customer_order">Customer Order</option>
              <option value="sample_inventory">Sample Inventory</option>
            </select>
          </label>
        </div>

        <label>Finished inventory bin</label>
        <select value={finishedBinId} onChange={(event) => setFinishedBinId(event.target.value)} required>
          <option value="">Choose finished bin...</option>
          {bins.map((bin) => (
            <option key={bin.id} value={bin.id}>
              {formatBinLabel(bin)}
            </option>
          ))}
        </select>

        <label className="checkbox-label">
          <input type="checkbox" checked={deductBlank} onChange={(event) => setDeductBlank(event.target.checked)} />
          Deduct blank inventory from a source bin
        </label>

        {deductBlank && (
          <>
            <label>Blank source bin</label>
            <select value={blankBinId} onChange={(event) => setBlankBinId(event.target.value)} required={deductBlank}>
              <option value="">Choose source bin containing this blank...</option>
              {sourceBins.map((bin) => (
                <option key={bin.bin_id} value={bin.bin_id}>
                  {[bin.bin_code, bin.label, bin.location, `${bin.on_hand_quantity} on hand`].filter(Boolean).join(' - ')}
                </option>
              ))}
            </select>
            {blankProductId && sourceBins.length === 0 && (
              <p className="message warning">This blank item is not currently available in any bin. You cannot deduct it until it is received into inventory.</p>
            )}
          </>
        )}

        <label>Notes</label>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />

        <button type="submit" disabled={busy || (deductBlank && blankProductId && sourceBins.length === 0)}>
          {busy ? 'Creating...' : 'Create Finished Product + Add Inventory'}
        </button>
      </form>
    </main>
  );
}
