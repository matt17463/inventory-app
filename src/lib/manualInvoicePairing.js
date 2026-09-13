function normalizeIdentityValue(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function rowIdentityValue(row, primary, alternate) {
  return normalizeIdentityValue(
    row?.[primary] ?? (alternate ? row?.[alternate] : '')
  );
}

export function findUniqueExactBlankMatch(rows = [], line = {}) {
  const target = {
    brand: normalizeIdentityValue(line.brand),
    style: normalizeIdentityValue(line.style),
    color: normalizeIdentityValue(line.color),
    size: normalizeIdentityValue(line.size),
  };

  if (!target.brand || !target.style || !target.color || !target.size) {
    return null;
  }

  const matches = (Array.isArray(rows) ? rows : []).filter((row) => (
    rowIdentityValue(row, 'brand', 'brand_name') === target.brand
    && rowIdentityValue(row, 'style', 'product_type') === target.style
    && rowIdentityValue(row, 'color', 'color_name') === target.color
    && rowIdentityValue(row, 'size', 'size_name') === target.size
  ));

  return matches.length === 1 ? matches[0] : null;
}
