import assert from 'node:assert/strict';
import test from 'node:test';
import AdmZip from 'adm-zip';
import { inflateSync } from 'node:zlib';
import { marketingTemplates } from '../../src/lib/marketingCatalogPolicy.js';
import { marketingDocumentBlueprint } from '../../src/lib/marketingDocumentBlueprints.js';
import { marketingDocumentModel, marketingSectionMissing } from '../../src/lib/marketingDocumentModel.js';
import { exportMarketingDocument } from '../../src/lib/marketingNativeExports.js';

function pdfText(bytes) {
  return [...bytes.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
    .map(match => inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1')).join('\n');
}

test('all 35 templates generate editable Word and native PDF with the same editorial content', async () => {
  assert.equal(marketingTemplates.length, 35);
  for (const { id } of marketingTemplates) {
    const { sections } = marketingDocumentBlueprint(id);
    const input = {
      template: id, organization: 'Example Client', contentVersion: 2,
      sectionContent: Object.fromEntries(sections.map((section, index) => [section, 'Confirmed section content ' + index])),
      offer: { unit_cost: 'PrivateSupplierCost' },
    };
    assert.deepEqual(marketingSectionMissing({ ...input, sectionContent: {} }), sections);
    assert.deepEqual(marketingSectionMissing(input), []);
    const model = marketingDocumentModel(input);
    const [docx, pdf] = await Promise.all(['docx', 'pdf'].map(format => exportMarketingDocument(model, format)));
    const xml = new AdmZip(Buffer.from(await docx.arrayBuffer())).readAsText('word/document.xml');
    const pdfBytes = Buffer.from(await pdf.arrayBuffer());
    assert.match(pdfBytes.toString('ascii', 0, 8), /^%PDF-/);
    const pdfContent = pdfText(pdfBytes);
    for (const output of [xml, pdfContent]) {
      assert.match(output, /Example Client/);
      assert.match(output, /FOR INTERNAL REVIEW/);
      assert.doesNotMatch(output, /PrivateSupplierCost/);
      for (const index of sections.keys()) assert.match(output, new RegExp('Confirmed section content ' + index));
    }
  }
});

test('catalog associates each style with its own approved color images and customer price', () => {
  const input = {
    template: 'product-catalog', productImages: ['hero', 'alternate', 'other'],
    productRows: [
      { name: 'Tee', type: 'Apparel', retailPrice: 20, supplierCost: 1.23, gallery: [{ index: 0, color: 'Black' }, { index: 1, color: 'Blue' }] },
      { name: 'Mug', type: 'Drinkware', retailPrice: 0, gallery: [{ index: 2, color: 'White' }], orderUrl: 'javascript:alert(1)' },
    ],
  };
  const { blocks } = marketingDocumentModel(input);
  assert.deepEqual(blocks.filter(block => block.type === 'image').map(({ source, label, thumbnail }) => [source, label, thumbnail]),
    [['hero', 'Tee', false], ['alternate', 'Blue', true], ['other', 'Mug', false]]);
  assert(blocks.some(block => block.value === '$20.00'));
  assert(blocks.some(block => block.value === '$0.00'));
  assert(!blocks.some(block => block.type === 'link' || block.value === '$1.23'));
});

test('approved export includes a native quote table without the draft label', async () => {
  const model = marketingDocumentModel({
    template: 'client-quote', organization: 'Example Client',
    productRows: [{ name: 'Example Tee', retailPrice: 19.5, quantity: 2 }],
  }, { approved: true });
  const [docx, pdf] = await Promise.all(['docx', 'pdf'].map(format => exportMarketingDocument(model, format)));
  const xml = new AdmZip(Buffer.from(await docx.arrayBuffer())).readAsText('word/document.xml');
  assert.match(xml, /<w:tbl>/);
  for (const output of [xml, pdfText(Buffer.from(await pdf.arrayBuffer()))]) {
    assert.match(output, /Example Tee/);
    assert.match(output, /\$39\.00/);
    assert.doesNotMatch(output, /FOR INTERNAL REVIEW/);
  }
});
