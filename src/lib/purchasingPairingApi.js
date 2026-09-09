import { supabase } from '../supabaseClient';

function cleanSearchTerm(value) {
  return String(value || '').trim().replace(/[%_,]/g, ' ');
}

function normalizeBlank(row) {
  const brand = row?.brand || row?.brand_name || row?.brands?.name || '';
  const style = row?.product_type || row?.style || row?.product_type_name || row?.product_types?.name || '';
  const color = row?.color || row?.color_name || row?.colors?.name || '';
  const size = row?.size || row?.size_name || row?.sizes?.name || '';

  return {
    ...row,
    brand,
    style,
    product_type: style,
    color,
    size,
    label: [row?.sku_base, brand, style, color, size].filter(Boolean).join(' / '),
  };
}

export function isManualPlaceholderSku(value) {
  return /^MANUAL-\d+-LINE-\d+$/i.test(String(value || '').trim());
}

export function sourceHasReusableMappingKey(source = {}) {
  const variationId = String(source?.woocommerce_variation_id || '').trim();
  const productId = String(source?.woocommerce_product_id || '').trim();
  const sku = String(source?.order_sku || '').trim();

  if (/^\d+$/.test(variationId)) return true;
  if (sku && !isManualPlaceholderSku(sku)) return true;
  return /^\d+$/.test(productId);
}

export function reusableMappingSummary(source = {}) {
  const parts = [];
  const variationId = String(source?.woocommerce_variation_id || '').trim();
  const productId = String(source?.woocommerce_product_id || '').trim();
  const sku = String(source?.order_sku || '').trim();

  if (/^\d+$/.test(variationId)) parts.push(`Woo variation #${variationId}`);
  if (sku && !isManualPlaceholderSku(sku)) parts.push(`SKU ${sku}`);
  if (!variationId && /^\d+$/.test(productId)) parts.push(`Woo product #${productId}`);

  return parts.join(' + ');
}

export async function searchPurchasingPairingBlanks(search = '') {
  const term = cleanSearchTerm(search);

  // Prefer the existing inventory search RPC because it searches SKU/name plus
  // related brand/style/color/size fields in the same way other pairing tools do.
  const rpc = await supabase.rpc('search_blank_products_for_edit', {
    p_search: term,
  });

  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data.map(normalizeBlank).filter((row) => row?.id).slice(0, 75);
  }

  let query = supabase
    .from('blank_products')
    .select(`
      id,
      sku_base,
      name,
      brand_id,
      product_type_id,
      color_id,
      size_id,
      sc_is_archived,
      brands:brand_id(name, code),
      product_types:product_type_id(name, code),
      colors:color_id(name, code),
      sizes:size_id(name, code)
    `)
    .eq('sc_is_archived', false)
    .limit(75);

  if (term) {
    const safe = term.replace(/\s+/g, ' ').trim();
    query = query.or(`sku_base.ilike.%${safe}%,name.ilike.%${safe}%`);
  }

  const fallback = await query;
  if (fallback.error) {
    const message = rpc.error?.message || fallback.error.message || 'Blank-product search failed.';
    throw new Error(message);
  }

  return (fallback.data || []).map(normalizeBlank).filter((row) => row?.id);
}

export async function fixPurchasingPairing({
  jobItemId,
  newBlankProductId,
  reason,
  rememberMapping = true,
}) {
  const numericJobItemId = Number(jobItemId);
  if (!Number.isFinite(numericJobItemId) || numericJobItemId <= 0) {
    throw new Error('A valid pull-sheet line ID is required.');
  }
  if (!newBlankProductId) {
    throw new Error('Choose the correct replacement blank product.');
  }

  const { data, error } = await supabase.rpc('sc_purchasing_fix_pairing_v1', {
    p_job_item_id: numericJobItemId,
    p_new_blank_product_id: newBlankProductId,
    p_reason: String(reason || '').trim() || 'Corrected from Purchasing Report',
    p_remember_mapping: Boolean(rememberMapping),
  });

  if (error) {
    if (/function .*sc_purchasing_fix_pairing_v1.*does not exist|could not find/i.test(error.message || '')) {
      throw new Error('Purchasing pairing SQL is not installed yet. Run deployment/sql/58_PURCHASING_INLINE_PAIRING_REPAIR.sql in Supabase.');
    }
    throw error;
  }

  return data || {};
}
