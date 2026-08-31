import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function action(payload) {
  const response = await authenticatedFunctionFetch('/.netlify/functions/product-blank-mapping', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(body.message || `Product mapping request failed (HTTP ${response.status}).`);
  return body.data;
}

function firstObject(...values) {
  return values.find((value) => value && typeof value === 'object' && !Array.isArray(value)) || null;
}

export function normalizeMappingBlankRow(row) {
  const item = firstObject(
    row?.item,
    row?.result,
    row?.blank_product,
    row?.sc_search_blank_products_for_pairing,
    row,
  ) || {};
  const brand = item.brand || item.brand_name || item.brand_code || '';
  const style = item.style || item.style_name || item.product_type || item.product_type_name || item.style_code || '';
  const color = item.color || item.color_name || item.color_code || '';
  const size = item.size || item.size_name || item.size_code || '';
  return {
    ...item,
    id: item.id || item.blank_product_id || item.product_id || null,
    sku_base: item.sku_base || item.sku || item.blank_sku || '',
    name: item.name || item.product_name || item.blank_name || '',
    brand,
    style,
    color,
    size,
    brands: firstObject(item.brands, item.brand_obj) || (brand ? { name: brand, code: item.brand_code || '' } : null),
    product_types: firstObject(item.product_types, item.product_type_obj) || (style ? { name: style, code: item.style_code || '' } : null),
    colors: firstObject(item.colors, item.color_obj) || (color ? { name: color, code: item.color_code || '' } : null),
    sizes: firstObject(item.sizes, item.size_obj) || (size ? { name: size, code: item.size_code || '' } : null),
  };
}

export const getProductBlankMappingIssues = (search = '', limit = 250) => action({ action: 'issues', search, limit });
export const searchMappingBlanks = async (search = '', limit = 100) => {
  const rows = await action({ action: 'search_blanks', search, limit });
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeMappingBlankRow)
    .filter((row) => row.id && (row.sku_base || row.name || row.brand || row.style || row.color || row.size));
};
export const setProductBlankMapping = (input) => action({ action: 'set', ...input });
export const backfillProductBlankMappings = (limit = 5000) => action({ action: 'backfill', limit });
export const previewBlankSubstitution = (oldBlankProductId, newBlankProductId) => action({
  action: 'preview_substitution', old_blank_product_id: oldBlankProductId, new_blank_product_id: newBlankProductId,
});
export const applyBlankSubstitution = (oldBlankProductId, newBlankProductId, notes = '') => action({
  action: 'apply_substitution', old_blank_product_id: oldBlankProductId, new_blank_product_id: newBlankProductId, notes,
});
export const getProductBlankMappingHistory = (limit = 50) => action({ action: 'history', limit });
