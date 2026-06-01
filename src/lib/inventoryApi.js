import { supabase } from '../supabaseClient';

function normalizeSearchValue(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function textSearchValue(value) {
  return String(value || '').toLowerCase();
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
    .select('id, bin_code, label, location, nfc_url, created_at')
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
    .select('id, bin_code, label, location, nfc_url')
    .single();

  if (error) throw error;
  return data;
}

export async function getBin(binId) {
  const { data, error } = await supabase
    .from('bins')
    .select('id, bin_code, label, location, nfc_url, created_at')
    .eq('id', Number(binId))
    .single();

  if (error) throw error;
  return data;
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
      brands:brand_id(name, code),
      colors:color_id(name, code),
      sizes:size_id(name, code),
      product_types:product_type_id(name, code)
    `)
    .order('name', { ascending: true });

  if (error) throw error;

  const rows = data || [];
  const term = search.trim();

  if (!term) return rows;

  const lowerTerm = textSearchValue(term);
  const normalizedTerm = normalizeSearchValue(term);

  return rows.filter((product) =>
    blankProductSearchText(product).some((part) => {
      const value = String(part || '');
      return (
        textSearchValue(value).includes(lowerTerm) ||
        normalizeSearchValue(value).includes(normalizedTerm)
      );
    })
  );
}

export async function findBlankProductByScannedValue(value) {
  const term = String(value || '').trim();
  if (!term) return null;

  const products = await getBlankProducts(term);
  const normalized = normalizeSearchValue(term);

  return (
    products.find((product) => normalizeSearchValue(product.sku_base) === normalized) ||
    products.find((product) => normalizeSearchValue(product.barcode) === normalized) ||
    products[0] ||
    null
  );
}

export async function getBlankInventory(search = '') {
  let query = supabase
    .from('blank_inventory_by_product')
    .select('*')
    .order('name', { ascending: true });

  const term = search.trim();

  if (term) {
    const escaped = escapeOrTerm(term);
    query = query.or(
      `sku_base.ilike.%${escaped}%,name.ilike.%${escaped}%,brand.ilike.%${escaped}%,color.ilike.%${escaped}%,size.ilike.%${escaped}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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
  const { data, error } = await supabase.rpc('reserve_blank_inventory', {
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
  const { error } = await supabase.rpc('release_inventory_reservation', {
    p_reservation_id: reservationId,
    p_notes: notes || null,
  });

  if (error) throw error;
}

export async function getReservations(status = 'active') {
  let query = supabase
    .from('inventory_reservations_view')
    .select('*')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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
  return data || {
    total_bins: 0,
    total_units_on_hand: 0,
    total_reserved_units: 0,
    total_available_units: 0,
    total_inventory_value: 0,
    low_stock_count: 0,
  };
}

export async function getActivityFeed(limit = 25) {
  const { data, error } = await supabase
    .from('inventory_activity_feed')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
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

export async function getFinishedProducts(search = '') {
  let query = supabase
    .from('finished_inventory_by_product')
    .select('*')
    .order('finished_sku', { ascending: true });

  const term = search.trim();

  if (term) {
    const escaped = escapeOrTerm(term);
    query = query.or(
      `finished_sku.ilike.%${escaped}%,name.ilike.%${escaped}%,customer.ilike.%${escaped}%,logo.ilike.%${escaped}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function receiveFinishedInventory({ binId, finishedProductId, quantity, notes }) {
  const { error } = await supabase.rpc('receive_finished_inventory', {
    p_bin_id: Number(binId),
    p_finished_product_id: Number(finishedProductId),
    p_quantity: Number(quantity),
    p_notes: notes || null,
  });

  if (error) throw error;
}

export async function getPullSheets() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPullSheetItems(jobId) {
  const { data, error } = await supabase
    .from('pull_sheet_view')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function completeJobItem({ jobItemId, binId, notes }) {
  const { error } = await supabase.rpc('complete_job_item', {
    p_job_item_id: Number(jobItemId),
    p_bin_id: Number(binId),
    p_notes: notes || null,
  });

  if (error) throw error;
}
