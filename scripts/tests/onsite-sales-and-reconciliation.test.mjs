import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('on-site sale is routed, responsive, authenticated, and atomically deducts inventory', () => {
  assert.match(read('src/App.jsx'), /OnsiteSales/);
  assert.match(read('src/navigationConfig.js'), /On-site Sales/);
  assert.match(read('netlify/functions/onsite-sales.js'), /authorizeEmployee/);
  const sql = read('deployment/sql/50_ONSITE_SALES_PURCHASING_AND_CATALOG_RECONCILIATION.sql');
  assert.match(sql, /sc_complete_onsite_sale_v1/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /quantity_change.*-1/s);
  assert.match(sql, /sc_onsite_production_orders/);
  assert.match(sql, /blank_product_id uuid not null references public\.blank_products\(id\)/);
  assert.match(sql, /p_blank_product_id uuid/);
  assert.doesNotMatch(read('netlify/functions/onsite-sales.js'), /p_blank_product_id:\s*number\(/);
});

test('purchasing uses authoritative movement-ledger availability', () => {
  const sql = read('deployment/sql/50_ONSITE_SALES_PURCHASING_AND_CATALOG_RECONCILIATION.sql');
  assert.match(sql, /sum\(quantity_change\)/);
  assert.match(sql, /sc_purchasing_authoritative_inventory_v3/);
  assert.match(read('src/lib/inventoryApi.js'), /applyAuthoritativePurchasingInventory/);
});

test('color mapping supports master drop zone and same-name distinct IDs', () => {
  assert.match(read('src/ColorAliasReview.jsx'), /Master color drop zone/);
  assert.match(read('src/ColorAliasReview.jsx'), /text\/sc-color-id/);
  const sql = read('deployment/sql/50_ONSITE_SALES_PURCHASING_AND_CATALOG_RECONCILIATION.sql');
  assert.match(sql, /source_color_id <> canonical_color_id/);
  assert.doesNotMatch(sql, /normalized value/);
});

test('product integrity includes WooCommerce blank reconciliation', () => {
  assert.match(read('src/ProductIntegrityCenter.jsx'), /WooCommerce ↔ blank reconciliation/);
  assert.match(read('deployment/sql/50_ONSITE_SALES_PURCHASING_AND_CATALOG_RECONCILIATION.sql'), /sc_catalog_reconciliation_v2/);
});


test('on-site sales v2 uses valid Woo ordering, category logos, and cascading in-stock selectors', () => {
  const fn = read('netlify/functions/onsite-sales.js');
  const page = read('src/OnsiteSales.jsx');
  const sql = read('deployment/sql/52_ONSITE_SALES_CASCADING_PICKER.sql');
  assert.match(fn, /orderby=title/);
  assert.doesNotMatch(fn, /products\?category=.*orderby=name/);
  assert.match(fn, /category-menu/);
  assert.match(fn, /logo\|graphic\|design/);
  assert.match(page, /Type/);
  assert.match(page, /Brand/);
  assert.match(page, /Style/);
  assert.match(page, /Color/);
  assert.match(page, /Size/);
  assert.doesNotMatch(page, /Finished item \/ design menu/);
  assert.match(sql, /sc_blank_item_types/);
  assert.match(sql, /sc_item_type_id/);
  assert.match(sql, /sc_onsite_inventory_search_v2/);
});

test('Mockup Studio classifies a style item type when creating or repairing blanks', () => {
  assert.match(read('src/MockupStudio.jsx'), /blank_item_type/);
  assert.match(read('src/MockupStudio.jsx'), /Item Type/);
  assert.match(read('netlify/functions/_shared/mockupBlankCatalog.js'), /sc_blank_item_types/);
  assert.match(read('netlify/functions/_shared/mockupBlankCatalog.js'), /sc_item_type_id/);
  assert.match(read('netlify/functions/mockup-publish-woocommerce.js'), /_sc_blank_item_type/);
});


test('on-site test mode cannot mutate inventory and provides device preview controls', () => {
  const fn = read('netlify/functions/onsite-sales.js');
  const page = read('src/OnsiteSales.jsx');
  const css = read('src/OnsiteSales.css');
  assert.match(page, /sc-onsite-test-mode/);
  assert.match(page, /Create TEST label/);
  assert.match(page, /TEST MODE — NO INVENTORY DEDUCTION/);
  assert.match(page, /sc-onsite-device-mode/);
  assert.match(page, /Phone/);
  assert.match(page, /Tablet/);
  assert.match(page, /Laptop/);
  assert.match(fn, /body\.test_mode/);
  assert.match(fn, /test_mode: true/);
  assert.match(fn, /TEST MODE — no inventory deduction/);
  assert.match(css, /onsite-device-phone/);
  assert.match(css, /onsite-test-watermark/);
  assert.match(css, /\.onsite-label\{display:block/);
  assert.doesNotMatch(css, /\.onsite-label\{display:none/);
  assert.match(page, /onClick=\{\(\)=>window\.print\(\)\}/);
});

test('on-site Woo reads cache category menus and diagnose SiteGround challenges', () => {
  const fn = read('netlify/functions/onsite-sales.js');
  const utils = read('netlify/functions/_shared/mockupUtils.js');
  assert.match(fn, /10 \* 60 \* 1000/);
  assert.match(fn, /5 \* 60 \* 1000/);
  assert.match(utils, /SkilledCrafting-InventoryApp\/1\.4\.3/);
  assert.match(utils, /sgcaptcha/);
  assert.match(utils, /new Date\(\)\.toISOString\(\)/);
  assert.match(utils, /SiteGround Anti-Bot challenge/);
});
