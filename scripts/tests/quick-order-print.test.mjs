import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
test('Work Hub exposes Print Order without requiring print center navigation',()=>{
 const hub=read('src/WorkHub.jsx');
 assert.match(hub,/QuickOrderPrint/);
 assert.match(hub,/printOpen\?'Close printing':'Print Order'/);
});
test('Simple printing uses authoritative source and retains financial and printer safeguards',()=>{
 const component=read('src/QuickOrderPrint.jsx');
 assert.match(component,/print-order-source/);
 assert.match(component,/canPrintCustomerCopy/);
 assert.match(component,/createInvoicePdf/);
 assert.match(component,/createDistributionLabelsPdf/);
 assert.match(component,/createProductionPacketPdf/);
 assert.match(component,/action:'capabilities'/);
 assert.match(component,/!routeReady\(key\)/);
 assert.match(component,/idempotencyKey:crypto.randomUUID\(\)/);
 assert.match(component,/selected.includes\('labels'\)/);
 assert.match(component,/Preview selected documents/);
 assert.match(component,/Print selected to shop printers/);
});

test('selected school label uses customized built-in storage instead of resetting to factory layout',()=>{
 const printCenter=read('src/PrintCenter.jsx');
 const workHubPrint=read('src/QuickOrderPrint.jsx');
 assert.match(printCenter,/BUILTIN_DESIGN_KEY/);
 assert.match(printCenter,/presets\[activeBuiltin\]=normalizeLabelDesign\(labelDesign\)/);
 assert.match(workHubPrint,/readSaved\(builtinsKey,\{\}\)\[template\]/);
 assert.match(workHubPrint,/normalizeLabelDesign\(customized\|\|presetLabelDesign\(template\)\)/);
});

test('school distribution template fields remain visible without Woo metadata',()=>{
 const pdf=read('src/lib/printPacketPdf.js');
 const panel=read('src/QuickOrderPrint.jsx');
 assert.match(pdf,/const rows=fields.slice\(0,7\)/);
 assert.match(pdf,/value\|\|'NOT PROVIDED'/);
 assert.doesNotMatch(pdf,/fields.filter\(\(\[,value\]\)=>value\)/);
 assert.match(panel,/labelFields,logoData/);
 assert.match(panel,/Student \/ teacher \/ team details/);
});
