import { supabase } from '../supabaseClient';

function normalizeError(error, fallback = 'Artwork bridge request failed') {
  if (!error) return new Error(fallback);
  if (error instanceof Error) return error;
  return new Error(error.message || fallback);
}

export async function getArtworkBridgeSummary() {
  const { data, error } = await supabase.rpc('sc_artwork_bridge_summary');
  if (error) throw normalizeError(error, 'Could not load artwork bridge summary');
  return Array.isArray(data) ? data[0] || {} : data || {};
}

export async function getArtworkBridgeStatus() {
  const { data, error } = await supabase.rpc('sc_artwork_bridge_status');
  if (error) throw normalizeError(error, 'Could not load artwork bridge status');
  return Array.isArray(data) ? data : [];
}

export async function getArtworkRequests(filter = 'all') {
  const { data, error } = await supabase.rpc('sc_artwork_requests_app', { p_filter: filter });
  if (error) throw normalizeError(error, 'Could not load artwork requests');
  return Array.isArray(data) ? data : [];
}

export async function getArtworkHandoffLog(limit = 50) {
  const { data, error } = await supabase
    .from('sc_artwork_handoff_log_app')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw normalizeError(error, 'Could not load artwork handoff log');
  return Array.isArray(data) ? data : [];
}

export async function updateArtworkStatus(sourceType, sourceId, status, notes = '') {
  const { data, error } = await supabase.rpc('sc_artwork_update_status', {
    p_source_type: sourceType,
    p_source_id: Number(sourceId),
    p_status: status,
    p_notes: notes || null,
  });
  if (error) throw normalizeError(error, 'Could not update artwork status');
  return data;
}

export async function sendArtworkToProduction(sourceType, sourceId, notes = '') {
  const { data, error } = await supabase.rpc('sc_artwork_handoff_to_production', {
    p_source_type: sourceType,
    p_source_id: Number(sourceId),
    p_notes: notes || null,
  });
  if (error) throw normalizeError(error, 'Could not create production handoff');
  return data;
}

export function buildPrompt(record) {
  return record?.chatgpt_prompt || record?.generated_prompt || record?.raw_payload?.artwork_request?.chatgpt_prompt || record?.raw_payload?.artwork_request?.generated_prompt || '';
}

export function recordTitle(record) {
  return record?.organization || record?.project_name || record?.customer_name || `${record?.source_type || 'Artwork'} #${record?.source_id || record?.app_row_id || ''}`;
}

export function recordSubtitle(record) {
  const parts = [record?.customer_name, record?.email, record?.deadline ? `Due: ${record.deadline}` : null].filter(Boolean);
  return parts.join(' • ');
}
