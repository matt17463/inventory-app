import { supabase } from '../supabaseClient';

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function isClosedStatus(value) {
  return /complete|void|cancel|deduct/.test(normalizeText(value));
}

function binSearchValues(bin) {
  return [
    bin?.bin_code,
    bin?.code,
    bin?.label,
    bin?.bin_label,
    bin?.name,
  ]
    .map(normalizeText)
    .filter(Boolean);
}

export function isPendingStockBin(bin) {
  return binSearchValues(bin).some((value) => (
    value === 'pending stock'
    || value.includes('pending stock')
    // Backward compatibility while the existing bin is renamed.
    || value === 'unassigned'
    || value.includes('unassigned')
  ));
}

// Backward-compatible export for older imports.
export const isUnassignedBin = isPendingStockBin;

function isPreferredPendingStockBin(bin) {
  return binSearchValues(bin).some((value) => (
    value === 'pending stock' || value.includes('pending stock')
  ));
}

function normalizeBin(bin) {
  if (!bin) return null;

  return {
    ...bin,
    bin_id: bin.bin_id ?? bin.id,
    quantity_on_hand: 0,
    available_quantity: 0,
    is_pending_stock_fallback: true,
    // Present a consistent user-facing name even during the rename transition.
    display_label: 'Pending Stock',
  };
}

export async function getPendingStockBins() {
  const { data, error } = await supabase
    .from('bins')
    .select('id, bin_code, label, location, display_order')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('bin_code', { ascending: true });

  if (error) throw error;

  return (data || [])
    .filter(isPendingStockBin)
    .sort((a, b) => Number(isPreferredPendingStockBin(b)) - Number(isPreferredPendingStockBin(a)))
    .map(normalizeBin);
}

export async function getPendingStockBin() {
  const bins = await getPendingStockBins();
  const bin = bins[0] || null;

  if (!bin) {
    throw new Error(
      'The Pending Stock bin was not found. Create or rename a bin so its code or label is “Pending Stock”.'
    );
  }

  return bin;
}

// Backward-compatible export for older imports.
export const getUnassignedBin = getPendingStockBin;

export async function assignOutOfStockJobItemsToPendingStock(jobId) {
  const numericJobId = Number(jobId);

  if (!Number.isFinite(numericJobId) || numericJobId <= 0) {
    return {
      success: false,
      job_id: jobId || null,
      assigned_count: 0,
      already_pending_stock_count: 0,
      error: 'A valid pull sheet job ID is required.',
    };
  }

  try {
    const pendingStockBin = await getPendingStockBin();

    const { data: jobItems, error: jobItemsError } = await supabase
      .from('job_items')
      .select('id, job_id, quantity, status, blank_product_id, selected_bin_id, inventory_required')
      .eq('job_id', numericJobId)
      .order('id', { ascending: true });

    if (jobItemsError) throw jobItemsError;

    const candidates = (jobItems || []).filter((row) => (
      row.blank_product_id
      && Number(row.quantity || 0) > 0
      && row.inventory_required !== false
      && row.inventory_required !== 'false'
      && !isClosedStatus(row.status)
    ));

    if (!candidates.length) {
      return {
        success: true,
        job_id: numericJobId,
        pending_stock_bin_id: pendingStockBin.bin_id,
        // Legacy response property retained for compatibility.
        unassigned_bin_id: pendingStockBin.bin_id,
        assigned_count: 0,
        already_pending_stock_count: 0,
        already_unassigned_count: 0,
        out_of_stock_job_item_ids: [],
      };
    }

    const blankProductIds = [...new Set(candidates.map((row) => String(row.blank_product_id)))];

    const { data: stockedRows, error: stockError } = await supabase
      .from('bin_blank_inventory_contents')
      .select('blank_product_id, quantity_on_hand, bin_id')
      .in('blank_product_id', blankProductIds)
      .gt('quantity_on_hand', 0);

    if (stockError) throw stockError;

    const pendingStockIds = new Set(
      (await getPendingStockBins()).map((bin) => String(bin.bin_id))
    );

    const inStockProductIds = new Set(
      (stockedRows || [])
        // Pending Stock is a workflow placeholder, never physical inventory.
        .filter((row) => !pendingStockIds.has(String(row.bin_id || '')))
        .map((row) => String(row.blank_product_id))
    );

    const outOfStockItems = candidates.filter(
      (row) => !inStockProductIds.has(String(row.blank_product_id))
    );

    const pendingStockId = String(pendingStockBin.bin_id);
    const alreadyPendingStock = outOfStockItems.filter(
      (row) => String(row.selected_bin_id || '') === pendingStockId
    );
    const needsAssignment = outOfStockItems.filter(
      (row) => String(row.selected_bin_id || '') !== pendingStockId
    );

    if (needsAssignment.length) {
      const { error: updateError } = await supabase
        .from('job_items')
        .update({ selected_bin_id: pendingStockBin.bin_id })
        .in('id', needsAssignment.map((row) => row.id));

      if (updateError) throw updateError;
    }

    return {
      success: true,
      job_id: numericJobId,
      pending_stock_bin_id: pendingStockBin.bin_id,
      unassigned_bin_id: pendingStockBin.bin_id,
      assigned_count: needsAssignment.length,
      already_pending_stock_count: alreadyPendingStock.length,
      already_unassigned_count: alreadyPendingStock.length,
      out_of_stock_job_item_ids: outOfStockItems.map((row) => row.id),
    };
  } catch (error) {
    return {
      success: false,
      job_id: numericJobId,
      assigned_count: 0,
      already_pending_stock_count: 0,
      already_unassigned_count: 0,
      error: error?.message || String(error),
    };
  }
}

// Backward-compatible export for the 0.6.17 call sites.
export const assignOutOfStockJobItemsToUnassigned =
  assignOutOfStockJobItemsToPendingStock;
