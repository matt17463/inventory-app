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

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'WooCommerce webhook function is live' }),
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
        errors.push({
          sku,
          blankSkuBase: parsed.blankSkuBase,
          error: 'Blank product not found. Run WooCommerce product sync first.',
        });
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

      const { data: jobItem, error: jobItemError } = await supabase
        .from('job_items')
        .insert({
          job_id: job.id,
          blank_product_id: blankProduct.id,
          finished_product_id: finishedProductId,
          woocommerce_line_item_id: item.id || null,
          order_sku: sku,
          quantity: item.quantity || 1,
          status: 'queued',
          logo_id: logoId,
          placement: parsed.placement,
          decoration_size: parsed.decorationSize,
          notes: item.name,
        })
        .select('id')
        .single();

      if (jobItemError) {
        errors.push({ sku, error: jobItemError.message });
      } else {
        createdItems.push(jobItem.id);
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
