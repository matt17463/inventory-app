import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panels = {
  'DTFPrepStudio.jsx': ['outputWidth','outputHeight','backgroundMethod','finalAlpha','halftoneStyle'],
  'MaterialSettings.jsx': ['Evidence classification','Outcome','Measurements (JSON with units)'],
  'EquipmentCenter.jsx': ['Home Assistant HTTPS address'],
  'ManufacturingRecipes.jsx': ['Approved material/machine settings'],
  'Purchasing.jsx': ['Correct blank product'],
  'ClientOrders.jsx': ['Sell price each'],
  'ArtworkRequests.jsx': ['Inventory App Status'],
  'MarketingProgramDesigner.jsx': ['Flyer headline'],
  'StorefrontDesigner.jsx': ['Assigned Woo category ID'],
  'LocalAiConnectionSettings.jsx': ['Tailscale HTTPS endpoint'],
};

for (const [panel, fields] of Object.entries(panels)) {
  test(`${panel} retains help on its audited fields`, () => {
    const source = readFileSync(new URL(`../../src/${panel}`, import.meta.url), 'utf8');
    assert.match(source, /import SettingHelp/);
    for (const field of fields) {
      if (panel === 'DTFPrepStudio.jsx') {
        assert.ok(source.includes(`  ${field}: '`), `Missing description for ${field}`);
        assert.ok(source.includes(`,'${field}')`), `Missing field mapping for ${field}`);
      } else {
        assert.ok(source.includes(`<SettingHelp label="${field}">`), `Missing help for ${field}`);
      }
    }
  });
}
