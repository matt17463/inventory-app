import { createClient } from '@supabase/supabase-js';
import { getHeader, validateSharedSecret } from './_shared/security.js';
import { ensureJobItemReservation, finishPullsheetRun, startPullsheetRun } from './_shared/pullsheetReservations.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function clean(value) {
  return String(value || '').trim();
}

function normalizeSku(value) {
  return clean(value).toUpperCase();
}

function normalizeText(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/grey/g, 'gray')
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeMetaKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function logoCodeFromName(name) {
  return String(name || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getNumeric(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}


function normalizeDueDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, 10);
}

function getOrderMetaValue(order, keys) {
  const meta = Array.isArray(order?.meta_data) ? order.meta_data : [];
  const wanted = keys.map(normalizeMetaKey);

  for (const item of meta) {
    if (!item) continue;
    const key = normalizeMetaKey(item.key);
    if (wanted.includes(key) && item.value !== undefined && item.value !== null && String(item.value).trim() !== '') {
      return String(item.value).trim();
    }
  }

  return null;
}

function getOrderDueDate(order) {
  return normalizeDueDate(
    order?.due_date ||
      order?.production_due_date ||
      order?.pullsheet_due_date ||
      order?.sc_pullsheet_due_date ||
      getOrderMetaValue(order, [
        '_sc_pullsheet_due_date',
        'sc_pullsheet_due_date',
        'production_due_date',
        'due_date',
      ])
  );
}

async function setJobDueDateFromOrder(order, jobId = null) {
  const dueDate = getOrderDueDate(order);
  if (!dueDate) return null;

  try {
    const params = jobId
      ? {
          p_job_id: Number(jobId),
          p_due_date: dueDate,
          p_source: order?.due_date_source || order?.source || 'manual_pullsheet_payload',
          p_reason: 'Due date received during pull sheet generation',
          p_changed_by: order?.due_date_changed_by || order?.changed_by || 'manual_pullsheet',
        }
      : {
          p_woocommerce_order_id: Number(order.id || order.order_id || order.woocommerce_order_id),
          p_due_date: dueDate,
          p_source: order?.due_date_source || order?.source || 'manual_pullsheet_payload',
          p_reason: 'Due date received during pull sheet generation',
          p_changed_by: order?.due_date_changed_by || order?.changed_by || 'manual_pullsheet',
        };

    const rpcName = jobId ? 'sc_set_job_due_date' : 'sc_set_job_due_date_by_woo_order';
    const { error } = await supabase.rpc(rpcName, params);
    if (error) console.warn('Due date sync failed:', error.message);
  } catch (err) {
    console.warn('Due date sync unavailable:', err.message);
  }

  return dueDate;
}

function getLineItemMeta(lineItem, possibleKeys) {
  const meta = Array.isArray(lineItem.meta_data) ? lineItem.meta_data : [];

  for (const wantedKey of possibleKeys) {
    const normalizedWanted = normalizeMetaKey(wantedKey);
    const found = meta.find((item) => normalizeMetaKey(item.key) === normalizedWanted);
    if (found && found.value !== undefined && found.value !== null && String(found.value).trim() !== '') {
      return String(found.value).trim();
    }
  }

  return null;
}

function getSelectedAttribute(lineItem, possibleKeys) {
  const attrs = Array.isArray(lineItem.selected_attributes) ? lineItem.selected_attributes : [];
  const targets = possibleKeys.map(normalizeMetaKey);

  for (const attr of attrs) {
    const keys = [attr.key, attr.label].map(normalizeMetaKey);
    if (keys.some((k) => targets.includes(k))) {
      return clean(attr.value || attr.slug);
    }
  }

  return getLineItemMeta(lineItem, possibleKeys);
}

function enrichedLineItem(lineItem) {
  const variationId = getNumeric(
    lineItem.variation_id || lineItem.woocommerce_variation_id || lineItem.variationId
  );
  const productId = getNumeric(
    lineItem.product_id || lineItem.woocommerce_product_id || lineItem.productId
  );

  const variationSku = normalizeSku(lineItem.variation_sku);
  const sku = normalizeSku(variationSku || lineItem.sku || lineItem.order_sku || lineItem.product_sku);

  return {
    ...lineItem,
    product_id: productId,
    variation_id: variationId,
    sku,
    variation_sku: variationSku,
    selected_brand: clean(lineItem.selected_brand) || getSelectedAttribute(lineItem, ['pa_brand', 'brand']),
    selected_style: clean(lineItem.selected_style) || getSelectedAttribute(lineItem, ['pa_style', 'style', 'product style']),
    selected_color: clean(lineItem.selected_color) || getSelectedAttribute(lineItem, ['pa_color', 'color', 'colour']),
    selected_size: clean(lineItem.selected_size) || getSelectedAttribute(lineItem, ['pa_size', 'size']),
  };
}

function parseOrderSku(sku) {
  const orderSku = normalizeSku(sku);
  const parts = orderSku.split('-').filter(Boolean);

  const sizePattern =
    /^(XS|S|M|L|XL|XXL|XXXL|[WYM]?[0-9]*XL|WXS|WS|WM|WL|WXL|W2XL|W3XL|W4XL|A2XL|A3XL|A4XL|AS|AM|AL|AXL|YL|YM|YS|YXL|YXS)$/;

  const knownStyleMarkers = [
    ['BELLA', 'CANVAS', '6405'],
    ['BELLA', 'CANVAS', '3001'],
    ['GILDAN', '18600'],
    ['GILDAN', '18500'],
    ['GILDAN', '18000'],
    ['GILDAN', '5000'],
    ['RICHARDSON', '112'],
    ['JERSEY'],
  ];

  function markerMatchesAt(marker, startIndex) {
    if (startIndex + marker.length > parts.length) return false;
    return marker.every((token, offset) => parts[startIndex + offset] === token);
  }

  for (let i = 0; i < parts.length; i += 1) {
    for (const marker of knownStyleMarkers) {
      if (!markerMatchesAt(marker, i)) continue;

      let sizeIndex = -1;
      for (let j = i + marker.length; j < parts.length; j += 1) {
        if (sizePattern.test(parts[j])) sizeIndex = j;
      }

      if (sizeIndex >= 0) {
        const blankSkuBase = parts.slice(i, sizeIndex + 1).join('-');
        const afterSize = parts.slice(sizeIndex + 1);
        return {
          orderSku,
          blankSkuBase,
          logoName: afterSize[0] || null,
          placement: afterSize[1] || null,
          decorationSize: afterSize[1]
            ? (afterSize[1].match(/([0-9]+(?:\.[0-9]+)?)/) || [])[1] || null
            : null,
        };
      }
    }
  }

  let sizeIndex = -1;
  parts.forEach((part, index) => {
    if (sizePattern.test(part)) sizeIndex = index;
  });

  if (sizeIndex < 0) {
    return { orderSku, blankSkuBase: orderSku, logoName: null, placement: null, decorationSize: null };
  }

  const blankStart = Math.max(0, sizeIndex - 4);
  const blankSkuBase = parts.slice(blankStart, sizeIndex + 1).join('-');
  const afterSize = parts.slice(sizeIndex + 1);

  return {
    orderSku,
    blankSkuBase,
    logoName: afterSize[0] || null,
    placement: afterSize[1] || null,
    decorationSize: afterSize[1]
      ? (afterSize[1].match(/([0-9]+(?:\.[0-9]+)?)/) || [])[1] || null
      : null,
  };
}

function customerNameFromOrder(order) {
  const billingName = `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim();
  const shippingName = `${order.shipping?.first_name || ''} ${order.shipping?.last_name || ''}`.trim();
  return clean(order.billing?.company) || billingName || clean(order.shipping?.company) || shippingName || 'Unknown Customer';
}

async function findOrCreateCustomer(name) {
  const cleanName = clean(name) || 'Unknown Customer';

  const { data: existing, error: existingError } = await supabase
    .from('customers')
    .select('id')
    .eq('name', cleanName)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id;

  const { data, error } = await supabase.from('customers').insert({ name: cleanName }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function findOrCreateLogo(logoName) {
  const name = clean(logoName);
  if (!name) return null;
  const code = logoCodeFromName(name);

  const { data: existing, error: existingError } = await supabase
    .from('logos')
    .select('id')
    .eq('name', name)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id;

  const { data, error } = await supabase.from('logos').insert({ name, code }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function queryMapping(column, value) {
  if (!value) return null;
  const { data, error } = await supabase
    .from('product_sku_mappings')
    .select(`blank_product_id, blank_products:blank_product_id (id, sku_base, name)`)
    .eq(column, value)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function queryProductWithBlank(filters) {
  let query = supabase
    .from('products')
    .select(`
      id,
      sku,
      name,
      woocommerce_product_id,
      woocommerce_variation_id,
      blank_product_id,
      brand_id,
      product_type_id,
      color_id,
      size_id,
      brands:brand_id (id, name, code),
      product_types:product_type_id (id, name, code),
      colors:color_id (id, name, code),
      sizes:size_id (id, name, code),
      blank_products:blank_product_id (id, sku_base, name)
    `)
    .not('blank_product_id', 'is', null)
    .limit(50);

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') query = query.eq(key, value);
  });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

function productMatchesSelectedAttributes(product, lineItem) {
  const selectedColor = normalizeText(lineItem.selected_color);
  const selectedSize = normalizeText(lineItem.selected_size);

  const productColor = normalizeText(`${product.colors?.name || ''} ${product.colors?.code || ''}`);
  const productSize = normalizeText(`${product.sizes?.name || ''} ${product.sizes?.code || ''}`);

  const colorOk = !selectedColor || productColor.includes(selectedColor) || selectedColor.includes(productColor);
  const sizeOk = !selectedSize || productSize.includes(selectedSize) || selectedSize.includes(productSize);

  return colorOk && sizeOk;
}

async function findProductByParentAndSelectedAttributes(lineItem) {
  if (!lineItem.product_id || (!lineItem.selected_color && !lineItem.selected_size)) return null;

  const candidates = await queryProductWithBlank({ woocommerce_product_id: lineItem.product_id });
  const variationCandidates = candidates.filter((p) => p.woocommerce_variation_id);
  const matches = variationCandidates.filter((p) => productMatchesSelectedAttributes(p, lineItem));

  if (matches.length === 1 && matches[0].blank_products?.id) {
    return { product: matches[0], source: 'parent_id_selected_attributes' };
  }

  return null;
}

/**
 * Primary lookup priority:
 * 1. WooCommerce variation_id mapping
 * 2. Variation SKU/current SKU mapping
 * 3. Synced products.woocommerce_variation_id
 * 4. Synced products.sku
 * 5. Parent product + selected color/size attributes
 * 6. Parent product mapping only as a warning/fallback
 * 7. SKU parser fallback
 */

async function findNonInventoryRuleForLineItem(rawLineItem) {
  const lineItem = enrichedLineItem(rawLineItem);
  try {
    const { data, error } = await supabase.rpc('sc_find_non_inventory_rule_for_line', {
      p_sku: normalizeSku(lineItem.sku) || null,
      p_woo_product_id: lineItem.product_id ? Number(lineItem.product_id) : null,
      p_woo_variation_id: lineItem.variation_id ? Number(lineItem.variation_id) : null,
      p_product_name: clean(lineItem.name) || null,
    });

    if (error) {
      console.warn('Non-inventory rule lookup failed:', error.message);
      return null;
    }

    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.warn('Non-inventory rule lookup unavailable:', err.message);
    return null;
  }
}

async function findBlankProductForLineItem(rawLineItem) {
  const lineItem = enrichedLineItem(rawLineItem);
  const sku = normalizeSku(lineItem.sku);
  const variationId = lineItem.variation_id;
  const productId = lineItem.product_id;
  let mapping = null;
  let source = 'not_found';
  let warning = null;

  if (variationId) {
    mapping = await queryMapping('woo_variation_id', variationId);
    source = 'variation_id_mapping';
  }

  if (!mapping && sku) {
    mapping = await queryMapping('woo_sku', sku);
    source = 'sku_mapping';
  }

  if (mapping?.blank_products?.id) {
    return {
      source,
      warning,
      blankProduct: mapping.blank_products,
      parsed: { orderSku: sku, blankSkuBase: mapping.blank_products.sku_base, logoName: null, placement: null, decorationSize: null },
      lineItem,
    };
  }

  if (variationId) {
    const products = await queryProductWithBlank({ woocommerce_variation_id: variationId });
    const product = products[0];
    if (product?.blank_products?.id) {
      return {
        source: 'products_variation_id',
        warning,
        blankProduct: product.blank_products,
        parsed: { orderSku: sku, blankSkuBase: product.blank_products.sku_base, logoName: null, placement: null, decorationSize: null },
        lineItem,
      };
    }
  }

  if (sku) {
    const products = await queryProductWithBlank({ sku });
    const product = products[0];
    if (product?.blank_products?.id) {
      return {
        source: 'products_sku',
        warning,
        blankProduct: product.blank_products,
        parsed: { orderSku: sku, blankSkuBase: product.blank_products.sku_base, logoName: null, placement: null, decorationSize: null },
        lineItem,
      };
    }
  }

  const selectedMatch = await findProductByParentAndSelectedAttributes(lineItem);
  if (selectedMatch?.product?.blank_products?.id) {
    return {
      source: selectedMatch.source,
      warning: variationId ? null : 'variation_id_missing_matched_by_selected_attributes',
      blankProduct: selectedMatch.product.blank_products,
      parsed: { orderSku: sku, blankSkuBase: selectedMatch.product.blank_products.sku_base, logoName: null, placement: null, decorationSize: null },
      lineItem,
    };
  }

  if (!mapping && productId) {
    mapping = await queryMapping('woo_product_id', productId);
    source = 'parent_product_id_mapping';
    warning = 'parent_product_fallback_verify_variation';
  }

  if (mapping?.blank_products?.id) {
    return {
      source,
      warning,
      blankProduct: mapping.blank_products,
      parsed: { orderSku: sku, blankSkuBase: mapping.blank_products.sku_base, logoName: null, placement: null, decorationSize: null },
      lineItem,
    };
  }

  const parsed = parseOrderSku(sku);
  const { data: fallbackBlank, error: fallbackError } = await supabase
    .from('blank_products')
    .select('id, sku_base, name')
    .eq('sku_base', parsed.blankSkuBase)
    .maybeSingle();

  if (fallbackError) throw fallbackError;

  if (fallbackBlank?.id) {
    return { source: 'fallback_parser', warning: variationId ? null : 'variation_id_missing_sku_parser_used', blankProduct: fallbackBlank, parsed, lineItem };
  }

  return { source: 'not_found', warning: variationId ? null : 'variation_id_missing_no_match', blankProduct: null, parsed, lineItem };
}

async function findOrCreateFinishedProduct({ blankProductId, customerId, logoId, finishedSku, name, placement, decorationSize }) {
  const sku = normalizeSku(finishedSku);

  const { data: existing, error: existingError } = await supabase
    .from('finished_products')
    .select('id')
    .eq('finished_sku', sku)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id;

  const payload = {
    blank_product_id: blankProductId,
    finished_sku: sku,
    name: clean(name) || sku,
    placement: clean(placement) || null,
    decoration_size: clean(decorationSize) || null,
  };
  if (customerId) payload.customer_id = customerId;
  if (logoId) payload.logo_id = logoId;

  Object.keys(payload).forEach((key) => {
    if (payload[key] === null || payload[key] === '') delete payload[key];
  });

  const { data, error } = await supabase.from('finished_products').insert(payload).select('id').single();
  if (error) throw error;
  return data.id;
}

async function upsertJob(order, customerName) {
  const orderId = Number(order.id);
  const { data: existing, error: lookupError } = await supabase
    .from('jobs')
    .select('id, status')
    .eq('woocommerce_order_id', orderId)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing?.id) {
    const { data, error } = await supabase
      .from('jobs')
      .update({
        job_name: `Order #${order.number || orderId}`,
        customer_name: customerName,
        notes: clean(order.customer_note) || null,
      })
      .eq('id', existing.id)
      .select('id, status')
      .single();
    if (error) throw error;
    return { ...data, created: false };
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      woocommerce_order_id: orderId,
      job_name: `Order #${order.number || orderId}`,
      customer_name: customerName,
      status: 'queued',
      notes: clean(order.customer_note) || null,
    })
    .select('id, status')
    .single();
  if (error) throw error;
  return { ...data, created: true };
}

async function existingJobItem(jobId, lineItemId, sku) {
  let query = supabase
    .from('job_items')
    .select('id')
    .eq('job_id', jobId)
    .order('id', { ascending: true })
    .limit(1);

  if (lineItemId) query = query.eq('woocommerce_line_item_id', Number(lineItemId));
  else query = query.eq('order_sku', normalizeSku(sku));

  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function createJobItem({ jobId, rawLineItem, blankProductId, finishedProductId, logoId, parsed, site, placement, decorationSize, lookupSource, pairingWarning, inventoryRequired = true, nonInventoryReason = null, nonInventoryRuleId = null }) {
  const lineItem = enrichedLineItem(rawLineItem);
  const lineItemId = lineItem.line_item_id || lineItem.id || null;
  const sku = normalizeSku(lineItem.sku);

  const enrichment = {
    blank_product_id: blankProductId,
    finished_product_id: finishedProductId || null,
    woocommerce_line_item_id: lineItemId ? Number(lineItemId) : null,
    woocommerce_product_id: lineItem.product_id ? Number(lineItem.product_id) : null,
    woocommerce_variation_id: lineItem.variation_id ? Number(lineItem.variation_id) : null,
    order_sku: sku,
    item_name: clean(lineItem.name) || null,
    ordered_product_name: clean(lineItem.name) || null,
    selected_brand: clean(lineItem.selected_brand) || null,
    selected_style: clean(lineItem.selected_style) || null,
    selected_color: clean(lineItem.selected_color) || null,
    selected_size: clean(lineItem.selected_size) || null,
    selected_attributes: Array.isArray(lineItem.selected_attributes) ? lineItem.selected_attributes : [],
    pairing_source: lookupSource || null,
    pairing_warning: pairingWarning || null,
    inventory_required: inventoryRequired !== false,
    non_inventory_reason: nonInventoryReason || null,
    non_inventory_rule_id: nonInventoryRuleId || null,
    non_inventory_marked_at: inventoryRequired === false ? new Date().toISOString() : null,
    logo_id: logoId || null,
    site: clean(site) || null,
    placement: clean(placement) || null,
    decoration_size: clean(decorationSize) || null,
    notes: clean(lineItem.name) || null,
  };

  Object.keys(enrichment).forEach((key) => {
    if (enrichment[key] === null || enrichment[key] === '') delete enrichment[key];
  });

  const existing = await existingJobItem(jobId, lineItemId, sku);

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('job_items')
      .update(enrichment)
      .eq('id', existing.id);
    if (updateError) throw updateError;
    return { id: existing.id, created: false, updated: true };
  }

  const payload = {
    job_id: Number(jobId),
    quantity: Number(lineItem.quantity || 1),
    status: 'queued',
    ...enrichment,
  };

  const { data, error } = await supabase.from('job_items').insert(payload).select('id').single();

  if (error) {
    console.error('JOB ITEM INSERT ERROR');
    console.error(JSON.stringify(error, null, 2));
    console.error('JOB ITEM PAYLOAD');
    console.error(JSON.stringify(payload, null, 2));
    throw error;
  }

  return { id: data.id, created: true };
}

async function processOrder(order, context = {}) {
  const orderId = Number(order.id);
  const runId = await startPullsheetRun(supabase, {
    source: context.source || 'manual_pullsheet',
    orderId,
    requestId: context.requestId || null,
  });
  const customerName = customerNameFromOrder(order);
  const customerId = await findOrCreateCustomer(customerName);
  const job = await upsertJob(order, customerName);
  await setJobDueDateFromOrder(order, job.id);

  const orderResult = {
    order_id: orderId,
    job_id: job.id,
    job_created: Boolean(job.created),
    items_created: 0,
    items_existing: 0,
    items_updated: 0,
    reservations_created: 0,
    reservations_existing: 0,
    reservations_failed: 0,
    items_needing_pairing: 0,
    errors: [],
  };

  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];

  for (const rawLineItem of lineItems) {
    const lineItem = enrichedLineItem(rawLineItem);
    try {
      const sku = normalizeSku(lineItem.sku);
      if (!sku) {
        orderResult.errors.push({ line_item_id: lineItem.line_item_id || lineItem.id || null, name: lineItem.name, error: 'Line item has no SKU.' });
        continue;
      }

      const nonInventoryRule = await findNonInventoryRuleForLineItem(lineItem);
      if (nonInventoryRule?.rule_id) {
        const parsed = parseOrderSku(sku);
        const site = getLineItemMeta(lineItem, ['site', 'school', 'location', 'store', 'department']) || parsed.logoName;
        const placement = getLineItemMeta(lineItem, ['logo placement', 'placement', 'print location', 'decoration location', 'location']) || parsed.placement;
        const decorationSize = getLineItemMeta(lineItem, ['decoration size', 'logo size', 'size']) || parsed.decorationSize;
        const reason = nonInventoryRule.reason || 'No inventory tracking required for this WooCommerce item.';

        const jobItem = await createJobItem({
          jobId: job.id,
          rawLineItem: lineItem,
          blankProductId: null,
          finishedProductId: null,
          logoId: null,
          parsed,
          site,
          placement,
          decorationSize,
          lookupSource: 'non_inventory_rule',
          pairingWarning: reason,
          inventoryRequired: false,
          nonInventoryReason: reason,
          nonInventoryRuleId: nonInventoryRule.rule_id,
        });

        if (jobItem.created) orderResult.items_created += 1;
        else if (jobItem.updated) orderResult.items_updated += 1;
        else orderResult.items_existing += 1;
        continue;
      }

      const lookup = await findBlankProductForLineItem(lineItem);
      const blankProduct = lookup.blankProduct;
      const parsed = lookup.parsed;

      const site = getLineItemMeta(lineItem, ['site', 'school', 'location', 'store', 'department']) || parsed.logoName;
      const placement = getLineItemMeta(lineItem, ['logo placement', 'placement', 'print location', 'decoration location', 'location']) || parsed.placement;
      const logoName = getLineItemMeta(lineItem, ['logo', 'design', 'artwork', 'graphic']) || site || parsed.logoName;
      const decorationSize = getLineItemMeta(lineItem, ['decoration size', 'logo size', 'size']) || parsed.decorationSize;

      if (!blankProduct) {
        const jobItem = await createJobItem({
          jobId: job.id,
          rawLineItem: lineItem,
          blankProductId: null,
          finishedProductId: null,
          logoId: null,
          parsed,
          site,
          placement,
          decorationSize,
          lookupSource: lookup.source || 'not_found',
          pairingWarning: lookup.warning || 'blank_product_not_found_needs_pairing',
        });

        if (jobItem.created) orderResult.items_created += 1;
        else if (jobItem.updated) orderResult.items_updated += 1;
        else orderResult.items_existing += 1;

        orderResult.items_needing_pairing += 1;
        orderResult.errors.push({
          sku,
          job_item_id: jobItem.id,
          product_id: lineItem.product_id || null,
          variation_id: lineItem.variation_id || null,
          selected_color: lineItem.selected_color || null,
          selected_size: lineItem.selected_size || null,
          lookup_source: lookup.source,
          pairing_warning: lookup.warning || 'blank_product_not_found_needs_pairing',
          blank_sku_base: parsed.blankSkuBase,
          error: 'Created visible pull sheet line item, but matching blank product was not found. Pair this line item in the app or verify product sync/product_sku_mappings.',
        });
        continue;
      }

      const logoId = await findOrCreateLogo(logoName);
      const finishedProductId = await findOrCreateFinishedProduct({ blankProductId: blankProduct.id, customerId, logoId, finishedSku: sku, name: lineItem.name, placement, decorationSize });

      const jobItem = await createJobItem({
        jobId: job.id,
        rawLineItem: lineItem,
        blankProductId: blankProduct.id,
        finishedProductId,
        logoId,
        parsed,
        site,
        placement,
        decorationSize,
        lookupSource: lookup.source,
        pairingWarning: lookup.warning,
      });

      if (jobItem.created) orderResult.items_created += 1;
      else if (jobItem.updated) orderResult.items_updated += 1;
      else orderResult.items_existing += 1;

      try {
        const reservation = await ensureJobItemReservation(supabase, {
          jobId: job.id,
          jobItemId: jobItem.id,
          blankProductId: blankProduct.id,
          quantity: Number(lineItem.quantity || 1),
        });
        if (reservation?.action === 'created') orderResult.reservations_created += 1;
        else orderResult.reservations_existing += 1;
      } catch (reservationError) {
        orderResult.reservations_failed += 1;
        orderResult.errors.push({
          sku,
          job_item_id: jobItem.id,
          code: reservationError.code || 'reservation_failed',
          error: `Reservation failed: ${reservationError.message}`,
          details: reservationError.details || null,
        });
      }
    } catch (err) {
      orderResult.errors.push({
        line_item_id: lineItem.line_item_id || lineItem.id || null,
        sku: lineItem.sku || null,
        product_id: lineItem.product_id || null,
        variation_id: lineItem.variation_id || null,
        error: err.message,
      });
    }
  }

  if (orderResult.reservations_created + orderResult.reservations_existing > 0 && orderResult.reservations_failed === 0) {
    await supabase.from('jobs').update({ status: 'reserved' }).eq('id', job.id);
  }

  try {
    await supabase.rpc('sc_recalculate_order_status', { p_job_id: Number(job.id) });
  } catch (err) {
    console.warn('Production status board recalculation failed:', err.message);
  }

  await finishPullsheetRun(supabase, runId, {
    job_id: Number(job.id),
    outcome: orderResult.errors.length ? 'completed_with_warnings' : 'completed',
    jobs_created: orderResult.job_created ? 1 : 0,
    items_created: orderResult.items_created,
    items_updated: orderResult.items_updated,
    items_existing: orderResult.items_existing,
    reservations_created: orderResult.reservations_created,
    reservations_existing: orderResult.reservations_existing,
    reservations_failed: orderResult.reservations_failed,
    items_needing_pairing: orderResult.items_needing_pairing,
    metadata: { error_count: orderResult.errors.length },
  });

  return orderResult;
}

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, body: '' };
    }

    if (event.httpMethod === 'GET') {
      return { statusCode: 200, body: JSON.stringify({ success: true, message: 'manual-pullsheet due-dates v1.6.0 active' }) };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }) };
    }

    const authorization = validateSharedSecret(event, {
      envNames: ['MANUAL_PULLSHEET_SECRET', 'SC_PULLSHEET_SECRET', 'WC_WEBHOOK_SECRET'],
      headerNames: ['x-manual-pullsheet-secret', 'x-webhook-secret'],
    });
    if (!authorization.ok) {
      return { statusCode: authorization.statusCode, body: JSON.stringify({ error: authorization.message, code: authorization.code }) };
    }

    const body = JSON.parse(event.body || '{}');
    let orders = Array.isArray(body.orders) ? body.orders : [];

    if (!orders.length && body.order) {
      orders = [body.order];
    }

    if (!orders.length && (body.order_id || body.woocommerce_order_id)) {
      orders = [
        {
          id: Number(body.order_id || body.woocommerce_order_id),
          order_id: Number(body.order_id || body.woocommerce_order_id),
          number: body.order_number || body.order_id || body.woocommerce_order_id,
          due_date: body.due_date || body.production_due_date || null,
          source: body.source || 'manual_pullsheet_payload',
          line_items: Array.isArray(body.line_items) ? body.line_items : [],
          billing: body.billing || {},
          shipping: body.shipping || {},
          customer_note: body.customer_note || null,
        },
      ];
    }

    if (orders.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No orders supplied' }) };
    }

    const results = [];
    let jobsCreated = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let reservationsCreated = 0;
    let reservationsExisting = 0;
    let reservationsFailed = 0;
    let itemsExisting = 0;
    let itemsNeedingPairing = 0;
    const errors = [];

    for (const order of orders) {
      const result = await processOrder(order, {
        source: body.source || 'manual_pullsheet',
        requestId: getHeader(event, 'x-nf-request-id') || getHeader(event, 'x-request-id') || null,
      });
      results.push(result);
      jobsCreated += result.job_created ? 1 : 0;
      itemsCreated += result.items_created;
      itemsUpdated += result.items_updated || 0;
      itemsExisting += result.items_existing || 0;
      reservationsCreated += result.reservations_created;
      reservationsExisting += result.reservations_existing || 0;
      reservationsFailed += result.reservations_failed || 0;
      itemsNeedingPairing += result.items_needing_pairing || 0;
      if (result.errors.length > 0) errors.push(...result.errors.map((error) => ({ order_id: result.order_id, ...error })));
    }

    return {
      statusCode: errors.length && itemsCreated === 0 && itemsUpdated === 0 ? 400 : 200,
      body: JSON.stringify({
        success: results.length > 0 && reservationsFailed === 0,
        jobs_created: jobsCreated,
        items_created: itemsCreated,
        items_updated: itemsUpdated,
        items_existing: itemsExisting,
        reservations_created: reservationsCreated,
        reservations_existing: reservationsExisting,
        reservations_failed: reservationsFailed,
        items_needing_pairing: itemsNeedingPairing,
        errors,
        results,
      }),
    };
  } catch (err) {
    console.error('manual-pullsheet unhandled error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error', details: err.message }) };
  }
};
