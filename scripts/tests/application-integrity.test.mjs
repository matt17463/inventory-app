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

test('duplicate resolution is previewed, confirmed, atomic, archived, and audited', () => {
  const sql = read('deployment/sql/30_RESOLVE_PRODUCT_REVIEW_CASES.sql');
  const fn = read('netlify/functions/application-integrity.js');
  assert.match(sql, /sc_preview_product_resolution_v1/);
  assert.match(sql, /sc_apply_product_resolution_v1/);
  assert.match(sql, /confirmation_phrase/);
  assert.match(sql, /preview_hash/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /sc_is_archived = true/);
  assert.match(sql, /sc_archived_original_sku/);
  assert.match(sql, /sc_core_mutation_audit/);
  assert.match(sql, /quantity_values_rewritten', false/);
  assert.match(sql, /add column sc_canonical_blank_product_id uuid/);
  assert.match(sql, /p_blank_product_id uuid/);
  assert.match(sql, /v_members uuid\[\]/);
  assert.match(sql, /entity_id_text::uuid/);
  assert.match(sql, /sc_update_blank_product_safe_v1\(uuid,jsonb,uuid\)/);
  assert.doesNotMatch(sql, /v_members bigint|v_survivor bigint|entity_id_text::bigint/);
  assert.doesNotMatch(fn, /p_blank_product_id: Number\(body\.id\)/);
  assert.doesNotMatch(fn, /\(body\.ids \|\| \[\]\)\.map\(Number\)/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.blank_products/i);
  assert.doesNotMatch(sql, /update\s+public\.blank_inventory_movements\s+set\s+quantity_change/i);
});

test('duplicate workbench requires dependency review and exact confirmation', () => {
  const page = read('src/ApplicationIntegrityCenter.jsx');
  const api = read('src/lib/applicationIntegrityApi.js');
  const fn = read('netlify/functions/application-integrity.js');
  assert.match(page, /Preview Resolve/);
  assert.match(page, /References that will be repointed/);
  assert.match(page, /confirmation_phrase/);
  assert.match(page, /Resolve Case and Archive Duplicates/);
  assert.match(api, /previewDuplicateReviewResolution/);
  assert.match(api, /applyDuplicateReviewResolution/);
  assert.match(fn, /review\.preview_resolution/);
  assert.match(fn, /review\.apply_resolution/);
});

test('archived blank products are excluded from primary direct searches', () => {
  for (const path of [
    'src/AddItemToBin.jsx',
    'src/EditBlankItems.jsx',
    'src/PullSheetView.jsx',
    'src/lib/inventoryApi.js',
    'src/lib/mockupStudioApi.js',
    'netlify/functions/manual-pullsheet.js',
    'netlify/functions/woocommerce-webhook.js',
    'netlify/functions/supplier-confirmation-parse.js',
  ]) {
    assert.match(read(path), /sc_is_archived/);
  }
});
