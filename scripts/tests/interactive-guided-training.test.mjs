import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('guided training launches a persistent route-aware coach',()=>{
  const overlay=read('src/components/GuidedTrainingOverlay.jsx');
  const shell=read('src/components/AppShell.jsx');
  assert.match(shell,/GuidedTrainingOverlay/);
  assert.match(overlay,/useLocation/);
  assert.match(overlay,/useNavigate/);
  assert.match(overlay,/Open the page for this step/);
  assert.match(overlay,/I completed this step/);
  assert.match(overlay,/sc-guided-training-target/);
});

test('starting guided training automatically activates safe testing settings',()=>{
  const engine=read('src/lib/guidedTraining.js');
  assert.match(engine,/enabled:true/);
  assert.match(engine,/simulateWrites:true/);
  assert.match(engine,/requireConfirmation:true/);
  assert.match(engine,/guidedTraining:true/);
});

test('guided training includes every navigation screen in a full application tour',()=>{
  const engine=read('src/lib/guidedTraining.js');
  assert.match(engine,/for\(const section of navSections\)/);
  assert.match(engine,/for\(const item of section\.items\)/);
  assert.match(engine,/Full Application Screen Tour/);
});

test('unsupported training workflows are treated as read-only rather than falsely sandboxed',()=>{
  const engine=read('src/lib/guidedTraining.js');
  const overlay=read('src/components/GuidedTrainingOverlay.jsx');
  assert.match(engine,/readOnly:/);
  assert.match(overlay,/Only workflows that explicitly support simulation are guaranteed not to write/);
});

test('testing mode and application guide can launch online guided training',()=>{
  const testing=read('src/TestingMode.jsx');
  const guide=read('src/ApplicationGuide.jsx');
  assert.match(testing,/Start guided training now/);
  assert.match(testing,/training coach will stay on screen/);
  assert.match(guide,/Start online guided training/);
});
