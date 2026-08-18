import { supabase } from '../supabaseClient';

function normalizePairing(row = {}) {
  const orderedSku = row.ordered_sku || row.order_sku || row.sku || '';
  const orderedName = row.ordered_name || row.ordered_product_name || row.item_name || row.product_name || orderedSku || '';

  const blankSku = row.paired_blank_sku_base || row.blank_sku || row.blank_sku_base || '';
  const blankName = row.paired_blank_name || row.blank_name || blankSku || '';

  const orderedBrand = row.ordered_brand || row.source_brand || row.finished_brand || '';
  const orderedStyle = row.ordered_style || row.source_style || row.ordered_product_type || row.finished_style || '';
  const orderedColor = row.ordered_color || row.source_color || row.finished_color || '';
  const orderedSize = row.ordered_size || row.source_size || row.finished_size || '';

  const pairedBlankBrand = row.paired_blank_brand || row.blank_brand || '';
  const pairedBlankStyle = row.paired_blank_style || row.blank_style || '';
  const pairedBlankColor = row.paired_blank_color || row.blank_color || '';
  const pairedBlankSize = row.paired_blank_size || row.blank_size || '';

  return {
    ...row,
    id: row.id || row.job_item_id,
    job_item_id: row.job_item_id || row.id,
    line_number: row.line_number,
    quantity: Number(row.quantity || row.qty || 0),

    ordered_sku: orderedSku,
    order_sku: orderedSku,
    ordered_name: orderedName,
    ordered_product_name: orderedName,
    ordered_brand: orderedBrand,
    ordered_style: orderedStyle,
    ordered_color: orderedColor,
    ordered_size: orderedSize,
    ordered_fields_source: row.ordered_fields_source || '',
    ordered_fields_warning: row.ordered_fields_warning || row.pairing_warning || '',

    paired_blank_id: row.paired_blank_id || row.blank_product_id || '',
    blank_product_id: row.blank_product_id || row.paired_blank_id || '',
    paired_blank_sku_base: blankSku,
    blank_sku: blankSku,
    paired_blank_name: blankName,
    blank_name: blankName,
    paired_blank_brand: pairedBlankBrand,
    paired_blank_style: pairedBlankStyle,
    paired_blank_color: pairedBlankColor,
    paired_blank_size: pairedBlankSize,

    pairing_status: row.pairing_status || 'review',
    pairing_warning: row.pairing_warning || row.ordered_fields_warning || '',
    selected_attributes: row.selected_attributes || {},

    // Compatibility with older PullSheetView components that still render these names.
    sku: orderedSku,
    product_name: orderedName,
    name: row.name || orderedName,
    status: row.status || row.job_item_status || row.pairing_status || 'review',
    job_status: row.job_status || row.status || '',
    logo: row.logo || row.artwork_note || row.artwork || '',
    placement: row.placement || '',
    notes: row.notes || row.line_notes || '',
  };
}

export async function getPullSheetOrderedBlankPairings(jobId) {
  const { data, error } = await supabase.rpc('sc_pull_sheet_ordered_blank_pairings', {
    p_job_id: Number(jobId),
  });

  if (error) throw error;
  return (data || []).map(normalizePairing);
}

// Export name expected by the current PullSheetView.jsx.
export async function getPullSheetItemsWithPairings(jobId) {
  return getPullSheetOrderedBlankPairings(jobId);
}

export async function searchBlankProductsForOverride(search = '') {
  const term = String(search || '').trim();

  const { data, error } = await supabase.rpc('search_blank_products_for_edit', {
    p_search: term,
  });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    sku_base: row.sku_base,
    name: row.name,
    brand: row.brand || row.brand_name || '',
    style: row.product_type || row.style || row.product_type_name || '',
    product_type: row.product_type || row.style || row.product_type_name || '',
    color: row.color || row.color_name || '',
    size: row.size || row.size_name || '',
    label: [row.sku_base, row.brand, row.product_type, row.color, row.size].filter(Boolean).join(' / '),
  }));
}

export async function overridePullSheetBlankPairing(jobItemId, newBlankProductId, reason = '') {
  const { data, error } = await supabase.rpc('override_job_item_blank_pairing', {
    p_job_item_id: Number(jobItemId),
    p_new_blank_product_id: newBlankProductId,
    p_reason: reason || 'Manual pull sheet blank override',
  });

  if (error) throw error;
  return data;
}

// Export name expected by the current PullSheetView.jsx.
export async function overrideJobItemBlankPairing(jobItemId, newBlankProductId, reason = '') {
  return overridePullSheetBlankPairing(jobItemId, newBlankProductId, reason);
}
