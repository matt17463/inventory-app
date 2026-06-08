
import { supabase } from "./supabaseClient";

function unwrapRpcResult(data, error) {
  if (error) {
    return { success: false, message: error.message || "Supabase RPC failed.", error };
  }
  if (data && typeof data === "object" && !Array.isArray(data)) return data;
  return { success: true, data };
}

export async function getBlankSourceBins(blankProductId) {
  if (!blankProductId) return [];
  const { data, error } = await supabase.rpc("sc_pull_sheet_blank_source_bins", {
    p_blank_product_id_text: String(blankProductId),
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function completePullSheetItemDeductBlankSafe({
  jobItemId,
  blankProductId,
  binId = "",
  quantity,
  notes = "",
}) {
  const { data, error } = await supabase.rpc("sc_complete_pull_sheet_item_deduct_blank_safe", {
    p_job_item_id_text: String(jobItemId || ""),
    p_blank_product_id_text: blankProductId ? String(blankProductId) : null,
    p_bin_id_text: binId ? String(binId) : null,
    p_quantity: quantity ? Number(quantity) : null,
    p_notes: notes || null,
  });

  return unwrapRpcResult(data, error);
}
