export const config = {
  rawBody: true,
};

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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

function getNumeric(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getLineItemId(item) {
  return getNumeric(item?.line_item_id || item?.id || item?.woocommerce_line_item_id);
}

function getProductId(item) {
  return getNumeric(item?.product_id || item?.woocommerce_product_id || item?.productId);
}

function getVariationId(item) {
  return getNumeric(item?.variation_id || item?.woocommerce_variation_id || item?.variationId);
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
    if (keys.some((key) => targets.includes(key))) {
      return clean(attr.value || attr.slug);
    }
  }

  return getLineItemMeta(lineItem, possibleKeys);
}

function enrichedLineItem(lineItem) {
  const variationId = getVariationId(lineItem);
  const productId = getProductId(lineItem);
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
    /^(XS|S|M|L|XL|XXL|XXXL|[WYM]?[0-9]*XL|WXS|WS|WM|WL|WXL|W2XL|W3XL|W4XL|A2XL|A3XL|A4XL|AS|AM|AL|AXL|YL|YM|YS|YXL|YXS|ONE|ONE-SIZE)$/;

  let sizeIndex = -1;
  parts.forEach((part, index) => {
    if (sizePattern.test(part)) sizeIndex = index;
  });

  if (sizeIndex < 0) {
    return {
      orderSku,
      blankSkuBase: orderSku,
      logoName: null,
      placement: null,
      decorationSize: null,
    };
  }

  const blankStart = Math.max(0, sizeIndex - 4);
  const blankSkuBase = parts.slice(blankStart, sizeIndex + 1).join('-');
  const afterSize = parts.slice(sizeIndex + 1);
  const logoName = afterSize[0] || null;
  const placement = afterSize[1] || null;
  const sizeMatch = placement ? placement.match(/([0-9]+(?:\.[0-9]+)?)/) : null;

  return {
    orderSku,
    blankSkuBase,
    logoName,
    placement,
    decorationSize: sizeMatch ? sizeMatch[1] : null,
  };
}

async function findOrCreateCustomer(name) {
  const cleaned = clean(name) || 'Unknown Customer';

  const { data: existing, error: existingError } = await supabase
    .from('customers')
    .select('id')
    .eq('name', cleaned)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('customers')
    .insert({ name: cleaned })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function findOrCreateLogo(customerId, logoName) {
  const cleaned = clean(logoName);
  if (!cleaned) return null;

  let query = supabase.from('logos').select('id').eq('name', cleaned);
  if (customerId) query = query.eq('customer_id', customerId);

  const { data: existing, error: existingError } = await query.maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return existing.id;

  const payload = { name: cleaned };
  if (customerId) payload.customer_id = customerId;

  const { data, error } = await supabase.from('logos').insert(payload).select('id').single();
  if (error) throw error;
  return data.id;
}

async function findOrCreateFinishedProduct({ blankProductId, customerId, logoId, sku, name, placement, decorationSize }) {
  if (!blankProductId) return null;

  const finishedSku = normalizeSku(sku);
  const { data: existing, error: existingError } = await supabase
    .from('finished_products')
    .select('id')
    .eq('finished_sku', finishedSku)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id;

  const payload = {
    blank_product_id: blankProductId,
    finished_sku: finishedSku,
    name: clean(name) || finishedSku,
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
  const variationCandidates = candidates.filter((product) => product.woocommerce_variation_id);
  const matches = variationCandidates.filter((product) => productMatchesSelectedAttributes(product, lineItem));

  if (matches.length === 1 && matches[0].blank_products?.id) {
    return { product: matches[0], source: 'parent_id_selected_attributes' };
  }

  return null;
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

async function existingJobItem(jobId, lineItemId, sku) {
  let query = supabase.from('job_items').select('id').eq('job_id', jobId);

  if (lineItemId) query = query.eq('woocommerce_line_item_id', Number(lineItemId));
  else query = query.eq('order_sku', normalizeSku(sku));

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

function stripEmpty(payload) {
  const cleaned = { ...payload };
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === null || cleaned[key] === undefined || cleaned[key] === '') delete cleaned[key];
  });
  return cleaned;
}

async function createOrUpdateJobItem({ jobId, item, blankProductId, finishedProductId, logoId, parsed, pairingSource, pairingWarning }) {
  const lineItem = enrichedLineItem(item);
  const sku = normalizeSku(lineItem.sku);
  const lineItemId = getLineItemId(lineItem);
  const productId = getProductId(lineItem);
  const variationId = getVariationId(lineItem);

  const basePayload = stripEmpty({
    job_id: Number(jobId),
    blank_product_id: blankProductId || null,
    finished_product_id: finishedProductId || null,
    woocommerce_line_item_id: lineItemId ? Number(lineItemId) : null,
    woocommerce_product_id: productId ? Number(productId) : null,
    woocommerce_variation_id: variationId ? Number(variationId) : null,
    order_sku: sku,
    item_name: clean(lineItem.name) || null,
    ordered_product_name: clean(lineItem.name) || null,
    selected_brand: lineItem.selected_brand || null,
    selected_style: lineItem.selected_style || null,
    selected_color: lineItem.selected_color || null,
    selected_size: lineItem.selected_size || null,
    quantity: Number(lineItem.quantity || 1),
    status: 'queued',
    logo_id: logoId || null,
    placement: parsed?.placement || null,
    decoration_size: parsed?.decorationSize || null,
    pairing_source: pairingSource || null,
    pairing_warning: pairingWarning || null,
    notes: pairingWarning ? `Needs review: ${lineItem.name || sku}` : lineItem.name,
  });

  const existing = await existingJobItem(jobId, lineItemId, sku);

  if (existing?.id) {
    const updatePayload = { ...basePayload };
    delete updatePayload.job_id;
    delete updatePayload.quantity;

    const { error } = await supabase.from('job_items').update(updatePayload).eq('id', existing.id);
    if (error) throw error;
    return { id: existing.id, created: false, updated: true };
  }

  const { data, error } = await supabase.from('job_items').insert(basePayload).select('id').single();
  if (error) throw error;
  return { id: data.id, created: true, updated: false };
}

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'WooCommerce webhook catalog-pairing zero-on-hand v1.2.0 active' }),
      };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing Supabase env vars' }) };
    }

    let rawBody = event.rawBody || event.body || '';

    if (event.isBase64Encoded && event.body) {
      rawBody = Buffer.from(event.body, 'base64').toString('utf8');
    }

    const headers = Object.fromEntries(
      Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), value])
    );

    const contentType = headers['content-type'] || '';

    if (contentType.includes('application/x-www-form-urlencoded') && rawBody.length <= 50) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'WooCommerce setup ping accepted' }),
      };
    }

    if (!rawBody) {
      return { statusCode: 200, body: JSON.stringify({ success: true, message: 'No body sent' }) };
    }

    const secret = process.env.WC_WEBHOOK_SECRET || '';
    const signature = headers['x-wc-webhook-signature'];

    if (secret && signature) {
      const expected = crypto.createHmac('sha256', secret.trim()).update(rawBody, 'utf8').digest('base64');

      if (signature.trim() !== expected) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid WooCommerce signature' }) };
      }
    }

    const order = JSON.parse(rawBody);

    if (order.ping === 'pong' || order.webhook_id) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'WooCommerce test received' }),
      };
    }

    const orderId = Number(order.id);
    const customerName =
      `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() ||
      order.billing?.company ||
      'Unknown Customer';

    const customerId = await findOrCreateCustomer(customerName);

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .upsert(
        {
          woocommerce_order_id: orderId,
          job_name: `Order #${order.number || orderId}`,
          customer_name: customerName,
          status: 'queued',
          notes: order.customer_note || null,
          due_date: new Date().toISOString().slice(0, 10),
        },
        { onConflict: 'woocommerce_order_id' }
      )
      .select('id')
      .single();

    if (jobError) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create job', details: jobError.message }) };
    }

    const createdItems = [];
    const updatedItems = [];
    const errors = [];

    for (const rawItem of order.line_items || []) {
      const lineItem = enrichedLineItem(rawItem);
      const sku = normalizeSku(lineItem.sku);

      if (!sku) {
        errors.push({ item: lineItem.name, error: 'Line item missing SKU' });
        continue;
      }

      try {
        const lookup = await findBlankProductForLineItem(lineItem);
        const blankProduct = lookup.blankProduct;
        const parsed = lookup.parsed || parseOrderSku(sku);

        let logoId = null;
        let finishedProductId = null;
        const site = getLineItemMeta(lineItem, ['site', 'school', 'location', 'store', 'department']) || parsed.logoName;
        const placement = getLineItemMeta(lineItem, ['logo placement', 'placement', 'print location', 'decoration location', 'location']) || parsed.placement;
        const logoName = getLineItemMeta(lineItem, ['logo', 'design', 'artwork', 'graphic']) || site || parsed.logoName;
        const decorationSize = getLineItemMeta(lineItem, ['decoration size', 'logo size', 'size']) || parsed.decorationSize;

        if (blankProduct?.id) {
          logoId = await findOrCreateLogo(customerId, logoName);
          finishedProductId = await findOrCreateFinishedProduct({
            blankProductId: blankProduct.id,
            customerId,
            logoId,
            sku,
            name: lineItem.name,
            placement,
            decorationSize,
          });
        }

        const jobItem = await createOrUpdateJobItem({
          jobId: job.id,
          item: lineItem,
          blankProductId: blankProduct?.id || null,
          finishedProductId,
          logoId,
          parsed: { ...parsed, placement, decorationSize },
          pairingSource: lookup.source,
          pairingWarning: blankProduct?.id ? lookup.warning : (lookup.warning || 'blank_product_not_found_needs_pairing'),
        });

        if (jobItem.created) createdItems.push(jobItem.id);
        if (jobItem.updated) updatedItems.push(jobItem.id);

        if (!blankProduct?.id) {
          errors.push({
            sku,
            job_item_id: jobItem.id,
            product_id: lineItem.product_id || null,
            variation_id: lineItem.variation_id || null,
            lookup_source: lookup.source,
            pairing_warning: lookup.warning,
            error: 'Created visible pull sheet line item, but no linked blank product was found. Repair/link this SKU and reprocess the pull sheet.',
          });
        }
      } catch (itemError) {
        errors.push({
          sku,
          product_id: lineItem.product_id || null,
          variation_id: lineItem.variation_id || null,
          error: itemError.message,
        });
      }
    }

    return {
      statusCode: createdItems.length || updatedItems.length ? 200 : 400,
      body: JSON.stringify({
        success: createdItems.length > 0 || updatedItems.length > 0,
        job_id: job.id,
        items_created: createdItems.length,
        items_updated: updatedItems.length,
        errors,
      }),
    };
  } catch (err) {
    console.error('Unhandled webhook error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error', details: err.message }),
    };
  }
};
