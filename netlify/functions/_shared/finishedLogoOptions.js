const logoAttributes = new Set(['logo', 'logotype', 'logoselection', 'logodesign', 'designselection']);
export function productLogoOptions(products) {
  const names = new Map();
  for (const product of products) {
    for (const attribute of product.attributes || []) {
      const key = String(attribute.name || '').toLowerCase().replace(/^pa[_-]/, '').replace(/[^a-z0-9]/g, '');
      if (!logoAttributes.has(key)) continue;
      for (const option of attribute.options || []) {
        for (const part of String(option).split('|')) {
          const name = part.trim();
          if (name) names.set(name.toLocaleLowerCase(), name);
        }
      }
    }
  }
  return [...names.values()].sort((a,b) => a.localeCompare(b));
}
