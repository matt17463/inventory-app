import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEME_PRESETS, normalizeThemePreset } from '../../src/themePresets.js';

test('Earthly theme is selectable and has complete preview tokens', () => {
  const preset = THEME_PRESETS.find((item) => item.id === 'earthly-neon');
  assert.ok(preset);
  assert.equal(normalizeThemePreset('earthly-neon'), 'earthly-neon');
  assert.equal(preset.preview.background, '#0a0e1a');
  assert.equal(preset.preview.primary, '#00d4ff');
  assert.equal(preset.preview.accent, '#00ff88');
});

test('Earthly theme has scoped styling and selects dark mode', () => {
  const css = readFileSync('src/graphicalDashboardThemes.css', 'utf8');
  const provider = readFileSync('src/ui/ThemeProvider.jsx', 'utf8');
  assert.ok(css.includes("html[data-preset='earthly-neon']"));
  assert.match(css, /prefers-reduced-motion/);
  assert.match(provider, /preset === 'earthly-neon'/);
});
