import { supabase } from '../supabaseClient';

function normalizeRows(data) {
  return Array.isArray(data) ? data : [];
}

export async function getArtworkBridgeSummary() {
  const { data, error } = await supabase.rpc('sc_artwork_bridge_summary');
  if (error) throw error;
  return normalizeRows(data)[0] || {
    artwork_requests: 0,
    reorder_requests: 0,
    due_soon_or_overdue: 0,
    recent_handoffs: 0,
    open_requests: 0,
    approved_requests: 0,
    completed_requests: 0,
  };
}

export async function getArtworkRequests() {
  const { data, error } = await supabase.rpc('sc_artwork_requests_app');
  if (error) throw error;
  return normalizeRows(data);
}

export async function updateArtworkStatus(requestId, status, note = '') {
  const { data, error } = await supabase.rpc('sc_artwork_update_status', {
    p_request_id: String(requestId),
    p_status: status,
    p_note: note || null,
  });
  if (error) throw error;
  return data;
}

export async function sendArtworkToProduction(requestId, note = '') {
  const { data, error } = await supabase.rpc('sc_artwork_handoff_to_production', {
    p_request_id: String(requestId),
    p_note: note || null,
  });
  if (error) throw error;
  return data;
}

export async function getArtworkHandoffLog() {
  const { data, error } = await supabase
    .from('sc_artwork_handoff_log_app')
    .select('*')
    .limit(100);
  if (error) throw error;
  return normalizeRows(data);
}

export function buildArtworkPrompt(request) {
  const parts = [];
  parts.push(`Create a professional custom apparel artwork concept for ${request.organization || request.project_name || 'this customer'}.`);
  if (request.project_type) parts.push(`Project type: ${request.project_type}.`);
  if (request.main_subject) parts.push(`Main subject: ${request.main_subject}.`);
  if (request.graphic_elements) parts.push(`Include these graphic elements: ${request.graphic_elements}.`);
  if (request.exact_text) parts.push(`Exact text to include: ${request.exact_text}.`);
  if (request.preferred_shape) parts.push(`Preferred design shape: ${request.preferred_shape}.`);
  if (request.emotion) parts.push(`The design should feel: ${request.emotion}.`);
  if (request.garment_color) parts.push(`Design for garment color: ${request.garment_color}.`);
  if (request.notes) parts.push(`Additional notes: ${request.notes}.`);
  parts.push('Use clean vector-style composition suitable for DTF or apparel decoration. Avoid mockup background.');
  return request.prompt || parts.join('\n');
}
