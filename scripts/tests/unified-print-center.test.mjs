import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeWooPrintSource,normalizeManualPrintSource,normalizePrintPrefs,canPrintCustomerCopy,printWarnings} from '../../src/lib/printModel.js';
import {deriveDistributionFields,canonicalDistributionMetaLabel,distributionLabelRows,distributeOrderLines} from '../../src/lib/distributionMetadata.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('Woo source preserves original authoritative tax, discount, totals and payment',()=>{
 const order={id:112,number:'112',date_paid:'2026-10-22T10:00:00',
  currency:'USD',status:'processing',billing:{first_name:'Pat',last_name:'Parent'},
  line_items:[{id:1,name:'Hoodie',quantity:2,subtotal:'60.00',total:'54.00',sku:'HD-XL',
    meta_data:[{display_key:'Player',display_value:'Alex'},{key:'_internal_cost',value:12}]}],
  discount_total:'6.00',shipping_total:'5.00',total_tax:'5.43',total:'64.43'};
 const s=normalizeWooPrintSource(order);
 assert.equal(s.total,64.43);assert.equal(s.discount,6);assert.equal(s.tax,5.43);
 assert.equal(s.paid,true);assert.equal(s.financialVerified,true);assert.equal(s.subtotal,60);
 assert.equal(s.lines[0].metadata.length,1);
 assert.equal(s.lines[0].metadata[0].label,'Player');
 assert.equal(canPrintCustomerCopy(s),true);
});
test('Manual source is never falsely presented as a QuickBooks-verified invoice',()=>{
 const s=normalizeManualPrintSource(
  {id:7,invoice_number:'QB-700',customer_name:'School',payment_received:true,total_payment_amount:50},
  [{item_name:'Team tee',quantity:2,price_per_item:25}]);
 assert.equal(s.total,50);assert.equal(s.reference,'QB-700');
 assert.equal(s.paid,true);assert.equal(s.financialVerified,false);
 assert.equal(canPrintCustomerCopy(s),false);
 assert.match(printWarnings(s,{status:'open'},[]).join(' '),/QuickBooks invoice reconciliation/i);
});
test('Missing source totals always block customer invoice',()=>{
 const s=normalizeWooPrintSource({id:22,billing:{},line_items:[{name:'Tee',quantity:1,total:12}]});
 assert.equal(s.total,null);assert.equal(canPrintCustomerCopy(s),false);
});
test('Customizable font and package settings are bounded for thermal media',()=>{
 const cfg=normalizePrintPrefs({invoiceFont:4,invoiceHeading:90,labelFont:3,packageCount:999,labelShowQR:true});
 assert.equal(cfg.invoiceFont,7);assert.equal(cfg.invoiceHeading,28);
 assert.equal(cfg.labelFont,9);assert.equal(cfg.packageCount,100);assert.equal(cfg.labelShowQR,true);
});
test('Application print interface only reads billing sources and does not write financial records',()=>{
 const server=read('netlify/functions/print-order-source.js');
 assert.match(server,/authorizeEmployee\(event/);
 assert.match(server,/allowedRoles:\['admin','manager'\]/);
 assert.match(server,/\.from\('jobs'\)/);
 assert.match(server,/\/wp-json\/wc\/v3\/orders\//);
 assert.doesNotMatch(server,/\.update\(|\.insert\(|\.upsert\(|\.delete\(/);
 const component=read('src/PrintCenter.jsx');
 assert.match(component,/createInvoicePairPdf/);
 assert.match(component,/canPrintCustomerCopy\(source\)/);
 assert.match(component,/4 × 6/);
 assert.match(component,/No postage is purchased/);
 const pdf=read('src/lib/printPacketPdf.js');
 assert.match(pdf,/SHOP COPY \/ INTERNAL - NOT FOR CUSTOMER/);
 assert.match(pdf,/qrCode\(doc,origin\+'\/work-hub\?job='/);
 assert.match(pdf,/createProductionPacketPdf/);
 assert.match(pdf,/cfg.labelShowItems&&cfg.packageCount===1/);
 assert.match(pdf,/Contents not allocated/);
});

test('Woo add-on labels with colons and possessives populate 4x6 student distribution label',()=>{
 const source=normalizeWooPrintSource({id:16148,line_items:[{id:1,name:'Sidney Glen ES Raglan Tee',quantity:1,total:'22.00',meta_data:[
  {display_key:'Color:',display_value:'Royal Blue'},
  {display_key:'Size:',display_value:'YM'},
  {display_key:'Logo Selection:',display_value:'SG Dolphin'},
  {display_key:'Student Name::',display_value:'Benzino Bustamante'},
  {display_key:'Teacher Name::',display_value:'Ms. Bornfleth'},
  {display_key:'Student’s Grade::',display_value:'4th Grade'}
 ]}]});
 const fields=deriveDistributionFields(source);
 assert.equal(fields.student,'Benzino Bustamante');
 assert.equal(fields.teacher,'Ms. Bornfleth');
 assert.equal(fields.grade,'4th Grade');
 assert.equal(canonicalDistributionMetaLabel(' Student Name:: '),'student name');
 assert.equal(canonicalDistributionMetaLabel('Student’s Grade::'),'students grade');
});
test('packing label retains ambiguous metadata as MULTIPLE and honors manual corrections',()=>{
 const source={lines:[{metadata:[{label:'Student Name::',value:'Alex'}]},{metadata:[{label:'Student Name:',value:'Taylor'}]}]};
 assert.equal(deriveDistributionFields(source).student,'MULTIPLE - SEE PACKING LIST');
 assert.equal(deriveDistributionFields(source,{student:'Override'}).student,'Override');
});

test('WooCommerce customer invoice carries original product image reference and verified amounts',()=>{
 const order={id:16148,number:'16148',billing:{first_name:'Sample',last_name:'Customer'},line_items:[{id:3,product_id:123,name:'Raglan Tee',quantity:1,total:'22.00',subtotal:'22.00',image:{src:'https://skilledcrafting.com/wp-content/uploads/item.jpg'},meta_data:[{display_key:'Student Name::',display_value:'Sample Student'}]}],total:'24.02',total_tax:'2.02',shipping_total:'0'};
 const source=normalizeWooPrintSource(order);
 assert.equal(source.lines[0].thumbnailUrl,'https://skilledcrafting.com/wp-content/uploads/item.jpg');
 assert.equal(source.lines[0].metadata[0].value,'Sample Student');
 assert.equal(source.total,24.02);
});
test('Customer invoice branding is configurable but never fabricates business phone or address',()=>{
 const defaults=normalizePrintPrefs({});
 assert.equal(defaults.businessWebsite,'skilledcrafting.com');
 assert.equal(defaults.businessAddress,'');assert.equal(defaults.businessPhone,'');
 const custom=normalizePrintPrefs({businessName:'Skilled Crafting',businessAddress:'Shop mailbox',businessPhone:'(360) 000-0000'});
 assert.equal(custom.businessAddress,'Shop mailbox');
 assert.equal(custom.businessPhone,'(360) 000-0000');
 const pdf=read('src/lib/printPacketPdf.js');
 assert.match(pdf,/line\.thumbnailData/);
 assert.match(pdf,/businessWebsite/);
 assert.match(pdf,/logoData/);
});

test('Print Center exposes customer invoice branding on the no-job settings screen',()=>{
 const component=read('src/PrintCenter.jsx');
 assert.match(component,/const printSettingsPanel=\(/);
 const noJob=component.split('if\(!jobId\)return')[1]?.split('return <main className="page sc-print-center">')[0]||'';
 assert.match(noJob,/\{printSettingsPanel\}/);
 assert.match(noJob,/\{designerPanel\}/);
 assert.match(component,/businessAddress/);
 assert.match(component,/businessPhone/);
 assert.match(component,/Save my workstation defaults/);
});

test('4x6 default General Packing shows actual teacher and grade instead of empty template placeholders',()=>{
 const order=normalizeWooPrintSource({id:16146,line_items:[{id:1,name:'Sidney Glen ES Hoodie',quantity:1,meta_data:[
 {display_key:'Student Name::',display_value:'Dean Borseth'},
 {display_key:'Teacher Name::',display_value:'Mrs. Smith'},
 {display_key:'Student’s Grade::',display_value:'4th Grade'},
 {display_key:'Logo Selection:',display_value:'SG Dolphin'}]}]});
 const rows=distributionLabelRows(order,{}, {visible:['student','team','appliedName'],labels:{student:'Student / Player',teacher:'Teacher',grade:'Grade'}}).rows;
 assert.deepEqual(rows.slice(0,3).map(x=>x.value),['Dean Borseth','Mrs. Smith','4th Grade']);
 assert.ok(rows.some(x=>x.label==='LOGO SELECTION'&&x.value==='SG Dolphin'));
 assert.ok(!rows.some(x=>x.value==='NOT PROVIDED'));
});
test('4x6 includes actual previously unknown Woo addon fields and never guesses conflicting per-line values',()=>{
 const rows=distributionLabelRows({lines:[{metadata:[{label:'Homeroom',value:'A'},{label:'Custom Pickup Code:',value:'X9'}]},{metadata:[{label:'Homeroom',value:'B'},{label:'Custom Pickup Code:',value:'Y8'}]}]}).rows;
 assert.ok(rows.some(x=>x.field==='teacher'&&x.value==='MULTIPLE - SEE PACKING LIST'));
 assert.ok(rows.some(x=>x.label==='CUSTOM PICKUP CODE'&&x.value==='MULTIPLE - SEE PACKING LIST'));
});

test('independent customer/shop invoice field selection keeps source billing and payment info',()=>{
 const prefs=normalizePrintPrefs({customerInvoiceFields:['invoiceDate','paymentMethod'],shopInvoiceFields:['billingAddress','productionInfo'],labelQuestions:'Questions? email@example.com'});
 assert.deepEqual(prefs.customerInvoiceFields,['invoiceDate','paymentMethod']);
 assert.deepEqual(prefs.shopInvoiceFields,['billingAddress','productionInfo']);
 assert.equal(prefs.labelQuestions,'Questions? email@example.com');
 const source=normalizeWooPrintSource({id:16151,payment_method_title:'Apple Pay',date_created:'2026-10-26T10:00:00',billing:{first_name:'Alex',address_1:'100 Main St',city:'Port Orchard',state:'WA',postcode:'98366'},line_items:[]});
 assert.equal(source.paymentMethod,'Apple Pay');assert.match(source.billingAddress,/100 Main St/);
 const pdf=read('src/lib/printPacketPdf.js');assert.match(pdf,/config\.shopInvoiceFields:config\.customerInvoiceFields/);
});

test('Gartin-like multi-item order generates recipient-specific label groups instead of MULTIPLE',()=>{
 const source={reference:'16151',lines:[
  {name:'Hoodie',quantity:1,metadata:[{label:'Student Name::',value:'Morgan Gartin'},{label:'Teacher Name::',value:'Ms Lee'},{label:'Student’s Grade::',value:'3rd'}]},
  {name:'T-shirt',quantity:2,metadata:[{label:'Student Name::',value:'Morgan Gartin'},{label:'Teacher Name::',value:'Ms Lee'},{label:'Student’s Grade::',value:'3rd'}]},
  {name:'Hat',quantity:1,metadata:[]} ]};
 const groups=distributeOrderLines(source);
 assert.equal(groups.length,1);assert.equal(groups[0].lines.length,3);
 assert.equal(distributionLabelRows(groups[0]).rows.find(r=>r.field==='student').value,'Morgan Gartin');
});
test('different students remain separate recipient groups and unassigned items cannot be guessed',()=>{
 const groups=distributeOrderLines({lines:[
  {name:'First',metadata:[{label:'Student Name',value:'A'}]},
  {name:'Second',metadata:[{label:'Student Name',value:'B'}]},
  {name:'Unassigned',metadata:[]} ]});
 assert.equal(groups.length,3);
 assert.equal(groups[2].lines[0].name,'Unassigned');
});
