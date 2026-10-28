import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLabelDesign,presetLabelDesign,moveLabelField} from '../../src/lib/labelDesigner.js';
import {readFileSync} from 'node:fs';
test('school and sports presets preserve valid editable fields',()=>{
 const school=presetLabelDesign('school'),sports=presetLabelDesign('sports');
 assert.ok(school.visible.includes('teacher'));
 assert.ok(sports.visible.includes('coach'));
 assert.equal(normalizeLabelDesign({visible:['invalid','student','student'],fontSize:500,logoSize:0}).fontSize,13);
});
test('field order can be changed without dropping any fields',()=>{
 const before=presetLabelDesign('sports'),after=moveLabelField(before,'student',1);
 assert.equal(after.order[1],'student');
 assert.equal(after.order.length,before.order.length);
 assert.equal(before.order[0],'student');
});
test('PDF generator uses normalized designer and true 4x6 dimensions',()=>{
 const code=readFileSync(new URL('../../src/lib/printPacketPdf.js',import.meta.url),'utf8');
 assert.match(code,/normalizeLabelDesign\(labelDesign\)/);
 assert.match(code,/distributionLabelRows\(group,labelFields,design\)/);
 assert.match(code,/format:\[288,432\]/);
 const metadata=readFileSync(new URL('../../src/lib/distributionMetadata.js',import.meta.url),'utf8');
 assert.match(code,/deriveDistributionFields\(group,labelFields\)/);
 assert.match(metadata,/MULTIPLE - SEE PACKING LIST/);
});
