/* global window -- used in Playwright page.evaluate callbacks */
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const documentURL = 'http://uv-studio.test/';
const artwork = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path fill="#117766" fill-rule="evenodd" d="M12 12H88V88H12Z M35 35H65V65H35Z"/></svg>',
);

async function openStudio(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(documentURL, route => route.fulfill({
    path: 'public/uv-studio/index.html',
    contentType: 'text/html',
  }));
  await page.goto(documentURL);
  await expect(page.locator('#status')).toContainText(/ready|preview/i);
  return errors;
}

async function readDownload(page, target) {
  const download = page.waitForEvent('download');
  await page.locator(target).click();
  return readFile(await (await download).path());
}

function zipEntries(bytes) {
  const entries = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    expect(bytes.readUInt16LE(offset + 8)).toBe(0);
    const size = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const start = offset + 30 + nameLength + bytes.readUInt16LE(offset + 28);
    entries.set(bytes.toString('utf8', offset + 30, offset + 30 + nameLength), bytes.subarray(start, start + size));
    offset = start + size;
  }
  return entries;
}

test('graphics contour, saved project and operator ZIP', async ({ page }) => {
  const errors = await openStudio(page);
  await page.locator('#file').setInputFiles({ name: 'fixture.svg', mimeType: 'image/svg+xml', buffer: artwork });
  await expect(page.locator('#job')).toHaveValue('fixture');
  await page.locator('#width').fill('1');
  await page.locator('#height').fill('1');
  await page.locator('#edgeStyle').selectOption('none');
  await expect(page.locator('#contourControls')).toBeVisible();
  await page.locator('#contourIslandArea').fill('1');
  await page.locator('#contourHoleArea').fill('2');
  await page.locator('#quantity').fill('1');

  const saved = await readDownload(page, '#save');
  expect(JSON.parse(saved.toString()).settings).toMatchObject({ edgeStyle: 'none', contourIslandArea: 1, contourHoleArea: 2 });
  await page.locator('#edgeStyle').selectOption('merrow');
  await page.locator('#projectInput').setInputFiles({ name: 'saved.json', mimeType: 'application/json', buffer: saved });
  await expect(page.locator('#edgeStyle')).toHaveValue('none');
  await expect(page.locator('#contourHoleArea')).toHaveValue('2');

  const entries = zipEntries(await readDownload(page, '#all'));
  for (const name of ['color-artwork.png','white-underbase.png','varnish-highlights.png','height-map-grayscale.png']) {
    const png = entries.get(name);
    expect(png?.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([300, 300]);
  }
  expect(entries.get('XTOOL-STUDIO-PRINT-GUIDE.txt')?.toString()).toContain('SEPARATE DESIGN REFERENCES');
  expect(entries.get('cutting/individual-patch-outline.svg')?.toString()).toContain('Artwork silhouette');
  expect(entries.has('batch/remainder-cutlines.svg')).toBe(true);
  expect(errors).toEqual([]);
});

test('keyboard help has an accessible description', async ({ page }) => {
  const errors = await openStudio(page);
  const help = page.getByRole('button', { name: 'Help: Patch perimeter' });
  await help.focus();
  await expect(help).toBeFocused();
  await expect(help).toHaveAccessibleDescription(/artwork/i);
  await expect(page.locator('#sc-tip-edgeStyle')).toBeVisible();
  expect(errors).toEqual([]);
});

test('embedded cloud pack carries print guidance and the cleanup manifest', async ({ page }) => {
  const errors = await openStudio(page);
  await page.locator('#file').setInputFiles({ name: 'fixture.svg', mimeType: 'image/svg+xml', buffer: artwork });
  await expect(page.locator('#job')).toHaveValue('fixture');
  await page.locator('#width').fill('1');
  await page.locator('#height').fill('1');
  await page.locator('#edgeStyle').selectOption('none');
  await page.locator('#contourIslandArea').fill('1');
  const result = await page.evaluate(() => new Promise(resolve => {
    const requestId = 'cloud-pack-fixture';
    function receive({ data }) {
      if (data.requestId !== requestId || !data.type.startsWith('SC_UV_EXPORT_') || data.type === 'SC_UV_EXPORT_PACK') return;
      window.removeEventListener('message', receive);
      resolve(data.buffer ? Array.from(new Uint8Array(data.buffer)) : data.message);
    }
    window.addEventListener('message', receive);
    window.postMessage({ type: 'SC_UV_EXPORT_PACK', requestId }, window.location.origin);
  }));
  expect(Array.isArray(result), String(result).slice(0, 120)).toBe(true);
  const entries = zipEntries(Buffer.from(result));
  expect(entries.has('XTOOL-STUDIO-PRINT-GUIDE.txt')).toBe(true);
  const manifest = JSON.parse(entries.get('manifest.json').toString());
  expect(manifest.patch).toMatchObject({ suppress_islands_below_mm2: 1 });
  expect(errors).toEqual([]);
});

test.describe('touch settings help', () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
  test('tap opens and dismisses help', async ({ page }) => {
    await openStudio(page);
    const help = page.getByRole('button', { name: 'Help: Patch perimeter' });
    await help.tap();
    await expect(help).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#sc-tip-edgeStyle')).toBeVisible();
    await help.tap();
    await expect(help).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#sc-tip-edgeStyle')).toBeHidden();
  });
});

test('maximum-size artwork exports at 300 DPI with a batch proof', async ({ page }) => {
  test.setTimeout(90000);
  const errors = await openStudio(page);
  await page.locator('#file').setInputFiles({ name: 'fixture.svg', mimeType: 'image/svg+xml', buffer: artwork });
  await expect(page.locator('#job')).toHaveValue('fixture');
  await page.locator('#width').fill('6');
  await page.locator('#height').fill('6');
  await page.locator('#edgeStyle').selectOption('none');
  await page.locator('#quantity').fill('1');
  const start = performance.now();
  const entries = zipEntries(await readDownload(page, '#all'));
  const elapsed = Math.round(performance.now() - start);
  const png = entries.get('color-artwork.png');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1800, 1800]);
  expect([...entries.keys()].some(name => name.startsWith('batch/') && name.endsWith('-proof.png'))).toBe(true);
  expect(errors).toEqual([]);
  console.log(`6×6 inch export at 300 DPI (Chromium): ${elapsed} ms`);
});

test('live proof stays docked and synchronizes into the read-only pop-out window', async ({ page }) => {
  const errors = await openStudio(page);
  await page.locator('#file').setInputFiles({ name: 'fixture.svg', mimeType: 'image/svg+xml', buffer: artwork });
  await expect(page.locator('#status')).toContainText('Preview ready');
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#popoutPreview').click();
  const popup = await popupPromise;
  await expect(popup.locator('header')).toContainText('Live, read-only preview');
  await expect(popup.locator('#sc-popout-canvas')).toBeVisible();
  await page.locator('[data-tab="height"]').click();
  await expect.poll(async () => popup.locator('#sc-popout-caption').textContent()).toContain('height');
  await expect(popup.locator('input,select,textarea')).toHaveCount(0);
  await popup.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('#popoutPreview')).toBeVisible();
  expect(errors).toEqual([]);
});

test('geometric octagon and independent physical artwork width persist without resizing patch', async ({ page }) => {
  const errors = await openStudio(page);
  await page.locator('#file').setInputFiles({ name: 'fixture.svg', mimeType: 'image/svg+xml', buffer: artwork });
  await page.locator('#edgeStyle').selectOption('merrow');
  await page.locator('#width').fill('3.5');
  await page.locator('#height').fill('2.5');
  await page.locator('#patchShape').selectOption('octagon');
  await page.locator('#artworkWidth').fill('1.25');
  await page.locator('#artworkX').fill('10');
  await page.locator('#artworkY').fill('-5');
  await expect(page.locator('#artworkDimensions')).toContainText('Artwork: 1.25 × 1.25 in');
  await expect(page.locator('#width')).toHaveValue('3.5');
  await expect(page.locator('#height')).toHaveValue('2.5');
  const octagon = await readDownload(page, '#outlineSvg');
  expect(octagon.toString()).toContain('Geometric patch perimeter');
  expect(octagon.toString()).toMatch(/L[\d.]+ [\d.]+/);
  await page.locator('#patchShape').selectOption('circle');
  const circle = await readDownload(page, '#outlineSvg');
  expect(circle.toString()).toMatch(/ A [\d.]+ [\d.]+ 0 1 0 /);
  expect(circle.toString()).not.toEqual(octagon.toString());
  await page.locator('#patchShape').selectOption('octagon');
  await page.locator('#width').fill('4');
  await expect(page.locator('#artworkDimensions')).toContainText('Artwork: 1.25 × 1.25 in');
  const saved = await readDownload(page, '#save');
  expect(JSON.parse(saved.toString()).settings).toMatchObject({
    width: 4, height: 2.5, edgeStyle: 'merrow', patchShape: 'octagon',
    artworkWidth: 1.25, artworkX: 10, artworkY: -5,
  });
  await page.locator('#artworkWidth').fill('0');
  await page.locator('#projectInput').setInputFiles({ name: 'saved.json', mimeType: 'application/json', buffer: saved });
  await expect(page.locator('#artworkWidth')).toHaveValue('1.25');
  await expect(page.locator('#artworkX')).toHaveValue('10');
  await expect(page.locator('#artworkY')).toHaveValue('-5');
  expect(errors).toEqual([]);
});
