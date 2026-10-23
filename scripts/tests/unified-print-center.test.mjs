import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeWooPrintSource,normalizeManualPrintSource,normalizePrintPrefs,canPrintCustomerCopy,printWarnings} from '../../src/lib/printModel.js';
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
 assert.match(pdf,/cfg\.labelShowItems&&cfg\.packageCount>1/);
 assert.match(pdf,/contents must be verified/);
});
