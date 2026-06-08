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

  const { data, error } = await supabase.rpc('sc_search_manual_invoice_products_v1', {
    p_product_source: args.productSource,
    p_search: args.search,
    p_brand: args.brand,
    p_style: args.style,
    p_color: args.color,
    p_size: args.size,
    p_limit: args.limit,
  });

  if (error) throw error;
  return data || [];
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
