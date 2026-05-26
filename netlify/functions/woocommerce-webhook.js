// File: netlify/functions/woocommerce-webhook.js
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // required for secure inserts
)

export const handler = async (event) => {
    try {
        // 1. Verify WooCommerce signature
        const signature = event.headers['x-wc-webhook-signature']
        const secret = process.env.WC_WEBHOOK_SECRET

        const expected = crypto
            .createHmac('sha256', secret)
            .update(event.body, 'utf8')
            .digest('base64')

        if (signature !== expected) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Invalid signature' })
            }
        }

        // 2. Parse WooCommerce order payload
        const order = JSON.parse(event.body)

        const orderId = order.id
        const customerName = order.billing.first_name + ' ' + order.billing.last_name
        const lineItems = order.line_items

        // 3. Create job record
        const { data: job, error: jobError } = await supabase
            .from('jobs')
            .insert({
                name: `Order #${orderId}`,
                customer_name: customerName,
                status: 'queued',
                notes: order.customer_note || null,
                due_date: new Date().toISOString().slice(0, 10)
            })
            .select()
            .single()

        if (jobError) {
            console.error(jobError)
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to create job' })
            }
        }

        // 4. Loop through line items → create job_items
        for (const item of lineItems) {
            const sku = item.sku
            const qty = item.quantity

            // Match SKU to product
            const { data: product } = await supabase
                .from('products')
                .select('id')
                .eq('sku', sku)
                .single()

            if (!product) {
                console.warn(`SKU not found: ${sku}`)
                continue
            }

            // Insert job item
            await supabase.from('job_items').insert({
                job_id: job.id,
                product_id: product.id,
                quantity_needed: qty,
                quantity_pulled: 0
            })
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, job_id: job.id })
        }

    } catch (err) {
        console.error(err)
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server error' })
        }
    }
}
