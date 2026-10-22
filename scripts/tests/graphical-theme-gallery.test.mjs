import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  THEME_PRESETS,
  normalizeThemePreset,
} from '../../src/themePresets.js';
import {
  normalizeHiddenThemeIds,
  getVisibleThemePresets,
  toggleHiddenThemeId,
  THEME_GALLERY_STORAGE_KEY,
} from '../../src/themeGalleryPreferences.js';

const graphicalIds = [
  'ecom-canvas',
  'aurora-command',
  'prism-ledger',
  'workflow-gallery',
];

test('new dashboard families have unique preview and structural metadata', () => {
  for (const id of graphicalIds) {
    const preset = THEME_PRESETS.find((entry) => entry.id === id);
    assert.ok(preset, `Missing new theme: ${id}`);
    assert.equal(normalizeThemePreset(id), id);
    assert.ok(preset.layout && preset.visualStyle && preset.traits.length > 2);
    assert.ok(new Set(Object.values(preset.preview)).size >= 5);
  }
  assert.equal(new Set(THEME_PRESETS.map((entry) => entry.id)).size, THEME_PRESETS.length);
  assert.equal(normalizeThemePreset('operations-blue'), 'professional-enterprise');
});

test('gallery curation hides old themes without deleting presets or hiding active', () => {
  const originalCount = THEME_PRESETS.length;
  const activeId = 'ecom-canvas';
  const hidden = toggleHiddenThemeId([], 'technical-blueprint', THEME_PRESETS, activeId);
  assert.deepEqual(hidden, ['technical-blueprint']);
  const filtered = getVisibleThemePresets(THEME_PRESETS, hidden, activeId);
  assert.ok(filtered.some((preset) => preset.id === activeId));
  assert.ok(!filtered.some((preset) => preset.id === 'technical-blueprint'));
  assert.equal(THEME_PRESETS.length, originalCount);
  assert.deepEqual(toggleHiddenThemeId(hidden, 'technical-blueprint', THEME_PRESETS, activeId), []);
  assert.deepEqual(toggleHiddenThemeId(hidden, activeId, THEME_PRESETS, activeId), hidden);
  assert.ok(getVisibleThemePresets(THEME_PRESETS, [activeId], activeId).some((preset) => preset.id === activeId));
});

test('bad localStorage values do not disable themes or inject unknown presets', () => {
  assert.deepEqual(normalizeHiddenThemeIds(null, THEME_PRESETS), []);
  assert.deepEqual(normalizeHiddenThemeIds({ bogus: true }, THEME_PRESETS), []);
  assert.deepEqual(normalizeHiddenThemeIds(['unknown', 42, 'prism-ledger', 'prism-ledger'], THEME_PRESETS), ['prism-ledger']);
  assert.ok(THEME_GALLERY_STORAGE_KEY.startsWith('sc_hidden_theme_'));
});

test('graphical CSS changes page composition, includes responsive safeguards', () => {
  const css = readFileSync(new URL('../../src/graphicalDashboardThemes.css', import.meta.url), 'utf8');
  for (const id of graphicalIds) {
    assert.match(css, new RegExp(`data-preset='${id}'`));
    assert.match(css, new RegExp(`data-preset='${id}'[\\s\\S]*?\\.sc-sidebar`));
    assert.match(css, new RegExp(`data-preset='${id}'[\\s\\S]*?\\.sc-topbar`));
  }
  for (const style of ['ecom', 'aurora', 'ledger', 'workflow']) {
    assert.ok(css.includes(`sc-theme-choice__preview--${style}`));
  }
  assert.ok(css.includes('@media (max-width: 1024px)'));
  assert.ok(css.includes('html[data-motion=\'reduced\']'));
  const entry = readFileSync(new URL('../../src/main.jsx', import.meta.url), 'utf8');
  assert.ok(entry.indexOf("import './graphicalDashboardThemes.css'") > entry.indexOf("import './themes.css'"));
});

test('theme gallery offers explicit hide, restore and active-theme protection', () => {
  const source = readFileSync(new URL('../../src/ThemeSettings.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('getVisibleThemePresets('));
  assert.ok(source.includes('disabled={active}'));
  assert.ok(source.includes('Restore All Themes'));
  assert.ok(source.includes('window.localStorage.setItem(THEME_GALLERY_STORAGE_KEY'));
  assert.ok(source.includes('this browser only'));
});
