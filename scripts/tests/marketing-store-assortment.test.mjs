import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMarketingAssortment } from '../../src/lib/marketingStoreAssortment.js';

const tables = {
  sc_growth_accounts: [{ id: 'account-a', customer_id: 'a' }],
  mockup_projects: [{ id: 'a-project', customer_id_text: 'a', woo_product_id: 22 }, { id: 'b-project', customer_id_text: 'b', woo_product_id: 22 }],
  sc_team_store_workflows: [{ id: 'store', mockup_project_id_text: 'a-project', stage: 'live' }],
  sc_team_store_products: [{ id: 'product', campaign_id: 'store', woo_product_id: 22, product_name: 'Tee', display_price: 20, currency: 'USD' }],
  mockup_outputs: [
    { id: 'blue', project_id: 'a-project', is_selected: true, approval_status: 'customer_approved', metadata: { blank_asset_id: 'blank-blue' } },
    { id: 'red', project_id: 'b-project', is_selected: true, approval_status: 'customer_approved', metadata: { blank_asset_id: 'blank-red' } },
    { id: 'pending', project_id: 'a-project', is_selected: true, approval_status: 'pending', metadata: { blank_asset_id: 'blank-red' } },
  ],
  mockup_blank_assets: [
    { id: 'blank-blue', project_id: 'a-project', product_type: 'Apparel', product_color: 'Blue', metadata: { catalog_size: 'S', catalog_sku_base: 'TEE' } },
    { id: 'blank-red', project_id: 'b-project', product_type: 'Apparel', product_color: 'Red' },
  ],
};

function database(data = tables) {
  return { from(table) {
    let rows = data[table];
    return {
      select() { return this; },
      eq(key, value) { rows = rows.filter(row => row[key] === value); return this; },
      in(key, values) { rows = rows.filter(row => values.includes(row[key])); return this; },
      order() { return this; },
      range(start, end) { return { data: rows.slice(start, end + 1) }; },
      single() { return { data: rows[0] }; },
      maybeSingle() { return { data: rows[0] }; },
    };
  } };
}

test('imports only the selected store and approved mockups for the linked customer', async () => {
  const [product] = await loadMarketingAssortment(database(), 'account-a');
  assert.deepEqual(product.images, [{ color: 'Blue', assetId: 'blue' }]);
  assert.equal(product.sizes, 'S');
  assert.equal(product.retailPrice, 20);
});

test('fails closed for a selected product without a matching customer project or customer price', async () => {
  const [product] = tables.sc_team_store_products;
  await assert.rejects(loadMarketingAssortment(database({ ...tables, sc_team_store_products: [{ ...product, woo_product_id: 30 }] }), 'account-a'), /no matching Mockup Studio project/);
  await assert.rejects(loadMarketingAssortment(database({ ...tables, sc_team_store_products: [{ ...product, display_price: null }] }), 'account-a'), /selling price/);
});
