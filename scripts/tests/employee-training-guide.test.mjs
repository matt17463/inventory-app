import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('application guide contains role-based employee training center',()=>{
  const page=read('src/ApplicationGuide.jsx');
  const data=read('src/application-guide/trainingData.js');
  assert.match(page,/Employee Training Center/);
  assert.match(page,/Owner \/ Manager Reference/);
  assert.match(page,/TRAINING_PROGRESS_KEY/);
  assert.match(data,/New Employee/);
  assert.match(data,/Receiving \/ Warehouse/);
  assert.match(data,/Production/);
  assert.match(data,/Artwork \/ Customer Admin/);
  assert.match(data,/Manager/);
  assert.match(data,/Owner \/ Admin/);
});

test('training curriculum includes core operational tutorials and safety guidance',()=>{
  const data=read('src/application-guide/trainingData.js');
  for(const text of ['Orientation','Receiving 101','Pull Sheet 101','Production 201','Purchasing 101','Client Orders 101','Manual Invoice Orders 101','Artwork 101','Inventory Audit 101','Troubleshooting 101']) assert.match(data,new RegExp(text));
  assert.match(data,/Pending Stock is not a physical bin/);
  assert.match(data,/Do not generate a job for a test order/);
});

test('testing mode exposes guided employee training without claiming universal simulation',()=>{
  const page=read('src/TestingMode.jsx');
  const lib=read('src/lib/testingMode.js');
  assert.match(page,/Guided employee training/);
  assert.match(page,/does not make unsupported workflows non-mutating/);
  assert.match(page,/Open Employee Training Center/);
  assert.match(lib,/guidedTraining: false/);
  assert.match(lib,/trainingRole: 'new-employee'/);
});

test('tools navigation exposes testing and guided training',()=>{
  const nav=read('src/navigationConfig.js');
  assert.match(nav,/Testing & Guided Training/);
  assert.match(nav,/\/testing-mode/);
});
