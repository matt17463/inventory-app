import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page = fs.readFileSync(path.join(root, 'src/ArtworkRequests.jsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/artworkSystemApi.js'), 'utf8');
const fn = fs.readFileSync(path.join(root, 'netlify/functions/artwork-request-file-download.js'), 'utf8');

test('Artwork Requests exposes a Download Original action for request mockups', () => {
  assert.match(page, /Download Original/);
  assert.match(page, /downloadArtworkRequestMockup/);
  assert.match(page, /Preparing Download/);
});

test('Artwork Request download API calls an employee-authenticated Netlify function', () => {
  assert.match(api, /authenticatedFunctionFetch/);
  assert.match(api, /artwork-request-file-download/);
  assert.match(api, /request_id/);
  assert.match(api, /mockup_index/);
});

test('Artwork Request download function verifies employee access and database attachment', () => {
  assert.match(fn, /authorizeEmployee/);
  assert.match(fn, /sc_artwork_system_requests/);
  assert.match(fn, /mockups/);
  assert.match(fn, /mockup_index/);
});

test('Artwork Request R2 downloads are short lived and forced as attachments', () => {
  assert.match(fn, /GetObjectCommand/);
  assert.match(fn, /HeadObjectCommand/);
  assert.match(fn, /ResponseContentDisposition/);
  assert.match(fn, /attachment; filename=/);
  assert.match(fn, /expiresIn: 300/);
  assert.match(fn, /startsWith\('artwork-system\/\'\)/);
});

test('Legacy artwork mockups retain a file_url fallback', () => {
  assert.match(fn, /mockup\.file_url/);
  assert.match(fn, /provider: 'legacy'/);
});
