import { supabase } from '../supabaseClient';

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeSearchArgs(input = '') {
  if (typeof input === 'string') {
    return { productSource: 'blank', search: input, brand: '', style: '', color: '', size: '', limit: 150 };
  }
  return {
    productSource: clean(input.productSource || input.product_source || 'blank').toLowerCase() === 'finished' ? 'finished' : 'blank',
    search: clean(input.search),
    brand: clean(input.brand),
    style: clean(input.style),
    color: clean(input.color),
    size: clean(input.size),
    limit: Number(input.limit || 150),
  };
}

export async function searchManualInvoiceProducts(input = {}) {
  const args = normalizeSearchArgs(input);

  const payload = {
    p_product_source: args.productSource,
    p_search: args.search,
    p_brand: args.brand,
    p_style: args.style,
    p_color: args.color,
    p_size: args.size,
    p_limit: args.limit,
  };

  const v2 = await supabase.rpc('sc_search_manual_invoice_products_v2', payload);

  if (!v2.error) return v2.data || [];

  const v1 = await supabase.rpc('sc_search_manual_invoice_products_v1', payload);

  if (v1.error) throw v2.error;
  return v1.data || [];
}

export async function searchBlanksForManualInvoice(input = '') {
  const args = normalizeSearchArgs(input);

  try {
    return await searchManualInvoiceProducts({ ...args, productSource: 'blank' });
  } catch (primaryError) {
    const { data, error } = await supabase.rpc('sc_search_blanks_for_manual_invoice_v3', {
      p_search: args.search,
      p_brand: args.brand,
      p_style: args.style,
      p_color: args.color,
      p_size: args.size,
      p_limit: args.limit,
    });
    if (!error) return data || [];

    const fallbackTerm = [args.search, args.brand, args.style, args.color, args.size].filter(Boolean).join(' ');
    const fallback = await supabase.rpc('sc_search_blanks_for_manual_invoice', {
      p_search: fallbackTerm,
    });
    if (fallback.error) throw primaryError;
    return fallback.data || [];
  }
}

export async function searchFinishedForManualInvoice(input = '') {
  const args = normalizeSearchArgs(input);
  return searchManualInvoiceProducts({ ...args, productSource: 'finished' });
}

export async function createManualInvoiceOrder(order, items, generateJob = true) {
  const header = {
    order_source: 'manual_invoice',
    invoice_number: clean(order.invoice_number),
    customer_name: clean(order.customer_name),
    organization: clean(order.organization),
    customer_email: clean(order.customer_email),
    customer_phone: clean(order.customer_phone),
    order_date: order.order_date || null,
    due_date: order.due_date || null,
    status: 'entered',
    invoice_sent: Boolean(order.invoice_sent),
    payment_received: Boolean(order.payment_received),
    tax_amount: Number(order.tax_amount || 0),
    shipping_amount: Number(order.shipping_amount || 0),
    total_payment_amount: Number(order.total_payment_amount || 0),
    notes: clean(order.notes),
  };

  const safeItems = (items || []).map((item, index) => {
    const itemType = clean(item.item_type || item.product_source || 'blank').toLowerCase() === 'finished' ? 'finished' : 'blank';
    return {
      line_number: index + 1,
      item_type: itemType,
      product_source: itemType,
      blank_product_id: itemType === 'blank' ? clean(item.blank_product_id) : '',
      finished_product_id: itemType === 'finished' ? clean(item.finished_product_id) : '',
      sku_base: clean(item.sku_base),
      item_name: clean(item.item_name),
      brand: clean(item.brand),
      style: clean(item.style),
      color: clean(item.color),
      size: clean(item.size),
      quantity: Number(item.quantity || 0),
      price_per_item: Number(item.price_per_item || 0),
      artwork_note: clean(item.artwork_note),
      placement: clean(item.placement),
      decoration_size: clean(item.decoration_size),
      notes: clean(item.notes),
    };
  });

  const { data, error } = await supabase.rpc('sc_create_manual_invoice_order', {
    p_order: header,
    p_items: safeItems,
    p_generate_job: Boolean(generateJob),
  });
  if (error) throw error;
  return data;
}

export async function getManualInvoiceOrders() {
  const { data, error } = await supabase
    .from('sc_manual_invoice_order_totals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(250);
  if (error) throw error;
  return data || [];
}

export async function getManualInvoiceOrderItems(manualOrderId) {
  const { data, error } = await supabase
    .from('sc_manual_invoice_order_items_detail')
    .select('*')
    .eq('manual_order_id', manualOrderId)
    .order('line_number', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function generateManualInvoiceJob(manualOrderId) {
  const { data, error } = await supabase.rpc('sc_generate_job_from_manual_invoice_order', {
    p_manual_order_id: manualOrderId,
  });
  if (error) throw error;
  return data;
}

export async function updateManualInvoicePaymentStatus(manualOrderId, invoiceSent, paymentReceived) {
  const { data, error } = await supabase.rpc('sc_update_manual_invoice_payment_status', {
    p_manual_order_id: manualOrderId,
    p_invoice_sent: Boolean(invoiceSent),
    p_payment_received: Boolean(paymentReceived),
  });
  if (error) throw error;
  return data;
}

export async function updateManualInvoiceOrder(manualOrderId, order, items, options = {}) {
  const header = {
    order_source: 'manual_invoice',
    invoice_number: clean(order.invoice_number),
    customer_name: clean(order.customer_name),
    organization: clean(order.organization),
    customer_email: clean(order.customer_email),
    customer_phone: clean(order.customer_phone),
    order_date: order.order_date || null,
    due_date: order.due_date || null,
    status: clean(order.status || 'entered') || 'entered',
    invoice_sent: Boolean(order.invoice_sent),
    payment_received: Boolean(order.payment_received),
    tax_amount: Number(order.tax_amount || 0),
    shipping_amount: Number(order.shipping_amount || 0),
    total_payment_amount: Number(order.total_payment_amount || 0),
    notes: clean(order.notes),
  };

  const safeItems = (items || []).map((item, index) => {
    const itemType = clean(item.item_type || item.product_source || 'blank').toLowerCase() === 'finished' ? 'finished' : 'blank';
    return {
      line_number: index + 1,
      item_type: itemType,
      product_source: itemType,
      blank_product_id: itemType === 'blank' ? clean(item.blank_product_id) : '',
      finished_product_id: itemType === 'finished' ? clean(item.finished_product_id) : '',
      sku_base: clean(item.sku_base),
      item_name: clean(item.item_name),
      brand: clean(item.brand),
      style: clean(item.style),
      color: clean(item.color),
      size: clean(item.size),
      quantity: Number(item.quantity || 0),
      price_per_item: Number(item.price_per_item || 0),
      artwork_note: clean(item.artwork_note),
      placement: clean(item.placement),
      decoration_size: clean(item.decoration_size),
      notes: clean(item.notes),
    };
  });

  const { data, error } = await supabase.rpc('sc_update_manual_invoice_order', {
    p_manual_order_id: manualOrderId,
    p_order: header,
    p_items: safeItems,
    p_regenerate_job: Boolean(options.regenerateJob),
  });

  if (error) throw error;
  return data;
}

export async function createMissingBlankProductForManualInvoice(line = {}) {
  const payload = {
    sku_base: clean(line.sku_base),
    name: clean(line.name || line.item_name),
    brand: clean(line.brand),
    style: clean(line.style),
    color: clean(line.color),
    size: clean(line.size),
    unit_cost: Number(line.unit_cost || line.price_per_item || 0),
    notes: clean(line.notes),
  };

  const { data, error } = await supabase.rpc('sc_create_blank_product_from_manual_invoice_line', {
    p_line: payload,
  });

  if (error) throw error;
  return data;
}


function normalizeLookupRow(row) {
  const id = row?.id == null ? '' : String(row.id);
  return {
    ...row,
    id,
    name: row?.name || row?.label || row?.title || row?.code || id,
    code: row?.code || row?.slug || '',
  };
}

async function loadManualInvoiceLookupTable(tableName) {
  const { data, error } = await supabase.from(tableName).select('*');
  if (error) throw error;
  return (data || [])
    .map(normalizeLookupRow)
    .filter((row) => row.id)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

export async function getManualInvoiceSizeRunLookups() {
  const [brands, productTypes, colors, sizes] = await Promise.all([
    loadManualInvoiceLookupTable('brands'),
    loadManualInvoiceLookupTable('product_types'),
    loadManualInvoiceLookupTable('colors'),
    loadManualInvoiceLookupTable('sizes'),
  ]);

  return {
    brands,
    product_types: productTypes,
    colors,
    sizes,
  };
}


function normalizeBin(row) {
  if (!row) return null;
  const id = row.id == null ? '' : String(row.id);
  const code = row.bin_code || row.code || row.name || row.label || id;
  const label = row.label || row.name || row.title || code;
  const location = row.location || row.area || row.zone || '';
  const display_name = row.display_name || [code, label !== code ? label : '', location].filter(Boolean).join(' · ');
  return { ...row, id, bin_code: code, label, location, display_name };
}

export async function getManualInvoiceBins() {
  const rpc = await supabase.rpc('sc_receiving_bins_v4');
  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data.map(normalizeBin).filter((row) => row?.id);
  }

  const direct = await supabase.from('bins').select('*');
  if (direct.error) throw direct.error;
  return (direct.data || [])
    .map(normalizeBin)
    .filter((row) => row?.id)
    .sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || '')));
}

export async function getManualInvoiceReceivingLookups() {
  const [lookups, bins] = await Promise.all([
    getManualInvoiceSizeRunLookups(),
    getManualInvoiceBins(),
  ]);

  return { ...lookups, bins };
}

function manualLinePayload(line = {}) {
  return {
    manual_order_item_id: clean(line.manual_order_item_id || line.id),
    item_type: clean(line.item_type || line.product_source || 'blank'),
    product_source: clean(line.product_source || line.item_type || 'blank'),
    blank_product_id: clean(line.blank_product_id),
    finished_product_id: clean(line.finished_product_id),
    sku_base: clean(line.sku_base || line.sku),
    item_name: clean(line.item_name || line.name),
    brand: clean(line.brand),
    style: clean(line.style || line.product_type),
    color: clean(line.color),
    size: clean(line.size),
    quantity: Number(line.quantity || 0),
    price_per_item: Number(line.price_per_item || 0),
    artwork_note: clean(line.artwork_note),
    placement: clean(line.placement),
    decoration_size: clean(line.decoration_size),
    notes: clean(line.notes),
  };
}

export async function receiveManualInvoiceBlankLine({
  manualOrderId = null,
  manualOrderItemId = null,
  line = {},
  binId,
  quantity = null,
  unitCost = null,
  notes = '',
  supplier = '',
  poNumber = '',
} = {}) {
  const payloadLine = manualLinePayload(line);
  const resolvedQuantity = quantity === null || quantity === undefined || quantity === ''
    ? Number(payloadLine.quantity || 0)
    : Number(quantity || 0);

  const unitCostValue = unitCost === null || unitCost === undefined || unitCost === ''
    ? null
    : Number(unitCost || 0);

  const { data, error } = await supabase.rpc('sc_receive_manual_invoice_blank_to_bin', {
    p_manual_order_id: manualOrderId || null,
    p_manual_order_item_id: manualOrderItemId || payloadLine.manual_order_item_id || null,
    p_line: payloadLine,
    p_bin_id_text: clean(binId),
    p_quantity: resolvedQuantity,
    p_unit_cost: unitCostValue,
    p_notes: clean(notes),
    p_supplier: clean(supplier),
    p_po_number: clean(poNumber),
  });

  if (error) throw error;
  if (data?.success === false) throw new Error(data.message || 'Manual invoice blank receiving failed.');
  return data;
}

export async function receiveManualInvoiceOrderBlanks({
  manualOrderId,
  binId,
  unitCost = null,
  notes = '',
  supplier = '',
  poNumber = '',
} = {}) {
  const unitCostValue = unitCost === null || unitCost === undefined || unitCost === ''
    ? null
    : Number(unitCost || 0);

  const { data, error } = await supabase.rpc('sc_receive_manual_invoice_order_blanks_to_bin', {
    p_manual_order_id: manualOrderId,
    p_bin_id_text: clean(binId),
    p_unit_cost: unitCostValue,
    p_notes: clean(notes),
    p_supplier: clean(supplier),
    p_po_number: clean(poNumber),
  });

  if (error) throw error;
  if (data?.success === false) throw new Error(data.message || 'Manual invoice order blank receiving failed.');
  return data;
}

export async function ensureBlankProductForManualSizeRun(line = {}) {
  const payload = {
    brand_id: clean(line.brand_id),
    product_type_id: clean(line.product_type_id),
    color_id: clean(line.color_id),
    size_id: clean(line.size_id),
    brand: clean(line.brand),
    style: clean(line.style),
    color: clean(line.color),
    size: clean(line.size),
    sku_base: clean(line.sku_base),
    name: clean(line.name || line.item_name),
    unit_cost: Number(line.unit_cost || line.price_per_item || 0),
    notes: clean(line.notes),
  };

  const { data, error } = await supabase.rpc('sc_ensure_manual_invoice_blank_for_size_run', {
    p_line: payload,
  });

  if (!error) return data;

  // Fallback for databases that have not run the newest SQL yet.
  return createMissingBlankProductForManualInvoice(payload);
}

export async function getManualInvoiceBlankReceiptSummary(manualOrderId = null, binId = '') {
  const { data, error } = await supabase.rpc('sc_manual_invoice_blank_receipt_summary', {
    p_manual_order_id: manualOrderId || null,
    p_bin_id_text: clean(binId),
  });
  if (error) throw error;
  return data || [];
}

export async function setManualInvoiceLineReceivedQuantity({
  manualOrderId = null,
  manualOrderItemId = null,
  line = {},
  binId,
  targetQuantity = 0,
  unitCost = null,
  notes = '',
  supplier = '',
  poNumber = '',
} = {}) {
  const payloadLine = manualLinePayload(line);
  const unitCostValue = unitCost === null || unitCost === undefined || unitCost === ''
    ? null
    : Number(unitCost || 0);

  const { data, error } = await supabase.rpc('sc_set_manual_invoice_blank_received_quantity', {
    p_manual_order_id: manualOrderId || null,
    p_manual_order_item_id: manualOrderItemId || payloadLine.manual_order_item_id || null,
    p_line: payloadLine,
    p_bin_id_text: clean(binId),
    p_target_quantity: Number(targetQuantity || 0),
    p_unit_cost: unitCostValue,
    p_notes: clean(notes),
    p_supplier: clean(supplier),
    p_po_number: clean(poNumber),
  });

  if (error) throw error;
  if (data?.success === false) throw new Error(data.message || 'Manual invoice received quantity update failed.');
  return data;
}
