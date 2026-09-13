import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const api = fs.readFileSync('src/lib/nonInventoryApi.js', 'utf8');
const view = fs.readFileSync('src/PullSheetView.jsx', 'utf8');
const sql = fs.readFileSync('62_RESTORE_NON_INVENTORY_TRACKING.sql', 'utf8');

test('API exposes restore inventory tracking RPC', () => {
  assert.match(api, /restoreJobItemInventoryTracking/);
  assert.match(api, /sc_restore_job_item_inventory_tracking/);
});

test('pull sheet exposes reverse non-inventory action', () => {
  assert.match(view, /Restore Inventory Tracking/);
  assert.match(view, /restoreLineInventoryTracking/);
  assert.match(view, /restoreJobItemInventoryTracking/);
});

test('non-inventory lines retain blank override access', () => {
  assert.match(view, /Override Blank Pairing/);
  assert.match(view, /openOverrideEditor/);
});

test('restore re-enables inventory and purchasing', () => {
  assert.match(sql, /inventory_required = true/);
  assert.match(sql, /include_on_purchasing_report = true/);
  assert.match(sql, /non_inventory_reason = null/);
  assert.match(sql, /non_inventory_rule_id = null/);
  assert.match(sql, /non_inventory_marked_at = null/);
});

test('restore uses exact pairing sources and never fuzzy matches', () => {
  assert.match(sql, /previous_blank_product_id/);
  assert.match(sql, /sc_manual_invoice_order_items/);
  assert.match(sql, /BLANK_PAIRING_REQUIRED/);
  assert.doesNotMatch(sql, /ilike/);
  assert.doesNotMatch(sql, /similarity\s*\(/);
});

test('shortages return to Pending Stock and Purchasing', () => {
  assert.match(sql, /pending stock/i);
  assert.match(sql, /bin_code/);
  assert.match(sql, /pending_stock_assigned/);
});

test('reservation is attempted only when enough inventory is available', () => {
  assert.match(sql, /v_available >= v_required_qty/);
  assert.match(sql, /sc_ensure_job_item_reservation_v1/);
});

test('restore is audited without creating inventory movements', () => {
  assert.match(sql, /restore_inventory_tracking/);
  assert.match(sql, /sc_non_inventory_actions_log/);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.blank_inventory_movements/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.inventory_movements/i);
});

test('active non-inventory rule is not silently disabled', () => {
  assert.match(view, /will NOT deactivate that rule/);
  assert.match(sql, /rule_left_active/);
});
