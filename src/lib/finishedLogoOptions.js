export function mergeLogoOptions(catalogRows, productNames) {
  const options = new Map(catalogRows.map((row) => [row.name.trim().toLocaleLowerCase(), { ...row, logoId: Object.hasOwn(row, 'logoId') ? row.logoId : row.id }]));
  for (const name of productNames) {
    const key = name.trim().toLocaleLowerCase();
    if (key && !options.has(key)) options.set(key, { id: `woo-logo:${key}`, name: name.trim(), logoId: null });
  }
  return [...options.values()].sort((a,b) => a.name.localeCompare(b.name));
}
