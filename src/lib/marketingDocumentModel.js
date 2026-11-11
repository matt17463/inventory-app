import { safeGrowthUrl } from './growthPricing.js';
import { marketingDocumentBlueprint } from './marketingDocumentBlueprints.js';
import { marketingTemplates } from './marketingCatalogPolicy.js';

const text = value => typeof value === 'string' ? value.trim() : '';
const hex = value => /^#[0-9a-f]{6}$/i.test(value || '');
const price = value => (typeof value === 'number' || text(value)) &&
  Number.isFinite(Number(value)) && Number(value) >= 0 ? '$' + Number(value).toFixed(2) : '';
const image = (source, label, thumbnail = false) => ({ type: 'image', source, label, thumbnail });
const field = (label, value) => ({ type: 'field', label, value });
const palette = { 'skilled-crafting': '#A82135', wedding: '#694957', sports: '#274B62', business: '#284A65', recognition: '#6C501D' };

export function marketingSectionMissing(document) {
  if (document.contentVersion !== 2) return [];
  const blueprint = marketingDocumentBlueprint(document.template);
  if (!blueprint) return ['valid document template'];
  return blueprint.sections.filter(section => !text(document.sectionContent?.[section]));
}

export function marketingDocumentModel(document, { approved = false } = {}) {
  const template = marketingTemplates.find(item => item.id === document.template);
  const blueprint = marketingDocumentBlueprint(document.template);
  if (!template || !blueprint) throw Error('Choose a valid marketing template.');
  const brandColors = Array.isArray(document.confirmedColors) ? document.confirmedColors.filter(hex) : [];
  const eventTheme = document.template.includes('wedding') ? 'wedding' : document.template === 'coach-recognition' ?
    'sports' : document.template === 'employee-recognition' ? 'recognition' : 'business';
  const accent = palette[blueprint.theme === 'event-theme' ? eventTheme : blueprint.theme] || brandColors[0] || '#284A65';
  const blocks = [];
  if (document.logo) blocks.push(image(document.logo, 'Client logo', true));
  if (text(document.description)) blocks.push({ type: 'paragraph', value: text(document.description) });
  for (const color of (document.template === "brand-guide" ? brandColors : [])) {
    const rgb = color.slice(1).match(/../g).map(channel => parseInt(channel, 16));
    blocks.push({ type: 'swatch', label: color + ' · RGB ' + rgb.join(', '), color });
  }
  for (const label of blueprint.sections) {
    const value = text(document.sectionContent?.[label]);
    if (value) blocks.push({ type: 'heading', value: label }, { type: 'paragraph', value });
  }
  const rows = document.productRows?.length ? document.productRows : document.style ? [{
    name: document.style, sku: document.sku, sizes: document.sizes, colors: document.productColors,
    retailPrice: document.retailPrice, quantity: document.quantity,
  }] : [];
  if (rows.length && ['pricing', 'quote'].includes(template.kind)) {
    blocks.push({ type: 'heading', value: 'Customer pricing' });
    blocks.push({
      type: 'table', columns: ['Product', 'Quantity', 'Unit price', 'Line total'],
      rows: rows.map(row => {
        const quantity = Number(row.quantity);
        const validQuantity = Number.isSafeInteger(quantity) && quantity > 0;
        const unitPrice = price(row.retailPrice);
        return [text(row.name), validQuantity ? String(quantity) : '', unitPrice,
          validQuantity && unitPrice ? price(quantity * Number(row.retailPrice)) : ''];
      }),
    });
  } else if (rows.length) {
    blocks.push({ type: 'heading', value: 'Products' });
    let productType;
    rows.forEach((row, index) => {
      if (text(row.type) && row.type !== productType) {
        productType = row.type;
        blocks.push({ type: 'heading', value: productType });
      }
      blocks.push({ type: 'subheading', value: text(row.name) });
      const source = document.productImages?.[row.gallery?.[0]?.index ?? index] || (!index && document.productImage);
      if (source) blocks.push(image(source, text(row.name)));
      for (const variant of (row.gallery || []).slice(1)) {
        const source = document.productImages?.[variant.index];
        if (source) blocks.push(image(source, text(variant.color) || text(row.name), true));
      }
      for (const [label, value] of [
        ['Style code', row.sku], ['Sizes', row.sizes], ['Colors', row.colors],
        ['Customer unit price', price(row.retailPrice)], ['Quantity', Number.isSafeInteger(Number(row.quantity)) && Number(row.quantity) > 0 ? String(row.quantity) : ''],
      ]) if (text(value)) blocks.push(field(label, text(value)));
      const orderUrl = safeGrowthUrl(row.orderUrl);
      if (orderUrl?.startsWith('https://')) blocks.push({ type: 'link', label: 'Order ' + text(row.name), url: orderUrl });
    });
  } else if (document.productImage) blocks.push(image(document.productImage, 'Product image'));
  for (const [index, source] of (document.logoOptions || []).entries()) blocks.push(image(source, 'Logo option ' + (index + 1), true));
  for (const swatch of (document.productSwatches || [])) {
    if (hex(swatch.hex)) blocks.push({ type: 'swatch', label: text(swatch.name) + ' · ' + swatch.hex, color: swatch.hex });
  }
  for (const [label, value] of [['Artwork placement', document.placement], ['Terms', document.terms], ['Next step', document.cta]]) {
    if (text(value)) blocks.push({ type: 'heading', value: label }, { type: 'paragraph', value: text(value) });
  }
  return { title: template.label, organization: text(document.organization), accent, approved, blocks };
}
