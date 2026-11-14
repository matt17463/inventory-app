import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

test('printer reminders are installed on both operational dashboards', () => {
  assert.match(read('src/Home.jsx'), /<PrinterIdleMonitor compact \/>/);
  assert.match(read('src/EquipmentCenter.jsx'), /<PrinterIdleMonitor \/>/);
});
test('Omni is registered without fabricated telemetry or machine commands', () => {
  const source = read('src/lib/equipment.js');
  assert.match(source, /"id": "omni"/);
  assert.match(source, /"name": "xTool Omni Dual UV"/);
  assert.match(source, /"stage": "Manual monitoring configured/);
  assert.match(source, /"entities": \[\]/);
});
test('manual modes are not exposed as machine actuation', () => {
  const source = read('src/components/PrinterIdleMonitor.jsx');
  assert.match(source, /does not send a command to the machine/);
  assert.match(source, /browser only/);
  assert.doesNotMatch(source, /callService\(/);
});
