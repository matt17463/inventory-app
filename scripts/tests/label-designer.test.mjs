import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLabelDesign,presetLabelDesign,moveLabelField} from '../../src/lib/labelDesigner.js';
import {deriveDistributionFields,createDistributionLabelsPdf} from '../../src/lib/printPacketPdf.js';
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
test('metadata resolves a single value but never silently chooses between students',()=>{
 const source={lines:[{metadata:[{label:'Student Name',value:'Alex'}]},{metadata:[{label:'Student Name',value:'Bailey'}]}]};
 assert.match(deriveDistributionFields(source).student,/MULTIPLE/);
 assert.equal(deriveDistributionFields(source,{student:'Taylor'}).student,'Taylor');
});
test('custom templates still generate a 4x6 thermal document',()=>{
 const source={reference:'TEST',shipName:'Parent',customerName:'Parent',lines:[{name:'Hoodie',quantity:1,metadata:[{label:'Coach',value:'Chris'}]}]};
 const pdf=createDistributionLabelsPdf({source,job:{id:123},prefs:{packageCount:2},labelDesign:normalizeLabelDesign({visible:['coach'],labels:{coach:'TEAM MANAGER'}})});
 assert.equal(pdf.getNumberOfPages(),2);
 assert.equal(pdf.internal.pageSize.getWidth(),288);
 assert.equal(pdf.internal.pageSize.getHeight(),432);
});
