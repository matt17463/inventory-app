import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const guideSource = fs.readFileSync(new URL('../../src/application-guide/guideData.js', import.meta.url), 'utf8');
const guidePageSource = fs.readFileSync(new URL('../../src/ApplicationGuide.jsx', import.meta.url), 'utf8');
const navSource = fs.readFileSync(new URL('../../src/navigationConfig.js', import.meta.url), 'utf8');

test('application guide is exhaustive, searchable, scenario-based, and references current navigation', () => {
  assert.match(guidePageSource, /Search the guide/);
  assert.match(guidePageSource, /Complete Application Screen Reference/);
  assert.match(guidePageSource, /navSections/);
  assert.match(guidePageSource, /Skilled Crafting scenario/);

  const requiredTopics = [
    'Inventory Overview',
    'Add Item to Bin',
    'Supplier Confirmation Receiving',
    'New Product Line Setup',
    'Pull Sheets',
    'Reservations',
    'Pending Stock',
    'Purchasing Report',
    'Purchase Orders',
    'On-site Sales',
    'Mockup Studio Projects',
    'Cloudflare R2 Storage',
    'WooCommerce Sync',
    'Product-to-Blank Mappings',
    'Bulk Pairing Repair',
    'Non-Inventory Rules',
    'SC Product Options',
    'Skilled Crafting WooCommerce Documents Plugin',
    'WooCommerce ↔ Supabase Sync Plugin',
    'Artwork System Plugin',
    'Deployment Health',
    'Asset Storage Health',
    'Business Playbooks',
  ];

  for (const topic of requiredTopics) {
    assert.ok(
      guideSource.includes(topic),
      `Expected guide content to include: ${topic}`
    );
  }

  const scenarioCount = (guideSource.match(/scenario:/g) || []).length;
  assert.ok(scenarioCount >= 25, `Expected at least 25 business scenarios, found ${scenarioCount}`);

  const navLabels = [
    'Daily Command Center',
    'Inventory Overview',
    'Pull Sheets',
    'Purchasing Report',
    'Mockup Studio',
    'Product-to-Blank Mappings',
    'Application Guide',
    'Deployment Health',
  ];

  for (const label of navLabels) {
    assert.ok(navSource.includes(label), `Expected navigation to contain ${label}`);
  }
});
