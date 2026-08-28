import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  normalizePurchasingDemandSourceRow,
  purchasingDemandSourceQuantity,
  representedPurchasingJobItemIds,
  unrepresentedPurchasingSources,
} from '../../src/lib/purchasingDemandSources.js';

const root = path.resolve('.');

test('Supabase demand_sources rows retain job item identity', () => {
  const normalized = normalizePurchasingDemandSourceRow({
    blank_product_id: '77b3a4a2-82c3-4ca2-a350-7a76a2b1818e',
    demand_source_count: 1,
    demand_total_quantity: 3,
    demand_order_numbers: '195',
    demand_pullsheet_numbers: '195',
    demand_sources: [{ job_item_id: 906, reservation_id: 'reservation-1', quantity: 3 }],
  });

  assert.equal(normalized.demand_source_count, 1);
  assert.equal(normalized.demand_total_quantity, 3);
  assert.equal(normalized.demand_order_numbers, '195');
  assert.equal(normalized.demand_pullsheet_numbers, '195');
  assert.equal(normalized.demand_sources[0].job_item_id, 906);
});

test('legacy source field names remain supported', () => {
  const normalized = normalizePurchasingDemandSourceRow({
    blank_product_id: 'blank-1',
    source_count: 1,
    total_quantity: 2,
    order_numbers: '194',
    pullsheet_numbers: '194',
    sources: JSON.stringify([{ job_item_id: 800, quantity: 2 }]),
  });

  assert.equal(normalized.demand_total_quantity, 2);
  assert.equal(normalized.demand_sources[0].job_item_id, 800);
});

test('quantity_reserved wins when a legacy quantity field is zero', () => {
  assert.equal(purchasingDemandSourceQuantity({
    quantity: 0,
    quantity_reserved: 3,
  }), 3);
});

test('Pending Stock does not add demand already represented by the reservation view', () => {
  const databaseSources = [{ job_item_id: 906, quantity: 3 }];
  const pendingSources = [{ job_item_id: 906, quantity: 3, pending_stock: true }];
  const representedIds = representedPurchasingJobItemIds(databaseSources);
  const additions = unrepresentedPurchasingSources(pendingSources, representedIds);

  assert.deepEqual(additions, []);
  assert.equal(
    3 + additions.reduce((sum, source) => (
      sum + purchasingDemandSourceQuantity(source)
    ), 0),
    3
  );
});

test('new Pending Stock demand not present in the database remains included', () => {
  const representedIds = representedPurchasingJobItemIds([
    { job_item_id: 906, quantity: 3 },
  ]);
  const additions = unrepresentedPurchasingSources([
    { job_item_id: 999, quantity: 2, pending_stock: true },
  ], representedIds);

  assert.equal(additions.length, 1);
  assert.equal(purchasingDemandSourceQuantity(additions[0]), 2);
});

test('SQL compatibility view repairs reservation quantities without changing data', () => {
  const sql = fs.readFileSync(
    path.join(
      root,
      'deployment/sql/38_PURCHASING_DEMAND_SOURCE_DEDUPLICATION.sql'
    ),
    'utf8'
  );

  assert.match(sql, /create or replace view public\.sc_purchasing_demand_sources_v2/i);
  assert.match(sql, /source_row\.demand_sources/i);
  assert.match(sql, /reservation\.quantity_reserved/i);
  assert.match(sql, /source_item->>'job_item_id'/i);
  assert.doesNotMatch(sql, /\b(delete|truncate)\s+from\b/i);
  assert.doesNotMatch(sql, /\bupdate\s+public\./i);
});
