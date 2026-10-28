import assert from 'node:assert/strict';
import test from 'node:test';
import {
  purchasingSourceOrderLabel,
  purchasingSourcePairingState,
  purchasingReservedShortage,
} from '../../src/lib/purchasingReportDisplay.js';

test('manual invoices are identified instead of incorrectly reported as unrecorded', () => {
  assert.equal(purchasingSourceOrderLabel({
    order_label: 'Order not recorded',
    job_name: 'Manual Invoice CO-1007',
    manual_order_id: '51',
  }), 'Manual Invoice CO-1007');
  assert.equal(purchasingSourceOrderLabel({ invoice_number: 'CO-1008' }), 'Invoice CO-1008');
  assert.equal(purchasingSourceOrderLabel({
    order_number: '16155',
  }), 'Order #16155');
  assert.equal(purchasingSourceOrderLabel({}), 'Order reference unavailable');
});

test('correct blank IDs show paired even while a genuine shortage remains', () => {
  const row = {
    blank_product_id: '585ca84a-faf1-470d-944c-193cbaf8f0da',
    quantity_on_hand: 10,
    reserved_quantity: 11,
  };
  const source = {
    job_item_id: 1385,
    current_blank_product_id: row.blank_product_id,
    pairing_warning: null,
  };
  assert.equal(purchasingSourcePairingState(row, source), 'paired');
  assert.equal(purchasingReservedShortage(row), 1);
  assert.equal(purchasingReservedShortage({ quantity_on_hand: 12, reserved_quantity: 11 }), 0);
});

test('missing, mismatched or warned pairings require review without changing demand', () => {
  const row = { blank_product_id: 'blank-one' };
  assert.equal(purchasingSourcePairingState(row, { job_item_id: 1, current_blank_product_id: 'blank-two' }), 'needs_review');
  assert.equal(purchasingSourcePairingState(row, { job_item_id: 1, current_blank_product_id: 'blank-one', pairing_warning: 'Review' }), 'needs_review');
  assert.equal(purchasingSourcePairingState(row, { job_item_id: 1 }), 'unverified');
  assert.equal(purchasingSourcePairingState(row, {}), 'unavailable');
});
