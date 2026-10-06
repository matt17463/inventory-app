import { supabase } from '../supabaseClient';
import { authenticatedFunctionFetch } from './netlifyFunctionClient';
import { createManualInvoiceOrder, searchManualInvoiceProducts } from './manualOrdersApi';
import { shouldSimulateWrites } from './testingMode';
import { calculateSalesTax } from './salesTax';

const clean = (value) => String(value ?? '').trim();

export async function listClientOrders() {
  const { data, error } = await supabase
    .from('sc_client_order_requests_detail')
    .select('*')
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getClientOrderItems(requestId) {
  const { data, error } = await supabase
    .from('sc_client_order_request_items')
    .select('*')
    .eq('request_id', requestId)
    .order('line_number');
  if (error) throw error;
  return data || [];
}

export async function updateClientOrder(requestId, patch) {
  const { data, error } = await supabase
    .from('sc_client_order_requests')
    .update(patch)
    .eq('id', requestId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateClientOrderItem(itemId, patch) {
  const allowed = [
    'blank_product_id', 'sku_base', 'mapped_item_name', 'brand', 'style',
    'mapped_color', 'mapped_size', 'unit_cost', 'decoration_cost',
    'labor_cost', 'unit_price', 'pricing_rule_id', 'pricing_rule_name',
    'placement', 'decoration_size', 'artwork_note',
  ];
  const payload = Object.fromEntries(
    Object.entries(patch || {}).filter(([key]) => allowed.includes(key))
  );
  const { data, error } = await supabase
    .from('sc_client_order_request_items')
    .update(payload)
    .eq('id', itemId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

function normalizeRule(rule) {
  const multiplier = Number(rule.markup_multiplier || 0)
    || (Number(rule.markup_percent || 0) ? 1 + Number(rule.markup_percent || 0) / 100 : 2);
  return {
    id: rule.id,
    rule_name: rule.rule_name || rule.name || 'Pricing rule',
    product_type: rule.product_type || '',
    decoration_type: rule.decoration_type || '',
    base_price: Number(rule.base_price || 0),
    markup_percent: Number(rule.markup_percent || 0),
    markup_multiplier: multiplier,
    decoration_cost: Number(rule.decoration_cost || rule.flat_fee || 0),
    setup_fee: Number(rule.setup_fee || 0),
    minimum_margin_percent: Number(rule.minimum_margin_percent || 0),
    active: rule.active ?? rule.is_active ?? true,
  };
}

export async function listClientPricingRules() {
  const rpc = await supabase.rpc('sc_quote_builder_pricing_rules');
  if (!rpc.error) {
    return (rpc.data || []).map(normalizeRule).filter((row) => row.active !== false);
  }

  const current = await supabase
    .from('sc_pricing_rules')
    .select('*')
    .order('updated_at', { ascending: false });
  if (!current.error) {
    return (current.data || []).map(normalizeRule).filter((row) => row.active !== false);
  }

  const legacy = await supabase
    .from('phase5_pricing_rules')
    .select('*')
    .order('rule_name', { ascending: true });
  if (legacy.error) throw rpc.error || current.error || legacy.error;
  return (legacy.data || []).map(normalizeRule).filter((row) => row.active !== false);
}

function normalizeClientOrderSize(value) {
  const raw = clean(value);
  if (!raw) return '';
  const normalized = raw
    .replace(/^youth\s+/i, '')
    .replace(/^adult\s+/i, '')
    .replace(/^kids?\s+/i, '')
    .trim();
  const aliases = {
    'extra small': 'XS',
    'x-small': 'XS',
    'small': 'S',
    'medium': 'M',
    'large': 'L',
    'extra large': 'XL',
    'x-large': 'XL',
    '2xl': '2XL',
    'xxl': '2XL',
    '3xl': '3XL',
    'xxxl': '3XL',
  };
  return aliases[normalized.toLowerCase()] || normalized;
}

function uniqueBlankRows(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = String(row.blank_product_id || row.product_id || row.id || [
      row.sku_base, row.sku, row.brand, row.style, row.color, row.size,
    ].join('|'));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchClientOrderBlankProducts(item, search = '') {
  const explicitTerm = clean(search);
  const fallbackTerm = clean(item?.garment_type);
  const term = explicitTerm || fallbackTerm;
  const color = clean(item?.garment_color);
  const rawSize = clean(item?.size);
  const normalizedSize = normalizeClientOrderSize(rawSize);

  // Preserve an operator-entered search term. The prior fallback could drop the
  // term entirely and return dozens of unrelated items that only matched color/size.
  // Instead, progressively relax only intake-derived filters while keeping the
  // product/style intent. For long searches, also try a style/SKU-like token.
  const searchTerms = [term];
  if (explicitTerm) {
    const tokens = explicitTerm.split(/\s+/).filter(Boolean);
    const styleLike = tokens.find((token) => /\d/.test(token));
    if (styleLike && !searchTerms.includes(styleLike)) searchTerms.push(styleLike);
  }

  for (const searchTerm of searchTerms.filter(Boolean)) {
    const attempts = [
      { search: searchTerm, color, size: rawSize },
      ...(normalizedSize && normalizedSize !== rawSize
        ? [{ search: searchTerm, color, size: normalizedSize }]
        : []),
      { search: searchTerm, color, size: '' },
      { search: searchTerm, color: '', size: normalizedSize || rawSize },
      { search: searchTerm, color: '', size: '' },
    ];

    for (const attempt of attempts) {
      const rows = await searchManualInvoiceProducts({
        productSource: 'blank',
        ...attempt,
        limit: 100,
      });
      if (rows.length) return uniqueBlankRows(rows);
    }
  }

  return [];
}

export function priceClientOrderItem(item, rule) {
  const quantity = Math.max(1, Number(item.quantity || 1));
  const blankCost = Number(item.unit_cost || 0);
  const decorationCost = Number(rule?.decoration_cost || item.decoration_cost || 0);
  const laborCost = Number(item.labor_cost || 0);
  const setupPerUnit = Number(rule?.setup_fee || 0) / quantity;
  const baseCost = blankCost + decorationCost + laborCost + setupPerUnit;
  const rulePrice = Number(rule?.base_price || 0) > 0
    ? Number(rule.base_price)
    : baseCost * Number(rule?.markup_multiplier || 2);
  return {
    decoration_cost: Number(decorationCost.toFixed(2)),
    unit_price: Number(rulePrice.toFixed(2)),
    pricing_rule_id: rule?.id == null ? null : String(rule.id),
    pricing_rule_name: rule?.rule_name || '',
  };
}

export async function markClientOrderQuoteSent(requestId) {
  return updateClientOrder(requestId, {
    status: 'quote_sent',
    quote_sent_at: new Date().toISOString(),
  });
}

export async function markClientOrderApproved(requestId) {
  return updateClientOrder(requestId, {
    status: 'awaiting_payment',
    approved_at: new Date().toISOString(),
  });
}

export async function markClientOrderPaid(requestId) {
  return updateClientOrder(requestId, {
    status: 'ready_for_production',
    payment_received_at: new Date().toISOString(),
  });
}

function conversionIds(result) {
  const source = Array.isArray(result) ? result[0] : result || {};
  return {
    manualOrderId: source.manual_order_id || source.order_id || source.id || null,
    jobId: source.generated?.job_id
      || source.generated_job_id
      || source.job_id
      || source.job?.id
      || null,
  };
}

export function buildClientOrderProductionPayload(request, items, options = {}) {
  if (!request?.id) throw new Error('Select a client order first.');
  if (request.manual_order_id) {
    throw new Error(`This request is already converted to manual order #${request.manual_order_id}.`);
  }
  if (!request.payment_received_at && request.status !== 'ready_for_production') {
    throw new Error('Record payment before converting this request to production.');
  }
  if (!items?.length) throw new Error('This request has no line items.');

  const unmapped = items.filter((item) => !clean(item.blank_product_id));
  if (unmapped.length) {
    throw new Error(`Map every line to a blank product before conversion. Unmapped lines: ${unmapped.map((i) => i.line_number).join(', ')}.`);
  }

  const unpriced = items.filter((item) => Number(item.unit_price || 0) <= 0);
  if (unpriced.length) {
    throw new Error(`Price every line before conversion. Unpriced lines: ${unpriced.map((i) => i.line_number).join(', ')}.`);
  }

  const invoiceNumber = clean(options.invoiceNumber || request.external_invoice_number || request.order_number);
  const lineSubtotal = (items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
  const taxAmount = calculateSalesTax(lineSubtotal);
  const manualHeader = {
    invoice_number: invoiceNumber,
    customer_name: clean(request.contact_name),
    organization: clean(request.organization),
    customer_email: clean(request.contact_email),
    customer_phone: clean(request.contact_phone),
    order_date: new Date().toISOString().slice(0, 10),
    due_date: request.desired_completion_date || null,
    invoice_sent: Boolean(request.quote_sent_at),
    payment_received: true,
    tax_amount: taxAmount,
    shipping_amount: Number(request.shipping_amount || 0),
    total_payment_amount: lineSubtotal + Number(request.shipping_amount || 0) + taxAmount,
    notes: [
      `Converted from client request ${request.order_number}.`,
      clean(request.quote_notes),
      clean(request.internal_notes),
      clean(options.conversionNote),
    ].filter(Boolean).join('\n'),
  };

  const manualItems = items.map((item) => ({
    item_type: 'blank',
    product_source: 'blank',
    blank_product_id: clean(item.blank_product_id),
    sku_base: clean(item.sku_base),
    item_name: clean(item.mapped_item_name || item.garment_type),
    brand: clean(item.brand),
    style: clean(item.style || item.garment_type),
    color: clean(item.mapped_color || item.garment_color),
    size: clean(item.mapped_size || item.size),
    quantity: Number(item.quantity || 0),
    price_per_item: Number(item.unit_price || 0),
    artwork_note: clean(item.artwork_note || request.customization_notes),
    placement: clean(item.placement),
    decoration_size: clean(item.decoration_size),
    notes: [
      item.recipient_name ? `Recipient: ${item.recipient_name}` : '',
      item.name_on_back ? `Name: ${item.name_on_back}` : '',
      item.jersey_number ? `Number: ${item.jersey_number}` : '',
      item.name_text_color ? `Personalization color: ${item.name_text_color}` : '',
      clean(item.notes),
    ].filter(Boolean).join(' · '),
  }));

  return {
    invoiceNumber,
    manualHeader,
    manualItems,
    totalQuantity: manualItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  };
}

export function previewClientOrderProductionConversion(request, items, options = {}) {
  const payload = buildClientOrderProductionPayload(request, items, options);
  return {
    simulated: true,
    manualOrderId: null,
    jobId: null,
    request: { ...request, status: 'production' },
    preview: {
      ...payload,
      wouldCreateManualOrder: true,
      wouldCreateProductionJob: true,
      wouldCreateInventoryReservations: true,
      wouldEvaluatePurchasingDemand: true,
      inventoryChanged: false,
      databaseChanged: false,
    },
  };
}

export async function convertClientOrderToProduction(request, items, options = {}) {
  const payload = buildClientOrderProductionPayload(request, items, options);

  // Hard safety boundary: in simulated-write Testing Mode, this function
  // validates and builds the exact live conversion payload but performs no writes.
  if (shouldSimulateWrites()) {
    return previewClientOrderProductionConversion(request, items, options);
  }

  const result = await createManualInvoiceOrder(payload.manualHeader, payload.manualItems, true);
  const ids = conversionIds(result);

  if (!ids.manualOrderId) {
    throw new Error('The manual order was created, but its ID was not returned. Check Manual Invoiced Orders before retrying.');
  }

  const updated = await updateClientOrder(request.id, {
    external_invoice_number: payload.invoiceNumber,
    manual_order_id: ids.manualOrderId,
    generated_job_id: ids.jobId,
    converted_at: new Date().toISOString(),
    conversion_note: clean(options.conversionNote),
    status: 'production',
  });

  return { result, request: updated, ...ids, simulated: false };
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildClientOrderQuickBooksCsv(request, items) {
  const subtotal = (items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0
  );
  const shipping = Number(request.shipping_amount || 0);
  const tax = calculateSalesTax(subtotal);
  const invoiceNumber = clean(request.external_invoice_number || request.order_number);
  const customer = clean(request.organization || request.contact_name);
  const invoiceDate = new Date().toISOString().slice(0, 10);
  const dueDate = clean(request.desired_completion_date || invoiceDate);

  const headers = [
    'InvoiceNo','Customer','InvoiceDate','DueDate','Memo',
    'Item (Product/Service)','Item Description','Item Qty','Item Rate',
    'ItemAmount','Taxable','Tax Rate','Currency','Shipping Charge',
  ];

  const rows = (items || []).map((item, index) => {
    const description = [
      item.mapped_item_name || item.garment_type,
      item.mapped_color || item.garment_color,
      item.mapped_size || item.size,
      item.recipient_name ? `Recipient: ${item.recipient_name}` : '',
      item.name_on_back ? `Name: ${item.name_on_back}` : '',
      item.jersey_number ? `#${item.jersey_number}` : '',
      item.placement ? `Placement: ${item.placement}` : '',
      item.artwork_note ? `Artwork: ${item.artwork_note}` : '',
    ].filter(Boolean).join(' · ');
    const qty = Number(item.quantity || 0);
    const rate = Number(item.unit_price || 0);
    return [
      invoiceNumber,
      customer,
      invoiceDate,
      dueDate,
      clean(request.quote_notes),
      '',
      description,
      qty,
      rate.toFixed(2),
      (qty * rate).toFixed(2),
      'Y',
      '9.2%',
      'USD',
      index === 0 && shipping > 0 ? shipping.toFixed(2) : '',
    ];
  });

  return {
    csv: [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n'),
    invoiceNumber,
    subtotal: Number(subtotal.toFixed(2)),
    tax,
    shipping: Number(shipping.toFixed(2)),
    total: Number((subtotal + tax + shipping).toFixed(2)),
  };
}

export function buildClientOrderInvoiceCsv(request, items) {
  const headers = [
    'Customer', 'Email', 'Invoice/Reference', 'Request', 'Description',
    'SKU', 'Qty', 'Rate', 'Amount', 'Requested Completion', 'Memo',
  ];
  const rows = (items || []).map((item) => {
    const description = [
      item.mapped_item_name || item.garment_type,
      item.mapped_color || item.garment_color,
      item.mapped_size || item.size,
      item.recipient_name ? `Recipient: ${item.recipient_name}` : '',
      item.name_on_back ? `Name: ${item.name_on_back}` : '',
      item.jersey_number ? `#${item.jersey_number}` : '',
    ].filter(Boolean).join(' · ');
    const qty = Number(item.quantity || 0);
    const rate = Number(item.unit_price || 0);
    return [
      request.organization || request.contact_name,
      request.contact_email,
      request.external_invoice_number || request.order_number,
      request.order_number,
      description,
      item.sku_base || '',
      qty,
      rate.toFixed(2),
      (qty * rate).toFixed(2),
      request.desired_completion_date || '',
      item.notes || request.quote_notes || '',
    ];
  });
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export async function listCalendarData() {
  const safe = async (promise) => {
    const result = await promise;
    if (result.error) return [];
    return result.data || [];
  };
  const [jobs, purchaseOrders, artwork, clientOrders, tasks] = await Promise.all([
    safe(supabase.from('jobs').select('id,job_name,customer_name,woocommerce_order_id,due_date,status,updated_at').not('due_date','is',null)),
    safe(supabase.from('phase1_purchase_orders_with_totals').select('*').not('expected_at','is',null)),
    safe(supabase.from('sc_artwork_system_requests').select('*')),
    safe(supabase.from('sc_client_order_requests_detail').select('*').not('desired_completion_date','is',null)),
    safe(supabase.from('phase5_tasks_detail').select('*').not('due_at','is',null)),
  ]);
  return { jobs, purchaseOrders, artwork, clientOrders, tasks };
}

export async function listClientOrderAttachments(requestId) {
  const { data, error } = await supabase
    .from('sc_client_order_attachments')
    .select('id,request_id,file_name,mime_type,file_size_bytes,created_at')
    .eq('request_id', requestId)
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function openClientOrderAttachment(attachmentId) {
  const response = await authenticatedFunctionFetch('/.netlify/functions/client-order-file', {
    method: 'POST',
    body: JSON.stringify({ attachment_id: attachmentId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false || !payload.url) {
    throw new Error(payload.error || 'Could not open attachment.');
  }
  window.open(payload.url, '_blank', 'noopener,noreferrer');
}
