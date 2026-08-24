import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('v1 application integrity migration is additive and service-only', () => {
  const sql = read('deployment/sql/28_APPLICATION_INTEGRITY_PLATFORM.sql');
  assert.match(sql, /ADDITIVE \/ NON-DESTRUCTIVE/);
  assert.match(sql, /sc_product_identity_aliases/);
  assert.match(sql, /sc_product_review_cases/);
  assert.match(sql, /sc_integration_jobs/);
  assert.match(sql, /sc_team_store_workflows/);
  assert.match(sql, /sc_create_blank_product_safe_v1/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /grant execute[\s\S]*to service_role/i);
  assert.doesNotMatch(sql, /drop\s+table|truncate\s+table|delete\s+from\s+public\.blank_products/i);
});

test('core product and pull-sheet writes use guarded server actions', () => {
  const inventory = read('src/lib/inventoryApi.js');
  const edit = read('src/EditBlankItems.jsx');
  const add = read('src/AddItemToBin.jsx');
  const pull = read('src/PullSheetView.jsx');
  assert.match(inventory, /createBlankProductGuarded/);
  assert.match(inventory, /updateBlankProductGuarded/);
  assert.match(inventory, /updatePullSheetStatusGuarded/);
  assert.match(edit, /updateBlankProduct\(selected\.id/);
  assert.match(add, /createBlankProduct\(payload\)/);
  assert.match(pull, /updatePullSheetItemStatus/);
  assert.doesNotMatch(edit, /from\(['"]blank_products['"]\)\.update/);
  assert.doesNotMatch(pull, /from\(['"]jobs['"]\)[\s\S]{0,100}\.update/);
});

test('operations integrity workspace exposes every coordinated workflow', () => {
  const page = read('src/ApplicationIntegrityCenter.jsx');
  const app = read('src/App.jsx');
  const nav = read('src/navigationConfig.js');
  for (const label of ['Product Identity', 'Duplicate Workbench', 'Receiving Inbox', 'Reconciliation', 'Integration Jobs', 'Team Stores']) {
    assert.match(page, new RegExp(label));
  }
  assert.match(app, /operations-integrity/);
  assert.match(nav, /Operations Integrity/);
});

test('supplier receiving persists parsed drafts and supports focused bulk review', () => {
  const page = read('src/SupplierConfirmationReceiving.jsx');
  const fn = read('netlify/functions/supplier-receiving-action.js');
  assert.match(page, /action: 'save_draft'/);
  assert.match(page, /Show review rows only/);
  assert.match(page, /Apply to Selected/);
  assert.match(fn, /async function saveDraft/);
  assert.match(fn, /rememberProductIdentityAlias/);
});

test('AuthGate verifies an active application role through the server', () => {
  const gate = read('src/AuthGate.jsx');
  const fn = read('netlify/functions/application-integrity.js');
  assert.match(gate, /application-integrity/);
  assert.match(gate, /Account access is not active/);
  assert.match(fn, /authorizeEmployee/);
  assert.match(fn, /allowedRoles/);
});
