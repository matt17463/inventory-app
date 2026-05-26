import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
    try {
        // 1. Get RAW body exactly as WooCommerce sent it
        const rawBody = event.rawBody || event.body

        // 2. Normalize signature header (Netlify sometimes lowercases headers)
        const signature =
            event.headers['x-wc-webhook-signature'] ||
            event.headers['X-Wc-Webhook-Signature'] ||
            event.headers['x-wc-webhook-signature'.toLowerCase()]

        const secret = process.env.WC_WEBHOOK_SECRET

        // 3. Compute expected signature using RAW BODY
        const expected = crypto
            .createHmac('sha256', secret)
            .update(rawBody, 'utf8')
            .digest('base64')

        // 4. Reject if signature mismatch
        if (signature !== expected) {
            console.log('Invalid signature')
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Invalid signature' })
            }
        }

        // 5. Parse JSON ONLY AFTER signature is verified
        const order = JSON.parse(rawBody)

        const orderId = order.id
        const customerName = `${order.billing.first_name} ${order.billing.last_name}`
        const lineItems = order.line_items

        // 6. Create job record
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
            console.error('Job insert error:', jobError)
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to create job' })
            }
        }

        // 7. Insert job items
        const jobItems = lineItems.map((item) => ({
            job_id: job.id,
            sku: item.sku,
            quantity: item.quantity,
            description: item.name
        }))

        const { error: itemsError } = await supabase
            .from('job_items')
            .insert(jobItems)

        if (itemsError) {
            console.error('Job items insert error:', itemsError)
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to create job items' })
            }
        }

        // 8. Success response
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, job_id: job.id })
        }

    } catch (err) {
        console.error('Unhandled error:', err)
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server error' })
        }
    }
}
