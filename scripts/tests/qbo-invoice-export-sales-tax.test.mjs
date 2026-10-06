import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SALES_TAX_RATE, SALES_TAX_PERCENT, calculateSalesTax } from '../../src/lib/salesTax.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('shared application sales tax rate is fixed at 9.2 percent',()=>{
  assert.equal(SALES_TAX_RATE,0.092);
  assert.equal(SALES_TAX_PERCENT,9.2);
  assert.equal(calculateSalesTax(100),9.2);
  assert.equal(calculateSalesTax(49.05),4.51);
});

test('manual invoiced orders calculate tax from subtotal instead of operator-entered tax',()=>{
  const page=read('src/ManualInvoicedOrders.jsx');
  const api=read('src/lib/manualOrdersApi.js');
  assert.match(page,/const calculatedTax = calculateSalesTax\(subtotal\)/);
  assert.match(page,/Tax \(\{SALES_TAX_PERCENT\}%\)/);
  assert.match(page,/value=\{calculatedTax\} readOnly/);
  assert.match(api,/const taxAmount = calculateSalesTax\(orderSubtotal\)/);
  assert.match(api,/tax_amount: taxAmount/);
});

test('client orders use the same 9.2 percent tax helper',()=>{
  const page=read('src/ClientOrders.jsx');
  const api=read('src/lib/clientOrdersApi.js');
  assert.match(page,/const localTax=calculateSalesTax\(localSubtotal\)/);
  assert.match(page,/tax_amount:localTax/);
  assert.match(api,/const taxAmount = calculateSalesTax\(lineSubtotal\)/);
});

test('manual invoiced orders expose a QuickBooks Online CSV export',()=>{
  const page=read('src/ManualInvoicedOrders.jsx');
  const api=read('src/lib/manualOrdersApi.js');
  assert.match(page,/QBO CSV/);
  assert.match(page,/buildQuickBooksInvoiceCsv/);
  assert.match(api,/InvoiceNo/);
  assert.match(api,/Item \(Product\/Service\)/);
  assert.match(api,/ItemAmount/);
  assert.match(api,/Taxable/);
  assert.match(api,/Tax Rate/);
  assert.match(api,/SALES_TAX_PERCENT/);
});
