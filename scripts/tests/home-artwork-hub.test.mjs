import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isOpenJob, isOpenClientOrder, isOpenCalendarItem } from '../../src/lib/openWorkStatus.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('completed, fulfilled, voided and production-complete jobs leave the pending calendar', () => {
  for (const status of ['completed', 'COMPLETE', 'closed', 'voided', 'canceled', 'fulfilled']) {
    assert.equal(isOpenJob({ status }), false, status);
  }
  assert.equal(isOpenJob({ status: 'reserved', production_status: 'production_complete' }), false);
  assert.equal(isOpenJob({ status: 'queued', production_completed_at: '2026-10-31T12:00:00Z' }), false);
  assert.equal(isOpenJob({ status: 'new', woo_status: 'completed' }), false);
  assert.equal(isOpenJob({ status: 'new' }), true);
  assert.equal(isOpenJob({ status: 'reserved' }), true);
  assert.equal(isOpenCalendarItem({ status: 'completed' }, 'job'), false);
});

test('client requests exclude completed linked jobs and cancelled requests', () => {
  assert.equal(isOpenClientOrder({ status: 'review' }), true);
  assert.equal(isOpenClientOrder({ status: 'production', linked_job_status: 'completed' }), false);
  assert.equal(isOpenClientOrder({ status: 'production', linked_job_production_status: 'production_complete' }), false);
  assert.equal(isOpenClientOrder({ status: 'production', linked_job_production_completed_at: '2026-10-30' }), false);
  assert.equal(isOpenClientOrder({ status: 'cancelled' }), false);
  assert.equal(isOpenClientOrder({ status: 'production', linked_job_status: 'reserved' }), true);
});

test('home links low-stock count to matching list, shows client orders, and puts artwork at bottom', () => {
  const home = read('src/Home.jsx');
  const low = read('src/LowStock.jsx');
  assert.match(home, /label: 'Low Stock Items',[\s\S]*?to: '\/low-stock'/);
  assert.match(home, /label: 'Pending Client Orders'/);
  assert.match(home, /isOpenClientOrder/);
  assert.match(home, /to="\/artwork-hub"/);
  assert.match(home, /to="\/dtf-studio"/);
  assert.match(low, /getLowStockItems/);
  assert.ok(home.indexOf('Artwork Notifications') > home.indexOf('Recommended Operating Order'));
});

test('artwork hub and shared calendar status checks are reachable', () => {
  const app = read('src/App.jsx');
  const nav = read('src/navigationConfig.js');
  const hub = read('src/ArtworkHub.jsx');
  assert.match(app, /path="\/artwork-hub"/);
  assert.match(nav, /Artwork Hub — All Tools/);
  for (const target of ['/artwork-requests', '/dtf-studio', '/mockup-studio', '/uv-studio', '/artwork-preflight', '/production-travelers', '/woo-artwork-mapping']) {
    assert.ok(hub.includes(target), target);
  }
  assert.match(read('src/HomeUpcomingCommitments.jsx'), /isOpenCalendarItem/);
  assert.match(read('src/OperationsCalendar.jsx'), /isOpenCalendarItem/);
});
