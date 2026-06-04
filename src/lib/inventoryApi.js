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

export async function getBlankInventory(search = '') {
  const { data, error } = await supabase
    .from('blank_inventory_by_product')
    .select('*')
    .order('name', { ascending: true })
    .limit(10000);

  if (error) throw error;

  const rows = data || [];
  const term = String(search || '').trim();

  if (!term) return rows;

  const tokens = searchTokens(term);
  if (!tokens.length) return rows;

  return rows.filter((row) => {
    const searchable = [
      row.blank_product_id,
      row.sku_base,
      row.name,
      row.brand,
      row.product_type,
      row.style,
      row.color,
      row.size,
    ].filter(Boolean).map((part) => ({
      text: textSearchValue(part),
      normalized: normalizeSearchValue(part),
    }));

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
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id,
      job_name,
      customer_name,
      woocommerce_order_id,
      status,
      due_date,
      notes,
      created_at
    `)
    .order('created_at', { ascending: false });

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

export async function getPullSheetItems(jobId) {
  const { data, error } = await supabase
    .from('pull_sheet_view')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
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
  ].filter(Boolean).join(' ');
}

export async function getPurchasingShortages(search = '') {
  const { data, error } = await supabase
    .from('purchasing_shortages')
    .select('*')
    .order('need_to_order', { ascending: false });

  if (error) throw error;

  const rows = data || [];
  return rows.filter((row) => rowMatchesAllTokens(row, search, purchasingSearchText));
}


export async function getPurchasingLowStock(search = '') {
  const { data, error } = await supabase
    .from('low_stock_blank_inventory')
    .select('*')
    .order('reorder_quantity', { ascending: false });

  if (error) throw error;

  const rows = data || [];
  return rows.filter((row) => rowMatchesAllTokens(row, search, purchasingSearchText));
}

export async function getPurchasingRecommendedOrders(search = '') {
  const { data, error } = await supabase
    .from('purchasing_recommended_orders')
    .select('*')
    .order('recommended_order_quantity', { ascending: false });

  if (error) throw error;

  const rows = data || [];
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

