import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }

test('shared ActionButton keeps action status beside the initiating button', () => {
  const source = read('src/components/UIPrimitives.jsx');
  assert.match(source, /sc-action-status-wrap/);
  assert.match(source, /Working…/);
  assert.match(source, /Completed/);
  assert.match(source, /progress/);
});

test('supplier receiving preserves completion message while refreshing duplicate order state', () => {
  const source = read('src/SupplierConfirmationReceiving.jsx');
  assert.match(source, /completionMessage/);
  assert.match(source, /parseFile\(\{ showResultMessage: false, manageBusy: false \}\)/);
  assert.match(source, /receiveProgress/);
});

test('blank override search shows physical inventory quantity', () => {
  const source = read('src/PullSheetView.jsx');
  assert.match(source, /bin_blank_inventory_contents/);
  assert.match(source, /inventory_quantity/);
  assert.match(source, /Inventory:/);
});

test('risk dashboard excludes completed and closed jobs', () => {
  const source = read('src/lib/inventoryApi.js');
  assert.match(source, /\\['closed', 'completed'\\]/);
});

test('application guide is routed and navigable', () => {
  assert.ok(fs.existsSync('src/ApplicationGuide.jsx'));
  assert.match(read('src/App.jsx'), /application-guide/);
  assert.match(read('src/navigationConfig.js'), /Application Guide/);
});
