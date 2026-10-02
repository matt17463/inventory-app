import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const home = fs.readFileSync(path.join(root, 'src', 'Home.jsx'), 'utf8');
const handoff = fs.readFileSync(path.join(root, 'netlify', 'functions', 'artwork-system-handoff.js'), 'utf8');

test('home surfaces recent Artwork System handoffs as notifications', () => {
  assert.match(home, /sc_artwork_system_handoffs/);
  assert.match(home, /Artwork Notifications/);
  assert.match(home, /sc-artwork-activity-seen-at/);
  assert.match(home, /Open Artwork Queue/);
});

test('artwork handoff endpoint preserves event type for homepage activity', () => {
  assert.match(handoff, /event_type:\s*eventType/);
  assert.match(handoff, /sc_artwork_system_handoffs/);
});
