import { supabase } from '../supabaseClient';

function firstValue(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}

function normalizePairingRow(row = {}) {
  const orderedName = firstValue(
    row.ordered_name,
    row.ordered_product_name,
    row.ordered_product_name_from_sync,
    row.item_name,
    row.name
  );

  const orderedSku = firstValue(
    row.ordered_sku,
    row.order_sku,
    row.ordered_product_sku,
    row.variation_sku
  );

  const pairedBlankId = firstValue(
    row.paired_blank_product_id,
    row.blank_product_id
  );

  const pairedBlankSku = firstValue(
    row.paired_blank_sku_base,
    row.blank_sku,
    row.blank_sku_base,
    row.paired_blank_sku
  );

  const pairedBlankName = firstValue(
    row.paired_blank_name,
    row.blank_name
  );

  let normalizedStatus = firstValue(row.pairing_status, 'review');
  if (normalizedStatus === 'exact_variation_pairing') normalizedStatus = 'paired';
  if (normalizedStatus === 'manual_override') normalizedStatus = 'paired';

  return {
    ...row,

    item_status: firstValue(row.item_status, row.status, 'open'),
    quantity: Number(row.quantity || 0),

    ordered_sku: orderedSku,
    ordered_name: orderedName,
    ordered_brand: firstValue(row.ordered_brand, row.selected_brand),
    ordered_style: firstValue(row.ordered_style, row.selected_style),
    ordered_color: firstValue(row.ordered_color, row.selected_color),
    ordered_size: firstValue(row.ordered_size, row.selected_size),

    paired_blank_product_id: pairedBlankId,
    paired_blank_sku_base: pairedBlankSku,
    paired_blank_name: pairedBlankName,
    paired_blank_brand: firstValue(row.paired_blank_brand, row.blank_brand),
    paired_blank_style: firstValue(row.paired_blank_style, row.blank_style),
    paired_blank_color: firstValue(row.paired_blank_color, row.blank_color),
    paired_blank_size: firstValue(row.paired_blank_size, row.blank_size),

    pairing_status: normalizedStatus,
    pairing_message: firstValue(row.pairing_message, row.pairing_warning),
  };
}

export async function getPullSheetItemsWithPairings(jobId) {
  const numericJobId = Number(jobId);
  if (!Number.isFinite(numericJobId)) {
    throw new Error('A valid job ID is required to load pull sheet pairings.');
  }

  const { data, error } = await supabase.rpc('sc_pull_sheet_ordered_blank_pairings', {
    p_job_id: numericJobId,
  });

  if (error) throw error;
  return (data || []).map(normalizePairingRow);
}

export async function overrideJobItemBlankPairing({ jobItemId, blankProductId, reason }) {
  const numericJobItemId = Number(jobItemId);
  if (!Number.isFinite(numericJobItemId)) {
    throw new Error('A valid job item ID is required to override a blank pairing.');
  }

  if (!blankProductId) {
    throw new Error('Choose a blank product before saving the override.');
  }

  const { data, error } = await supabase.rpc('sc_override_job_item_blank_pairing', {
    p_job_item_id: numericJobItemId,
    p_new_blank_product_id: blankProductId,
    p_reason: reason || null,
    p_changed_by: 'inventory_app',
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
