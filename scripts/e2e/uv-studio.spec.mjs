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
