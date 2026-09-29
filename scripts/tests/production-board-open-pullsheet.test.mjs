import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(
  new URL('../../supabase/migrations/202609301430_production_board_open_pullsheet_guard.sql', import.meta.url),
  'utf8',
);
const deploymentSql = fs.readFileSync(
  new URL('../../deployment/sql/72_PRODUCTION_BOARD_OPEN_PULLSHEET_GUARD.sql', import.meta.url),
  'utf8',
);

test('SQL 72 matches the migration exactly', () => {
  assert.equal(deploymentSql, migration);
});

test('resolved lines do not auto-complete an otherwise open pull sheet', () => {
  assert.match(
    migration,
    /unresolved_lines[\s\S]*= 0[\s\S]*v_effective_status := 'ready_to_ship'[\s\S]*v_effective_column := 'ready_to_ship'/,
  );
  assert.doesNotMatch(
    migration,
    /unresolved_lines[\s\S]{0,180}= 0[\s\S]{0,180}v_effective_status := 'production_complete'[\s\S]{0,120}v_effective_column := 'completed'/,
  );
});

test('explicit completed status still places the job in Completed', () => {
  assert.match(
    migration,
    /when v_saved_status in \('completed', 'production_complete'\) then 'production_complete'/,
  );
  assert.match(
    migration,
    /when v_saved_status in \('completed', 'production_complete'\) then 'completed'/,
  );
});

test('open resolved jobs explain why they remain active', () => {
  assert.match(
    migration,
    /pull sheet remains active until the job is explicitly completed/i,
  );
});

test('board wrapper remains volatile because legacy reconciliation can write', () => {
  assert.match(
    migration,
    /create or replace function public\.sc_list_order_status_board_v2[\s\S]*language plpgsql[\s\S]*volatile/i,
  );
});
