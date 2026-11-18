import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../../' + name, import.meta.url), 'utf8');

test('all three artwork studios expose a pop-out proof control', () => {
  const dtf = read('src/DTFPrepStudio.jsx');
  const mockup = read('src/MockupStudio.jsx');
  const uv = read('public/uv-studio/index.html');
  assert.match(dtf, /<ArtworkPopoutPreview targetRef={proofPopoutRef}/);
  assert.match(dtf, /ref={proofPopoutRef} className=/);
  assert.match(mockup, /<ArtworkPopoutPreview targetRef={placementPopoutRef}/);
  assert.match(mockup, /ref={placementPopoutRef}/);
  assert.match(uv, /id="popoutPreview"/);
  assert.match(uv, /function syncPopoutPreview\(\)/);
  assert.match(uv, /syncPopoutPreview\(\);\}/);
});

test('popout uses read-only DOM replication and local browser window', () => {
  const popup = read('src/components/ArtworkPopoutPreview.jsx');
  assert.match(popup, /target\.cloneNode\(true\)/);
  assert.match(popup, /MutationObserver\(schedule\)/);
  assert.match(popup, /button,input,select,textarea,a/);
  assert.match(popup, /window\.open\('', '',/);
  assert.doesNotMatch(popup, /fetch\(|localStorage|sessionStorage|postMessage/);
  assert.match(popup, /popup\.close\(\)/);
});

test('responsive sticky layout provides desktop docking and mobile fallback', () => {
  const dtf = read('src/DTFPrepStudio.css');
  const mockup = read('src/MockupStudio.css');
  const uv = read('public/uv-studio/index.html');
  assert.match(dtf, /\.dtf-viewer \{ grid-column: 2; grid-row: 1; position: sticky/);
  assert.match(mockup, /\.mockup-editor-layout>\.mockup-placement-preview-dock\{position:sticky/);
  assert.match(uv, /\.middle\{grid-column:3;grid-row:1;position:sticky/);
  assert.match(uv, /@media\(max-width:760px\)/);
});
