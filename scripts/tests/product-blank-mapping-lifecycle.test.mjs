import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve('.');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('mapping lifecycle SQL is additive, deterministic, and reservation-safe', () => {
  const sql = read('deployment/sql/44_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql');
  assert.match(sql, /create table if not exists public\.sc_product_blank_mappings/i);
  assert.match(sql, /sc_resolve_blank_product_v1/i);
  assert.match(sql, /cardinality\(v_matches\) = 1/i);
  assert.match(sql, /sc_set_product_blank_mappings_bulk_v1/i);
  assert.match(sql, /sc_apply_blank_substitution_v1/i);
  assert.match(sql, /where ji\.blank_product_id is null/i);
  assert.doesNotMatch(sql, /update public\.job_items[\s\S]{0,400}where[\s\S]{0,120}blank_product_id = p_old_blank_product_id/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.blank_products/i);
});

test('WooCommerce order paths prefer remembered lifecycle mappings', () => {
  for (const file of ['netlify/functions/woocommerce-webhook.js', 'netlify/functions/manual-pullsheet.js']) {
    const source = read(file);
    const lifecycle = source.indexOf("queryLifecycleMapping('woocommerce_variation'");
    const legacy = source.indexOf("queryMapping('woo_variation_id'");
    assert.ok(lifecycle > -1, `${file} is missing lifecycle lookup`);
    assert.ok(legacy > lifecycle, `${file} must check lifecycle mappings before legacy mappings`);
  }
});

test('Mockup Studio requires and remembers Color/Size blank mappings', () => {
  const source = read('netlify/functions/mockup-publish-woocommerce.js');
  assert.match(source, /sc_resolve_blank_matrix_v1/);
  assert.match(source, /_sc_blank_product_id/);
  assert.match(source, /sc_set_product_blank_mappings_bulk_v1/);
  assert.match(source, /require review/);
});

test('pull sheet shows actual Woo identity and can remember an override', () => {
  const source = read('src/PullSheetView.jsx');
  assert.match(source, /woocommerce_variation_id,/);
  assert.match(source, /pairing_source,/);
  assert.match(source, /Remember this variation\/SKU mapping for future orders/);
  assert.match(source, /setProductBlankMapping/);
});

test('mapping lifecycle UI exposes review, backfill, and substitution', () => {
  const source = read('src/ProductBlankMappings.jsx');
  assert.match(source, /Run deterministic backfill/);
  assert.match(source, /Accept exact match/);
  assert.match(source, /Replace a discontinued blank/);
  assert.match(source, /already paired open pull-sheet line\(s\) will be preserved/);
});
