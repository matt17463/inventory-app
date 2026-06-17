import { supabase } from '../supabaseClient';

function clean(value) {
  return String(value ?? '').trim();
}

function toCsv(rows = []) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => escape(r[c])).join(','))].join('\n');
}

export function downloadCsv(filename, rows) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getExceptionCenter() {
  const { data, error } = await supabase.rpc('phase6_exception_center');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getProductDataHealthSummary() {
  const { data, error } = await supabase.rpc('phase6_product_data_health_summary');
  if (error) throw error;
  return data || [];
}

export async function getProductDataHealthReport(issueType = 'all') {
  const issue = issueType || 'all';

  // Older Supabase snippets used p_issue. Newer ones used p_issue_type.
  // Try both so the Exception Center can show specific rows instead of only category counts.
  const first = await supabase.rpc('phase6_product_data_health_report', { p_issue: issue });
  if (!first.error) return first.data || [];

  const second = await supabase.rpc('phase6_product_data_health_report', { p_issue_type: issue });
  if (!second.error) return second.data || [];

  throw first.error || second.error;
}

export async function markProductHealthIssueStatus(row, status = 'ignored', resolutionNote = '') {
  const payload = {
    product_table: 'products',
    product_id: String(row.product_id),
    issue_type: row.issue_type,
    status,
    resolution_note: resolutionNote,
    updated_at: new Date().toISOString(),
    metadata: row,
  };

  const { data, error } = await supabase
    .from('sc_product_data_health_notes')
    .upsert(payload, { onConflict: 'product_table,product_id,issue_type' })
    .select()
    .single();

  if (error) throw error;
  await logAction('product_health_issue_updated', 'product', String(row.product_id), `${status}: ${row.issue_type}`, null, 'info', payload);
  return data;
}

export async function getAuditTrail({ search = '', actionType = '', limit = 250 } = {}) {
  let query = supabase
    .from('sc_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (actionType) query = query.eq('action_type', actionType);
  if (search) {
    const term = `%${search}%`;
    query = query.or(`summary.ilike.${term},entity_id.ilike.${term},related_customer.ilike.${term},related_order_id.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function logAction(actionType, entityType = null, entityId = null, summary = null, actorName = null, severity = 'info', metadata = {}) {
  const { data, error } = await supabase.rpc('phase6_log_action', {
    p_action_type: actionType,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_summary: summary,
    p_actor_name: actorName,
    p_severity: severity,
    p_metadata: metadata || {},
  });
  if (error) throw error;
  return data;
}

export async function getCustomerPortalTokens() {
  const { data, error } = await supabase
    .from('sc_customer_portal_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

export async function createCustomerPortalToken(input) {
  const token = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = {
    customer_name: clean(input.customer_name),
    customer_email: clean(input.customer_email),
    customer_phone: clean(input.customer_phone),
    organization: clean(input.organization),
    notes: clean(input.notes),
    token,
    expires_at: input.expires_at || null,
    is_active: true,
  };
  const { data, error } = await supabase.from('sc_customer_portal_tokens').insert(payload).select().single();
  if (error) throw error;
  await logAction('customer_portal_token_created', 'customer_portal_token', data.id, `Portal token created for ${payload.customer_name || payload.customer_email}`, null, 'info', payload);
  return data;
}

export async function getCustomerPortalData(token) {
  const { data, error } = await supabase.rpc('phase6_customer_portal_data', { p_token: token });
  if (error) throw error;
  return data;
}

export async function getCustomerPortalEvents() {
  const { data, error } = await supabase
    .from('sc_customer_portal_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

export async function createCustomerPortalEvent(input) {
  const payload = {
    portal_token_id: input.portal_token_id || null,
    event_type: clean(input.event_type) || 'status_update',
    source_system: clean(input.source_system) || 'inventory_app',
    source_id: clean(input.source_id),
    customer_name: clean(input.customer_name),
    customer_email: clean(input.customer_email),
    organization: clean(input.organization),
    title: clean(input.title),
    status: clean(input.status),
    due_date: clean(input.due_date),
    message: clean(input.message),
    public_note: clean(input.public_note),
    private_note: clean(input.private_note),
    is_customer_visible: input.is_customer_visible !== false,
    metadata: input.metadata || {},
  };
  const { data, error } = await supabase.from('sc_customer_portal_events').insert(payload).select().single();
  if (error) throw error;
  await logAction('customer_portal_event_created', 'customer_portal_event', data.id, payload.title || payload.event_type, null, 'info', payload);
  return data;
}

export async function getApprovalHandoffs() {
  const { data, error } = await supabase
    .from('sc_approval_production_handoffs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

export async function markApprovalReadyForProduction(id, jobId = '', note = '') {
  const { data, error } = await supabase.rpc('phase6_mark_approval_ready_for_production', {
    p_handoff_id: id,
    p_job_id: jobId || null,
    p_note: note || null,
  });
  if (error) throw error;
  return data;
}

export async function createApprovalHandoff(input) {
  const payload = {
    source_system: clean(input.source_system) || 'manual',
    source_type: clean(input.source_type) || 'artwork_request',
    source_id: clean(input.source_id),
    customer_name: clean(input.customer_name),
    customer_email: clean(input.customer_email),
    organization: clean(input.organization),
    artwork_title: clean(input.artwork_title),
    artwork_code: clean(input.artwork_code),
    mockup_url: clean(input.mockup_url),
    approved_file_url: clean(input.approved_file_url),
    print_locations: clean(input.print_locations),
    garment_notes: clean(input.garment_notes),
    due_date: clean(input.due_date),
    payload: input.payload || {},
    automation_status: clean(input.automation_status) || 'new',
    manager_note: clean(input.manager_note),
  };
  const { data, error } = await supabase.from('sc_approval_production_handoffs').insert(payload).select().single();
  if (error) throw error;
  await logAction('approval_handoff_created', 'approval_production_handoff', data.id, payload.artwork_title || 'Approval handoff created', null, 'info', payload);
  return data;
}

export async function getQuoteOrderHandoffs() {
  const { data, error } = await supabase
    .from('sc_quote_order_handoffs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

export async function createQuoteOrderHandoff(input) {
  const revenue = Number(input.estimated_revenue || 0);
  const cost = Number(input.estimated_cost || 0);
  const payload = {
    quote_id: clean(input.quote_id),
    quote_number: clean(input.quote_number),
    customer_name: clean(input.customer_name),
    customer_email: clean(input.customer_email),
    organization: clean(input.organization),
    status: clean(input.status) || 'draft',
    source_quote: input.source_quote || {},
    estimated_revenue: revenue || null,
    estimated_cost: cost || null,
    estimated_profit: revenue || cost ? revenue - cost : null,
    target_margin_percent: input.target_margin_percent ? Number(input.target_margin_percent) : null,
  };
  const { data, error } = await supabase.from('sc_quote_order_handoffs').insert(payload).select().single();
  if (error) throw error;
  await logAction('quote_handoff_created', 'quote_order_handoff', data.id, `Quote handoff created: ${payload.quote_number || payload.customer_name}`, null, 'info', payload);
  return data;
}

export async function markQuoteConverted(id, orderId = '', jobId = '', note = '') {
  const { data, error } = await supabase.rpc('phase6_mark_quote_converted', {
    p_handoff_id: id,
    p_order_id: orderId || null,
    p_job_id: jobId || null,
    p_note: note || null,
  });
  if (error) throw error;
  return data;
}

export async function getInventoryAuditSessions() {
  const { data, error } = await supabase
    .from('sc_inventory_audit_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

export async function createInventoryAuditSession(input) {
  const payload = {
    started_by: clean(input.started_by),
    bin_id: clean(input.bin_id),
    bin_code: clean(input.bin_code),
    audit_type: clean(input.audit_type) || 'cycle_count',
    status: 'open',
    notes: clean(input.notes),
  };
  const { data, error } = await supabase.from('sc_inventory_audit_sessions').insert(payload).select().single();
  if (error) throw error;
  await logAction('inventory_audit_session_created', 'inventory_audit_session', data.id, `Inventory audit started for bin ${payload.bin_code || payload.bin_id}`, payload.started_by, 'info', payload);
  return data;
}

export async function getInventoryAuditCounts(sessionId) {
  const { data, error } = await supabase
    .from('sc_inventory_audit_counts')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addInventoryAuditCount(input) {
  const payload = {
    session_id: input.session_id,
    item_type: clean(input.item_type) || 'blank',
    product_id: clean(input.product_id),
    sku: clean(input.sku),
    product_name: clean(input.product_name),
    expected_quantity: input.expected_quantity === '' || input.expected_quantity == null ? null : Number(input.expected_quantity),
    counted_quantity: Number(input.counted_quantity || 0),
    adjustment_reason: clean(input.adjustment_reason),
    counted_by: clean(input.counted_by),
    notes: clean(input.notes),
  };
  const { data, error } = await supabase.from('sc_inventory_audit_counts').insert(payload).select().single();
  if (error) throw error;
  await logAction('inventory_audit_count_added', 'inventory_audit_count', data.id, `Cycle count added for ${payload.sku || payload.product_name}`, payload.counted_by, data.variance_quantity !== 0 ? 'warning' : 'info', payload);
  return data;
}

export async function closeInventoryAuditSession(sessionId, completedBy = '') {
  const { data, error } = await supabase
    .from('sc_inventory_audit_sessions')
    .update({ status: 'completed', completed_by: clean(completedBy), updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select()
    .single();
  if (error) throw error;
  await logAction('inventory_audit_session_completed', 'inventory_audit_session', sessionId, 'Inventory audit session completed.', completedBy, 'info', data);
  return data;
}

export async function getProductionPhotos() {
  const { data, error } = await supabase
    .from('sc_production_photos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

export async function uploadProductionPhoto(file, input) {
  if (!file) throw new Error('Photo file is required.');
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto?.randomUUID ? crypto.randomUUID() : Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('production-photo-proof').upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;
  const { data: publicData } = supabase.storage.from('production-photo-proof').getPublicUrl(path);
  const payload = {
    uploaded_by: clean(input.uploaded_by),
    source_type: clean(input.source_type),
    source_id: clean(input.source_id),
    customer_name: clean(input.customer_name),
    order_id: clean(input.order_id),
    job_id: clean(input.job_id),
    photo_type: clean(input.photo_type) || 'general',
    photo_url: publicData.publicUrl,
    storage_path: path,
    caption: clean(input.caption),
    notes: clean(input.notes),
    metadata: input.metadata || {},
  };
  const { data, error } = await supabase.from('sc_production_photos').insert(payload).select().single();
  if (error) throw error;
  await logAction('production_photo_uploaded', 'production_photo', data.id, payload.caption || `Photo uploaded: ${payload.photo_type}`, payload.uploaded_by, 'info', payload);
  return data;
}
