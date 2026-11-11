export const technicalGuideFields = {
  'brand-guide': {
    heading: 'Brand application matrix',
    help: 'Enter one approved application per line. Include embroidery, DTF, UV and print where applicable.',
    columns: ['Application', 'Approved mark', 'Background', 'Minimum size', 'Restrictions'],
    imageHeading: 'Approved logo variants',
  },
  'product-placement-guide': {
    heading: 'Placement specifications',
    help: 'Enter one verified placement per garment and size range. Include units, tolerance and the measurement origin in each row.',
    columns: ['Garment and sizes', 'Placement', 'Origin and offset', 'Artwork dimensions', 'Allowed range', 'Method'],
    imageHeading: 'Approved placement views',
  },
};

export function parseTechnicalGuideRows(template, input) {
  const config = technicalGuideFields[template];
  if (!config) return [];
  const lines = String(input || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length > 25) throw Error('Use up to 25 technical specifications per guide.');
  return lines.map((line, index) => {
    const cells = line.split('|').map(cell => cell.trim());
    if (cells.length !== config.columns.length || cells.some(cell => !cell || cell.length > 180))
      throw Error('Specification ' + (index + 1) + ' needs each field in order, with up to 180 characters per field.');
    return cells;
  });
}

export function technicalGuideMissing(document) {
  const config = technicalGuideFields[document.template];
  if (!config || document.contentVersion !== 2) return [];
  const missing = [];
  const rows = document.technicalRows;
  if (!Array.isArray(rows) || !rows.length || rows.length > 25 || rows.some(row =>
    !Array.isArray(row) || row.length !== config.columns.length ||
    row.some(cell => typeof cell !== 'string' || !cell.trim() || cell.length > 180))) missing.push(config.heading);
  const images = document.template === 'brand-guide' ? document.logoOptions || document.marketing_logo_options :
    document.productImages || document.marketing_product_images;
  if (!Array.isArray(images) || !images.length || images.some(image => !image)) missing.push(config.imageHeading);
  else if (!Array.isArray(document.technicalImageLabels) ||
    document.technicalImageLabels.length !== images.length ||
    document.technicalImageLabels.some(label => typeof label !== 'string' || !label.trim() || label.length > 120))
    missing.push('a caption for each approved image');
  if (typeof document.technicalRevision !== "string" || !document.technicalRevision.trim() || document.technicalRevision.length > 200) missing.push('document revision and approving party');
  return missing;
}
