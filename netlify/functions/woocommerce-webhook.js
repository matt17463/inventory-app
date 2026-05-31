export const config = {
  rawBody: true,
};

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'WooCommerce webhook function is live',
        }),
      };
    }

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Missing Supabase environment variables',
        }),
      };
    }

    if (!process.env.WC_WEBHOOK_SECRET) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Missing WC_WEBHOOK_SECRET',
        }),
      };
    }

    let rawBody = event.rawBody || event.body;

    if (event.isBase64Encoded && event.body) {
      rawBody = Buffer.from(event.body, 'base64').toString('utf8');
    }

    if (!rawBody) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Webhook endpoint reached, but no body was sent.',
        }),
      };
    }

    let parsedBody = null;

    try {
      parsedBody = JSON.parse(rawBody);
    } catch (e) {
      parsedBody = null;
    }

    // Let WooCommerce save/test pings pass before signature validation.
    // Real order payloads still require valid WooCommerce HMAC signature.
    if (
      parsedBody &&
      (
        parsedBody.webhook_id ||
        parsedBody.ping === 'pong' ||
        parsedBody.action === 'woocommerce_webhook_delivery'
      )
    ) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'WooCommerce webhook test received before signature validation',
        }),
      };
    }

    const normalizedHeaders = {};

    for (const [key, value] of Object.entries(event.headers || {})) {
      normalizedHeaders[key.toLowerCase()] = value;
    }

    const signature = normalizedHeaders['x-wc-webhook-signature'];

    if (!signature) {
      console.log('Missing WooCommerce signature');
      console.log('Headers:', event.headers);

      return {
        statusCode: 401,
        body: JSON.stringify({
          error: 'Missing WooCommerce signature',
        }),
      };
    }

    const expected = crypto
      .createHmac('sha256', process.env.WC_WEBHOOK_SECRET.trim())
      .update(rawBody, 'utf8')
      .digest('base64');

    if (signature.trim() !== expected) {
      console.log('Invalid WooCommerce signature');
      console.log('Received signature:', signature);
      console.log('Expected signature:', expected);
      console.log('Headers:', event.headers);
      console.log('Raw body length:', rawBody.length);
      console.log('Is base64 encoded:', event.isBase64Encoded);

      return {
        statusCode: 401,
        body: JSON.stringify({
          error: 'Invalid WooCommerce signature',
        }),
      };
    }

    const order = parsedBody || JSON.parse(rawBody);

    const orderId = order.id;
    const customerName =
      `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() ||
      'Unknown Customer';

    const lineItems = order.line_items || [];

    if (!orderId || lineItems.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing order ID or line items',
        }),
      };
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        job_name: `Order #${orderId}`,
        customer_name: customerName,
        notes: order.customer_note || null,
        due_date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (jobError) {
      console.error('Job insert error:', jobError);

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to create job',
          details: jobError.message,
        }),
      };
    }

    const jobItems = [];

    for (const item of lineItems) {
      if (!item.sku) {
        console.error('Line item missing SKU:', item.name);
        continue;
      }

      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, sku')
        .eq('sku', item.sku)
        .maybeSingle();

      if (productError || !product) {
        console.error('Product not found for SKU:', item.sku, productError);
        continue;
      }

      jobItems.push({
        job_id: job.id,
        product_id: product.id,
        quantity: item.quantity || 1,
      });
    }

    if (jobItems.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            'No valid job items created. Check that WooCommerce order SKUs exist in Supabase products.',
        }),
      };
    }

    const { error: itemsError } = await supabase
      .from('job_items')
      .insert(jobItems);

    if (itemsError) {
      console.error('Job items insert error:', itemsError);

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to create job items',
          details: itemsError.message,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        job_id: job.id,
        items_created: jobItems.length,
      }),
    };
  } catch (err) {
    console.error('Unhandled webhook error:', err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Server error',
        details: err.message,
      }),
    };
  }
};
