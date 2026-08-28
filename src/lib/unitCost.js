function isBlankValue(value) {
  return value == null || String(value).trim() === '';
}

export function parseOptionalUnitCost(value, label = 'Unit cost') {
  if (isBlankValue(value)) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a number that is zero or greater.`);
  }

  return parsed;
}

export function requireUnitCost(value, itemLabel = 'this new blank product') {
  const parsed = parseOptionalUnitCost(value);
  if (parsed == null) {
    throw new Error(`Enter the unit cost for ${itemLabel} before creating it.`);
  }
  return parsed;
}
