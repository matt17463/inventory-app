import { validateSharedSecret } from './_shared/security.js';
// Netlify Function: artwork-system-handoff
// Receives webhook payloads from the consolidated WordPress plugin sc-artwork-system.php
// and mirrors them into Supabase for the inventory app.

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-sc-artwork-secret, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(statusCode, body) {
  return { statusCode, headers: jsonHeaders, body: JSON.stringify(body) };
}

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

async function supabaseRequest(path, method, body, extraHeaders = {}) {
  const url = (env('SUPABASE_URL') || env('VITE_SUPABASE_URL') || '').replace(/\/$/, '');
  const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SERVICE_KEY');

  if (!url || !key) {
    throw new Error('Supabase URL/key is not configured for this Netlify function.');
  }

  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
      ...extraHeaders,
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = text; }

  if (!res.ok) {
    const message = typeof parsed === 'string' ? parsed : (parsed?.message || JSON.stringify(parsed));
    throw new Error(`Supabase ${method} ${path} failed: ${res.status} ${message}`);
  }

  return parsed;
}

function getHeader(event, name) {
  const wanted = name.toLowerCase();
  const headers = event.headers || {};
  const key = Object.keys(headers).find((k) => k.toLowerCase() === wanted);
  return key ? headers[key] : '';
}

function nullableText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function nullableBigint(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeRequest(payload) {
  const r = payload.artwork_request || {};
  return {
    wp_source_id: nullableBigint(r.id || payload.source_id),
    wp_customer_id: nullableBigint(r.customer_id),
    wpforms_entry_id: nullableText(r.wpforms_entry_id),
    source_site_url: nullableText(payload.site_url),
    status: nullableText(r.status),
    inventory_status: nullableText(r.inventory_status),
    customer_name: nullableText(r.customer_name),
    organization: nullableText(r.organization),
    email: nullableText(r.email),
    project_type: nullableText(r.project_type),
    project_details: nullableText(r.project_details),
    audience: nullableText(r.audience),
    printing_canvas: nullableText(r.printing_canvas),
    garment_color: nullableText(r.garment_color),
    brand_attitude: nullableText(r.brand_attitude),
    visual_era: nullableText(r.visual_era),
    ink_color: nullableText(r.ink_color),
    line_quality: nullableText(r.line_quality),
    color_style: nullableText(r.color_style),
    visual_tone: nullableText(r.visual_tone),
    texture_finish: nullableText(r.texture_finish),
    style_direction: nullableText(r.style_direction),
    main_subject: nullableText(r.main_subject),
    graphic_elements: nullableText(r.graphic_elements),
    graphic_text: nullableText(r.graphic_text),
    final_notes: nullableText(r.final_notes),
    notes: nullableText(r.notes),
    deadline: nullableText(r.deadline),
    design_shape: nullableText(r.design_shape),
    emotion: nullableText(r.emotion),
    generated_prompt: nullableText(r.generated_prompt),
    chatgpt_prompt: nullableText(r.chatgpt_prompt),
    designer_notes: nullableText(r.designer_notes),
    mockups: Array.isArray(payload.mockups) ? payload.mockups : [],
    raw_payload: payload,
    wordpress_created_at: nullableText(r.created_at),
    wordpress_updated_at: nullableText(r.updated_at),
    updated_at: new Date().toISOString(),
  };
}

function normalizeReorder(payload) {
  const r = payload.reorder || {};
  return {
    wp_source_id: nullableBigint(r.id || payload.source_id),
    wp_customer_id: nullableBigint(r.customer_id),
    wp_artwork_id: nullableBigint(r.artwork_id),
    source_site_url: nullableText(payload.site_url),
    status: nullableText(r.status),
    inventory_status: nullableText(r.inventory_status),
    customer_name: nullableText(r.customer_name),
    organization: nullableText(r.organization),
    email: nullableText(r.email),
    requester_name: nullableText(r.requester_name),
    requester_email: nullableText(r.requester_email),
    artwork_title: nullableText(r.artwork_title),
    artwork_code: nullableText(r.artwork_code),
    file_url: nullableText(r.file_url),
    mockup_url: nullableText(r.mockup_url),
    print_locations: nullableText(r.print_locations),
    production_method: nullableText(r.production_method),
    quantity_notes: nullableText(r.quantity_notes),
    garment_notes: nullableText(r.garment_notes),
    deadline: nullableText(r.deadline),
    message: nullableText(r.message),
    raw_payload: payload,
    wordpress_created_at: nullableText(r.created_at),
    updated_at: new Date().toISOString(),
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return response(200, { ok: true });
  if (event.httpMethod !== 'POST') return response(405, { success: false, message: 'Use POST.' });

  const authorization = validateSharedSecret(event, {
    envNames: ['SC_ARTWORK_WEBHOOK_SECRET', 'SC_INVENTORY_BRIDGE_SECRET'],
    headerNames: ['x-sc-artwork-secret', 'x-webhook-secret'],
  });
  if (!authorization.ok) {
    return response(authorization.statusCode, { success: false, message: authorization.message, code: authorization.code });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return response(400, { success: false, message: 'Invalid JSON body.' });
  }

  const eventType = nullableText(payload.event_type) || 'artwork_handoff';
  const sourceType = nullableText(payload.source_type) || 'request';
  const sourceId = nullableBigint(payload.source_id);

  if (!sourceId) {
    return response(400, { success: false, message: 'Missing source_id.' });
  }

  try {
    await supabaseRequest('sc_artwork_system_handoffs', 'POST', {
      event_type: eventType,
      source_type: sourceType,
      source_id: sourceId,
      source_site_url: nullableText(payload.site_url),
      payload,
      response: { received: true, received_at: new Date().toISOString() },
    });

    let saved = null;
    if (sourceType === 'request' && payload.artwork_request) {
      const row = normalizeRequest(payload);
      saved = await supabaseRequest('sc_artwork_system_requests?on_conflict=wp_source_id', 'POST', row);
    } else if (sourceType === 'reorder' && payload.reorder) {
      const row = normalizeReorder(payload);
      saved = await supabaseRequest('sc_artwork_system_reorders?on_conflict=wp_source_id', 'POST', row);
    }

    return response(200, {
      success: true,
      message: 'Artwork handoff received by inventory app.',
      event_type: eventType,
      source_type: sourceType,
      source_id: sourceId,
      saved_count: Array.isArray(saved) ? saved.length : (saved ? 1 : 0),
    });
  } catch (err) {
    console.error(err);
    return response(500, { success: false, message: err.message || 'Artwork handoff failed.' });
  }
};
