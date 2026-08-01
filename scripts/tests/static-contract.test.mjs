import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve('.');
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const nav = fs.readFileSync(path.join(root, 'src/navigationConfig.js'), 'utf8');

function routePaths() {
  return new Set([...app.matchAll(/<Route\s+path=["']([^"']+)["']/g)].map((match) => match[1]));
}

function navigationPaths() {
  return [...nav.matchAll(/\bpath:\s*["']([^"']+)["']/g)].map((match) => match[1].split('?')[0]);
}

test('all navigation paths have active routes', () => {
  const routes = routePaths();
  const missing = navigationPaths().filter((item) => !routes.has(item));
  assert.deepEqual(missing, []);
});

test('employee routes use a real not-found page', () => {
  assert.match(app, /<Route path="\*" element=\{<NotFound \/>\}/);
  assert.doesNotMatch(app, /<Route path="\*" element=\{<Home \/>\}/);
});

test('legacy create-product route is a safe redirect', () => {
  assert.match(app, /path="\/create-product"[^\n]+Navigate replace to="\/inventory\/edit-blanks"/);
  assert.doesNotMatch(app, /import CreateProduct/);
});

test('public customer portal remains outside AuthGate', () => {
  const publicRoute = app.indexOf('<Route path="/customer-portal"');
  const authGate = app.indexOf('<AuthGate>');
  assert.ok(publicRoute >= 0 && authGate >= 0 && publicRoute < authGate);
});

test('known stale deployable files are absent', () => {
  const stale = [
    'public/pullsheet.js',
    'public/Home.jsx',
    'ManualInvoicedOrders.jsx',
    'ManualInvoicedOrders(10).jsx',
    'manualOrdersApi.js',
    'download',
    'download (1)',
  ];
  assert.deepEqual(stale.filter((name) => fs.existsSync(path.join(root, name))), []);
});


test('fallback navigation does not contain removed bin-contents route', () => {
  const shell = fs.readFileSync(path.join(root, 'src/components/AppShell.jsx'), 'utf8');
  assert.doesNotMatch(shell, /\/bin-contents/);
});


test('out-of-stock pull sheet lines use the Pending Stock bin safely', () => {
  const helper = fs.readFileSync(path.join(root, 'src/lib/pullSheetBinAssignmentApi.js'), 'utf8');
  const pullSheet = fs.readFileSync(path.join(root, 'src/PullSheetView.jsx'), 'utf8');
  const manualOrders = fs.readFileSync(path.join(root, 'src/lib/manualOrdersApi.js'), 'utf8');

  assert.match(helper, /assignOutOfStockJobItemsToPendingStock/);
  assert.match(helper, /selected_bin_id:\s*pendingStockBin\.bin_id/);
  assert.match(helper, /pending stock/);
  assert.match(helper, /unassigned/);
  assert.match(pullSheet, /Out of stock — automatically assigned to Pending Stock/);
  assert.match(pullSheet, /Awaiting Stock/);
  assert.match(pullSheet, /outOfStockEntries/);
  assert.match(manualOrders, /attachOutOfStockAssignment/);
});


test('purchasing report counts Pending Stock demand', () => {
  const inventoryApi = fs.readFileSync(path.join(root, 'src/lib/inventoryApi.js'), 'utf8');
  const purchasing = fs.readFileSync(path.join(root, 'src/Purchasing.jsx'), 'utf8');

  assert.match(inventoryApi, /getPendingStockPurchasingContext/);
  assert.match(inventoryApi, /pending_stock_quantity/);
  assert.match(inventoryApi, /effectiveReserved[\s\S]*adjustedBaseReserved[\s\S]*additionalPendingQuantity/);
  assert.match(inventoryApi, /mergePurchasingLineOverrides/);
  assert.match(purchasing, /Pending Stock:/);
  assert.match(purchasing, /buildSupplierSummaryFromRecommended/);
});


test('purchase order screens use the purchasing report source of truth', () => {
  const inventoryApi = fs.readFileSync(path.join(root, 'src/lib/inventoryApi.js'), 'utf8');
  const generator = fs.readFileSync(path.join(root, 'src/PurchaseOrderGenerator.jsx'), 'utf8');
  const waitingOn = fs.readFileSync(path.join(root, 'src/WaitingOn.jsx'), 'utf8');
  const receivePo = fs.readFileSync(path.join(root, 'src/ReceivePurchaseOrder.jsx'), 'utf8');

  assert.match(inventoryApi, /getPurchaseOrderRecommendations[\s\S]*getPurchasingRecommendedOrders/);
  assert.doesNotMatch(inventoryApi, /phase1_get_purchase_recommendations/);
  assert.doesNotMatch(inventoryApi, /phase1_get_waiting_on_items/);
  assert.match(inventoryApi, /getOpenPurchaseOrderCoverageMap/);
  assert.match(inventoryApi, /reportRecommendedQuantity - openPoQuantity/);
  assert.match(generator, /Report Need/);
  assert.match(generator, /On Open PO/);
  assert.match(generator, /Still To Order/);
  assert.match(generator, /Covered by Open PO/);
  assert.match(waitingOn, /uncovered_quantity/);
  assert.match(receivePo, /!isPendingStockBin\(bin\)/);
});


test('physical Unassigned inventory clears stale Pending Stock demand', () => {
  const helper = fs.readFileSync(path.join(root, 'src/lib/pullSheetBinAssignmentApi.js'), 'utf8');
  const pullSheet = fs.readFileSync(path.join(root, 'src/PullSheetView.jsx'), 'utf8');
  const inventoryApi = fs.readFileSync(path.join(root, 'src/lib/inventoryApi.js'), 'utf8');

  assert.match(helper, /function isLegacyUnassignedBin/);
  assert.match(helper, /if \(officialBins\.length\)/);
  assert.doesNotMatch(
    helper.match(/export function isPendingStockBin[\s\S]*?\n\}/)?.[0] || '',
    /unassigned/
  );
  assert.match(helper, /saveJobItemSelectedBin/);
  assert.match(helper, /reassigned_to_physical_count/);
  assert.match(pullSheet, /changeSelectedBin/);
  assert.match(pullSheet, /Source bin saved\. Purchasing now uses this physical-bin assignment/);
  assert.match(pullSheet, /filter\(\(bin\) => !isPendingStockBin\(bin\)\)/);
  assert.match(inventoryApi, /representedJobItemIds/);
  assert.match(inventoryApi, /additionalPendingQuantity/);
  assert.match(inventoryApi, /adjustedBaseReserved/);
  assert.match(inventoryApi, /additionalPendingQuantity/);
  assert.match(inventoryApi, /additionalNonInventoryQuantity/);
});


test('graphical interface themes are display-only and fully wired', () => {
  const main = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8');
  const provider = fs.readFileSync(path.join(root, 'src/ui/ThemeProvider.jsx'), 'utf8');
  const settings = fs.readFileSync(path.join(root, 'src/ThemeSettings.jsx'), 'utf8');
  const presets = fs.readFileSync(path.join(root, 'src/themePresets.js'), 'utf8');
  const themeCss = fs.readFileSync(path.join(root, 'src/themes.css'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'src/components/AppShell.jsx'), 'utf8');

  assert.match(main, /import '\.\/themes\.css'/);
  assert.match(provider, /sc_display_preferences_v2/);
  assert.match(provider, /normalizeThemePreset/);
  assert.match(provider, /data-preset/);
  assert.match(provider, /data-density/);
  assert.match(provider, /data-motion/);
  assert.match(provider, /mode: 'system'/);
  assert.match(settings, /THEME_PRESETS\.map/);
  assert.match(settings, /preset\.traits\.map/);
  assert.match(settings, /preset\.visualStyle/);
  assert.match(settings, /Reset to Default/);
  assert.match(shell, /to="\/theme-settings"/);

  const presetIds = [
    'technical-blueprint',
    'futuristic-interface',
    'cyberpunk-neon',
    'formal-executive',
    'professional-enterprise',
    'industrial-command',
  ];

  presetIds.forEach((presetId) => {
    assert.match(presets, new RegExp(`id: '${presetId}'`));
    assert.match(themeCss, new RegExp(`data-preset='${presetId}'`));
  });

  assert.match(presets, /THEME_PRESET_ALIASES/);
  assert.match(themeCss, /clip-path/);
  assert.match(themeCss, /backdrop-filter/);
  assert.match(themeCss, /repeating-linear-gradient/);
  assert.match(themeCss, /font-family: Georgia/);
  assert.match(themeCss, /body::before/);
  assert.match(themeCss, /data-density='compact'/);
  assert.match(themeCss, /data-density='spacious'/);
  assert.match(themeCss, /data-motion='reduced'/);
  assert.match(themeCss, /@media print/);
});


test('non-inventory lines can be included in or excluded from purchasing', () => {
  const pullSheet = fs.readFileSync(path.join(root, 'src/PullSheetView.jsx'), 'utf8');
  const nonInventoryApi = fs.readFileSync(path.join(root, 'src/lib/nonInventoryApi.js'), 'utf8');
  const inventoryApi = fs.readFileSync(path.join(root, 'src/lib/inventoryApi.js'), 'utf8');
  const rules = fs.readFileSync(path.join(root, 'src/NonInventoryRules.jsx'), 'utf8');
  const migration = fs.readFileSync(
    path.join(root, 'deployment/sql/07_NON_INVENTORY_PURCHASING_TOGGLE.sql'),
    'utf8'
  );

  assert.match(pullSheet, /Include on Purchasing Report/);
  assert.match(pullSheet, /changePurchasingReportInclusion/);
  assert.match(pullSheet, /include_on_purchasing_report/);
  assert.match(nonInventoryApi, /sc_mark_job_item_non_inventory_v2/);
  assert.match(nonInventoryApi, /setJobItemPurchasingReportInclusion/);
  assert.match(nonInventoryApi, /sc_save_non_inventory_product_rule_v3/);
  assert.match(rules, /Include matching lines on the Purchasing Report/);
  assert.match(inventoryApi, /getNonInventoryPurchasingContext/);
  assert.match(inventoryApi, /excludedJobItemIds/);
  assert.match(inventoryApi, /additionalNonInventoryQuantity/);
  assert.match(inventoryApi, /excludedSourceQuantity/);
  assert.match(migration, /include_on_purchasing_report boolean/);
  assert.match(migration, /sc_apply_non_inventory_rules_to_job_v2/);
});


test('opening a pull sheet is database read-only', () => {
  const pullSheet = fs.readFileSync(
    path.join(root, 'src/PullSheetView.jsx'),
    'utf8'
  );

  const loadFunction =
    pullSheet.match(/async function load\(\)[\s\S]*?\n {2}\}/)?.[0] || '';

  assert.match(loadFunction, /fetchJobItemsDirect/);
  assert.match(loadFunction, /Viewing a pull sheet must be read-only/);
  assert.doesNotMatch(
    loadFunction,
    /assignOutOfStockJobItemsToPendingStock/
  );
  assert.doesNotMatch(loadFunction, /sc_pull_sheet_items/);
  assert.doesNotMatch(loadFunction, /sc_pull_sheet_items_catalog_v1/);
  assert.doesNotMatch(loadFunction, /sc_pull_sheet_ordered_blank_pairings/);
  assert.doesNotMatch(loadFunction, /\.update\(/);
  assert.doesNotMatch(loadFunction, /\.insert\(/);
});


test('pull sheets hide cancelled historical duplicate rows', () => {
  const pullSheet = fs.readFileSync(
    path.join(root, 'src/PullSheetView.jsx'),
    'utf8'
  );
  const repairSql = fs.readFileSync(
    path.join(root, 'deployment/sql/12_PULL_SHEET_170_SAFE_DUPLICATE_REPAIR.sql'),
    'utf8'
  );

  assert.match(
    pullSheet,
    /!\S*\/\(cancel\|void\|deleted\)\/i\.test/
  );
  assert.match(repairSql, /expected 265 saved job items/i);
  assert.match(repairSql, /expected 212 orphaned copies/i);
  assert.match(repairSql, /sc_backup_job170_orphan_job_items_20260729/);
  assert.match(repairSql, /duplicate_manual_order_sync_orphan/);
  assert.match(repairSql, /ux_job_items_active_manual_order_line/);
  assert.doesNotMatch(repairSql, /delete\s+from\s+public\.job_items/i);
});


test('pull-sheet completion is idempotent and uses the safe RPC', () => {
  const pullSheet = fs.readFileSync(
    path.join(root, 'src/PullSheetView.jsx'),
    'utf8'
  );
  const completionApi = fs.readFileSync(
    path.join(root, 'src/lib/pullSheetCompletionApi.js'),
    'utf8'
  );
  const repairSql = fs.readFileSync(
    path.join(
      root,
      'deployment/sql/16_PULL_SHEET_COMPLETION_IDEMPOTENCY_AND_165_REPAIR.sql'
    ),
    'utf8'
  );

  assert.match(pullSheet, /completePullSheetItemDeductBlankSafe/);
  assert.doesNotMatch(
    pullSheet,
    /supabase\.rpc\('complete_job_item'/
  );
  assert.match(
    pullSheet,
    /No additional inventory was deducted/
  );
  assert.match(
    completionApi,
    /sc_complete_pull_sheet_item_deduct_blank_safe/
  );
  assert.match(
    repairSql,
    /ux_blank_inventory_movements_pullsheet_completion_job_item/
  );
  assert.match(
    repairSql,
    /movement 960 -> job item 215 -> job 165/i
  );
  assert.match(
    repairSql,
    /Repair line 215 WITHOUT creating another inventory movement/
  );
});


test('inventory overview searches every product SKU, name, and description', () => {
  const inventoryPage = fs.readFileSync(
    path.join(root, 'src/BlankInventory.jsx'),
    'utf8'
  );
  const inventoryApi = fs.readFileSync(
    path.join(root, 'src/lib/inventoryApi.js'),
    'utf8'
  );

  assert.match(inventoryPage, /Search every blank SKU, linked Woo SKU/);
  assert.match(inventoryPage, /Search any SKU, name, description/);
  assert.match(inventoryPage, /inventory-description-cell/);
  assert.doesNotMatch(inventoryPage, /Include linked Woo SKUs in search/);
  assert.match(inventoryApi, /fetchAllRelationRows/);
  assert.match(inventoryApi, /\.range\(/);
  assert.match(inventoryApi, /inventoryRecordMatchesAllTokens/);
  assert.match(inventoryApi, /INVENTORY_SEARCHABLE_KEY/);
  assert.match(inventoryApi, /short_description/);
  assert.match(inventoryApi, /post_content/);
  assert.match(inventoryApi, /fetchRelationRowsForSearch\('products'/);
  assert.match(inventoryApi, /fetchRelationRowsForSearch\(\s*'finished_products'/);
  assert.doesNotMatch(
    inventoryApi,
    /includeLinkedWooSkus\s*\?\s*inventoryCatalogCoreSearchParts/
  );
});
