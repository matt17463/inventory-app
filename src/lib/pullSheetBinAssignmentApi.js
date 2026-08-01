import { supabase } from '../supabaseClient';

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function databaseId(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return /^\d+$/.test(text) ? Number(text) : text;
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

/**
 * Pending Stock is the virtual shortage bin.
 *
 * A separate physical bin named Unassigned is intentionally NOT considered
 * Pending Stock once the official Pending Stock bin exists.
 */
export function isPendingStockBin(bin) {
  return binSearchValues(bin).some((value) => (
    value === 'pending stock'
    || value.includes('pending stock')
  ));
}

function isLegacyUnassignedBin(bin) {
  return binSearchValues(bin).some((value) => (
    value === 'unassigned'
    || value.includes('unassigned')
  ));
}

// Backward-compatible export for old imports. It now means the official
// Pending Stock workflow bin, not every bin named Unassigned.
export const isUnassignedBin = isPendingStockBin;

function normalizeBin(bin, { legacyFallback = false } = {}) {
  if (!bin) return null;

  return {
    ...bin,
    bin_id: bin.bin_id ?? bin.id,
    quantity_on_hand: 0,
    available_quantity: 0,
    is_pending_stock_fallback: true,
    is_legacy_unassigned_fallback: legacyFallback,
    display_label: 'Pending Stock',
  };
}

async function readBins() {
  const { data, error } = await supabase
    .from('bins')
    .select('id, bin_code, label, location, display_order')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('bin_code', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getPendingStockBins() {
  const bins = await readBins();
  const officialBins = bins.filter(isPendingStockBin);

  if (officialBins.length) {
    return officialBins.map((bin) => normalizeBin(bin));
  }

  // Legacy fallback is used only when the official Pending Stock bin has not
  // yet been created or renamed. It never combines Pending Stock and a
  // physical Unassigned bin into the same workflow category.
  return bins
    .filter(isLegacyUnassignedBin)
    .map((bin) => normalizeBin(bin, { legacyFallback: true }));
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

export const getUnassignedBin = getPendingStockBin;

export async function saveJobItemSelectedBin({ jobItemId, binId }) {
  const resolvedJobItemId = databaseId(jobItemId);

  if (resolvedJobItemId === null) {
    throw new Error('A valid pull-sheet line ID is required.');
  }

  const { data, error } = await supabase
    .from('job_items')
    .update({
      selected_bin_id: databaseId(binId),
    })
    .eq('id', resolvedJobItemId)
    .select('id, selected_bin_id')
    .single();

  if (error) throw error;
  return data;
}

function groupPhysicalStockRows(stockedRows, pendingStockIds) {
  const byProduct = new Map();

  (stockedRows || []).forEach((row) => {
    if (pendingStockIds.has(String(row.bin_id || ''))) return;

    const productKey = String(row.blank_product_id || '');
    if (!productKey) return;

    const quantity = Math.max(0, Number(row.quantity_on_hand || 0));
    if (quantity <= 0) return;

    const bins = byProduct.get(productKey) || [];
    bins.push({
      bin_id: row.bin_id,
      quantity_on_hand: quantity,
    });
    byProduct.set(productKey, bins);
  });

  return byProduct;
}

export async function assignOutOfStockJobItemsToPendingStock(jobId) {
  const numericJobId = Number(jobId);

  if (!Number.isFinite(numericJobId) || numericJobId <= 0) {
    return {
      success: false,
      job_id: jobId || null,
      assigned_count: 0,
      reassigned_to_physical_count: 0,
      cleared_for_bin_selection_count: 0,
      already_pending_stock_count: 0,
      error: 'A valid pull sheet job ID is required.',
    };
  }

  try {
    const pendingStockBin = await getPendingStockBin();
    const pendingStockBins = await getPendingStockBins();
    const pendingStockIds = new Set(
      pendingStockBins.map((bin) => String(bin.bin_id))
    );

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
        unassigned_bin_id: pendingStockBin.bin_id,
        assigned_count: 0,
        reassigned_to_physical_count: 0,
        cleared_for_bin_selection_count: 0,
        already_pending_stock_count: 0,
        already_unassigned_count: 0,
        out_of_stock_job_item_ids: [],
      };
    }

    const blankProductIds = [
      ...new Set(candidates.map((row) => String(row.blank_product_id))),
    ];

    const { data: stockedRows, error: stockError } = await supabase
      .from('bin_blank_inventory_contents')
      .select('blank_product_id, quantity_on_hand, bin_id')
      .in('blank_product_id', blankProductIds)
      .gt('quantity_on_hand', 0);

    if (stockError) throw stockError;

    const physicalBinsByProduct = groupPhysicalStockRows(
      stockedRows,
      pendingStockIds
    );

    const pendingStockId = String(pendingStockBin.bin_id);
    const assignToPendingIds = [];
    const reassignments = [];
    const clearSelections = [];
    const alreadyPendingStock = [];
    const outOfStockJobItemIds = [];

    candidates.forEach((row) => {
      const productKey = String(row.blank_product_id);
      const requiredQuantity = Math.max(1, Number(row.quantity || 0));
      const physicalBins = physicalBinsByProduct.get(productKey) || [];
      const eligibleBins = physicalBins.filter(
        (bin) => Number(bin.quantity_on_hand || 0) >= requiredQuantity
      );
      const selectedBinId = String(row.selected_bin_id || '');
      const selectedIsPending = pendingStockIds.has(selectedBinId);

      if (!eligibleBins.length) {
        outOfStockJobItemIds.push(row.id);

        if (selectedBinId === pendingStockId) {
          alreadyPendingStock.push(row);
        } else {
          assignToPendingIds.push(row.id);
        }
        return;
      }

      if (!selectedIsPending) return;

      if (eligibleBins.length === 1) {
        reassignments.push({
          job_item_id: row.id,
          bin_id: eligibleBins[0].bin_id,
        });
      } else {
        // Stock exists in more than one usable bin. Clear the stale Pending
        // Stock value and let the employee choose the physical source bin.
        clearSelections.push(row.id);
      }
    });

    if (assignToPendingIds.length) {
      const { error: pendingError } = await supabase
        .from('job_items')
        .update({ selected_bin_id: pendingStockBin.bin_id })
        .in('id', assignToPendingIds);

      if (pendingError) throw pendingError;
    }

    for (const repair of reassignments) {
      await saveJobItemSelectedBin({
        jobItemId: repair.job_item_id,
        binId: repair.bin_id,
      });
    }

    if (clearSelections.length) {
      const { error: clearError } = await supabase
        .from('job_items')
        .update({ selected_bin_id: null })
        .in('id', clearSelections);

      if (clearError) throw clearError;
    }

    return {
      success: true,
      job_id: numericJobId,
      pending_stock_bin_id: pendingStockBin.bin_id,
      unassigned_bin_id: pendingStockBin.bin_id,
      assigned_count: assignToPendingIds.length,
      reassigned_to_physical_count: reassignments.length,
      cleared_for_bin_selection_count: clearSelections.length,
      already_pending_stock_count: alreadyPendingStock.length,
      already_unassigned_count: alreadyPendingStock.length,
      out_of_stock_job_item_ids: outOfStockJobItemIds,
    };
  } catch (error) {
    return {
      success: false,
      job_id: numericJobId,
      assigned_count: 0,
      reassigned_to_physical_count: 0,
      cleared_for_bin_selection_count: 0,
      already_pending_stock_count: 0,
      already_unassigned_count: 0,
      error: error?.message || String(error),
    };
  }
}

export const assignOutOfStockJobItemsToUnassigned =
  assignOutOfStockJobItemsToPendingStock;
