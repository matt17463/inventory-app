import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordProblem, passwordRecoveryRedirect } from '../../src/lib/passwordSecurity.js';

test('password validation protects short, weak, and mismatched values', () => {
  assert.match(passwordProblem('short1', 'short1'), /12/);
  assert.match(passwordProblem('alphabetonlylong', 'alphabetonlylong'), /number/);
  assert.match(passwordProblem('longpassword123', 'differentpassword123'), /match/);
  assert.equal(passwordProblem('longpassword123', 'longpassword123'), '');
});
test('recovery redirect is rooted at the application origin', () => {
  assert.equal(passwordRecoveryRedirect('https://inventory.skilledcrafting.com/some-page'), 'https://inventory.skilledcrafting.com/reset-password');
});
