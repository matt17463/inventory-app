import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(
  new URL('../../supabase/migrations/202608200200_active_pullsheet_operational_rows.sql', import.meta.url),
  'utf8',
);
const deploymentSql = fs.readFileSync(
  new URL('../../deployment/sql/20_ACTIVE_PULLSHEET_OPERATIONAL_ROWS.sql', import.meta.url),
  'utf8',
);
const productionApi = fs.readFileSync(
  new URL('../../src/lib/productionStatusApi.js', import.meta.url),
  'utf8',
);
const inventoryApi = fs.readFileSync(
  new URL('../../src/lib/inventoryApi.js', import.meta.url),
  'utf8',
);

test('cancelled pull-sheet rows remain history and are excluded from active summaries', () => {
  assert.equal(deploymentSql, migration);
  assert.match(migration, /sc_job_item_is_operational_v1/);
  assert.match(migration, /'cancelled'[\s\S]*'canceled'[\s\S]*'voided'[\s\S]*'deleted'/);
  assert.match(migration, /cancelled_history_lines/);
  assert.match(migration, /unpaired_required_lines/);
});

test('production board and pull-sheet list use active-line RPCs', () => {
  assert.match(productionApi, /sc_list_order_status_board_v2/);
  assert.match(inventoryApi, /sc_existing_pull_sheets_v2/);
  assert.match(inventoryApi, /sc_pull_sheet_items_active_v1/);
});

test('manual production status controls the board column without removing blockers', () => {
  assert.match(migration, /v_manual/);
  assert.match(migration, /Manual production status selected/);
  assert.match(migration, /blocking_issues/);
});
