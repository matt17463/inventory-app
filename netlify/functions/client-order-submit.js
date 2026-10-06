import crypto from 'node:crypto';
import { createServiceClient, getHeader } from './_shared/security.js';
import { putOperationalObject } from './_shared/operationalStorage.js';

const clean = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const allowedOrigin = (event) => {
  const origin = getHeader(event, 'origin');
  const configured = String(process.env.SC_PUBLIC_ORDER_ORIGINS || process.env.SC_ALLOWED_ORIGINS || '')
    .split(',').map((x) => x.trim()).filter(Boolean);
  return !origin || configured.includes(origin);
};

function publicHeaders(event) {
  const origin = getHeader(event, 'origin');
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (origin && allowedOrigin(event)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
function reply(statusCode, payload, event) {
  return { statusCode, headers: publicHeaders(event), body: JSON.stringify(payload) };
}

function normalizeAttachments(files) {
  if (!Array.isArray(files)) return [];
  return files.slice(0, 3).map((file) => ({
    name: clean(file?.name, 180).replace(/[^a-zA-Z0-9._ -]/g, '_') || 'attachment',
    type: clean(file?.type, 120) || 'application/octet-stream',
    data: String(file?.data || ''),
  })).filter((file) => file.data);
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 250).map((row, index) => ({
    line_number: index + 1,
    recipient_name: clean(row.recipient_name, 160) || null,
    garment_type: clean(row.garment_type, 120) || null,
    size: clean(row.size, 50) || null,
    garment_color: clean(row.garment_color, 80) || null,
    name_on_back: clean(row.name_on_back, 120) || null,
    name_text_color: clean(row.name_text_color, 80) || null,
    jersey_number: clean(row.jersey_number, 40) || null,
    quantity: Math.max(1, Math.min(999, Number(row.quantity || 1) || 1)),
    notes: clean(row.notes, 500) || null,
  })).filter((row) => row.garment_type || row.size || row.recipient_name);
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: publicHeaders(event), body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Method not allowed.' }, event);
  if (!allowedOrigin(event)) return reply(403, { success: false, error: 'This form may only be submitted from an approved Skilled Crafting site.' }, event);

  try {
    const body = JSON.parse(event.body || '{}');
    if (clean(body.website, 200)) return reply(200, { success: true, message: 'Thank you.' }, event); // honeypot

    const organization = clean(body.organization, 160);
    const contactName = clean(body.contact_name, 160);
    const contactEmail = clean(body.contact_email, 200).toLowerCase();
    const items = normalizeItems(body.items);
    const attachments = normalizeAttachments(body.attachments);
    if (!organization || !contactName || !emailOk(contactEmail)) {
      return reply(400, { success: false, error: 'Organization, contact name, and a valid email are required.' }, event);
    }
    if (!items.length) return reply(400, { success: false, error: 'Add at least one garment/order line.' }, event);

    const supabase = createServiceClient();
    const forwarded = getHeader(event, 'x-forwarded-for').split(',')[0].trim() || 'unknown';
    const salt = process.env.SC_PUBLIC_ORDER_RATE_SALT || process.env.GOOGLE_CALENDAR_STATE_SECRET || 'sc-client-orders';
    const ipHash = crypto.createHash('sha256').update(`${salt}:${forwarded}`).digest('hex');
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const recent = await supabase.from('sc_client_order_submission_guard')
      .select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('submitted_at', since);
    if (recent.error) throw recent.error;
    if (Number(recent.count || 0) >= 5) return reply(429, { success: false, error: 'Too many recent submissions. Please wait and try again.' }, event);

    const requestPayload = {
      organization,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: clean(body.contact_phone, 80) || null,
      order_type: clean(body.order_type, 80) || null,
      desired_completion_date: clean(body.desired_completion_date, 20) || null,
      event_date: clean(body.event_date, 20) || null,
      delivery_method: clean(body.delivery_method, 80) || null,
      preferred_contact_method: clean(body.preferred_contact_method, 40) || null,
      garment_types: Array.isArray(body.garment_types) ? body.garment_types.map((v) => clean(v, 80)).filter(Boolean).slice(0, 20) : [],
      preferred_colors: Array.isArray(body.preferred_colors) ? body.preferred_colors.map((v) => clean(v, 80)).filter(Boolean).slice(0, 20) : [],
      artwork_choice: clean(body.artwork_choice, 80) || null,
      artwork_reference_url: clean(body.artwork_reference_url, 500) || null,
      customization_notes: clean(body.customization_notes, 4000) || null,
      customer_notes: clean(body.customer_notes, 4000) || null,
      status: 'submitted',
      source: 'public_order_form',
    };
    const created = await supabase.from('sc_client_order_requests').insert(requestPayload).select('id,order_number').single();
    if (created.error) throw created.error;

    const itemRows = items.map((row) => ({ ...row, request_id: created.data.id }));
    const inserted = await supabase.from('sc_client_order_request_items').insert(itemRows);
    if (inserted.error) {
      await supabase.from('sc_client_order_requests').delete().eq('id', created.data.id);
      throw inserted.error;
    }
    for (const file of attachments) {
      const bytes = Buffer.from(file.data, 'base64');
      if (!bytes.length || bytes.length > 4 * 1024 * 1024) continue;
      const safeName = file.name.replace(/\s+/g, '-');
      const stored = await putOperationalObject({
        key: `operational/client-orders/${created.data.id}/${crypto.randomUUID()}-${safeName}`,
        bytes,
        contentType: file.type,
        makePreview: false,
      });
      const saved = await supabase.from('sc_client_order_attachments').insert({
        request_id: created.data.id,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: stored.file_size_bytes,
        storage_provider: stored.storage_provider,
        storage_bucket: stored.storage_bucket,
        storage_path: stored.storage_path,
      });
      if (saved.error) throw saved.error;
    }

    await supabase.from('sc_client_order_submission_guard').insert({ ip_hash: ipHash });

    return reply(200, {
      success: true,
      order_number: created.data.order_number,
      message: 'Your order request was submitted. Skilled Crafting will review the details and contact you with pricing.',
    }, event);
  } catch (error) {
    console.error('client-order-submit failed:', error);
    return reply(500, { success: false, error: 'The order request could not be submitted. Please try again or contact Skilled Crafting.' }, event);
  }
}
