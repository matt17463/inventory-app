import { supplierMatchKey } from './supplierConfirmationParser.js';

function text(value) {
  return String(value ?? '').trim();
}

function rowId(row) {
  return text(row?.id ?? row?.color_id ?? row?.canonical_color_id ?? row?.canonical_color_id_text);
}

function ruleSourceId(rule) {
  return text(rule?.source_color_id ?? rule?.source_color_id_text);
}

function ruleCanonicalId(rule) {
  return text(rule?.canonical_color_id ?? rule?.canonical_color_id_text);
}

function colorKeys(color) {
  return [color?.name, color?.code, color?.slug, color?.woo_slug, color?.woocommerce_slug]
    .map(supplierMatchKey)
    .filter(Boolean);
}

function activeRules(rules) {
  return (rules || []).filter((rule) => !rule?.status || String(rule.status).toLowerCase() === 'active');
}

/**
 * Resolve supplier color text to the application's canonical color record.
 * The colors table is the lookup used by WooCommerce-synced products. Active
 * color-pairing rules collapse duplicate/alias records to that canonical row.
 */
export function matchSupplierColor(value, colors = [], rules = [], aliases = [], sourceSystem = '') {
  const wanted = supplierMatchKey(value);
  if (!wanted) return { color_id: '', color_match_method: 'supplier color missing' };

  const activeColorById = new Map((colors || []).filter((color) => color?.is_active !== false).map((color) => [rowId(color), color]));
  const savedAlias = (aliases || []).find((alias) => (
    (!sourceSystem || text(alias?.source_system) === text(sourceSystem))
    && supplierMatchKey(alias?.source_key || alias?.source_value) === wanted
  ));
  const savedCanonicalId = text(savedAlias?.canonical_color_id_text);
  if (savedCanonicalId && activeColorById.has(savedCanonicalId)) {
    return { color_id: savedCanonicalId, color_match_method: 'remembered supplier color pairing' };
  }

  const exactRows = (colors || []).filter((color) => colorKeys(color).includes(wanted));
  const enabledRules = activeRules(rules);
  const sourceRuleMatches = enabledRules.filter((rule) => (
    supplierMatchKey(rule?.source_color_name) === wanted
    || supplierMatchKey(rule?.source_color_code) === wanted
  ));

  const resolvedIds = new Set();
  for (const color of exactRows) {
    const id = rowId(color);
    const pairing = enabledRules.find((rule) => ruleSourceId(rule) === id);
    resolvedIds.add(ruleCanonicalId(pairing) || id);
  }
  for (const rule of sourceRuleMatches) {
    const canonicalId = ruleCanonicalId(rule);
    if (canonicalId) resolvedIds.add(canonicalId);
  }

  const existingIds = [...resolvedIds].filter((resolvedId) => activeColorById.has(resolvedId));
  if (existingIds.length === 1) {
    const usedPairing = sourceRuleMatches.length > 0
      || exactRows.some((color) => {
        const pairing = enabledRules.find((rule) => ruleSourceId(rule) === rowId(color));
        return pairing && ruleCanonicalId(pairing) === existingIds[0];
      });
    return {
      color_id: existingIds[0],
      color_match_method: usedPairing ? 'WooCommerce color pairing rule' : 'WooCommerce color exact match',
    };
  }

  if (existingIds.length > 1 || exactRows.length > 1) {
    return { color_id: '', color_match_method: 'ambiguous WooCommerce color' };
  }
  return { color_id: '', color_match_method: 'choose existing WooCommerce color' };
}
