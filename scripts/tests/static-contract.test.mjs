import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve('.');
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const nav = fs.readFileSync(path.join(root, 'src/navigationConfig.js'), 'utf8');

function routePaths() {
  return new Set([...app.matchAll(/<Route\s+path=["']([^"']+)["']/g)].map((match) => match[1]));
}

function navigationPaths() {
  return [...nav.matchAll(/\bpath:\s*["']([^"']+)["']/g)].map((match) => match[1].split('?')[0]);
}

test('all navigation paths have active routes', () => {
  const routes = routePaths();
  const missing = navigationPaths().filter((item) => !routes.has(item));
  assert.deepEqual(missing, []);
});

test('employee routes use a real not-found page', () => {
  assert.match(app, /<Route path="\*" element=\{<NotFound \/>\}/);
  assert.doesNotMatch(app, /<Route path="\*" element=\{<Home \/>\}/);
});

test('legacy create-product route is a safe redirect', () => {
  assert.match(app, /path="\/create-product"[^\n]+Navigate replace to="\/inventory\/edit-blanks"/);
  assert.doesNotMatch(app, /import CreateProduct/);
});

test('public customer portal remains outside AuthGate', () => {
  const publicRoute = app.indexOf('<Route path="/customer-portal"');
  const authGate = app.indexOf('<AuthGate>');
  assert.ok(publicRoute >= 0 && authGate >= 0 && publicRoute < authGate);
});

test('known stale deployable files are absent', () => {
  const stale = [
    'public/pullsheet.js',
    'public/Home.jsx',
    'ManualInvoicedOrders.jsx',
    'ManualInvoicedOrders(10).jsx',
    'manualOrdersApi.js',
    'download',
    'download (1)',
  ];
  assert.deepEqual(stale.filter((name) => fs.existsSync(path.join(root, name))), []);
});


test('fallback navigation does not contain removed bin-contents route', () => {
  const shell = fs.readFileSync(path.join(root, 'src/components/AppShell.jsx'), 'utf8');
  assert.doesNotMatch(shell, /\/bin-contents/);
});
