import { supabase } from '../supabaseClient';

function normalizeSearchValue(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function textSearchValue(value) {
  return String(value || '').toLowerCase();
}

function searchTokens(term) {
  return String(term || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function productMatchesAllTokens(product, term) {
  const tokens = searchTokens(term);
  if (!tokens.length) return true;

  const parts = blankProductSearchText(product)
    .concat([formatBlankProductLabel(product)])
    .map((part) => ({
      text: textSearchValue(part),
      normalized: normalizeSearchValue(part),
    }));

  return tokens.every((token) => {
    const normalizedToken = normalizeSearchValue(token);
    return parts.some((part) =>
      part.text.includes(token) || part.normalized.includes(normalizedToken)
    );
  });
}

function escapeOrTerm(term) {
  return String(term || '').replace(/[%_,]/g, '\\$&');
}

function blankProductSearchText(product) {
  return [
    product.sku_base,
    product.barcode,
    product.name,
    product.brands?.name,
    product.brands?.code,
    product.product_types?.name,
    product.product_types?.code,
    product.colors?.name,
    product.colors?.code,
    product.sizes?.name,
    product.sizes?.code,
  ];
}

export function formatBinLabel(bin) {
  return [bin?.bin_code, bin?.label, bin?.location].filter(Boolean).join(' - ');
}

export function formatBlankProductLabel(product) {
  const brand = product?.brands?.code || product?.brands?.name || product?.brand;
  const type = product?.product_types?.code || product?.product_types?.name || product?.product_type;
  const color = product?.colors?.code || product?.colors?.name || product?.color;
  const size = product?.sizes?.code || product?.sizes?.name || product?.size;

  return [product?.sku_base, product?.name, brand, type, color, size]
    .filter(Boolean)
    .join(' - ');
}

export function money(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export async function getBins() {
  const { data, error } = await supabase
    .from('bins')
    .select('id, bin_code, label, location, nfc_url, display_order, created_at')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('bin_code', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createBin({ binCode, label, location }) {
  const payload = {
    bin_code: binCode?.trim() || null,
    label: label?.trim() || null,
    location: location?.trim() || null,
  };

  if (!payload.bin_code && !payload.label) {
    throw new Error('Enter a bin code or label.');
  }

  const { data, error } = await supabase
    .from('bins')
    .insert(payload)
    .select('id, bin_code, label, location, nfc_url, display_order')
    .single();

  if (error) throw error;
  return data;
}

export async function getBin(binId) {
  const { data, error } = await supabase
    .from('bins')
    .select('id, bin_code, label, location, nfc_url, display_order, created_at')
    .eq('id', Number(binId))
    .single();

  if (error) throw error;
  return data;
}


export async function getBlankProductLookups() {
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

  return {
    brands: brandRes.data || [],
    colors: colorRes.data || [],
    sizes: sizeRes.data || [],
    productTypes: typeRes.data || [],
  };
}

export async function createBlankProduct(input) {
  const skuBase = String(input?.sku_base || '').trim().toUpperCase();
  const name = String(input?.name || '').trim();

  if (!skuBase) throw new Error('Enter a blank SKU base.');
  if (!name) throw new Error('Enter a blank item name.');

  const payload = {
    sku_base: skuBase,
    name,
    barcode: String(input?.barcode || '').trim() || null,
    brand_id: input?.brand_id ? Number(input.brand_id) : null,
    product_type_id: input?.product_type_id ? Number(input.product_type_id) : null,
    color_id: input?.color_id ? Number(input.color_id) : null,
    size_id: input?.size_id ? Number(input.size_id) : null,
    image_url: String(input?.image_url || '').trim() || null,
    unit_cost: input?.unit_cost !== '' && input?.unit_cost != null ? Number(input.unit_cost) : null,
    low_stock_threshold: input?.low_stock_threshold !== '' && input?.low_stock_threshold != null ? Number(input.low_stock_threshold) : null,
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === null || Number.isNaN(payload[key])) delete payload[key];
  });

  const { data, error } = await supabase
    .from('blank_products')
    .upsert(payload, { onConflict: 'sku_base' })
    .select(`
      id,
      sku_base,
      barcode,
      name,
      image_url,
      unit_cost,
      low_stock_threshold,
      brand_id,
      color_id,
      size_id,
      product_type_id,
      brands:brand_id(name, code),
      colors:color_id(name, code),
      sizes:size_id(name, code),
      product_types:product_type_id(name, code)
    `)
    .single();

  if (error) throw error;
  return data;
}


export async function updateBlankProduct(blankProductId, input) {
  if (!blankProductId) throw new Error('Missing blank product ID.');

  const skuBase = String(input?.sku_base || '').trim().toUpperCase();
  const name = String(input?.name || '').trim();

  if (!skuBase) throw new Error('Enter a blank SKU base.');
  if (!name) throw new Error('Enter a blank item name.');

  const payload = {
    sku_base: skuBase,
    name,
    barcode: String(input?.barcode || '').trim() || null,
    brand_id: input?.brand_id ? Number(input.brand_id) : null,
    product_type_id: input?.product_type_id ? Number(input.product_type_id) : null,
    color_id: input?.color_id ? Number(input.color_id) : null,
    size_id: input?.size_id ? Number(input.size_id) : null,
    image_url: String(input?.image_url || '').trim() || null,
    unit_cost: input?.unit_cost !== '' && input?.unit_cost != null ? Number(input.unit_cost) : 0,
    low_stock_threshold: input?.low_stock_threshold !== '' && input?.low_stock_threshold != null ? Number(input.low_stock_threshold) : null,
  };

  Object.keys(payload).forEach((key) => {
    if (Number.isNaN(payload[key])) delete payload[key];
  });

  const { data, error } = await supabase
    .from('blank_products')
    .update(payload)
    .eq('id', blankProductId)
    .select(`
      id,
      sku_base,
      barcode,
      name,
      image_url,
      unit_cost,
      low_stock_threshold,
      brand_id,
      color_id,
      size_id,
      product_type_id,
      brands:brand_id(name, code),
      colors:color_id(name, code),
      sizes:size_id(name, code),
      product_types:product_type_id(name, code)
    `)
    .single();

  if (error) throw error;
  return data;
}


export async function bulkUpdateBlankProducts(blankProductIds, input) {
  const ids = Array.from(new Set((blankProductIds || []).filter(Boolean)));
  if (!ids.length) throw new Error('Select at least one blank item.');

  const payload = {};

  if (Object.prototype.hasOwnProperty.call(input, 'brand_id')) {
    payload.brand_id = input.brand_id ? Number(input.brand_id) : null;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'product_type_id')) {
    payload.product_type_id = input.product_type_id ? Number(input.product_type_id) : null;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'color_id')) {
    payload.color_id = input.color_id ? Number(input.color_id) : null;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'size_id')) {
    payload.size_id = input.size_id ? Number(input.size_id) : null;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'unit_cost')) {
    const unitCost = input.unit_cost === '' || input.unit_cost == null ? 0 : Number(input.unit_cost);
    if (Number.isNaN(unitCost) || unitCost < 0) throw new Error('Unit cost must be zero or greater.');
    payload.unit_cost = unitCost;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'low_stock_threshold')) {
    if (input.low_stock_threshold === '' || input.low_stock_threshold == null) {
      payload.low_stock_threshold = null;
    } else {
      const threshold = Number(input.low_stock_threshold);
      if (Number.isNaN(threshold) || threshold < 0) throw new Error('Low-stock threshold must be zero or greater.');
      payload.low_stock_threshold = threshold;
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, 'image_url')) {
    payload.image_url = String(input.image_url || '').trim() || null;
  }

  Object.keys(payload).forEach((key) => {
    if (Number.isNaN(payload[key])) delete payload[key];
  });

  if (!Object.keys(payload).length) {
    throw new Error('Choose at least one bulk edit field to apply.');
  }

  const { data, error } = await supabase
    .from('blank_products')
    .update(payload)
    .in('id', ids)
    .select('id');

  if (error) throw error;
  return data || [];
}

export async function getBlankProducts(search = '') {
  const { data, error } = await supabase
    .from('blank_products')
    .select(`
      id,
      sku_base,
      barcode,
      name,
      image_url,
      unit_cost,
      low_stock_threshold,
      brand_id,
      color_id,
      size_id,
      product_type_id,
      brands:brand_id(name, code),
      colors:color_id(name, code),
      sizes:size_id(name, code),
      product_types:product_type_id(name, code)
    `)
    .order('name', { ascending: true })
    .limit(5000);

  if (error) throw error;

  const rows = data || [];
  const term = search.trim();

  if (!term) return rows;

  return rows.filter((product) => productMatchesAllTokens(product, term));
}

export async function findBlankProductsByScannedValue(value) {
  const term = String(value || '').trim();
  if (!term) return [];

  const products = await getBlankProducts(term);
  const normalized = normalizeSearchValue(term);

  return [...products].sort((a, b) => {
    const aExact = normalizeSearchValue(a.sku_base) === normalized || normalizeSearchValue(a.barcode) === normalized;
    const bExact = normalizeSearchValue(b.sku_base) === normalized || normalizeSearchValue(b.barcode) === normalized;

    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    return formatBlankProductLabel(a).localeCompare(formatBlankProductLabel(b));
  });
}

export async function findBlankProductByScannedValue(value) {
  const products = await findBlankProductsByScannedValue(value);
  return products[0] || null;
}

function normalizeCatalogInventoryRow(row) {
  const onHand = Number(row.on_hand_quantity ?? row.quantity_on_hand ?? row.total_quantity ?? row.quantity ?? 0);
  const reserved = Number(row.reserved_quantity ?? row.quantity_reserved ?? row.reserved ?? 0);
  const available = Number(row.available_quantity ?? (onHand - reserved));
  const skuBase = row.blank_sku || row.sku_base || row.blank_sku_base || row.woo_sku || row.sku || '';
  const displayName = row.blank_product_name || row.product_display_name || row.name || row.woo_product_name || skuBase;

  return {
    ...row,
    product_row_id: row.product_row_id || row.synced_product_id || row.product_id || null,
    blank_product_id: row.blank_product_id || row.product_row_id || row.id || null,
    sku_base: skuBase,
    blank_sku: row.blank_sku || row.sku_base || row.blank_sku_base || skuBase,
    woo_sku: row.woo_sku || row.sku || row.linked_woo_skus || '',
    name: displayName,
    blank_product_name: row.blank_product_name || displayName,
    product_type: row.product_type || row.style,
    style: row.style || row.product_type,
    quantity_on_hand: Number.isFinite(onHand) ? onHand : 0,
    total_quantity: Number.isFinite(onHand) ? onHand : 0,
    reserved_quantity: Number.isFinite(reserved) ? reserved : 0,
    available_quantity: Number.isFinite(available) ? available : 0,
    inventory_status: row.inventory_status || (onHand > 0 ? 'in_stock' : 'zero_on_hand'),
    search_text: row.search_text || '',
  };
}

function inventoryCatalogSearchParts(row) {
  return [
    row.product_row_id,
    row.blank_product_id,
    row.woo_sku,
    row.sku,
    row.sku_base,
    row.blank_sku,
    row.woo_product_name,
    row.blank_product_name,
    row.name,
    row.brand,
    row.product_type,
    row.style,
    row.color,
    row.size,
    row.inventory_status,
    row.search_text,
    row.barcode,
    row.linked_woo_skus,
    row.supplier_skus,
    row.vendor,
    row.supplier,
  ].filter(Boolean).map((part) => ({
    text: textSearchValue(part),
    normalized: normalizeSearchValue(part),
  }));
}

export async function getBlankInventory(search = '') {
  let rows = [];
  let catalogError = null;

  const preferred = await supabase
    .from('app_blank_inventory_overview_v2')
    .select('*')
    .order('blank_product_name', { ascending: true })
    .limit(30000);

  if (!preferred.error) {
    rows = (preferred.data || []).map(normalizeCatalogInventoryRow);
  } else {
    catalogError = preferred.error;

    const catalog = await supabase
      .from('app_synced_inventory_catalog_v1')
      .select('*')
      .order('name', { ascending: true })
      .limit(20000);

    if (!catalog.error) {
      rows = (catalog.data || []).map(normalizeCatalogInventoryRow);
    } else {
      catalogError = catalogError || catalog.error;

      // Backward-compatible fallback so the app still loads before the SQL patch is installed.
      const legacy = await supabase
        .from('blank_inventory_by_product')
        .select('*')
        .order('name', { ascending: true })
        .limit(10000);

      if (legacy.error) {
        throw catalogError || legacy.error;
      }

      rows = (legacy.data || []).map(normalizeCatalogInventoryRow);
    }
  }

  const term = String(search || '').trim();
  if (!term) return rows;

  const tokens = searchTokens(term);
  if (!tokens.length) return rows;

  return rows.filter((row) => {
    const searchable = inventoryCatalogSearchParts(row);
    return tokens.every((token) => {
      const normalizedToken = normalizeSearchValue(token);
      return searchable.some((part) =>
        part.text.includes(token) || part.normalized.includes(normalizedToken)
      );
    });
  });
}

export async function getBinContents(binId, search = '') {
  let query = supabase
    .from('bin_blank_inventory_contents')
    .select('*')
    .eq('bin_id', Number(binId))
    .order('sku_base', { ascending: true });

  const term = search.trim();

  if (term) {
    const escaped = escapeOrTerm(term);
    query = query.or(
      `sku_base.ilike.%${escaped}%,name.ilike.%${escaped}%,brand.ilike.%${escaped}%,product_type.ilike.%${escaped}%,color.ilike.%${escaped}%,size.ilike.%${escaped}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getBinItemReceiveHistory({ binId, blankProductId, skuBase } = {}) {
  const normalizedBinId = binId == null ? '' : String(binId);
  const normalizedBlankId = blankProductId == null ? null : String(blankProductId);
  const normalizedSkuBase = skuBase == null ? null : String(skuBase);

  if (!normalizedBinId) {
    throw new Error('Missing bin ID for receiving history.');
  }

  const rpc = await supabase.rpc('sc_get_bin_blank_receive_history_v1', {
    p_bin_id_text: normalizedBinId,
    p_blank_product_id_text: normalizedBlankId,
    p_sku_base_text: normalizedSkuBase,
  });

  if (!rpc.error) {
    return rpc.data || [];
  }

  // Fallback for deployments before the SQL patch is installed.
  let query = supabase
    .from('blank_inventory_movements')
    .select(`
      *,
      blank_products:blank_product_id(sku_base,name)
    `)
    .eq('bin_id', Number(binId))
    .order('created_at', { ascending: false })
    .limit(250);

  if (normalizedBlankId) {
    query = query.eq('blank_product_id', normalizedBlankId);
  }

  const { data, error } = await query;
  if (error) throw rpc.error || error;

  return (data || [])
    .filter((row) => {
      const sku = row?.blank_products?.sku_base || row?.sku_base || '';
      if (normalizedSkuBase && normalizeSearchValue(sku) !== normalizeSearchValue(normalizedSkuBase)) return false;
      const quantity = Number(row.quantity_change ?? row.quantity ?? 0);
      return Number.isFinite(quantity) && quantity > 0;
    })
    .map((row) => ({
      movement_id: row.id,
      received_at: row.created_at,
      quantity: Number(row.quantity_change ?? row.quantity ?? 0),
      unit_cost: row.unit_cost ?? row.price ?? row.cost ?? null,
      vendor: row.vendor || row.supplier || null,
      supplier: row.supplier || row.vendor || null,
      po_number: row.po_number || row.purchase_order_number || null,
      source: row.source || row.source_type || row.movement_type || null,
      movement_type: row.movement_type || null,
      notes: row.notes || '',
      blank_product_id: row.blank_product_id,
      sku_base: row?.blank_products?.sku_base || row.sku_base || '',
      blank_name: row?.blank_products?.name || row.name || '',
      details: row,
    }));
}

export async function receiveBlankInventory({ binId, blankProductId, quantity, notes }) {
  const { error } = await supabase.rpc('receive_blank_inventory', {
    p_bin_id: Number(binId),
    p_blank_product_id: blankProductId,
    p_quantity: Number(quantity),
    p_notes: notes || null,
  });

  if (error) throw error;
}

export async function setBinBlankInventoryQuantity({ binId, blankProductId, quantity, notes }) {
  const { error } = await supabase.rpc('set_bin_blank_inventory_quantity', {
    p_bin_id: Number(binId),
    p_blank_product_id: blankProductId,
    p_quantity: Number(quantity),
    p_notes: notes || null,
  });

  if (error) throw error;
}

export async function transferBlankInventory({ fromBinId, toBinId, blankProductId, quantity, notes }) {
  const { error } = await supabase.rpc('transfer_blank_inventory', {
    p_from_bin_id: Number(fromBinId),
    p_to_bin_id: Number(toBinId),
    p_blank_product_id: blankProductId,
    p_quantity: Number(quantity),
    p_notes: notes || null,
  });

  if (error) throw error;
}

export async function reserveInventory({ blankProductId, binId, quantity, orderRef, customerName, notes }) {
  const { data, error } = await supabase.rpc('create_inventory_reservation_safe', {
    p_blank_product_id: blankProductId,
    p_bin_id: binId ? Number(binId) : null,
    p_quantity: Number(quantity),
    p_order_ref: orderRef || null,
    p_customer_name: customerName || null,
    p_notes: notes || null,
  });

  if (error) throw error;
  return data;
}

export async function releaseReservation({ reservationId, notes }) {
  const { error } = await supabase.rpc('release_inventory_reservation_safe', {
    p_reservation_id: reservationId,
    p_notes: notes || null,
  });

  if (error) throw error;
}

export async function getReservations(status = 'active') {
  const { data, error } = await supabase.rpc('get_inventory_reservations_safe', {
    p_status: status && status !== 'all' ? status : null,
  });

  if (error) throw error;

  return (data || []).map((row) => ({
    ...row,
    name: row.name || row.blank_product_name || row.blank_name || '',
    customer_name: row.customer_name || row.customer || '',
    order_ref: row.order_ref || row.order_reference || '',
    quantity_reserved: row.quantity_reserved ?? row.quantity ?? 0,
  }));
}

export async function recordAuditCount({ binId, blankProductId, countedQuantity, expectedQuantity, notes }) {
  const { error } = await supabase.rpc('record_bin_audit_count', {
    p_bin_id: Number(binId),
    p_blank_product_id: blankProductId,
    p_counted_quantity: Number(countedQuantity),
    p_expected_quantity: Number(expectedQuantity || 0),
    p_notes: notes || null,
  });

  if (error) throw error;
}

export async function getLowStockItems() {
  const { data, error } = await supabase
    .from('low_stock_blank_inventory')
    .select('*')
    .order('available_quantity', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getInventoryValuation() {
  const { data, error } = await supabase
    .from('inventory_valuation_by_product')
    .select('*')
    .order('inventory_value', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getDashboardMetrics() {
  const { data, error } = await supabase
    .from('inventory_dashboard_metrics')
    .select('*')
    .maybeSingle();

  if (error) throw error;

  const row = data || {};

  // If the metrics view has an old/missing bins field, fetch bins directly.
  let binsCount =
    row.total_bins ??
    row.bin_count ??
    row.bins_count ??
    row.bins ??
    null;

  if (binsCount === null || binsCount === undefined) {
    const { count, error: binsError } = await supabase
      .from('bins')
      .select('id', { count: 'exact', head: true });

    if (!binsError) {
      binsCount = count || 0;
    }
  }

  return {
    total_bins: binsCount ?? 0,

    total_units_on_hand:
      row.total_units_on_hand ??
      row.on_hand_units ??
      row.total_on_hand ??
      row.total_units ??
      0,

    total_reserved_units:
      row.total_reserved_units ??
      row.total_units_reserved ??
      row.reserved_units ??
      0,

    total_available_units:
      row.total_available_units ??
      row.total_units_available ??
      row.available_units ??
      row.total_units_on_hand ??
      row.total_on_hand ??
      0,

    total_inventory_value:
      row.total_inventory_value ??
      row.inventory_value ??
      row.value ??
      0,

    low_stock_count:
      row.low_stock_count ??
      row.low_stock_items ??
      0,
  };
}

function normalizeActivityRow(row) {
  const unwrapped = row?.activity && typeof row.activity === 'object' && !Array.isArray(row.activity)
    ? row.activity
    : row;
  const payload = unwrapped?.payload || unwrapped?.metadata || unwrapped?.details_json || unwrapped?.raw_payload || null;
  const payloadObject = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};

  return {
    ...payloadObject,
    ...unwrapped,
    source_table:
      unwrapped?.source_table ||
      unwrapped?.table_name ||
      unwrapped?.entity_table ||
      payloadObject.source_table ||
      payloadObject.table_name ||
      null,
    source_id:
      unwrapped?.source_id ||
      unwrapped?.movement_id ||
      unwrapped?.blank_inventory_movement_id ||
      unwrapped?.entity_id ||
      payloadObject.source_id ||
      payloadObject.movement_id ||
      null,
  };
}

async function attachUndoMetadata(rows) {
  const activityIds = rows.map((row) => row.id).filter((id) => id !== null && id !== undefined).map(String);

  if (!activityIds.length) return rows;

  const undoLog = await supabase
    .from('sc_activity_undo_log')
    .select('activity_id, source_table, source_id, reversal_movement_id, undone_at, reason')
    .in('activity_id', activityIds);

  if (!undoLog.error && Array.isArray(undoLog.data)) {
    const byActivityId = new Map(undoLog.data.map((entry) => [String(entry.activity_id), entry]));
    rows.forEach((row) => {
      const undo = byActivityId.get(String(row.id));
      if (undo) {
        row.undone_at = undo.undone_at;
        row.undo_reason = undo.reason;
        row.undo_reversal_movement_id = undo.reversal_movement_id;
      }
    });
  }

  return rows;
}

export async function getActivityFeed(limit = 25) {
  const { data, error } = await supabase
    .from('inventory_activity_feed')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return attachUndoMetadata((data || []).map(normalizeActivityRow));
}

function rowMatchesPullSheet(row, jobId) {
  const target = String(jobId || '').trim();
  if (!target) return true;

  const directFields = [
    row.job_id,
    row.pullsheet_job_id,
    row.pull_sheet_id,
    row.pullsheet_id,
    row.source_job_id,
    row.order_job_id,
  ];

  if (directFields.some((value) => String(value ?? '').trim() === target)) return true;

  const text = [
    row.description,
    row.summary,
    row.details,
    row.notes,
    row.activity_type,
    row.action_type,
    row.action,
    row.order_ref,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return [
    `job ${target}`,
    `job:${target}`,
    `job_id ${target}`,
    `job_id:${target}`,
    `pullsheet ${target}`,
    `pull sheet ${target}`,
  ].some((needle) => text.includes(needle));
}

export async function getActivityFeedForPullSheet(jobId, limit = 250) {
  if (!jobId) return getActivityFeed(limit);

  let { data, error } = await supabase.rpc('sc_activity_feed_for_pullsheet', {
    p_job_id: Number(jobId),
    p_limit: Number(limit),
  });

  if (error && /function .* does not exist|could not find/i.test(error.message || '')) {
    const allRows = await getActivityFeed(Math.max(Number(limit) * 4, 500));
    return allRows.filter((row) => rowMatchesPullSheet(row, jobId)).slice(0, Number(limit));
  }

  if (error) throw error;

  const rows = (data || []).map(normalizeActivityRow);
  return attachUndoMetadata(rows);
}

export async function undoActivityFeedEntry(activity, reason = '') {
  if (!activity?.id && !activity?.source_id && !activity?.movement_id && !activity?.blank_inventory_movement_id) {
    throw new Error('This activity entry does not include an ID that can be undone.');
  }

  const payload = {
    p_activity_id: activity?.id == null ? null : String(activity.id),
    p_source_table: activity?.source_table || activity?.table_name || activity?.entity_table || null,
    p_source_id: activity?.source_id || activity?.movement_id || activity?.blank_inventory_movement_id || activity?.entity_id || null,
    p_reason: reason || null,
  };

  let { data, error } = await supabase.rpc('sc_undo_activity_feed_entry', payload);

  // Older SQL installs may expose a smaller argument list. Try the minimal
  // version before surfacing the error.
  if (error && /function .* does not exist|could not find/i.test(error.message || '')) {
    const fallback = await supabase.rpc('sc_undo_activity_feed_entry', {
      p_activity_id: payload.p_activity_id,
      p_reason: payload.p_reason,
    });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  if (data && data.success === false) {
    throw new Error(data.message || 'Activity could not be undone.');
  }

  return data || { success: true, message: 'Activity was undone.' };
}

function toBulkUndoTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeBulkUndoOptions(options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit || 250), 2000));
  const jobId = options.jobId || options.pullSheetId || null;
  const orderId = options.orderId || options.woocommerceOrderId || null;

  return {
    p_start_at: toBulkUndoTimestamp(options.startAt),
    p_end_at: toBulkUndoTimestamp(options.endAt),
    p_job_id: jobId ? Number(jobId) : null,
    p_woocommerce_order_id: orderId ? Number(orderId) : null,
    p_limit: limit,
    p_reason: String(options.reason || '').trim() || null,
    p_dry_run: options.dryRun !== false,
  };
}

async function runBulkUndoActivity(options = {}) {
  const payload = normalizeBulkUndoOptions(options);

  const hasScope = payload.p_start_at || payload.p_end_at || payload.p_job_id || payload.p_woocommerce_order_id;
  if (!hasScope) {
    throw new Error('Choose a time range, pull sheet, or WooCommerce order before running bulk undo.');
  }

  const { data, error } = await supabase.rpc('sc_bulk_undo_activity_feed', payload);

  if (error) {
    if (/function .* does not exist|could not find/i.test(error.message || '')) {
      throw new Error('Bulk undo SQL has not been installed yet. Run supabase_activity_feed_bulk_undo.sql in Supabase first.');
    }
    throw error;
  }

  if (data && data.success === false) {
    throw new Error(data.message || 'Bulk undo could not be completed.');
  }

  return data || { success: true, items: [] };
}

export async function previewBulkUndoActivity(options = {}) {
  return runBulkUndoActivity({ ...options, dryRun: true });
}

export async function applyBulkUndoActivity(options = {}) {
  return runBulkUndoActivity({ ...options, dryRun: false });
}

export async function getWooSyncQueue(limit = 50) {
  const { data, error } = await supabase
    .from('woo_sync_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function enqueueWooSync({ entityType, entityId, action, payload }) {
  const { error } = await supabase.from('woo_sync_queue').insert({
    entity_type: entityType,
    entity_id: String(entityId),
    action,
    payload: payload || {},
    status: 'pending',
  });

  if (error) throw error;
}

function finishedProductSearchText(product) {
  return [
    product?.finished_sku,
    product?.sku,
    product?.finished_name,
    product?.name,
    product?.customer,
    product?.customer_name,
    product?.logo,
    product?.logo_name,
    product?.placement,
    product?.blank_sku_base,
    product?.blank_name,
    product?.brand,
    product?.brand_code,
    product?.product_type,
    product?.product_type_code,
    product?.color,
    product?.color_code,
    product?.size,
    product?.size_code,
    product?.bin_code,
    product?.bin_label,
    product?.bin_location,
  ].filter(Boolean).join(' ');
}

function rowMatchesAllTokens(row, term, builder) {
  const tokens = searchTokens(term);
  if (!tokens.length) return true;

  const text = builder(row);
  const lower = textSearchValue(text);
  const normalized = normalizeSearchValue(text);

  return tokens.every((token) => {
    const normalizedToken = normalizeSearchValue(token);
    return lower.includes(token) || normalized.includes(normalizedToken);
  });
}

export function formatFinishedProductLabel(product) {
  const sku = product?.finished_sku || product?.sku;
  const name = product?.finished_name || product?.name;
  const customer = product?.customer || product?.customer_name;
  const logo = product?.logo || product?.logo_name;
  const placement = product?.placement;
  const blank = product?.blank_sku_base || product?.blank_name;
  const qty = product?.total_quantity ?? product?.quantity_on_hand;

  return [sku, name, customer, logo, placement, blank, qty != null ? `${qty} on hand` : null]
    .filter(Boolean)
    .join(' - ');
}

export async function getFinishedProducts(search = '') {
  // Query the finished inventory compatibility view and filter locally with token search.
  // This lets searches like "Bremerton navy left chest" or "Bella Canvas customer" work
  // across SKU, customer, logo, placement, blank, brand, color, size, and bin columns.
  const { data, error } = await supabase
    .from('finished_inventory_by_product')
    .select('*')
    .order('finished_sku', { ascending: true })
    .limit(1000);

  if (error) throw error;

  const rows = data || [];
  return rows
    .filter((row) => rowMatchesAllTokens(row, search, finishedProductSearchText))
    .sort((a, b) => finishedProductSearchText(a).localeCompare(finishedProductSearchText(b)));
}

export async function receiveFinishedInventory({ binId, finishedProductId, quantity, notes }) {
  if (!finishedProductId) throw new Error('Choose a finished product.');
  if (!binId) throw new Error('Choose a finished-products bin.');
  if (!quantity || Number(quantity) <= 0) throw new Error('Quantity must be greater than zero.');

  const { error } = await supabase.rpc('receive_finished_inventory', {
    p_bin_id: Number(binId),
    p_finished_product_id: finishedProductId,
    p_quantity: Number(quantity),
    p_notes: notes || null,
  });

  if (error) throw error;
}


export async function getPullSheets() {
  // Use the final app-facing RPC created by pullsheet_visibility_fix.sql.
  // This keeps WooCommerce, manual invoice, and other generated jobs visible
  // even when older views/status filters would hide them.
  const { data, error } = await supabase.rpc('sc_existing_pull_sheets');

  if (error) throw error;
  return data || [];
}

export async function createPullSheet({ jobName, customerName, orderNumber, dueDate, notes }) {
  const name = String(jobName || '').trim();
  if (!name) throw new Error('Enter a job name.');

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      job_name: name,
      customer_name: String(customerName || '').trim() || null,
      woocommerce_order_id: String(orderNumber || '').trim() || null,
      due_date: dueDate || null,
      notes: String(notes || '').trim() || null,
      status: 'ready_to_pull',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updatePullSheetStatus({ jobId, status }) {
  const { error } = await supabase
    .from('jobs')
    .update({ status })
    .eq('id', jobId);

  if (error) throw error;
}

export async function updatePullSheetStatuses({ jobIds, status }) {
  const ids = Array.from(new Set((jobIds || []).filter((id) => id !== undefined && id !== null && String(id).trim() !== '')));
  const nextStatus = String(status || '').trim();

  if (!ids.length) throw new Error('Choose at least one pull sheet.');
  if (!nextStatus) throw new Error('Choose a status.');

  const { data, error } = await supabase
    .from('jobs')
    .update({ status: nextStatus })
    .in('id', ids)
    .select('id, status');

  if (error) throw error;
  return data || [];
}


function toPairingRepairTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizePairingRepairOptions(options = {}) {
  const jobItemIds = Array.isArray(options.jobItemIds)
    ? options.jobItemIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : [];

  const limit = Math.max(1, Math.min(Number(options.limit || 250), 2000));

  return {
    p_search: String(options.search || '').trim() || null,
    p_woocommerce_order_id: options.woocommerceOrderId ? Number(options.woocommerceOrderId) : null,
    p_job_id: options.jobId ? Number(options.jobId) : null,
    p_order_sku: String(options.orderSku || '').trim() || null,
    p_current_blank_product_id: options.currentBlankProductId || null,
    p_new_blank_product_id: options.newBlankProductId || null,
    p_start_at: toPairingRepairTimestamp(options.startAt),
    p_end_at: toPairingRepairTimestamp(options.endAt),
    p_status: String(options.status || '').trim() || null,
    p_job_item_ids: jobItemIds.length ? jobItemIds : null,
    p_limit: limit,
  };
}

export async function previewBulkPairingRepair(options = {}) {
  const payload = normalizePairingRepairOptions(options);

  const { data, error } = await supabase.rpc('sc_preview_bulk_pairing_repair', payload);

  if (error) {
    if (/function .* does not exist|could not find/i.test(error.message || '')) {
      throw new Error('Bulk pairing repair SQL has not been installed yet. Run supabase_bulk_pairing_repair.sql in Supabase first.');
    }
    throw error;
  }

  return data || [];
}

export async function applyBulkPairingRepair(options = {}) {
  const payload = {
    ...normalizePairingRepairOptions(options),
    p_new_blank_product_id: options.newBlankProductId || null,
    p_clear_reservations: options.clearReservations !== false,
    p_recreate_reservations: options.recreateReservations !== false,
    p_update_source_mapping: Boolean(options.updateSourceMapping),
    p_clear_finished_product_link: Boolean(options.clearFinishedProductLink),
    p_reason: String(options.reason || '').trim() || null,
    p_applied_by: String(options.appliedBy || '').trim() || null,
    p_dry_run: options.dryRun !== false,
  };

  if (!payload.p_new_blank_product_id) {
    throw new Error('Choose the correct replacement blank product.');
  }

  const { data, error } = await supabase.rpc('sc_apply_bulk_pairing_repair', payload);

  if (error) {
    if (/function .* does not exist|could not find/i.test(error.message || '')) {
      throw new Error('Bulk pairing repair SQL has not been installed yet. Run supabase_bulk_pairing_repair.sql in Supabase first.');
    }
    throw error;
  }

  if (data && data.success === false && Number(data.failed || 0) > 0 && Number(data.updated || 0) === 0) {
    const firstError = Array.isArray(data.items) ? data.items.find((item) => item.status === 'failed') : null;
    throw new Error(firstError?.message || data.message || 'Bulk pairing repair failed.');
  }

  return data || { success: true, updated: 0, failed: 0, items: [] };
}

export async function getPullSheetItems(jobId) {
  const { data, error } = await supabase.rpc('sc_pull_sheet_items', {
    p_job_id: Number(jobId),
  });

  if (error) throw error;
  return (data || []).filter((row) => row.job_item_id || row.id || row.blank_product_id || row.quantity);
}

export async function addPullSheetItem({
  jobId,
  blankProductId,
  quantity,
  logo,
  placement,
  notes,
}) {
  if (!jobId) throw new Error('Missing pull sheet ID.');
  if (!blankProductId) throw new Error('Choose a blank item.');
  if (!quantity || Number(quantity) <= 0) throw new Error('Quantity must be greater than zero.');

  const { data, error } = await supabase
    .from('job_items')
    .insert({
      job_id: jobId,
      blank_product_id: blankProductId,
      quantity: Number(quantity),
      logo: String(logo || '').trim() || null,
      placement: String(placement || '').trim() || null,
      notes: String(notes || '').trim() || null,
      status: 'ready_to_pull',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updatePullSheetItemStatus({ jobItemId, status }) {
  const { error } = await supabase
    .from('job_items')
    .update({ status })
    .eq('id', Number(jobItemId));

  if (error) throw error;
}

export async function deletePullSheetItem(jobItemId) {
  const { error } = await supabase
    .from('job_items')
    .delete()
    .eq('id', Number(jobItemId));

  if (error) throw error;
}

export async function completeJobItem({ jobItemId, binId, notes }) {
  const { error } = await supabase.rpc('complete_job_item', {
    p_job_item_id: Number(jobItemId),
    p_bin_id: Number(binId),
    p_notes: notes || null,
  });

  if (error) throw error;
}

export function pullSheetStatusLabel(status) {
  const map = {
    draft: 'Draft',
    ready_to_pull: 'Ready to Pull',
    pulled: 'Pulled',
    in_production: 'In Production',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[status] || status || '';
}

function finishedMatchSearchText(item) {
  return [
    item?.finished_sku,
    item?.sku,
    item?.finished_name,
    item?.name,
    item?.blank_sku_base,
    item?.blank_name,
    item?.customer_name,
    item?.customer,
    item?.logo_name,
    item?.logo,
    item?.placement,
    item?.color,
    item?.size,
    item?.bin_code,
    item?.bin_label,
  ].filter(Boolean).join(' ');
}

export async function getFinishedMatchesForPullSheetItem(item) {
  if (!item?.blank_product_id) return [];

  const { data, error } = await supabase
    .from('finished_inventory_by_product')
    .select('*')
    .eq('blank_product_id', item.blank_product_id)
    .gt('total_quantity', 0)
    .order('finished_sku', { ascending: true });

  if (error) throw error;

  const rows = data || [];
  const logo = String(item.logo || '').trim().toLowerCase();
  const placement = String(item.placement || '').trim().toLowerCase();
  const customer = String(item.customer_name || item.customer || '').trim().toLowerCase();

  return rows.filter((row) => {
    const rowLogo = String(row.logo || row.logo_name || '').trim().toLowerCase();
    const rowPlacement = String(row.placement || '').trim().toLowerCase();
    const rowCustomer = String(row.customer || row.customer_name || '').trim().toLowerCase();

    const logoOk = !logo || !rowLogo || rowLogo === logo || rowLogo.includes(logo) || logo.includes(rowLogo);
    const placementOk = !placement || !rowPlacement || rowPlacement === placement || rowPlacement.includes(placement) || placement.includes(rowPlacement);
    const customerOk = !customer || !rowCustomer || rowCustomer === customer || rowCustomer.includes(customer) || customer.includes(rowCustomer);

    return logoOk && placementOk && customerOk;
  }).sort((a, b) => finishedMatchSearchText(a).localeCompare(finishedMatchSearchText(b)));
}


export async function deductFinishedInventoryForJobItem({ jobItemId, finishedProductId, binId, quantity, notes }) {
  const { error } = await supabase.rpc('deduct_finished_inventory_for_job_item', {
    p_job_item_id: Number(jobItemId),
    p_finished_product_id: finishedProductId,
    p_bin_id: Number(binId),
    p_quantity: Number(quantity),
    p_notes: notes || null,
  });

  if (error) throw error;
}

export async function returnPullSheetItemToFinishedInventory({ jobItemId, binId, quantity, notes }) {
  const { error } = await supabase.rpc('return_pullsheet_item_to_finished_inventory', {
    p_job_item_id: Number(jobItemId),
    p_bin_id: Number(binId),
    p_quantity: Number(quantity),
    p_notes: notes || null,
  });

  if (error) throw error;
}


function purchasingDemandSourceText(row) {
  const sources = Array.isArray(row?.demand_sources) ? row.demand_sources : [];
  return sources
    .map((source) => [
      source?.order_number,
      source?.order_label,
      source?.job_id,
      source?.pullsheet_label,
      source?.job_name,
      source?.customer_name,
      source?.order_sku,
      source?.item_name,
      source?.job_status,
      source?.job_item_status,
      source?.pairing_source,
      source?.pairing_warning,
    ].filter(Boolean).join(' '))
    .join(' ');
}

function purchasingSearchText(row) {
  return [
    row?.sku_base,
    row?.name,
    row?.brand,
    row?.brand_code,
    row?.product_type,
    row?.product_type_code,
    row?.color,
    row?.color_code,
    row?.size,
    row?.size_code,
    row?.vendor,
    row?.supplier,
    row?.demand_order_numbers,
    row?.demand_pullsheet_numbers,
    purchasingDemandSourceText(row),
  ].filter(Boolean).join(' ');
}

function normalizePurchasingDemandSourceRow(row) {
  let sources = row?.sources || [];

  if (typeof sources === 'string') {
    try {
      sources = JSON.parse(sources);
    } catch (_err) {
      sources = [];
    }
  }

  if (!Array.isArray(sources)) sources = [];

  return {
    blank_product_id: row?.blank_product_id,
    demand_source_count: Number(row?.source_count || 0),
    demand_total_quantity: Number(row?.total_quantity || 0),
    demand_order_numbers: row?.order_numbers || '',
    demand_pullsheet_numbers: row?.pullsheet_numbers || '',
    demand_sources: sources,
  };
}

async function getPurchasingDemandSourceMap() {
  const { data, error } = await supabase
    .from('purchasing_demand_sources_v1')
    .select('*');

  if (error) {
    // The purchasing page still works before the SQL patch is installed;
    // order/pull sheet references simply show as unavailable.
    console.warn('Purchasing demand source view unavailable:', error.message || error);
    return new Map();
  }

  return new Map((data || []).map((row) => {
    const normalized = normalizePurchasingDemandSourceRow(row);
    return [String(normalized.blank_product_id || ''), normalized];
  }));
}

function attachPurchasingDemandSources(rows, sourceMap) {
  return (rows || []).map((row) => {
    const source = sourceMap.get(String(row?.blank_product_id || ''));
    if (!source) {
      return {
        ...row,
        demand_source_count: 0,
        demand_total_quantity: 0,
        demand_order_numbers: '',
        demand_pullsheet_numbers: '',
        demand_sources: [],
      };
    }

    return {
      ...row,
      demand_source_count: source.demand_source_count,
      demand_total_quantity: source.demand_total_quantity,
      demand_order_numbers: source.demand_order_numbers,
      demand_pullsheet_numbers: source.demand_pullsheet_numbers,
      demand_sources: source.demand_sources,
    };
  });
}

export async function getPurchasingShortages(search = '') {
  const [rowsRes, sourceMap] = await Promise.all([
    supabase
      .from('purchasing_shortages')
      .select('*')
      .order('need_to_order', { ascending: false }),
    getPurchasingDemandSourceMap(),
  ]);

  if (rowsRes.error) throw rowsRes.error;

  const rows = attachPurchasingDemandSources(rowsRes.data || [], sourceMap);
  return rows.filter((row) => rowMatchesAllTokens(row, search, purchasingSearchText));
}


export async function getPurchasingLowStock(search = '') {
  const [rowsRes, sourceMap] = await Promise.all([
    supabase
      .from('low_stock_blank_inventory')
      .select('*')
      .order('reorder_quantity', { ascending: false }),
    getPurchasingDemandSourceMap(),
  ]);

  if (rowsRes.error) throw rowsRes.error;

  const rows = attachPurchasingDemandSources(rowsRes.data || [], sourceMap);
  return rows.filter((row) => rowMatchesAllTokens(row, search, purchasingSearchText));
}

export async function getPurchasingRecommendedOrders(search = '') {
  const [rowsRes, sourceMap] = await Promise.all([
    supabase
      .from('purchasing_recommended_orders')
      .select('*')
      .order('recommended_order_quantity', { ascending: false }),
    getPurchasingDemandSourceMap(),
  ]);

  if (rowsRes.error) throw rowsRes.error;

  const rows = attachPurchasingDemandSources(rowsRes.data || [], sourceMap);
  return rows.filter((row) => rowMatchesAllTokens(row, search, purchasingSearchText));
}

export async function getPurchasingReorderSuggestions(search = '') {
  return getPurchasingRecommendedOrders(search);
}

export async function getPurchasingSupplierSummary() {
  const { data, error } = await supabase
    .from('purchasing_supplier_order_summary')
    .select('*')
    .order('brand', { ascending: true })
    .order('product_type', { ascending: true });

  if (error) throw error;
  return data || [];
}


// =========================================================
// Append-only blank product import
// =========================================================

export async function appendBlankProductsFromSpreadsheet({ rows, sourceFileName }) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('No blank product rows were provided.');
  }

  const payloadRows = rows.map((row) => ({
    brand: row.brand || null,
    style: row.style || null,
    color: row.color || null,
    size: row.size || null,
    quantity: Number(row.quantity || 0),
    bin: row.bin || null,
    unit_cost: Number(row.unitCost || 0),
    low_stock_threshold: row.lowStockThreshold === '' || row.lowStockThreshold == null ? null : Number(row.lowStockThreshold),
    sku_base: row.skuBase || null,
    barcode: row.barcode || null,
    name: row.name || null,
    image_url: row.imageUrl || null,
    supplier: row.supplier || null,
    supplier_sku: row.supplierSku || null,
    notes: row.notes || null,
    source_row_number: row.sourceRowNumber || null,
  }));

  const { data, error } = await supabase.rpc('append_blank_products_from_json', {
    p_rows: payloadRows,
    p_source_file_name: sourceFileName || null,
  });

  if (error) throw error;
  return data;
}

// =========================================================
// Sample inventory
// =========================================================

export async function getSampleInventory(search = '') {
  const { data, error } = await supabase
    .from('sample_inventory_view')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) throw error;

  const rows = data || [];
  const tokens = searchTokens(search);
  if (!tokens.length) return rows;

  return rows.filter((row) => {
    const searchable = [row.sku_base, row.name, row.brand, row.product_type, row.color, row.size, row.notes]
      .filter(Boolean)
      .map((part) => ({ text: textSearchValue(part), normalized: normalizeSearchValue(part) }));

    return tokens.every((token) => {
      const normalizedToken = normalizeSearchValue(token);
      return searchable.some((part) => part.text.includes(token) || part.normalized.includes(normalizedToken));
    });
  });
}

export async function addSampleInventory({ blankProductId, quantity, notes }) {
  if (!blankProductId) throw new Error('Choose a blank product.');
  const qty = Number(quantity || 0);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantity must be greater than zero.');

  const { data, error } = await supabase.rpc('add_sample_inventory', {
    p_blank_product_id: blankProductId,
    p_quantity: qty,
    p_notes: notes || null,
  });

  if (error) throw error;
  return data;
}

export async function adjustSampleInventory({ sampleInventoryId, quantityChange, notes }) {
  const qty = Number(quantityChange || 0);
  if (!sampleInventoryId) throw new Error('Missing sample inventory row.');
  if (!Number.isFinite(qty) || qty === 0) throw new Error('Quantity adjustment cannot be zero.');

  const { data, error } = await supabase.rpc('adjust_sample_inventory', {
    p_sample_inventory_id: sampleInventoryId,
    p_quantity_change: qty,
    p_notes: notes || null,
  });

  if (error) throw error;
  return data;
}

// =========================================================
// Bin display ordering
// =========================================================

export async function updateBinDisplayOrder(binId, displayOrder) {
  const { data, error } = await supabase
    .from('bins')
    .update({ display_order: Number(displayOrder || 0) })
    .eq('id', Number(binId))
    .select('id, bin_code, label, location, nfc_url, display_order')
    .single();

  if (error) throw error;
  return data;
}

export async function saveBinDisplayOrder(orderedBins) {
  const rows = (orderedBins || []).map((bin, index) => ({
    id: Number(bin.id),
    display_order: index + 1,
  }));

  for (const row of rows) {
    const { error } = await supabase
      .from('bins')
      .update({ display_order: row.display_order })
      .eq('id', row.id);
    if (error) throw error;
  }

  return true;
}

// =========================================================
// Color Alias Approval Workflow
// =========================================================

export async function getColorAliasCandidates() {
  const { data, error } = await supabase
    .from('color_alias_review_candidates')
    .select('*')
    .order('affected_woo_products', { ascending: false })
    .order('brand', { ascending: true })
    .order('style', { ascending: true })
    .order('woo_color', { ascending: true })
    .order('possible_blank_color', { ascending: true })
    .limit(1000);

  if (error) throw error;
  return data || [];
}

export async function getColorAliasApprovals(status = 'all') {
  let query = supabase
    .from('color_alias_approvals')
    .select('*')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function saveColorAliasDecision({ wooColor, blankColor, status, notes, reviewedBy }) {
  const { data, error } = await supabase.rpc('save_color_alias_decision', {
    p_woo_color: wooColor,
    p_blank_color: blankColor,
    p_status: status,
    p_notes: notes || null,
    p_reviewed_by: reviewedBy || 'Matthew',
  });

  if (error) throw error;
  return data;
}

export async function relinkWooProductsToBlankMaster(limit = 250) {
  const { data, error } = await supabase.rpc('wcsb_relink_woo_products_to_blank_master_batch', {
    p_limit: Number(limit || 250),
  });

  if (error) throw error;
  return data;
}

export async function getWooBlankMatchSummary() {
  const { data, error } = await supabase
    .from('woo_blank_match_diagnostics')
    .select('match_diagnostic')
    .limit(10000);

  if (error) throw error;

  const counts = {};
  (data || []).forEach((row) => {
    const key = row.match_diagnostic || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([match_diagnostic, qty]) => ({ match_diagnostic, qty }))
    .sort((a, b) => b.qty - a.qty);
}



// Create Finished Product from Blank
export async function searchBlankProductsForFinishedCreation(search = '') {
  const term = String(search || '').trim();

  let query = supabase
    .from('blank_products_search')
    .select('*')
    .order('brand', { ascending: true })
    .order('style', { ascending: true })
    .order('color', { ascending: true })
    .order('size', { ascending: true })
    .limit(250);

  if (term) {
    const escaped = term.replace(/[%_]/g, '\\$&');
    query = query.or([
      `sku_base.ilike.%${escaped}%`,
      `name.ilike.%${escaped}%`,
      `brand.ilike.%${escaped}%`,
      `style.ilike.%${escaped}%`,
      `color.ilike.%${escaped}%`,
      `size.ilike.%${escaped}%`,
    ].join(','));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createFinishedProductFromBlank({
  blankProductId,
  existingFinishedProductId,
  finishedBinId,
  quantity,
  customerName,
  logoName,
  decorationType,
  placement,
  decorationSize,
  notes,
  deductBlank,
  blankBinId,
}) {
  const { data, error } = await supabase.rpc('create_finished_product_from_blank', {
    p_existing_finished_product_id: existingFinishedProductId || null,
    p_blank_product_id: blankProductId,
    p_finished_bin_id: finishedBinId ? Number(finishedBinId) : null,
    p_quantity: Number(quantity || 0),
    p_customer_name: customerName,
    p_logo_name: logoName,
    p_decoration_type: decorationType || null,
    p_placement: placement || null,
    p_decoration_size: decorationSize || null,
    p_notes: notes || null,
    p_deduct_blank: Boolean(deductBlank),
    p_blank_bin_id: blankBinId ? Number(blankBinId) : null,
  });

  if (error) throw error;
  return data;
}


// =========================================================
// Standalone Sample Products - not linked to WooCommerce or blank_products
// =========================================================

export async function createStandaloneSampleProduct({
  brand,
  style,
  color,
  vendor,
  price,
  size,
  notes,
}) {
  const payload = {
    brand: String(brand || '').trim(),
    style: String(style || '').trim(),
    color: String(color || '').trim(),
    vendor: String(vendor || '').trim() || null,
    price: price === '' || price == null ? null : Number(price),
    size: String(size || '').trim(),
    notes: String(notes || '').trim() || null,
  };

  if (!payload.brand) throw new Error('Brand is required.');
  if (!payload.style) throw new Error('Style is required.');
  if (!payload.color) throw new Error('Color is required.');
  if (!payload.size) throw new Error('Size is required.');
  if (payload.price != null && Number.isNaN(payload.price)) throw new Error('Price must be a number.');

  const { data, error } = await supabase
    .from('sample_products')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getStandaloneSampleProducts(search = '') {
  const { data, error } = await supabase
    .from('sample_products')
    .select('id, brand, style, color, vendor, price, size, notes, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) throw error;

  const rows = data || [];
  const tokens = String(search || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

  if (!tokens.length) return rows;

  return rows.filter((row) => {
    const text = [
      row.brand,
      row.style,
      row.color,
      row.vendor,
      row.size,
      row.notes,
    ].filter(Boolean).join(' ').toLowerCase();

    const normalized = text.replace(/[^a-z0-9]+/g, '');

    return tokens.every((token) => {
      const normalizedToken = token.replace(/[^a-z0-9]+/g, '');
      return text.includes(token) || normalized.includes(normalizedToken);
    });
  });
}



// =========================================================
// Transfer Inventory - Bin Scoped Items
// =========================================================

export async function getBlankItemsInBin(binId, search = '') {
  if (!binId) return [];

  const numericBinId = Number(binId);
  const normalizedSearch = String(search || '').trim();
  const matchesSearch = (row) => rowMatchesAllTokens(row, normalizedSearch, (item) => [
    item?.blank_product_id,
    item?.sku_base,
    item?.name,
    item?.brand,
    item?.style,
    item?.product_type,
    item?.color,
    item?.size,
    item?.on_hand_quantity,
  ].filter(Boolean).join(' '));

  const normalizeRows = (rows = []) => rows
    .map((row) => ({
      ...row,
      bin_id: row.bin_id ?? numericBinId,
      blank_product_id: row.blank_product_id ?? row.id,
      sku_base: row.sku_base ?? row.blank_sku_base ?? row.sku,
      name: row.name ?? row.blank_name ?? row.product_name,
      brand: row.brand ?? row.brand_name,
      style: row.style ?? row.product_type ?? row.product_type_name,
      color: row.color ?? row.color_name,
      size: row.size ?? row.size_name ?? row.size_code,
      on_hand_quantity: Number(row.on_hand_quantity ?? row.quantity_on_hand ?? row.total_quantity ?? row.quantity ?? 0),
    }))
    .filter((row) => row.blank_product_id && Number(row.on_hand_quantity || 0) > 0)
    .filter(matchesSearch)
    .sort((a, b) => [a.brand, a.style, a.color, a.size, a.sku_base, a.name].filter(Boolean).join(' ').localeCompare(
      [b.brand, b.style, b.color, b.size, b.sku_base, b.name].filter(Boolean).join(' ')
    ));

  // Preferred path: the Supabase RPC. Some older deployments return no rows
  // for the UNASSIGNED/System bin, so the page falls back to direct reads below.
  const rpc = await supabase.rpc('get_blank_items_in_bin', {
    p_bin_id: numericBinId,
    p_search: normalizedSearch,
  });

  if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length) {
    return normalizeRows(rpc.data);
  }

  // Fallback 1: app-facing inventory view.
  const view = await supabase
    .from('bin_blank_inventory_contents')
    .select('*')
    .eq('bin_id', numericBinId)
    .order('sku_base', { ascending: true });

  if (!view.error && Array.isArray(view.data) && view.data.length) {
    return normalizeRows(view.data);
  }

  // Fallback 2: raw movement table. This is intentionally broader so that
  // the transfer page still works if the RPC/view is stale or missing a bin.
  const movement = await supabase
    .from('blank_inventory_movements')
    .select(`
      bin_id,
      blank_product_id,
      quantity_change,
      blank_products:blank_product_id(
        id,
        sku_base,
        name,
        brand_id,
        product_type_id,
        color_id,
        size_id,
        brands:brand_id(name, code),
        product_types:product_type_id(name, code),
        colors:color_id(name, code),
        sizes:size_id(name, code)
      )
    `)
    .eq('bin_id', numericBinId);

  if (movement.error) {
    // If all paths fail, surface the most useful error to the screen.
    throw rpc.error || view.error || movement.error;
  }

  const byProduct = new Map();
  (movement.data || []).forEach((row) => {
    const product = row.blank_products || {};
    const id = row.blank_product_id || product.id;
    if (!id) return;

    const current = byProduct.get(id) || {
      bin_id: row.bin_id,
      blank_product_id: id,
      sku_base: product.sku_base,
      name: product.name,
      brand: product.brands?.name || product.brands?.code || '',
      style: product.product_types?.name || product.product_types?.code || '',
      color: product.colors?.name || product.colors?.code || '',
      size: product.sizes?.name || product.sizes?.code || '',
      on_hand_quantity: 0,
    };

    current.on_hand_quantity += Number(row.quantity_change || 0);
    byProduct.set(id, current);
  });

  return normalizeRows(Array.from(byProduct.values()));
}

// =========================================================
// Printable Warehouse Audit Report
// =========================================================

export async function getWarehouseInventoryAuditReport() {
  const { data, error } = await supabase
    .from('warehouse_inventory_audit_report')
    .select('*')
    .order('bin_sort', { ascending: true, nullsFirst: false })
    .order('bin_code', { ascending: true })
    .order('brand', { ascending: true, nullsFirst: false })
    .order('style', { ascending: true, nullsFirst: false })
    .order('color', { ascending: true, nullsFirst: false })
    .order('size', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data || [];
}


// =========================================================
// Inventory Reservations / Holds
// =========================================================

export async function createInventoryReservation({
  blankProductId,
  binId,
  quantity,
  orderRef,
  customer,
  notes,
}) {
  const { data, error } = await supabase.rpc('create_inventory_reservation_safe', {
    p_blank_product_id: blankProductId,
    p_bin_id: binId ? Number(binId) : null,
    p_quantity: Number(quantity || 0),
    p_order_ref: String(orderRef || '').trim() || null,
    p_customer: String(customer || '').trim() || null,
    p_notes: String(notes || '').trim() || null,
  });

  if (error) throw error;
  return data;
}

export async function getInventoryReservations(status = 'active') {
  const { data, error } = await supabase
    .from('inventory_reservations_view')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) throw error;
  return data || [];
}


// =========================================================
// Finished Inventory - Search, Create, and Receive
// Required by src/ReturnFinishedInventory.jsx
// =========================================================

export async function searchFinishedProductsForReceiving(search = '') {
  const { data, error } = await supabase.rpc('search_finished_products_for_receiving', {
    p_search: String(search || '').trim(),
    p_limit: 5000,
  });

  if (error) throw error;
  return data || [];
}

export async function createOrReceiveFinishedProduct({
  existingFinishedProductId,
  finishedSku,
  name,
  customer,
  logo,
  brand,
  style,
  color,
  size,
  productType,
  binId,
  quantity,
  notes,
}) {
  const { data, error } = await supabase.rpc('create_or_receive_finished_product_inventory', {
    p_existing_finished_product_id: existingFinishedProductId || null,
    p_finished_sku: String(finishedSku || '').trim() || null,
    p_name: String(name || '').trim() || null,
    p_customer_name: String(customer || '').trim() || null,
    p_logo_name: String(logo || '').trim() || null,
    p_brand: String(brand || '').trim() || null,
    p_style: String(style || '').trim() || null,
    p_color: String(color || '').trim() || null,
    p_size: String(size || '').trim() || null,
    p_product_type: String(productType || '').trim() || null,
    p_bin_id: binId ? Number(binId) : null,
    p_quantity: Number(quantity || 0),
    p_notes: String(notes || '').trim() || null,
  });

  if (error) throw error;
  return data;
}


// =========================================================
// Phase 1 Purchasing: Purchase Orders + Waiting On dashboard
// =========================================================

export async function getPurchaseOrderRecommendations(search = '') {
  const { data, error } = await supabase.rpc('phase1_get_purchase_recommendations', {
    p_search: String(search || '').trim() || null,
  });

  if (error) throw error;
  return data || [];
}

export async function createPurchaseOrderFromItems({ supplierName, expectedAt, notes, items }) {
  const { data, error } = await supabase.rpc('phase1_create_purchase_order_from_items', {
    p_supplier_name: supplierName || null,
    p_expected_at: expectedAt || null,
    p_notes: notes || null,
    p_items: items || [],
  });

  if (error) throw error;
  return data;
}

export async function getPurchaseOrders(status = 'open') {
  let query = supabase
    .from('phase1_purchase_orders_with_totals')
    .select('*')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    if (status === 'open') {
      query = query.in('status', ['draft', 'ordered', 'partial']);
    } else if (status === 'partial') {
      query = query.eq('status', 'partial');
    } else {
      query = query.eq('status', status);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getPurchaseOrderDetail(purchaseOrderId) {
  if (!purchaseOrderId) throw new Error('Missing purchase order ID.');

  const [poRes, itemsRes] = await Promise.all([
    supabase
      .from('phase1_purchase_orders_with_totals')
      .select('*')
      .eq('id', purchaseOrderId)
      .single(),
    supabase
      .from('phase1_purchase_order_items_detail')
      .select('*')
      .eq('purchase_order_id', purchaseOrderId)
      .order('sku_base', { ascending: true }),
  ]);

  if (poRes.error) throw poRes.error;
  if (itemsRes.error) throw itemsRes.error;

  return { po: poRes.data, items: itemsRes.data || [] };
}

export async function receivePurchaseOrderItem({ poItemId, quantity, binId, notes }) {
  const { data, error } = await supabase.rpc('phase1_receive_purchase_order_item', {
    p_purchase_order_item_id: poItemId,
    p_quantity: Number(quantity),
    p_bin_id: Number(binId),
    p_notes: notes || null,
  });

  if (error) throw error;
  return data;
}

export async function getWaitingOnItems(search = '') {
  const { data, error } = await supabase.rpc('phase1_get_waiting_on_items', {
    p_search: String(search || '').trim() || null,
  });

  if (error) throw error;
  return data || [];
}

// =====================================================
// Phase 3 - Supplier Catalog + Label Tools
// =====================================================

export async function importSupplierCatalogRows({
  supplierName,
  sourceFileName,
  rows,
  updateBlankProducts = true,
  createMissingLookups = true,
}) {
  const { data, error } = await supabase.rpc('import_supplier_catalog_rows', {
    p_supplier_name: supplierName,
    p_source_file_name: sourceFileName || null,
    p_rows: rows || [],
    p_update_blank_products: Boolean(updateBlankProducts),
    p_create_missing_lookups: Boolean(createMissingLookups),
  });

  if (error) throw error;
  return data;
}

export async function getSupplierCatalogReview(search = '') {
  let query = supabase
    .from('supplier_catalog_review')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5000);

  const term = String(search || '').trim();
  if (term) {
    const escaped = escapeOrTerm(term);
    query = query.or([
      `supplier_name.ilike.%${escaped}%`,
      `brand.ilike.%${escaped}%`,
      `style.ilike.%${escaped}%`,
      `color.ilike.%${escaped}%`,
      `size.ilike.%${escaped}%`,
      `supplier_sku.ilike.%${escaped}%`,
      `upc.ilike.%${escaped}%`,
      `blank_sku_base.ilike.%${escaped}%`,
    ].join(','));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Phase 2 Production: Board, Finished Suggestions, Spoilage
// =========================================================

export async function getProductionBoard(search = '') {
  const { data, error } = await supabase.rpc('phase2_get_production_board', {
    p_search: String(search || '').trim() || null,
  });
  if (error) throw error;
  return data || [];
}

export async function updateProductionJobStatus({ jobId, status, notes }) {
  const { data, error } = await supabase.rpc('phase2_update_job_status', {
    p_job_id: jobId,
    p_status: status,
    p_notes: notes || null,
  });
  if (error) throw error;
  return data;
}

export async function getFinishedMatchSuggestions(search = '') {
  const { data, error } = await supabase.rpc('phase2_get_finished_match_suggestions', {
    p_search: String(search || '').trim() || null,
  });
  if (error) throw error;
  return data || [];
}

export async function useFinishedInventoryForJobItem({ jobItemId, finishedProductId, quantity, notes }) {
  const { data, error } = await supabase.rpc('phase2_use_finished_inventory_for_job_item', {
    p_job_item_id: jobItemId,
    p_finished_product_id: finishedProductId,
    p_quantity: Number(quantity),
    p_notes: notes || null,
  });
  if (error) throw error;
  return data;
}

export async function recordBlankSpoilage({ blankProductId, binId, quantity, reason, jobId, jobItemId, notes }) {
  const { data, error } = await supabase.rpc('phase2_record_blank_spoilage', {
    p_blank_product_id: blankProductId,
    p_bin_id: Number(binId),
    p_quantity: Number(quantity),
    p_reason: reason || 'Other',
    p_job_id: jobId || null,
    p_job_item_id: jobItemId || null,
    p_notes: notes || null,
  });
  if (error) throw error;
  return data;
}

export async function recordFinishedSpoilage({ finishedProductId, binId, quantity, reason, jobId, jobItemId, notes }) {
  const { data, error } = await supabase.rpc('phase2_record_finished_spoilage', {
    p_finished_product_id: finishedProductId,
    p_bin_id: Number(binId),
    p_quantity: Number(quantity),
    p_reason: reason || 'Other',
    p_job_id: jobId || null,
    p_job_item_id: jobItemId || null,
    p_notes: notes || null,
  });
  if (error) throw error;
  return data;
}

export async function getSpoilageReport(search = '') {
  const { data, error } = await supabase.rpc('phase2_get_spoilage_report', {
    p_search: String(search || '').trim() || null,
  });
  if (error) throw error;
  return data || [];
}

// =====================================================
// Phase 4 - Management Intelligence
// =====================================================

export async function getPhase4JobCosting(search = '') {
  const { data, error } = await supabase.rpc('phase4_get_job_costing', {
    p_search: String(search || '').trim() || null,
  });

  if (error) throw error;
  return data || [];
}

export async function savePhase4JobCostSettings({
  jobId,
  orderRevenue,
  decorationCostPerUnit,
  laborCostPerUnit,
  overheadCost,
  shippingRevenue,
  shippingCost,
  spoilageAllowance,
  notes,
}) {
  const { data, error } = await supabase.rpc('phase4_upsert_job_cost_settings', {
    p_job_id: Number(jobId),
    p_order_revenue: orderRevenue === '' || orderRevenue == null ? 0 : Number(orderRevenue),
    p_decoration_cost_per_unit: decorationCostPerUnit === '' || decorationCostPerUnit == null ? 0 : Number(decorationCostPerUnit),
    p_labor_cost_per_unit: laborCostPerUnit === '' || laborCostPerUnit == null ? 0 : Number(laborCostPerUnit),
    p_overhead_cost: overheadCost === '' || overheadCost == null ? 0 : Number(overheadCost),
    p_shipping_revenue: shippingRevenue === '' || shippingRevenue == null ? 0 : Number(shippingRevenue),
    p_shipping_cost: shippingCost === '' || shippingCost == null ? 0 : Number(shippingCost),
    p_spoilage_allowance: spoilageAllowance === '' || spoilageAllowance == null ? 0 : Number(spoilageAllowance),
    p_notes: notes || null,
  });

  if (error) throw error;
  return data;
}

export async function getPhase4CustomerReorders(search = '') {
  const { data, error } = await supabase.rpc('phase4_get_customer_reorders', {
    p_search: String(search || '').trim() || null,
  });

  if (error) throw error;
  return data || [];
}

export async function getPhase4CampaignForecast(search = '') {
  const { data, error } = await supabase.rpc('phase4_get_campaign_forecast', {
    p_search: String(search || '').trim() || null,
  });

  if (error) throw error;
  return data || [];
}

// =====================================================
// Phase 5 - Advanced Operations, Pricing, Scheduling, Artwork
// =====================================================

export async function getPhase5CommandCenter() {
  const { data, error } = await supabase.rpc('phase5_get_command_center');
  if (error) throw error;
  return data || {};
}

export async function getPhase5RiskDashboard(search = '') {
  const { data, error } = await supabase.rpc('phase5_get_job_risk_dashboard', { p_search: String(search || '').trim() || null });
  if (error) throw error;
  return data || [];
}

export async function getPhase5Employees() {
  const { data, error } = await supabase.from('phase5_employees').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function savePhase5Employee({ id, name, role, hourlyCost, active = true }) {
  const payload = { name: String(name || '').trim(), role: String(role || '').trim() || null, hourly_cost: hourlyCost === '' || hourlyCost == null ? 0 : Number(hourlyCost), active: Boolean(active) };
  if (!payload.name) throw new Error('Employee name is required.');
  const query = id ? supabase.from('phase5_employees').update(payload).eq('id', id).select('*').single() : supabase.from('phase5_employees').insert(payload).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getPhase5Tasks(filter = 'open') {
  let query = supabase.from('phase5_tasks_detail').select('*').order('due_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
  if (filter === 'open') query = query.in('status', ['not_started', 'in_progress', 'blocked']);
  if (filter === 'completed') query = query.eq('status', 'completed');
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function savePhase5Task({ id, jobId, taskType, title, assignedToEmployeeId, status, priority, dueAt, notes }) {
  const payload = { job_id: jobId ? Number(jobId) : null, task_type: taskType || 'general', title: String(title || '').trim(), assigned_to_employee_id: assignedToEmployeeId || null, status: status || 'not_started', priority: priority === '' || priority == null ? 0 : Number(priority), due_at: dueAt || null, notes: notes || null };
  if (!payload.title) throw new Error('Task title is required.');
  const query = id ? supabase.from('phase5_tasks').update(payload).eq('id', id).select('*').single() : supabase.from('phase5_tasks').insert(payload).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getPhase5QcJobs(search = '') {
  const { data, error } = await supabase.rpc('phase5_get_qc_jobs', { p_search: String(search || '').trim() || null });
  if (error) throw error;
  return data || [];
}

export async function savePhase5QcChecklist({ jobId, checklist, passed, checkedBy, notes }) {
  const { data, error } = await supabase.rpc('phase5_save_qc_checklist', { p_job_id: Number(jobId), p_checklist: checklist || {}, p_passed: Boolean(passed), p_checked_by: checkedBy || null, p_notes: notes || null });
  if (error) throw error;
  return data;
}

export async function getPhase5Quotes(status = 'open') {
  let query = supabase.from('phase5_quotes_with_totals').select('*').order('created_at', { ascending: false });
  if (status === 'open') query = query.in('status', ['draft', 'sent', 'accepted']);
  else if (status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createPhase5Quote({ customerName, quoteTitle, status, notes, items }) {
  const { data, error } = await supabase.rpc('phase5_create_quote', { p_customer_name: customerName, p_quote_title: quoteTitle, p_status: status || 'draft', p_notes: notes || null, p_items: items || [] });
  if (error) throw error;
  return data;
}

export async function getPhase5PricingRules() {
  const { data, error } = await supabase.from('phase5_pricing_rules').select('*').order('rule_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function savePhase5PricingRule(rule) {
  const payload = { rule_name: rule.ruleName, product_type: rule.productType || null, decoration_type: rule.decorationType || null, markup_multiplier: Number(rule.markupMultiplier || 2), decoration_cost: Number(rule.decorationCost || 0), setup_fee: Number(rule.setupFee || 0), minimum_margin_percent: Number(rule.minimumMarginPercent || 45), active: rule.active !== false };
  const query = rule.id ? supabase.from('phase5_pricing_rules').update(payload).eq('id', rule.id).select('*').single() : supabase.from('phase5_pricing_rules').insert(payload).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getPhase5ProductionTimeRules() {
  const { data, error } = await supabase.from('phase5_production_time_rules').select('*').order('rule_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function savePhase5ProductionTimeRule(rule) {
  const payload = { rule_name: rule.ruleName, decoration_type: rule.decorationType || null, setup_minutes: Number(rule.setupMinutes || 0), seconds_per_unit: Number(rule.secondsPerUnit || 60), qc_seconds_per_unit: Number(rule.qcSecondsPerUnit || 20), packing_seconds_per_unit: Number(rule.packingSecondsPerUnit || 20), active: rule.active !== false };
  const query = rule.id ? supabase.from('phase5_production_time_rules').update(payload).eq('id', rule.id).select('*').single() : supabase.from('phase5_production_time_rules').insert(payload).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getPhase5ProductionCalendar() {
  const { data, error } = await supabase.rpc('phase5_get_production_calendar');
  if (error) throw error;
  return data || [];
}

export async function getPhase5CapacityPlanning() {
  const { data, error } = await supabase.rpc('phase5_get_capacity_planning');
  if (error) throw error;
  return data || [];
}

export async function getPhase5VendorPriceComparison(search = '') {
  const { data, error } = await supabase.rpc('phase5_get_vendor_price_comparison', { p_search: String(search || '').trim() || null });
  if (error) throw error;
  return data || [];
}

export async function getPhase5ShopTv() {
  const { data, error } = await supabase.rpc('phase5_get_shop_tv');
  if (error) throw error;
  return data || {};
}

export async function getPhase5ArtworkRequests(status = 'open') {
  let query = supabase.from('phase5_artwork_requests').select('*').order('created_at', { ascending: false });
  if (status === 'open') query = query.in('status', ['new', 'prompt_ready', 'in_design', 'sent_for_approval', 'revision_requested']);
  else if (status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function savePhase5ArtworkRequest(request) {
  const payload = { customer_name: request.customerName || null, job_id: request.jobId ? Number(request.jobId) : null, request_title: request.requestTitle || null, request_details: request.requestDetails || null, desired_emotion: request.desiredEmotion || null, preferred_shape: request.preferredShape || null, deadline: request.deadline || null, ai_prompt: request.aiPrompt || null, status: request.status || 'new', notes: request.notes || null };
  const query = request.id ? supabase.from('phase5_artwork_requests').update(payload).eq('id', request.id).select('*').single() : supabase.from('phase5_artwork_requests').insert(payload).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------
// Supplier Catalog Reference Review Workflow
// Required by src/SupplierCatalogReview.jsx
// ---------------------------------------------------------
export async function getSupplierCatalogReviewStats() {
  const { data, error } = await supabase.rpc('sc_supplier_catalog_review_stats');
  if (error) throw error;
  return data || [];
}

export async function updateSupplierCatalogReviewItem({
  itemId,
  review_status,
  use_in_quote_builder = false,
  use_in_substitution_suggestions = false,
  create_blank_candidate = false,
  review_notes = '',
  updated_by = null,
}) {
  const { data, error } = await supabase.rpc('sc_update_supplier_catalog_review_item', {
    p_item_id: itemId,
    p_review_status: review_status || 'unreviewed',
    p_use_in_quote_builder: Boolean(use_in_quote_builder),
    p_use_in_substitution_suggestions: Boolean(use_in_substitution_suggestions),
    p_create_blank_candidate: Boolean(create_blank_candidate),
    p_review_notes: review_notes || null,
    p_updated_by: updated_by || null,
  });

  if (error) throw error;
  return data;
}

export async function getSupplierCatalogQuoteReference(search = '') {
  let query = supabase
    .from('supplier_catalog_quote_reference')
    .select('*')
    .order('supplier_name', { ascending: true })
    .limit(5000);

  const term = String(search || '').trim();

  if (term) {
    const escaped = escapeOrTerm(term);
    query = query.or([
      `supplier_name.ilike.%${escaped}%`,
      `brand.ilike.%${escaped}%`,
      `style.ilike.%${escaped}%`,
      `color.ilike.%${escaped}%`,
      `size.ilike.%${escaped}%`,
      `supplier_sku.ilike.%${escaped}%`,
      `upc.ilike.%${escaped}%`,
      `blank_sku_base.ilike.%${escaped}%`,
    ].join(','));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}


// ---------------------------------------------------------
// Supplier Catalog Website CSV Feed Sync
// Required by src/SupplierCatalogImport.jsx
// ---------------------------------------------------------
export async function listSupplierCatalogFeeds() {
  const { data, error } = await supabase
    .from('supplier_catalog_feeds')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createSupplierCatalogFeed(feed) {
  const { data, error } = await supabase
    .from('supplier_catalog_feeds')
    .insert({
      supplier_name: feed.supplier_name,
      feed_name: feed.feed_name || null,
      feed_url: feed.feed_url,
      source_file_name: feed.source_file_name || null,
      is_active: feed.is_active !== false,
      update_blank_products: Boolean(feed.update_blank_products),
      create_missing_lookups: feed.create_missing_lookups !== false,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateSupplierCatalogFeed(feedId, values) {
  const { data, error } = await supabase
    .from('supplier_catalog_feeds')
    .update({
      supplier_name: values.supplier_name,
      feed_name: values.feed_name || null,
      feed_url: values.feed_url,
      source_file_name: values.source_file_name || null,
      is_active: values.is_active !== false,
      update_blank_products: Boolean(values.update_blank_products),
      create_missing_lookups: values.create_missing_lookups !== false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', feedId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSupplierCatalogFeed(feedId) {
  const { error } = await supabase
    .from('supplier_catalog_feeds')
    .delete()
    .eq('id', feedId);

  if (error) throw error;
  return true;
}

export async function syncSupplierCatalogFeed(feedId) {
  const response = await fetch('/.netlify/functions/supplier-catalog-feed-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ feed_id: feedId }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || body?.success === false) {
    throw new Error(body?.message || `Supplier catalog feed sync failed: HTTP ${response.status}`);
  }

  return body;
}

