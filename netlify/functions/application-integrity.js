import { authorizeEmployee, jsonResponse } from './_shared/security.js';

const FUNCTION_NAME = 'application-integrity';

function clean(value) { return String(value ?? '').trim(); }
function cap(value, fallback = 250, maximum = 2000) {
  return Math.min(Math.max(Number(value || fallback), 1), maximum);
}
function isMissing(error) {
  return /does not exist|could not find|schema cache|relation .* does not exist/i.test(error?.message || '');
}

async function rowsOrEmpty(promise) {
  const result = await promise;
  if (result.error) {
    if (isMissing(result.error)) return [];
    throw result.error;
  }
  return result.data || [];
}

async function productSnapshot(supabase, id) {
  const result = await supabase.from('blank_products').select(`
    id,sku_base,barcode,name,brand_id,product_type_id,color_id,size_id,unit_cost,low_stock_threshold,image_url,
    brands:brand_id(id,name,code),product_types:product_type_id(id,name,code),
    colors:color_id(id,name,code),sizes:size_id(id,name,code)
  `).eq('id', id).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

async function productReferenceCounts(supabase, id) {
  const references = {};
  const checks = [
    ['inventory_movements', 'blank_inventory_movements', 'blank_product_id'],
    ['pull_sheet_lines', 'job_items', 'blank_product_id'],
    ['reservations', 'inventory_reservations', 'blank_product_id'],
    ['woocommerce_records', 'products', 'blank_product_id'],
    ['supplier_mappings', 'sc_supplier_item_mappings', 'blank_product_id_text'],
  ];
  for (const [label, table, column] of checks) {
    const result = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, id);
    references[label] = result.error && isMissing(result.error) ? null : Number(result.count || 0);
    if (result.error && !isMissing(result.error)) references[`${label}_error`] = result.error.message;
  }
  return references;
}

async function listReviewCases(supabase, body) {
  let query = supabase.from('sc_product_review_cases').select('*')
    .order('updated_at', { ascending: false }).limit(cap(body.limit, 250));
  if (clean(body.status) && clean(body.status) !== 'all') query = query.eq('status', clean(body.status));
  const cases = await rowsOrEmpty(query);
  const ids = cases.map((row) => row.id);
  const items = ids.length ? await rowsOrEmpty(
    supabase.from('sc_product_review_case_items').select('*').in('case_id', ids),
  ) : [];
  return cases.map((row) => ({ ...row, items: items.filter((item) => item.case_id === row.id) }));
}

async function createReviewCase(supabase, body, userId) {
  const entityIds = Array.from(new Set((body.entity_ids || []).map(clean).filter(Boolean)));
  if (entityIds.length < 2) throw new Error('Choose at least two records for duplicate review.');
  const snapshots = [];
  for (const id of entityIds) {
    const snapshot = await productSnapshot(supabase, id);
    if (!snapshot) throw new Error(`Blank product ${id} was not found.`);
    snapshots.push({ product: snapshot, references: await productReferenceCounts(supabase, id) });
  }
  const created = await supabase.from('sc_product_review_cases').insert({
    case_type: 'duplicate_product', status: 'open',
    title: clean(body.title) || `Duplicate product review: ${snapshots.map((row) => row.product.sku_base).join(' / ')}`,
    reason: clean(body.reason) || 'Manual duplicate review', candidate_group: clean(body.candidate_group) || null,
    proposed_survivor_id_text: clean(body.proposed_survivor_id) || null,
    evidence: { source: clean(body.source) || 'operations_integrity', product_count: snapshots.length },
    created_by: userId,
  }).select('*').single();
  if (created.error) throw created.error;
  const caseItems = snapshots.map((snapshot) => ({
    case_id: created.data.id, entity_type: 'blank_product', entity_id_text: String(snapshot.product.id),
    proposed_role: String(snapshot.product.id) === clean(body.proposed_survivor_id) ? 'survivor' : 'duplicate', snapshot,
  }));
  const inserted = await supabase.from('sc_product_review_case_items').insert(caseItems);
  if (inserted.error) throw inserted.error;
  return { ...created.data, items: caseItems };
}

async function rememberIdentity(supabase, body, userId) {
  const sourceSystem = clean(body.source_system).toLowerCase();
  const aliasType = clean(body.alias_type).toLowerCase();
  const sourceValue = clean(body.source_value);
  if (!sourceSystem || !sourceValue) throw new Error('Source system and source value are required.');
  if (!['supplier_sku','sku','barcode','brand','style','color','size'].includes(aliasType)) throw new Error('Unsupported identity alias type.');
  const sourceNorm = sourceValue.toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const payload = {
    source_system: sourceSystem, alias_type: aliasType, source_value: sourceValue, source_value_norm: sourceNorm,
    context_brand_norm: clean(body.context_brand).toUpperCase().replace(/[^A-Z0-9]+/g, ''),
    context_style_norm: clean(body.context_style).toUpperCase().replace(/[^A-Z0-9]+/g, ''),
    canonical_blank_product_id_text: clean(body.blank_product_id) || null,
    canonical_lookup_type: clean(body.canonical_lookup_type) || null,
    canonical_lookup_id_text: clean(body.canonical_lookup_id) || null,
    canonical_label: clean(body.canonical_label) || null,
    confidence: 100, status: 'active', notes: clean(body.notes) || null,
    created_by: userId, reviewed_by: userId, updated_at: new Date().toISOString(),
  };
  const result = await supabase.from('sc_product_identity_aliases').upsert(payload, {
    onConflict: 'source_system,alias_type,source_value_norm,context_brand_norm,context_style_norm',
  }).select('*').single();
  if (result.error) throw result.error;
  return result.data;
}

async function listIntegrationJobs(supabase, body) {
  const own = await rowsOrEmpty(supabase.from('sc_integration_jobs').select('*')
    .order('created_at', { ascending: false }).limit(cap(body.limit, 250)));
  const sources = [
    ['mockup_ai', 'mockup_ai_jobs', 'created_at'],
    ['color_lifecycle', 'sc_color_lifecycle_jobs', 'created_at'],
    ['woocommerce_mockup', 'mockup_woo_export_jobs', 'created_at'],
    ['supplier_feed', 'sc_supplier_catalog_feed_runs', 'created_at'],
  ];
  const external = [];
  for (const [jobType, table, order] of sources) {
    const rows = await rowsOrEmpty(supabase.from(table).select('*').order(order, { ascending: false }).limit(50));
    rows.forEach((row) => external.push({
      ...row, id: `${table}:${row.id}`, native_id: row.id, job_type: jobType,
      source_system: row.source_system || table, status: row.status || 'unknown',
      progress_current: Number(row.progress_current ?? row.output_count ?? row.processed_count ?? 0),
      progress_total: Number(row.progress_total ?? row.input_count ?? row.total_count ?? 0),
      last_error: row.last_error || row.error_message || row.error || '', external_table: table,
    }));
  }
  return [...own, ...external].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

async function updateOwnedJob(supabase, body, userId) {
  const id = clean(body.id);
  const mode = clean(body.mode);
  if (!id || !['retry','cancel'].includes(mode)) throw new Error('Choose an application-owned job and retry or cancel.');
  const current = await supabase.from('sc_integration_jobs').select('*').eq('id', id).single();
  if (current.error) throw current.error;
  const patch = mode === 'retry'
    ? { status: 'queued', last_error: null, completed_at: null, updated_at: new Date().toISOString() }
    : { status: 'cancelled', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const updated = await supabase.from('sc_integration_jobs').update(patch).eq('id', id).select('*').single();
  if (updated.error) throw updated.error;
  const event = await supabase.from('sc_integration_job_events').insert({
    job_id: id, event_type: mode === 'retry' ? 'retry_requested' : 'cancelled',
    message: mode === 'retry' ? 'Retry requested from Operations Integrity.' : 'Job cancelled from Operations Integrity.',
    details: { actor_user_id: userId },
  });
  if (event.error) throw event.error;
  return updated.data;
}

async function reconciliation(supabase, body) {
  const issues = [];
  const integrity = await supabase.rpc('sc_product_integrity_issues_v1', {
    p_issue_type: 'all', p_search: clean(body.search), p_limit: cap(body.limit, 500),
  });
  if (!integrity.error) (integrity.data || []).forEach((row) => issues.push({
    category: 'product_integrity', severity: row.severity, entity_type: row.entity_type,
    entity_id: row.entity_id, label: row.sku || row.product_name, message: row.issue_type.replaceAll('_', ' '), details: row.details,
  }));

  const movements = await rowsOrEmpty(supabase.from('blank_inventory_movements')
    .select('id,bin_id,blank_product_id,quantity_change,created_at,movement_type,notes')
    .order('created_at', { ascending: false }).limit(2000));
  movements.filter((row) => !row.bin_id || !row.blank_product_id).forEach((row) => issues.push({
    category: 'unlocated_movement', severity: 'high', entity_type: 'blank_inventory_movement', entity_id: row.id,
    label: `Movement ${row.id}`, message: 'Inventory movement is missing a bin or product reference.', details: row,
  }));

  const inventory = await rowsOrEmpty(supabase.from('app_blank_inventory_overview_v2').select('*').limit(5000));
  inventory.filter((row) => Number(row.on_hand_quantity ?? row.quantity_on_hand ?? row.total_quantity ?? 0) < 0)
    .forEach((row) => issues.push({
      category: 'purchasing_demand', severity: 'info', entity_type: 'blank_product',
      entity_id: row.blank_product_id || row.id, label: row.blank_sku || row.sku_base || row.name,
      message: 'Negative on-hand is preserved as purchasing demand; do not manually correct it.',
      details: { on_hand_quantity: Number(row.on_hand_quantity ?? row.quantity_on_hand ?? row.total_quantity ?? 0) },
    }));

  return {
    generated_at: new Date().toISOString(), issues,
    summary: issues.reduce((acc, row) => { acc[row.category] = (acc[row.category] || 0) + 1; return acc; }, {}),
  };
}

async function workflows(supabase, body, userId) {
  if (body.mode === 'save') {
    const payload = {
      workflow_name: clean(body.workflow_name), customer_name: clean(body.customer_name) || null,
      store_name: clean(body.store_name) || null, stage: clean(body.stage) || 'request',
      status: clean(body.status) || 'active', artwork_request_reference: clean(body.artwork_request_reference) || null,
      mockup_project_id_text: clean(body.mockup_project_id) || null, due_date: clean(body.due_date) || null,
      notes: clean(body.notes) || null, updated_at: new Date().toISOString(),
    };
    if (!payload.workflow_name) throw new Error('Enter a workflow name.');
    let result;
    if (clean(body.id)) result = await supabase.from('sc_team_store_workflows').update(payload).eq('id', clean(body.id)).select('*').single();
    else result = await supabase.from('sc_team_store_workflows').insert({ ...payload, created_by: userId }).select('*').single();
    if (result.error) throw result.error;
    return result.data;
  }
  return rowsOrEmpty(supabase.from('sc_team_store_workflows').select('*').order('updated_at', { ascending: false }).limit(500));
}

async function coreMutation(supabase, action, body, userId) {
  if (action === 'product.create') {
    const result = await supabase.rpc('sc_create_blank_product_safe_v1', { p_payload: body.payload || {}, p_actor: userId });
    if (result.error) throw result.error;
    if (result.data?.blocked) throw new Error('Creation blocked because an existing or ambiguous product match was found. Review the preview and use the existing product or open a duplicate case.');
    return result.data;
  }
  if (action === 'product.update') {
    const result = await supabase.rpc('sc_update_blank_product_safe_v1', { p_blank_product_id: Number(body.id), p_payload: body.payload || {}, p_actor: userId });
    if (result.error) throw result.error;
    if (result.data?.blocked) throw new Error(result.data.message || 'Update blocked because it would create a duplicate.');
    return result.data;
  }
  if (action === 'product.bulk_update') {
    const ids = Array.from(new Set((body.ids || []).map(Number).filter(Number.isFinite)));
    if (!ids.length) throw new Error('Choose at least one blank product.');
    const results = [];
    for (const id of ids) {
      const result = await supabase.rpc('sc_update_blank_product_safe_v1', { p_blank_product_id: id, p_payload: body.payload || {}, p_actor: userId });
      if (result.error) throw result.error;
      if (result.data?.blocked) throw new Error(`Blank product ${id}: ${result.data.message || 'duplicate conflict'}`);
      results.push(result.data);
    }
    return results;
  }
  if (action === 'pullsheet.status') {
    const result = await supabase.rpc('sc_set_job_status_safe_v1', { p_job_id: Number(body.job_id), p_status: clean(body.status), p_actor: userId, p_reason: clean(body.reason) || null });
    if (result.error) throw result.error;
    return result.data;
  }
  if (action === 'pullsheet.line_status') {
    const result = await supabase.rpc('sc_set_job_item_status_safe_v1', { p_job_item_id: Number(body.job_item_id), p_status: clean(body.status), p_actor: userId, p_reason: clean(body.reason) || null });
    if (result.error) throw result.error;
    return result.data;
  }
  if (action === 'pullsheet.create') {
    const payload = body.payload || {};
    const created = await supabase.from('jobs').insert({
      job_name: clean(payload.job_name), customer_name: clean(payload.customer_name) || null,
      woocommerce_order_id: clean(payload.woocommerce_order_id) || null, due_date: clean(payload.due_date) || null,
      notes: clean(payload.notes) || null, status: 'ready_to_pull',
    }).select('*').single();
    if (created.error) throw created.error;
    await supabase.from('sc_core_mutation_audit').insert({ action: 'create', entity_type: 'job', entity_id_text: String(created.data.id), actor_user_id: userId, after_snapshot: created.data, reason: 'Guarded pull sheet creation' });
    return created.data;
  }
  if (action === 'pullsheet.add_line') {
    const payload = body.payload || {};
    const created = await supabase.from('job_items').insert({
      job_id: payload.job_id, blank_product_id: payload.blank_product_id, quantity: Number(payload.quantity),
      logo: clean(payload.logo) || null, placement: clean(payload.placement) || null,
      notes: clean(payload.notes) || null, status: 'ready_to_pull',
    }).select('*').single();
    if (created.error) throw created.error;
    await supabase.from('sc_core_mutation_audit').insert({ action: 'create', entity_type: 'job_item', entity_id_text: String(created.data.id), actor_user_id: userId, after_snapshot: created.data, reason: 'Guarded pull sheet line creation' });
    return created.data;
  }
  if (action === 'pullsheet.patch_lines') {
    const ids = Array.from(new Set((body.job_item_ids || []).map(Number).filter(Number.isFinite)));
    if (!ids.length) throw new Error('Choose at least one pull sheet line.');
    const requested = body.patch || {};
    const allowed = ['selected_bin_id', 'include_on_purchasing_report'];
    const patch = Object.fromEntries(Object.entries(requested).filter(([key]) => allowed.includes(key)));
    if (!Object.keys(patch).length) throw new Error('No permitted pull sheet line fields were supplied.');
    const before = await supabase.from('job_items').select('*').in('id', ids);
    if (before.error) throw before.error;
    const updated = await supabase.from('job_items').update(patch).in('id', ids).select('*');
    if (updated.error) throw updated.error;
    const beforeById = new Map((before.data || []).map((row) => [String(row.id), row]));
    const audit = (updated.data || []).map((row) => ({
      action: 'update', entity_type: 'job_item', entity_id_text: String(row.id), actor_user_id: userId,
      before_snapshot: beforeById.get(String(row.id)) || null, after_snapshot: row,
      reason: clean(body.reason) || 'Guarded pull sheet line update',
    }));
    if (audit.length) { const logged = await supabase.from('sc_core_mutation_audit').insert(audit); if (logged.error) throw logged.error; }
    return updated.data || [];
  }
  throw new Error(`Unsupported guarded mutation: ${action}`);
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (!['GET','POST'].includes(event.httpMethod)) return jsonResponse(405, { success: false, message: 'Method not allowed.' }, event);
  const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : Object.fromEntries(new URLSearchParams(event.rawQuery || event.queryStringParameters || {}));
  const action = clean(body.action || (event.httpMethod === 'GET' ? 'health' : ''));
  const allowedRoles = action.startsWith('product.') || action.startsWith('pullsheet.') || action.startsWith('review.') || action === 'identity.remember' || action === 'jobs.update' || (action === 'workflows' && body.mode === 'save')
    ? ['admin','manager'] : ['admin','manager','operator'];
  const auth = await authorizeEmployee(event, { functionName: FUNCTION_NAME, allowedRoles });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, message: auth.message }, event);

  try {
    let data;
    if (action === 'health') data = { version: '1.0.0', platform: 'application_integrity', role: auth.role };
    else if (action === 'identity.resolve') {
      const result = await auth.supabase.rpc('sc_blank_product_candidates_v1', {
        p_source_system: clean(body.source_system), p_supplier_sku: clean(body.supplier_sku),
        p_sku: clean(body.sku), p_barcode: clean(body.barcode), p_brand: clean(body.brand),
        p_style: clean(body.style), p_color: clean(body.color), p_size: clean(body.size), p_limit: cap(body.limit, 25, 100),
      });
      if (result.error) throw result.error;
      data = result.data || [];
    } else if (action === 'product.preview') {
      const result = await auth.supabase.rpc('sc_preview_blank_product_v1', { p_payload: body.payload || {} });
      if (result.error) throw result.error;
      data = result.data;
    } else if (action === 'identity.remember') data = await rememberIdentity(auth.supabase, body, auth.user.id);
    else if (action === 'review.list') data = await listReviewCases(auth.supabase, body);
    else if (action === 'review.create') data = await createReviewCase(auth.supabase, body, auth.user.id);
    else if (action === 'jobs.list') data = await listIntegrationJobs(auth.supabase, body);
    else if (action === 'jobs.update') data = await updateOwnedJob(auth.supabase, body, auth.user.id);
    else if (action === 'reconciliation') data = await reconciliation(auth.supabase, body);
    else if (action === 'workflows') data = await workflows(auth.supabase, body, auth.user.id);
    else if (action.startsWith('product.') || action.startsWith('pullsheet.')) data = await coreMutation(auth.supabase, action, body, auth.user.id);
    else throw new Error(`Unsupported action: ${action || '(missing)'}`);
    return jsonResponse(200, { success: true, data }, event);
  } catch (error) {
    console.error('Application integrity action failed:', action, error);
    const missing = isMissing(error);
    return jsonResponse(missing ? 409 : 500, {
      success: false,
      message: missing ? 'Application Integrity SQL is not installed. Run deployment/sql/28_APPLICATION_INTEGRITY_PLATFORM.sql, then retry.' : (error.message || 'Application integrity action failed.'),
    }, event);
  }
}
