import { supabase } from '../supabaseClient';

function normalizePairing(row = {}) {
  const orderedSku = row.ordered_sku || row.order_sku || row.sku || '';
  const orderedName = row.ordered_name || row.ordered_product_name || row.item_name || row.product_name || orderedSku || '';

  const blankSku = row.paired_blank_sku_base || row.blank_sku || row.blank_sku_base || '';
  const blankName = row.paired_blank_name || row.blank_name || blankSku || '';

  return {
    ...row,
    job_item_id: row.job_item_id || row.id,
    line_number: row.line_number,
    quantity: Number(row.quantity || row.qty || 0),

    ordered_sku: orderedSku,
    order_sku: orderedSku,
    ordered_name: orderedName,
    ordered_product_name: orderedName,
    ordered_brand: row.ordered_brand || row.source_brand || '',
    ordered_style: row.ordered_style || row.source_style || row.ordered_product_type || '',
    ordered_color: row.ordered_color || row.source_color || '',
    ordered_size: row.ordered_size || row.source_size || '',
    ordered_fields_source: row.ordered_fields_source || '',
    ordered_fields_warning: row.ordered_fields_warning || row.pairing_warning || '',

    paired_blank_id: row.paired_blank_id || row.blank_product_id || '',
    blank_product_id: row.blank_product_id || row.paired_blank_id || '',
    paired_blank_sku_base: blankSku,
    blank_sku: blankSku,
    paired_blank_name: blankName,
    blank_name: blankName,
    paired_blank_brand: row.paired_blank_brand || row.blank_brand || '',
    paired_blank_style: row.paired_blank_style || row.blank_style || '',
    paired_blank_color: row.paired_blank_color || row.blank_color || '',
    paired_blank_size: row.paired_blank_size || row.blank_size || '',

    pairing_status: row.pairing_status || 'review',
    pairing_warning: row.pairing_warning || row.ordered_fields_warning || '',
    selected_attributes: row.selected_attributes || {},
  };
}

export async function getPullSheetOrderedBlankPairings(jobId) {
  const { data, error } = await supabase.rpc('sc_pull_sheet_ordered_blank_pairings', {
    p_job_id: Number(jobId),
  });

  if (error) throw error;
  return (data || []).map(normalizePairing);
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
