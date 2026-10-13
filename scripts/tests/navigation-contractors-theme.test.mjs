import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { defaultNavigationLayout, sanitizeNavigationLayout, materializeNavigation, moveNavigationItem } from '../../src/lib/navigationPreferences.js';
import { periodRange, effectiveRate, contractorReport, contractorCsv } from '../../src/lib/contractorHours.js';

const read = (path) => fs.readFileSync(path, 'utf8');
const base = [
  { id: 'one', title: 'One', icon: '▣', items: [{ path:'/first', label:'First' },{ path:'/second', label:'Second' }] },
  { id: 'two', title: 'Two', icon: '▣', items: [{ path:'/third', label:'Third' }] },
];

test('menu groups can be renamed, reordered and pages moved without losing routes', () => {
  const defaultLayout = defaultNavigationLayout(base);
  const moved = moveNavigationItem(defaultLayout, '/first', 'two', 0);
  assert.deepEqual(moved.groups[1].paths, ['/first','/third']);
  const rebuilt = sanitizeNavigationLayout(base, {
    groups: [{ id:'custom', title:'My Day', paths:['/second','/second','/unknown'] },
      { id:'two', title:'Custom Equipment', paths:['/third','/first'] }],
    hiddenPaths: ['/first','/unknown'],
  });
  assert.equal(rebuilt.groups[0].title, 'My Day');
  assert.deepEqual(rebuilt.hiddenPaths, ['/first']);
  assert.deepEqual(new Set(rebuilt.groups.flatMap((g) => g.paths)), new Set(['/first','/second','/third']));
  assert.equal(materializeNavigation(base, rebuilt).flatMap((g) => g.items).length, 2);
});
test('newly introduced pages are preserved when loading older saved menus', () => {
  const result = sanitizeNavigationLayout(base, {
    groups: [{ id:'one', title:'Daily', paths:['/first'] }],
    hiddenPaths: [],
  });
  assert.ok(result.groups.some((g) => g.paths.includes('/second')));
  assert.ok(result.groups.some((g) => g.paths.includes('/third')));
});

test('calendar reporting periods use Monday weeks and real quarter boundaries', () => {
  assert.deepEqual(periodRange('week', '2026-10-12'), {start:'2026-10-12',end:'2026-10-18'});
  assert.deepEqual(periodRange('month', '2026-02-14'), {start:'2026-02-01',end:'2026-02-28'});
  assert.deepEqual(periodRange('quarter', '2026-10-12'), {start:'2026-10-01',end:'2026-12-31'});
  assert.deepEqual(periodRange('year', '2026-10-12'), {start:'2026-01-01',end:'2026-12-31'});
});

test('historical rates apply to the date worked, with unpaid and paid separated', () => {
  const rates = [{contractor_id:'a',effective_on:'2026-01-01',hourly_rate:20},
    {contractor_id:'a',effective_on:'2026-10-01',hourly_rate:25}];
  const entry = (work_date, status, hours) => ({id:work_date+status,contractor_id:'a',work_date,status,hours});
  const report = contractorReport([
    entry('2026-09-30','approved',10),
    entry('2026-10-12','approved',5),
    entry('2026-10-12','paid',2),
    entry('2026-10-12','submitted',3),
    entry('2026-10-12','void',7),
  ], rates);
  assert.equal(effectiveRate(rates,'a','2026-09-30'),20);
  assert.equal(effectiveRate(rates,'a','2026-10-12'),25);
  assert.equal(report.dueAmount, 325);
  assert.equal(report.paidAmount, 50);
  assert.equal(report.pendingHours, 3);
  assert.equal(report.totalHours, 20);
});

test('CSV export neutralizes spreadsheet formulas in user-authored fields', () => {
  const csv = contractorCsv([{
    contractor_id:'a',work_date:'2026-10-12',method:'manual',hours:2,activity:'Production',
    notes:'=HYPERLINK("evil")',status:'submitted',rate:25,amount:50,
  }],{a:'=BAD'});
  assert.match(csv, /'=BAD/);
  assert.match(csv, /'=HYPERLINK/);
});

test('contractor migration enforces RLS and writes through authenticated RPCs only', () => {
  const sql = read('supabase/migrations/202610120001_contractor_hours.sql');
  for (const table of ['sc_contractors','sc_contractor_time_entries','sc_contractor_hourly_rates','sc_contractor_rate_audit','sc_contractor_time_audit']) {
    assert.match(sql, new RegExp('alter table public\\.'+table+' enable row level security'));
  }
  assert.match(sql, /revoke all on public\.sc_contractors/);
  assert.match(sql, /create policy sc_contractor_entries_select/);
  assert.match(sql, /public\.sc_current_app_role\(\) is not null/);
  assert.match(sql, /sc_contractor_one_open_shift/);
  assert.match(sql, /sc_contractor_clock_in/);
  assert.match(sql, /sc_contractor_clock_out/);
  assert.match(sql, /sc_contractor_resolve_open/);
  assert.match(sql, /Manager permission required/);
  assert.match(sql, /sc_contractor_audit_change/);
  assert.match(sql, /sc_contractor_audit_rate_change/);
  assert.doesNotMatch(sql, /create policy .* for (insert|update|delete)/i);
});

test('contractor and menu pages are wired in routes, navigation and the shell', () => {
  const app = read('src/App.jsx'), nav = read('src/navigationConfig.js'), shell = read('src/components/AppShell.jsx');
  assert.match(app, /path="\/menu-manager"/);
  assert.match(app, /path="\/contractor-hours"/);
  assert.match(nav, /path: '\/menu-manager'/);
  assert.match(nav, /path: '\/contractor-hours'/);
  assert.match(shell, /NavigationContext\.Provider/);
});

test('Midnight Industrial is opt in and does not replace the current default theme', () => {
  const presets = read('src/themePresets.js'), css = read('src/themes.css'), provider = read('src/ui/ThemeProvider.jsx');
  assert.match(presets, /DEFAULT_THEME_PRESET = 'professional-enterprise'/);
  assert.match(presets, /id: 'midnight-industrial'/);
  assert.match(css, /data-preset='midnight-industrial'/);
  assert.match(provider, /preset === 'midnight-industrial'/);
});
