import test from 'node:test';
import assert from 'node:assert/strict';
import { marketingTheme, marketingDesigns, marketingAudiences } from '../../src/lib/marketingDesignSystem.js';

test('design system provides four reusable families and decision maker audiences', () => {
  assert.equal(Object.keys(marketingDesigns).length, 4);
  for (const audience of ['pto','athletics','coach','club','student']) assert.ok(marketingAudiences[audience]);
});
test('school and team defaults are distinct', () => {
  assert.equal(marketingTheme({segment:'school'}).key,'schoolSpirit');
  assert.equal(marketingTheme({segment:'team'}).key,'teamEnergy');
});
test('approved high-contrast brand color is retained', () => {
  assert.equal(marketingTheme({design:'schoolSpirit',confirmedColors:['#202060']}).primary,'#202060');
});
test('unreadable brand color is not used for white text', () => {
  assert.notEqual(marketingTheme({design:'schoolSpirit',confirmedColors:['#FFFF00']}).primary,'#FFFF00');
});
test('unknown design falls back to segment default and invalid colors are discarded', () => {
  const theme=marketingTheme({design:'not-real',segment:'team',confirmedColors:['red','<script>']});
  assert.equal(theme.key,'teamEnergy');
  assert.deepEqual(theme.verifiedColors,[]);
});
