export const config = {
  rawBody: true,
};

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeSku(value) {
  return String(value || '').trim().toUpperCase();
}

function parseOrderSku(sku) {
  const clean = normalizeSku(sku);
  const parts = clean.split('-').filter(Boolean);

  let sizeIndex = -1;
  const sizePattern = /^(XS|S|M|L|XL|XXL|XXXL|[WYM]?[0-9]*XL|WXS|WS|WM|WL|WXL|W2XL|W3XL|W4XL|A2XL|A3XL|A4XL)$/;

  parts.forEach((part, index) => {
    if (sizePattern.test(part)) sizeIndex = index;
  });

  if (sizeIndex < 0) {
    return {
      orderSku: clean,
      blankSkuBase: clean,
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
    orderSku: clean,
    blankSkuBase,
    logoName,
    placement,
    decorationSize: sizeMatch ? sizeMatch[1] : null,
  };
}

async function findOrCreateCustomer(name) {
  const clean = String(name || '').trim() || 'Unknown Customer';

  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('name', clean)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('customers')
    .insert({ name: clean })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function findOrCreateLogo(customerId, logoName) {
  if (!logoName) return null;

  const clean = String(logoName).trim();

  const { data: existing } = await supabase
    .from('logos')
    .select('id')
    .eq('customer_id', customerId)
    .eq('name', clean)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('logos')
    .insert({
      customer_id: customerId,
      name: clean,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function findOrCreateFinishedProduct({ blankProductId, customerId, logoId, sku, name, placement, decorationSize }) {
  const { data: existing } = await supabase
    .from('finished_products')
    .select('id')
    .eq('finished_sku', sku)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('finished_products')
    .insert({
      blank_product_id: blankProductId,
      customer_id: customerId,
      logo_id: logoId,
      finished_sku: sku,
      placement,
      decoration_size: decorationSize,
      name,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
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

async function existingJobItem(jobId, lineItemId, sku) {
  let query = supabase.from('job_items').select('id').eq('job_id', jobId);

  if (lineItemId) {
    query = query.eq('woocommerce_line_item_id', Number(lineItemId));
  } else {
    query = query.eq('order_sku', normalizeSku(sku));
  }

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
  const sku = normalizeSku(item.sku);
  const lineItemId = getLineItemId(item);
  const productId = getProductId(item);
  const variationId = getVariationId(item);

  const basePayload = stripEmpty({
    job_id: Number(jobId),
    blank_product_id: blankProductId || null,
    finished_product_id: finishedProductId || null,
    woocommerce_line_item_id: lineItemId ? Number(lineItemId) : null,
    woocommerce_product_id: productId ? Number(productId) : null,
    woocommerce_variation_id: variationId ? Number(variationId) : null,
    order_sku: sku,
    item_name: item.name || null,
    ordered_product_name: item.name || null,
    quantity: Number(item.quantity || 1),
    status: 'queued',
    logo_id: logoId || null,
    placement: parsed?.placement || null,
    decoration_size: parsed?.decorationSize || null,
    pairing_source: pairingSource || null,
    pairing_warning: pairingWarning || null,
    notes: pairingWarning ? `Needs blank pairing: ${item.name || sku}` : item.name,
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
        body: JSON.stringify({ success: true, message: 'WooCommerce webhook visible-unpaired-line-items v1.1.0 active' }),
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

    // WooCommerce setup ping when saving webhook.
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

    const orderId = order.id;
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
          job_name: `Order #${orderId}`,
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
    const errors = [];

    for (const item of order.line_items || []) {
      const sku = normalizeSku(item.sku);

      if (!sku) {
        errors.push({ item: item.name, error: 'Line item missing SKU' });
        continue;
      }

      const parsed = parseOrderSku(sku);

      const { data: blankProduct, error: blankError } = await supabase
        .from('blank_products')
        .select('id, sku_base')
        .eq('sku_base', parsed.blankSkuBase)
        .maybeSingle();

      if (blankError || !blankProduct) {
        try {
          const jobItem = await createOrUpdateJobItem({
            jobId: job.id,
            item,
            blankProductId: null,
            finishedProductId: null,
            logoId: null,
            parsed,
            pairingSource: 'fallback_parser_not_found',
            pairingWarning: 'blank_product_not_found_needs_pairing',
          });

          if (jobItem.created) createdItems.push(jobItem.id);

          errors.push({
            sku,
            job_item_id: jobItem.id,
            blankSkuBase: parsed.blankSkuBase,
            error: 'Created visible pull sheet line item, but blank product was not found. Pair this line item in the app or rerun product sync/mapping repair.',
          });
        } catch (jobItemError) {
          errors.push({
            sku,
            blankSkuBase: parsed.blankSkuBase,
            error: `Blank product not found and visible job item could not be created: ${jobItemError.message}`,
          });
        }
        continue;
      }

      const logoId = await findOrCreateLogo(customerId, parsed.logoName);
      const finishedProductId = await findOrCreateFinishedProduct({
        blankProductId: blankProduct.id,
        customerId,
        logoId,
        sku,
        name: item.name,
        placement: parsed.placement,
        decorationSize: parsed.decorationSize,
      });

      try {
        const jobItem = await createOrUpdateJobItem({
          jobId: job.id,
          item,
          blankProductId: blankProduct.id,
          finishedProductId,
          logoId,
          parsed,
          pairingSource: 'fallback_parser',
          pairingWarning: null,
        });

        if (jobItem.created) createdItems.push(jobItem.id);
      } catch (jobItemError) {
        errors.push({ sku, error: jobItemError.message });
      }
    }

    return {
      statusCode: createdItems.length > 0 ? 200 : 400,
      body: JSON.stringify({
        success: createdItems.length > 0,
        job_id: job.id,
        items_created: createdItems.length,
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
