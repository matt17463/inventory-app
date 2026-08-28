import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { supplierMatchKey } from './_shared/supplierConfirmationParser.js';
import { signedOperationalUrl } from './_shared/operationalStorage.js';
import { requireSupplierReceivingContract } from './_shared/supplierReceivingContract.js';

const FUNCTION_NAME = 'supplier-receiving-action';

function clean(value) { return String(value ?? '').trim(); }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function optionalUnitCost(value) {
  if (value == null || String(value).trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Unit cost must be a number that is zero or greater.');
  return parsed;
}

function schemaUnavailable(error) {
  return /does not exist|schema cache|could not find/i.test(error?.message || '');
}

async function findNaturalKey(supabase, table, filters, label = table) {
  let query = supabase.from(table).select('*');
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const result = await query.limit(2);
  if (result.error) throw result.error;
  if ((result.data || []).length > 1) {
    throw new Error(`${label} has duplicate database records for its natural key. Resolve the duplicates in Operations Integrity before retrying.`);
  }
  return result.data?.[0] || null;
}

async function saveNaturalKey(supabase, {
  table, filters, insertPayload, updatePayload = insertPayload, label = table, optional = false,
}) {
  try {
    const existing = await findNaturalKey(supabase, table, filters, label);
    if (existing) {
      const updated = await supabase.from(table).update(updatePayload).eq('id', existing.id).select('*').single();
      if (updated.error) throw updated.error;
      return updated.data;
    }

    const inserted = await supabase.from(table).insert(insertPayload).select('*').single();
    if (!inserted.error) return inserted.data;
    if (inserted.error.code !== '23505') throw inserted.error;

    // Another request may have inserted the same natural key after our read.
    // Re-read that record and apply the current values instead of relying on
    // PostgREST to infer a particular UNIQUE constraint for ON CONFLICT.
    const winner = await findNaturalKey(supabase, table, filters, label);
    if (!winner) throw inserted.error;
    const updated = await supabase.from(table).update(updatePayload).eq('id', winner.id).select('*').single();
    if (updated.error) throw updated.error;
    return updated.data;
  } catch (error) {
    if (optional && schemaUnavailable(error)) return null;
    throw error;
  }
}

async function trackIntegrationJob(supabase, payload) {
  const idempotencyKey = clean(payload.idempotency_key);

  if (idempotencyKey) {
    const existing = await supabase
      .from('sc_integration_jobs')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing.error) {
      if (schemaUnavailable(existing.error)) return null;
      throw existing.error;
    }
    if (existing.data?.id) return existing.data.id;
  }

  const inserted = await supabase.from('sc_integration_jobs').insert(payload).select('id').maybeSingle();
  if (!inserted.error) return inserted.data?.id || null;
  if (schemaUnavailable(inserted.error)) return null;

  // The partial unique index can reject a simultaneous retry, but PostgREST
  // cannot target that partial index using onConflict. Re-read the winner.
  if (idempotencyKey && inserted.error.code === '23505') {
    const winner = await supabase
      .from('sc_integration_jobs')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (!winner.error && winner.data?.id) return winner.data.id;
    if (winner.error && !schemaUnavailable(winner.error)) throw winner.error;
  }

  throw inserted.error;
}

async function rememberColorAlias(supabase, confirmation, row, userId) {
  const sourceValue = clean(row.color);
  const canonicalId = clean(row.color_id);
  if (!sourceValue || !canonicalId) return;
  const color = await supabase.from('sc_active_colors').select('id,name').eq('id', canonicalId).maybeSingle();
  if (color.error) throw color.error;
  if (!color.data) throw new Error(`${row.supplier_sku}: choose an active WooCommerce color.`);
  const sourceSystem = clean(confirmation.supplier_key);
  const sourceKey = supplierMatchKey(sourceValue);
  const values = {
    source_system: clean(confirmation.supplier_key), source_value: sourceValue,
    source_key: sourceKey, canonical_color_id_text: canonicalId,
    canonical_color_name: color.data.name, notes: `Remembered while receiving ${confirmation.supplier_name || confirmation.supplier_key}`,
    updated_at: new Date().toISOString(),
  };
  await saveNaturalKey(supabase, {
    table: 'sc_import_color_aliases', filters: { source_system: sourceSystem, source_key: sourceKey },
    insertPayload: { ...values, created_by: userId }, updatePayload: values,
    label: 'Supplier color alias', optional: true,
  });
}

async function rememberProductIdentityAlias(supabase, confirmation, row, userId) {
  const supplierSku = clean(row.supplier_sku);
  const blankProductId = clean(row.blank_product_id);
  if (!supplierSku || !blankProductId) return;
  const normalize = (value) => clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const sourceSystem = clean(confirmation.supplier_key).toLowerCase();
  const sourceValueNorm = normalize(supplierSku);
  const contextBrandNorm = normalize(row.brand);
  const contextStyleNorm = normalize(row.style);
  const values = {
    source_system: sourceSystem, alias_type: 'supplier_sku',
    source_value: supplierSku, source_value_norm: sourceValueNorm,
    context_brand_norm: contextBrandNorm, context_style_norm: contextStyleNorm,
    canonical_blank_product_id_text: blankProductId, canonical_label: clean(row.description) || supplierSku,
    confidence: 100, status: 'active', reviewed_by: userId,
    notes: `Remembered while receiving order ${clean(confirmation.order_number)}`,
    updated_at: new Date().toISOString(),
  };
  await saveNaturalKey(supabase, {
    table: 'sc_product_identity_aliases',
    filters: {
      source_system: sourceSystem, alias_type: 'supplier_sku', source_value_norm: sourceValueNorm,
      context_brand_norm: contextBrandNorm, context_style_norm: contextStyleNorm,
    },
    insertPayload: { ...values, created_by: userId }, updatePayload: values,
    label: 'Supplier product identity alias', optional: true,
  });
}

async function rememberSupplierItemMapping(supabase, confirmation, row, userId) {
  const supplierKey = clean(confirmation.supplier_key);
  const supplierSku = clean(row.supplier_sku);
  if (!supplierKey || !supplierSku) return;
  const values = {
    supplier_key: supplierKey, supplier_sku: supplierSku,
    blank_product_id_text: clean(row.blank_product_id), last_brand: clean(row.brand) || null,
    last_style: clean(row.style) || null, last_color: clean(row.color) || null,
    last_size: clean(row.size) || null, updated_at: new Date().toISOString(),
  };
  await saveNaturalKey(supabase, {
    table: 'sc_supplier_item_mappings', filters: { supplier_key: supplierKey, supplier_sku: supplierSku },
    insertPayload: { ...values, created_by: userId }, updatePayload: values,
    label: 'Supplier item mapping',
  });
}

function lookupCode(value) {
  return clean(value)
    .toUpperCase()
    .replace(/&/g, 'AND')
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 80);
}

async function lookupRows(supabase, table) {
  const result = await supabase.from(table).select('id,name,code').limit(5000);
  if (result.error) throw result.error;
  return result.data || [];
}

function matchingLookup(rows, value) {
  const wanted = supplierMatchKey(value);
  if (!wanted) return null;
  return rows.find((row) => [row.name, row.code].some((candidate) => supplierMatchKey(candidate) === wanted)) || null;
}

async function ensureLookup(supabase, table, label, value, cache) {
  const name = clean(value);
  const key = `${table}:${supplierMatchKey(name)}`;
  if (!name) return { row: null, created: false };
  if (cache.has(key)) return cache.get(key);

  let rows = await lookupRows(supabase, table);
  const existing = matchingLookup(rows, name);
  if (existing) {
    const resolved = { row: existing, created: false };
    cache.set(key, resolved);
    return resolved;
  }

  const inserted = await supabase.from(table).insert({ name, code: lookupCode(name) || null }).select('id,name,code').single();
  if (!inserted.error && inserted.data) {
    const resolved = { row: inserted.data, created: true };
    cache.set(key, resolved);
    return resolved;
  }

  // A normalized-name or code constraint may have won a concurrent insert.
  // Re-read before reporting an error so retries do not create duplicates.
  rows = await lookupRows(supabase, table);
  const retry = matchingLookup(rows, name);
  if (retry) {
    const resolved = { row: retry, created: false };
    cache.set(key, resolved);
    return resolved;
  }
  throw new Error(`Could not create ${label} "${name}": ${inserted.error?.message || 'database insert failed'}`);
}

async function ensureSupplierLookups(supabase, body) {
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) throw new Error('No supplier rows were supplied for lookup matching.');
  const cache = new Map();
  const created = [];
  const resolvedRows = [];

  for (const source of rows) {
    const row = { ...source };
    if (!clean(row.brand_id) && clean(row.brand)) {
      const result = await ensureLookup(supabase, 'brands', 'Brand', row.brand, cache);
      row.brand_id = String(result.row?.id || '');
      if (result.created) created.push({ type: 'brand', id: row.brand_id, name: result.row.name, code: result.row.code });
    }
    if (!clean(row.product_type_id) && clean(row.style)) {
      const result = await ensureLookup(supabase, 'product_types', 'Style', row.style, cache);
      row.product_type_id = String(result.row?.id || '');
      if (result.created) created.push({ type: 'style', id: row.product_type_id, name: result.row.name, code: result.row.code });
    }
    resolvedRows.push(row);
  }

  return { rows: resolvedRows, created_lookups: created };
}

async function history(supabase) {
  await requireSupplierReceivingContract(supabase);
  const imports = await supabase.from('sc_supplier_receiving_imports').select('*').order('created_at', { ascending: false }).limit(50);
  if (imports.error) throw imports.error;
  const importIds = (imports.data || []).map((row) => row.id);
  const receipts = importIds.length
    ? await supabase.from('sc_supplier_receiving_receipts').select('*').in('import_id', importIds).order('created_at', { ascending: false })
    : { data: [], error: null };
  if (receipts.error) throw receipts.error;
  return (imports.data || []).map((row) => ({
    ...row,
    receipts: (receipts.data || []).filter((receipt) => receipt.import_id === row.id),
  }));
}

async function upsertImport(supabase, confirmation, userId) {
  const payload = {
    supplier_key: clean(confirmation.supplier_key), supplier_name: clean(confirmation.supplier_name),
    order_number: clean(confirmation.order_number), po_number: clean(confirmation.po_number) || null,
    order_date: clean(confirmation.order_date) || null, original_file_name: clean(confirmation.original_file_name) || null,
    document_storage_provider: clean(confirmation.document_storage_provider) || 'r2',
    document_storage_bucket: clean(confirmation.document_storage_bucket) || null,
    document_path: clean(confirmation.document_path) || null,
    document_size_bytes: number(confirmation.document_size_bytes) || null,
    document_mime_type: clean(confirmation.document_mime_type) || 'application/pdf',
    document_sha256: clean(confirmation.document_sha256) || null,
    ordered_lines: number(confirmation.total_lines), ordered_units: number(confirmation.total_units),
    order_total: number(confirmation.subtotal), updated_at: new Date().toISOString(),
  };
  return saveNaturalKey(supabase, {
    table: 'sc_supplier_receiving_imports',
    filters: { supplier_key: payload.supplier_key, order_number: payload.order_number },
    insertPayload: { ...payload, created_by: userId }, updatePayload: payload,
    label: 'Supplier order import',
  });
}

async function ensureImportLine(supabase, importId, row) {
  const payload = {
    import_id: importId, supplier_line_key: clean(row.supplier_line_key), supplier_sku: clean(row.supplier_sku) || null,
    description: clean(row.description) || null, brand: clean(row.brand) || null, style: clean(row.style) || null,
    color: clean(row.color) || null, size: clean(row.size) || null, source_page: number(row.source_page) || null,
    ordered_quantity: number(row.ordered_quantity), unit_cost: optionalUnitCost(row.unit_cost), line_total: number(row.line_total),
    blank_product_id_text: clean(row.blank_product_id) || null, updated_at: new Date().toISOString(),
  };
  return saveNaturalKey(supabase, {
    table: 'sc_supplier_receiving_lines',
    filters: { import_id: importId, supplier_line_key: payload.supplier_line_key },
    insertPayload: { ...payload, received_quantity: 0 }, updatePayload: payload,
    label: 'Supplier order line',
  });
}

async function refreshImportTotals(supabase, importId) {
  const result = await supabase.from('sc_supplier_receiving_lines').select('ordered_quantity,received_quantity').eq('import_id', importId);
  if (result.error) throw result.error;
  const ordered = (result.data || []).reduce((sum, line) => sum + number(line.ordered_quantity), 0);
  const received = (result.data || []).reduce((sum, line) => sum + number(line.received_quantity), 0);
  const status = received <= 0 ? 'review' : received >= ordered ? 'received' : 'partially_received';
  const updated = await supabase.from('sc_supplier_receiving_imports').update({ received_units: received, status, updated_at: new Date().toISOString() }).eq('id', importId).select('*').single();
  if (updated.error) throw updated.error;
  return updated.data;
}

async function saveDraft(supabase, body, userId) {
  const confirmation = body.confirmation || {};
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!clean(confirmation.supplier_key) || !clean(confirmation.order_number)) {
    throw new Error('The parsed supplier and order number are required to save a receiving draft.');
  }
  const receivingImport = await upsertImport(supabase, confirmation, userId);
  for (const row of rows) await ensureImportLine(supabase, receivingImport.id, row);
  const updated = await refreshImportTotals(supabase, receivingImport.id);
  return { receiving_import: updated, saved_lines: rows.length };
}

async function commitReceipt(supabase, body, userId) {
  const confirmation = body.confirmation || {};
  const rows = Array.isArray(body.rows) ? body.rows.filter((row) => number(row.receive_now) > 0) : [];
  if (!confirmation.supplier_key || !confirmation.order_number) throw new Error('The parsed supplier and order number are required.');
  if (!rows.length) throw new Error('No rows have a Receive Now quantity greater than zero.');
  const key = clean(body.idempotency_key);
  if (!key) throw new Error('The receiving request key is missing. Refresh and retry.');
  const duplicate = await findNaturalKey(supabase, 'sc_supplier_receiving_receipts', { idempotency_key: key }, 'Supplier receipt');
  if (duplicate) return { receipt: duplicate, duplicate_request: true };

  const trackedJobId = await trackIntegrationJob(supabase, {
    job_type: 'supplier_receiving', source_system: clean(confirmation.supplier_key),
    external_reference: clean(confirmation.order_number), status: 'running',
    progress_current: 0, progress_total: rows.length, attempt_count: 1,
    idempotency_key: `supplier-receiving:${key}`, input_summary: { ordered_rows: rows.length },
    created_by: userId, started_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });

  const receivingImport = await upsertImport(supabase, confirmation, userId);
  const prepared = [];
  for (const row of rows) {
    if (!clean(row.blank_product_id) || !clean(row.bin_id)) throw new Error(`Complete the blank mapping and bin for ${row.supplier_sku || row.supplier_line_key}.`);
    const importLine = await ensureImportLine(supabase, receivingImport.id, row);
    const quantity = number(row.receive_now);
    const remaining = number(importLine.ordered_quantity) - number(importLine.received_quantity);
    if (quantity <= 0 || quantity > remaining) throw new Error(`${row.supplier_sku}: Receive Now must be between 1 and ${remaining}.`);
    prepared.push({ row, importLine, quantity });
  }

  let receiptResult = await supabase.from('sc_supplier_receiving_receipts').insert({
    import_id: receivingImport.id, idempotency_key: key, status: 'processing', notes: clean(body.notes) || null, created_by: userId,
  }).select('*').single();
  if (receiptResult.error?.code === '23505') {
    const winner = await findNaturalKey(supabase, 'sc_supplier_receiving_receipts', { idempotency_key: key }, 'Supplier receipt');
    if (winner) return { receipt: winner, duplicate_request: true };
  }
  if (receiptResult.error) throw receiptResult.error;
  const receipt = receiptResult.data;
  let completedUnits = 0;
  const errors = [];
  const warnings = [];

  for (const item of prepared) {
    const receiptLineResult = await supabase.from('sc_supplier_receiving_receipt_lines').insert({
      receipt_id: receipt.id, import_line_id: item.importLine.id,
      blank_product_id_text: clean(item.row.blank_product_id), bin_id_text: clean(item.row.bin_id),
      quantity: item.quantity, unit_cost: optionalUnitCost(item.row.unit_cost), status: 'pending',
    }).select('*').single();
    if (receiptLineResult.error) { errors.push(receiptLineResult.error.message); continue; }
    const receiptLine = receiptLineResult.data;
    const marker = `[SC-SUPPLIER-RECEIPT:${receipt.id}:${receiptLine.id}]`;
    const rpc = await supabase.rpc('sc_receive_blank_inventory_v4', {
      p_blank_product_id_text: clean(item.row.blank_product_id), p_bin_id_text: clean(item.row.bin_id),
      p_quantity: item.quantity, p_unit_cost: optionalUnitCost(item.row.unit_cost),
      p_notes: [marker, confirmation.supplier_name, `Order ${confirmation.order_number}`, body.notes].filter(Boolean).join(' | '),
    });
    if (rpc.error || rpc.data?.success === false) {
      const message = rpc.error?.message || rpc.data?.message || 'Inventory receiving failed.';
      await supabase.from('sc_supplier_receiving_receipt_lines').update({ status: 'failed', error_message: message }).eq('id', receiptLine.id);
      errors.push(`${item.row.supplier_sku}: ${message}`);
      continue;
    }
    // The inventory RPC is the authoritative mutation. Count the units as
    // received even if later bookkeeping needs integrity review.
    completedUnits += item.quantity;
    const completedLine = await supabase.from('sc_supplier_receiving_receipt_lines').update({ status: 'completed' }).eq('id', receiptLine.id);
    if (completedLine.error) {
      errors.push(`${item.row.supplier_sku}: inventory was received but its receipt line could not be finalized (${completedLine.error.message}). Do not retry; review this receipt in Operations Integrity.`);
      continue;
    }
    const importLineUpdate = await supabase.from('sc_supplier_receiving_lines').update({
      received_quantity: number(item.importLine.received_quantity) + item.quantity,
      blank_product_id_text: clean(item.row.blank_product_id), updated_at: new Date().toISOString(),
    }).eq('id', item.importLine.id);
    if (importLineUpdate.error) {
      errors.push(`${item.row.supplier_sku}: inventory was received but the order-line total could not be updated (${importLineUpdate.error.message}). Do not retry; review this receipt in Operations Integrity.`);
      continue;
    }
    if (item.row.remember_mapping !== false) {
      const rememberTasks = [
        ['supplier SKU mapping', () => rememberSupplierItemMapping(supabase, confirmation, item.row, userId)],
        ['supplier color pairing', () => rememberColorAlias(supabase, confirmation, item.row, userId)],
        ['product identity alias', () => rememberProductIdentityAlias(supabase, confirmation, item.row, userId)],
      ];
      for (const [label, task] of rememberTasks) {
        try { await task(); }
        catch (error) { warnings.push(`${item.row.supplier_sku}: inventory was received, but the ${label} was not saved (${error.message}).`); }
      }
    }
  }

  const status = errors.length ? (completedUnits ? 'partial_error' : 'failed') : 'completed';
  const completed = await supabase.from('sc_supplier_receiving_receipts').update({
    status, received_units: completedUnits, completed_at: new Date().toISOString(),
  }).eq('id', receipt.id).select('*').single();
  if (completed.error) throw completed.error;
  const updatedImport = await refreshImportTotals(supabase, receivingImport.id);
  if (trackedJobId) await supabase.from('sc_integration_jobs').update({
    status: errors.length ? 'failed' : 'completed', progress_current: prepared.length,
    result_summary: { completed_units: completedUnits, error_count: errors.length },
    last_error: errors.length ? errors.join('; ').slice(0, 4000) : null,
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', trackedJobId);
  return { receipt: completed.data, receiving_import: updatedImport, errors, warnings };
}

async function rollbackReceipt(supabase, body, userId) {
  const receiptId = clean(body.receipt_id);
  if (!receiptId) throw new Error('Choose a receipt to roll back.');
  const receiptResult = await supabase.from('sc_supplier_receiving_receipts').select('*').eq('id', receiptId).single();
  if (receiptResult.error) throw receiptResult.error;
  if (receiptResult.data.rolled_back_at) throw new Error('This receipt was already rolled back.');
  const linesResult = await supabase.from('sc_supplier_receiving_receipt_lines').select('*,sc_supplier_receiving_lines(*)').eq('receipt_id', receiptId).eq('status', 'completed');
  if (linesResult.error) throw linesResult.error;
  if (!(linesResult.data || []).length) throw new Error('This receipt has no completed lines to roll back.');

  for (const line of linesResult.data) {
    const movements = await supabase.from('blank_inventory_movements').select('quantity_change').eq('blank_product_id', line.blank_product_id_text).eq('bin_id', line.bin_id_text);
    if (movements.error) throw movements.error;
    const onHand = (movements.data || []).reduce((sum, movement) => sum + number(movement.quantity_change), 0);
    if (onHand < number(line.quantity)) throw new Error(`Rollback blocked: bin stock is now too low for ${line.sc_supplier_receiving_lines?.supplier_sku || 'a received item'}. Move/restore stock first.`);
  }

  for (const line of linesResult.data) {
    const movement = await supabase.from('blank_inventory_movements').insert({
      bin_id: line.bin_id_text, blank_product_id: line.blank_product_id_text,
      quantity_change: -number(line.quantity), movement_type: 'adjustment', source_type: 'supplier_confirmation_rollback',
      notes: `[SC-SUPPLIER-ROLLBACK:${receiptId}:${line.id}] ${clean(body.reason) || 'Supplier confirmation receipt rolled back.'}`,
    });
    if (movement.error) throw movement.error;
    const importLine = line.sc_supplier_receiving_lines;
    await supabase.from('sc_supplier_receiving_lines').update({
      received_quantity: Math.max(0, number(importLine.received_quantity) - number(line.quantity)), updated_at: new Date().toISOString(),
    }).eq('id', line.import_line_id);
    await supabase.from('sc_supplier_receiving_receipt_lines').update({ status: 'rolled_back', rolled_back_at: new Date().toISOString() }).eq('id', line.id);
  }
  const receipt = await supabase.from('sc_supplier_receiving_receipts').update({
    status: 'rolled_back', rolled_back_at: new Date().toISOString(), rolled_back_by: userId,
    rollback_reason: clean(body.reason) || 'Supplier confirmation receipt rolled back.',
  }).eq('id', receiptId).select('*').single();
  if (receipt.error) throw receipt.error;
  await refreshImportTotals(supabase, receiptResult.data.import_id);
  return { receipt: receipt.data };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (!['GET', 'POST'].includes(event.httpMethod)) return jsonResponse(405, { success: false, message: 'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName: FUNCTION_NAME, allowedRoles: ['admin', 'manager', 'operator'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, message: auth.message }, event);
  try {
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const action = event.httpMethod === 'GET' ? 'history' : clean(body.action || 'history');
    let data;
    if (action === 'history') data = { history: await history(auth.supabase) };
    else if (action === 'ensure_lookups') data = await ensureSupplierLookups(auth.supabase, body);
    else if (['save_draft', 'commit', 'rollback'].includes(action)) {
      await requireSupplierReceivingContract(auth.supabase);
      if (action === 'save_draft') data = await saveDraft(auth.supabase, body, auth.user.id);
      else if (action === 'commit') data = await commitReceipt(auth.supabase, body, auth.user.id);
      else data = await rollbackReceipt(auth.supabase, body, auth.user.id);
    }
    else if (action === 'document_url') {
      data = { url: await signedOperationalUrl(auth.supabase, {
        provider: clean(body.document_storage_provider) || (clean(body.document_storage_bucket) ? 'r2' : 'supabase'),
        bucket: clean(body.document_storage_bucket) || 'sc-receiving-documents',
        path: clean(body.document_path),
      }, 300) };
    } else throw new Error('Unknown supplier receiving action.');
    return jsonResponse(200, { success: true, ...data }, event);
  } catch (error) {
    console.error('Supplier receiving action failed:', error);
    return jsonResponse(400, { success: false, message: error.message || 'Supplier receiving action failed.' }, event);
  }
}
