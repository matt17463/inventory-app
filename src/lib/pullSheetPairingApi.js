import { supabase } from '../supabaseClient';

export async function getPullSheetItemsWithPairings(jobId) {
  const { data, error } = await supabase.rpc('sc_pull_sheet_ordered_blank_pairings', {
    p_job_id: Number(jobId),
  });
  if (error) throw error;
  return data || [];
}

export async function overrideJobItemBlankPairing({ jobItemId, blankProductId, reason }) {
  const { data, error } = await supabase.rpc('sc_override_job_item_blank_pairing', {
    p_job_item_id: Number(jobItemId),
    p_blank_product_id: blankProductId,
    p_reason: reason || null,
  });
  if (error) throw error;
  return data?.[0] || null;
}
