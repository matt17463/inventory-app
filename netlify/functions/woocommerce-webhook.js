// Netlify Function: WooCommerce order -> Supabase jobs/job_items
// Required environment variables:
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY
// WC_WEBHOOK_SECRET

export const config = {
  rawBody: true,
}

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function timingSafeSignatureCompare(received, expected) {
  if (!received || !expected) return false

  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)

  if (receivedBuffer.length !== expectedBuffer.length) return false

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
}

export const handler = async (event) => {
  try {
    const rawBody = event.rawBody

    if (!rawBody) {
      console.error('WooCommerce webhook rawBody missing')
      return response(500, { error: 'rawBody missing' })
    }

    const signature =
      event.headers['x-wc-webhook-signature'] ||
      event.headers['X-Wc-Webhook-Signature'] ||
      event.headers['X-WC-Webhook-Signature']

    const secret = process.env.WC_WEBHOOK_SECRET

    if (!secret) {
      console.error('WC_WEBHOOK_SECRET is not configured')
      return response(500, { error: 'Webhook secret not configured' })
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('base64')

    if (!timingSafeSignatureCompare(signature, expected)) {
      console.error('Invalid WooCommerce webhook signature')
      return response(401, { error: 'Invalid signature' })
    }

    const order = JSON.parse(rawBody)

    if (order.ping === 'pong') {
      return response(200, { success: true, message: 'Ping OK' })
    }

    const orderId = order.id
    const customerName = `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim()
    const lineItems = Array.isArray(order.line_items) ? order.line_items : []

    if (!orderId) {
      return response(400, { error: 'Missing WooCommerce order id' })
    }

    if (lineItems.length === 0) {
      return response(400, { error: 'Order contains no line items' })
    }

    // Current jobs schema: id, created_at, customer_name, job_name, due_date, notes
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        job_name: `Order #${orderId}`,
        customer_name: customerName || null,
        notes: order.customer_note || null,
        due_date: new Date().toISOString().slice(0, 10),
      })
      .select('id')
      .single()

    if (jobError) {
      console.error('Job insert error:', jobError)
      return response(500, { error: 'Failed to create job', details: jobError.message })
    }

    const jobItems = []
    const missingProducts = []

    for (const item of lineItems) {
      const sku = item.sku

      if (!sku) {
        missingProducts.push({ name: item.name, reason: 'Missing SKU on WooCommerce line item' })
        continue
      }

      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, sku')
        .eq('sku', sku)
        .single()

      if (productError || !product) {
        missingProducts.push({ sku, name: item.name, reason: productError?.message || 'Product not found' })
        continue
      }

      jobItems.push({
        job_id: job.id,
        product_id: product.id,
        quantity: item.quantity || 1,
      })
    }

    if (jobItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('job_items')
        .insert(jobItems)

      if (itemsError) {
        console.error('Job items insert error:', itemsError)
        return response(500, { error: 'Failed to create job items', details: itemsError.message })
      }
    }

    return response(200, {
      success: true,
      job_id: job.id,
      inserted_items: jobItems.length,
      missing_products: missingProducts,
    })
  } catch (err) {
    console.error('Unhandled WooCommerce webhook error:', err)
    return response(500, { error: 'Server error', details: err.message })
  }
}
