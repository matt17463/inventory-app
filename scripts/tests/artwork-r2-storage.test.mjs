import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bridge = fs.readFileSync(path.join(root, 'netlify/functions/artwork-r2-storage.js'), 'utf8');

test('Artwork R2 bridge is fail-closed and uses existing private R2 configuration', () => {
  assert.match(bridge, /SC_ARTWORK_R2_SECRET/);
  assert.match(bridge, /SC_ARTWORK_WEBHOOK_SECRET/);
  assert.match(bridge, /Invalid artwork R2 bridge secret/);
  assert.match(bridge, /r2Configured\(\)/);
  assert.match(bridge, /R2_BUCKET_NAME|r2BucketName\(\)/);
});

test('Artwork R2 bridge signs direct uploads instead of proxying file bodies through Netlify', () => {
  assert.match(bridge, /presignedR2Put/);
  assert.match(bridge, /upload_url/);
  assert.match(bridge, /artwork-system\//);
  assert.match(bridge, /52_428_800/);
  assert.doesNotMatch(bridge, /Buffer\.from\(event\.body/);
});

test('Artwork R2 bridge verifies objects and generates short-lived private downloads', () => {
  assert.match(bridge, /HeadObjectCommand/);
  assert.match(bridge, /expected_size/);
  assert.match(bridge, /GetObjectCommand/);
  assert.match(bridge, /expires_in/);
  assert.match(bridge, /ResponseContentDisposition: 'inline'/);
});

test('Artwork R2 deletion is constrained to Artwork System keys', () => {
  assert.match(bridge, /startsWith\('artwork-system\/'\)/);
  assert.match(bridge, /Refusing to delete a non-Artwork-System R2 object/);
});
