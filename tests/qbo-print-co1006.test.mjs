import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileQboInvoice} from '../netlify/functions/_shared/qboPrint.js';

const manual={
 source:'quickbooks_manual',reference:'CO-1006',customerName:'Molly Doughty',
 organizationName:'South Kitsap 3 BU10 Vipers',currency:'USD',total:279.99
};
const invoice={
 Id:'2846',DocNumber:'CO-1006',
 CustomerRef:{value:'177',name:'South Kitsap 3 BU10 Vipers'},
 TotalAmt:279.99,Balance:0,TxnDate:'2026-10-26',
 Line:[
  ...Array.from({length:8},(_,i)=>({Id:String(i+1),DetailType:'SalesItemLineDetail',Description:'Hoodie',Amount:32.05,SalesItemLineDetail:{Qty:1,UnitPrice:32.05}})),
  {Id:'9',DetailType:'SalesItemLineDetail',Description:'9.2% Sales Tax',Amount:23.59,SalesItemLineDetail:{Qty:1,UnitPrice:23.59}}
 ]
};
test('CO-1006: organization customer and sales-tax service line reconcile',()=>{
 const result=reconcileQboInvoice(manual,invoice);
 assert.equal(result.financialVerified,true,JSON.stringify(result.warnings));
 assert.equal(result.total,279.99);
 assert.equal(result.paid,true);
});
test('mismatched QuickBooks customer still blocks customer copy',()=>{
 const result=reconcileQboInvoice(manual,{...invoice,CustomerRef:{value:'999',name:'Unrelated Company'}});
 assert.equal(result.financialVerified,false);
 assert.match(result.warnings.join(' '),/customer/);
});
test('mismatched total still blocks customer copy',()=>{
 const result=reconcileQboInvoice(manual,{...invoice,TotalAmt:280.99});
 assert.equal(result.financialVerified,false);
 assert.match(result.warnings.join(' '),/total/);
});
