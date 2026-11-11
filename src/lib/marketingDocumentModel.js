import { technicalGuideFields } from './marketingTechnicalGuide.js';
import { safeGrowthUrl } from './growthPricing.js';
import { marketingDocumentBlueprint } from './marketingDocumentBlueprints.js';
import { marketingTemplates } from './marketingCatalogPolicy.js';
import { marketingTheme } from './marketingDesignSystem.js';

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
  const accent = ['school','team'].includes(document.segment) ? marketingTheme(document).primary :
    brandColors[0] || palette[blueprint.theme === 'event-theme' ? eventTheme : blueprint.theme] || '#284A65';
  const blocks = [];
  const schoolTeamDocuments = new Set(['brochure-schools','brochure-sports','fundraising-proposal','store-launch','proposal','coach-recognition','product-catalog','package-comparison']);
  if (['school','team'].includes(document.segment) && schoolTeamDocuments.has(document.template)) {
    const school = document.segment === 'school';
    const message = school ? 'More school pride. More ways to support your programs.' :
      'Build team identity on and off the field.';
    blocks.push({type:'heading',value:message});
    blocks.push({type:'paragraph',value:school ?
      'Explore coordinated spirit wear, staff apparel, branded merchandise and convenient family ordering with Skilled Crafting.' :
      'Explore coordinated team merchandise, family apparel, coach recognition and ordering options designed around your club.'});
  }
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
  if (['school','team'].includes(document.segment) && schoolTeamDocuments.has(document.template)) {
    blocks.push({type:'heading',value:'How the partnership works'});
    blocks.push({type:'paragraph',value:'1. Discuss your audience and program goals.\n2. Select products and confirm artwork.\n3. Review selling prices, ordering and fulfillment details.\n4. Approve the program before launch.'});
    if(document.template === 'fundraising-proposal') blocks.push({type:'paragraph',value:'Fundraising proceeds depend on verified selling prices, decorated costs, taxes, fees, returns and agreed payout terms. No proceeds are guaranteed.'});
  }
  const technical = technicalGuideFields[document.template];
  if (technical && document.technicalRevision) blocks.push(field('Revision and approval', document.technicalRevision));
  if (technical && document.technicalRows?.length) {
    blocks.push({ type: 'heading', value: technical.heading },
      { type: 'table', columns: technical.columns, rows: document.technicalRows });
  }
  const guideImages = document.template === 'brand-guide' ? document.logoOptions :
    document.template === 'product-placement-guide' ? document.productImages : null;
  if (guideImages?.length) {
    blocks.push({ type: 'heading', value: technical.imageHeading });
    for (const [index, source] of guideImages.entries()) {
      if (source) blocks.push(image(source, text(document.technicalImageLabels?.[index]) || 'Reference ' + (index + 1)));
    }
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
  } else if (rows.length && !technical) {
    blocks.push({ type: 'heading', value: 'Products' });
    let productType;
    rows.forEach((row, index) => {
      if (text(row.type) && row.type !== productType) {
        productType = row.type;
        blocks.push({ type: 'heading', value: productType });
      }
      blocks.push({ type: 'subheading', value: text(row.name) });
      const source = (!guideImages?.length && document.productImages?.[row.gallery?.[0]?.index ?? index]) || (!index && document.productImage);
      if (source) blocks.push(image(source, text(row.name)));
      for (const variant of (row.gallery || []).slice(1)) {
        const source = document.productImages?.[variant.index];
        if (source) blocks.push(image(source, text(variant.color) || text(row.name), true));
      }
      for (const [label, value] of [
        ['Style code', row.sku], ['Sizes', row.sizes], ['Colors', row.colors],
        ['Customer unit price', row.variants?.length ? '' : price(row.retailPrice)], ['Quantity', Number.isSafeInteger(Number(row.quantity)) && Number(row.quantity) > 0 ? String(row.quantity) : ''],
      ]) if (text(value)) blocks.push(field(label, text(value)));
      for (const specification of (row.specifications || [])) {
        if (text(specification.label) && text(specification.value)) blocks.push(field(specification.label, specification.value));
      }
      const orderUrl = safeGrowthUrl(row.orderUrl);
      if (orderUrl?.startsWith('https://')) blocks.push({ type: 'link', label: 'Order ' + text(row.name), url: orderUrl });
      if (row.variants?.length) {
        const combinations = new Map();
        for (const variant of row.variants) {
          const values = [text(variant.size), text(variant.color), text(variant.sku), price(variant.price)];
          combinations.set(JSON.stringify(values), values);
        }
        blocks.push({ type: 'table', columns: ['Size', 'Color', 'Variant SKU', 'Customer price'], rows: [...combinations.values()] });
      }

    });
  } else if (document.productImage && !guideImages?.length) {
    blocks.push(image(document.productImage, 'Product image'));
  }
  for (const [index, source] of (document.template === "brand-guide" ? [] : document.logoOptions || []).entries()) blocks.push(image(source, 'Logo option ' + (index + 1), true));
  for (const swatch of (document.productSwatches || [])) {
    if (hex(swatch.hex)) blocks.push({ type: 'swatch', label: text(swatch.name) + ' · ' + swatch.hex, color: swatch.hex });
  }
  for (const [label, value] of [['Artwork placement', document.placement], ['Terms', document.terms], ['Next step', document.cta]]) {
    if (text(value)) blocks.push({ type: 'heading', value: label }, { type: 'paragraph', value: text(value) });
  }
  return { title: template.label, organization: text(document.organization), accent, approved, blocks };
}
