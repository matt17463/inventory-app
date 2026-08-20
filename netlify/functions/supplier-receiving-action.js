import { authorizeEmployee, jsonResponse } from './_shared/security.js';

const FUNCTION_NAME = 'supplier-receiving-action';
const BUCKET = 'sc-receiving-documents';

function clean(value) { return String(value ?? '').trim(); }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }

async function requireTables(supabase) {
  const probe = await supabase.from('sc_supplier_receiving_imports').select('id').limit(1);
  if (probe.error) throw new Error('Supplier receiving SQL is not installed. Run deployment/sql/19_SUPPLIER_CONFIRMATION_RECEIVING.sql in Supabase, then retry.');
}

async function history(supabase) {
  await requireTables(supabase);
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
    document_path: clean(confirmation.document_path) || null, document_sha256: clean(confirmation.document_sha256) || null,
    ordered_lines: number(confirmation.total_lines), ordered_units: number(confirmation.total_units),
    order_total: number(confirmation.subtotal), created_by: userId, updated_at: new Date().toISOString(),
  };
  const result = await supabase.from('sc_supplier_receiving_imports').upsert(payload, { onConflict: 'supplier_key,order_number', ignoreDuplicates: false }).select('*').single();
  if (result.error) throw result.error;
  return result.data;
}

async function ensureImportLine(supabase, importId, row) {
  const existing = await supabase.from('sc_supplier_receiving_lines').select('*').eq('import_id', importId).eq('supplier_line_key', row.supplier_line_key).maybeSingle();
  if (existing.error) throw existing.error;
  const payload = {
    import_id: importId, supplier_line_key: clean(row.supplier_line_key), supplier_sku: clean(row.supplier_sku) || null,
    description: clean(row.description) || null, brand: clean(row.brand) || null, style: clean(row.style) || null,
    color: clean(row.color) || null, size: clean(row.size) || null, source_page: number(row.source_page) || null,
    ordered_quantity: number(row.ordered_quantity), unit_cost: number(row.unit_cost), line_total: number(row.line_total),
    blank_product_id_text: clean(row.blank_product_id) || null, updated_at: new Date().toISOString(),
  };
  if (existing.data) {
    const updated = await supabase.from('sc_supplier_receiving_lines').update(payload).eq('id', existing.data.id).select('*').single();
    if (updated.error) throw updated.error;
    return updated.data;
  }
  const inserted = await supabase.from('sc_supplier_receiving_lines').insert({ ...payload, received_quantity: 0 }).select('*').single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
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

async function commitReceipt(supabase, body, userId) {
  const confirmation = body.confirmation || {};
  const rows = Array.isArray(body.rows) ? body.rows.filter((row) => number(row.receive_now) > 0) : [];
  if (!confirmation.supplier_key || !confirmation.order_number) throw new Error('The parsed supplier and order number are required.');
  if (!rows.length) throw new Error('No rows have a Receive Now quantity greater than zero.');
  const key = clean(body.idempotency_key);
  if (!key) throw new Error('The receiving request key is missing. Refresh and retry.');
  const duplicate = await supabase.from('sc_supplier_receiving_receipts').select('*').eq('idempotency_key', key).maybeSingle();
  if (duplicate.error) throw duplicate.error;
  if (duplicate.data) return { receipt: duplicate.data, duplicate_request: true };

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

  const receiptResult = await supabase.from('sc_supplier_receiving_receipts').insert({
    import_id: receivingImport.id, idempotency_key: key, status: 'processing', notes: clean(body.notes) || null, created_by: userId,
  }).select('*').single();
  if (receiptResult.error) throw receiptResult.error;
  const receipt = receiptResult.data;
  let completedUnits = 0;
  const errors = [];

  for (const item of prepared) {
    const receiptLineResult = await supabase.from('sc_supplier_receiving_receipt_lines').insert({
      receipt_id: receipt.id, import_line_id: item.importLine.id,
      blank_product_id_text: clean(item.row.blank_product_id), bin_id_text: clean(item.row.bin_id),
      quantity: item.quantity, unit_cost: number(item.row.unit_cost), status: 'pending',
    }).select('*').single();
    if (receiptLineResult.error) { errors.push(receiptLineResult.error.message); continue; }
    const receiptLine = receiptLineResult.data;
    const marker = `[SC-SUPPLIER-RECEIPT:${receipt.id}:${receiptLine.id}]`;
    const rpc = await supabase.rpc('sc_receive_blank_inventory_v4', {
      p_blank_product_id_text: clean(item.row.blank_product_id), p_bin_id_text: clean(item.row.bin_id),
      p_quantity: item.quantity, p_unit_cost: number(item.row.unit_cost),
      p_notes: [marker, confirmation.supplier_name, `Order ${confirmation.order_number}`, body.notes].filter(Boolean).join(' | '),
    });
    if (rpc.error || rpc.data?.success === false) {
      const message = rpc.error?.message || rpc.data?.message || 'Inventory receiving failed.';
      await supabase.from('sc_supplier_receiving_receipt_lines').update({ status: 'failed', error_message: message }).eq('id', receiptLine.id);
      errors.push(`${item.row.supplier_sku}: ${message}`);
      continue;
    }
    await supabase.from('sc_supplier_receiving_receipt_lines').update({ status: 'completed' }).eq('id', receiptLine.id);
    await supabase.from('sc_supplier_receiving_lines').update({
      received_quantity: number(item.importLine.received_quantity) + item.quantity,
      blank_product_id_text: clean(item.row.blank_product_id), updated_at: new Date().toISOString(),
    }).eq('id', item.importLine.id);
    if (item.row.remember_mapping !== false && item.row.supplier_sku) {
      await supabase.from('sc_supplier_item_mappings').upsert({
        supplier_key: confirmation.supplier_key, supplier_sku: item.row.supplier_sku,
        blank_product_id_text: clean(item.row.blank_product_id), last_brand: clean(item.row.brand) || null,
        last_style: clean(item.row.style) || null, last_color: clean(item.row.color) || null,
        last_size: clean(item.row.size) || null, created_by: userId, updated_at: new Date().toISOString(),
      }, { onConflict: 'supplier_key,supplier_sku' });
    }
    completedUnits += item.quantity;
  }

  const status = errors.length ? (completedUnits ? 'partial_error' : 'failed') : 'completed';
  const completed = await supabase.from('sc_supplier_receiving_receipts').update({
    status, received_units: completedUnits, completed_at: new Date().toISOString(),
  }).eq('id', receipt.id).select('*').single();
  if (completed.error) throw completed.error;
  const updatedImport = await refreshImportTotals(supabase, receivingImport.id);
  return { receipt: completed.data, receiving_import: updatedImport, errors };
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
    else if (action === 'commit') data = await commitReceipt(auth.supabase, body, auth.user.id);
    else if (action === 'rollback') data = await rollbackReceipt(auth.supabase, body, auth.user.id);
    else if (action === 'document_url') {
      const signed = await auth.supabase.storage.from(BUCKET).createSignedUrl(clean(body.document_path), 300);
      if (signed.error) throw signed.error;
      data = { url: signed.data.signedUrl };
    } else throw new Error('Unknown supplier receiving action.');
    return jsonResponse(200, { success: true, ...data }, event);
  } catch (error) {
    console.error('Supplier receiving action failed:', error);
    return jsonResponse(400, { success: false, message: error.message || 'Supplier receiving action failed.' }, event);
  }
}
