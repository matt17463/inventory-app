import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Mockup Studio exposes a non-destructive Download Project Graphics panel', async () => {
  const studio = await read('src/MockupStudio.jsx');
  assert.match(studio, /function DownloadGraphicsPanel/);
  assert.match(studio, /Download project graphics/);
  assert.match(studio, /Download Project Graphics \(\{selectedCount\}\)/);
  assert.match(studio, /Unlike Local Image Archive, this never deletes files from R2 or Supabase/);
  assert.match(studio, /Blank photos/);
  assert.match(studio, /Original artwork/);
  assert.match(studio, /Prepared artwork/);
  assert.match(studio, /Generated mockups/);
  assert.match(studio, /Production files/);
  assert.match(studio, /Preview derivatives/);
});

test('bulk graphics download uses existing authenticated cloud-file downloader and verifies local copies', async () => {
  const local = await read('src/lib/mockupLocalArchive.js');
  assert.match(local, /export async function createLocalMockupGraphicExport/);
  assert.match(local, /downloadMockupStoredFile\(reference\)/);
  assert.match(local, /showDirectoryPicker/);
  assert.match(local, /savedFile\.size !== blob\.size/);
  assert.match(local, /await sha256\(savedFile\) !== checksum/);
  assert.match(local, /cloud_files_changed: false/);
  assert.match(local, /mockup-graphics-download-manifest\.json/);
});

test('download export organizes primary files and optional previews into named folders', async () => {
  const local = await read('src/lib/mockupLocalArchive.js');
  assert.match(local, /folder: 'Blank Photos'/);
  assert.match(local, /folder: 'Artwork\/Originals'/);
  assert.match(local, /folder: 'Artwork\/Prepared'/);
  assert.match(local, /folder: 'Mockups'/);
  assert.match(local, /folder: 'Production'/);
  assert.match(local, /'Previews\/Mockups'/);
  assert.match(local, /external-references-not-downloaded\.json/);
});

test('bulk graphics download does not invoke archive cleanup or cloud deletion', async () => {
  const local = await read('src/lib/mockupLocalArchive.js');
  const start = local.indexOf('export async function createLocalMockupGraphicExport');
  const end = local.indexOf('export async function createLocalMockupArchive', start);
  assert.ok(start >= 0 && end > start);
  const block = local.slice(start, end);
  assert.doesNotMatch(block, /deleteStoredReference|continueMockupLocalArchive|beginMockupLocalArchive|remove\(/);
  assert.match(block, /Cloud storage was not changed/);
});

test('download-all feature is wired into the full application test suite', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  assert.equal(packageJson.version, '1.4.21');
  assert.equal(packageJson.scripts['test:mockup-downloads'], 'node --test scripts/tests/mockup-download-all.test.mjs');
  assert.match(packageJson.scripts.test, /npm run test:mockup-downloads/);
});
