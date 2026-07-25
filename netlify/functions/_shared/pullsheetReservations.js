function clean(value) {
  return String(value ?? '').trim();
}

export async function ensureJobItemReservation(supabase, {
  jobId,
  jobItemId,
  blankProductId,
  quantity,
}) {
  const { data, error } = await supabase.rpc('sc_ensure_job_item_reservation_v1', {
    p_job_id: Number(jobId),
    p_job_item_id: Number(jobItemId),
    p_blank_product_id: blankProductId,
    p_quantity: Number(quantity),
  });
  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  if (result?.success === false || result?.needs_review) {
    const reservationError = new Error(
      result?.action === 'mismatch'
        ? 'An active reservation exists but its blank product or quantity does not match the order line.'
        : 'Reservation could not be ensured.'
    );
    reservationError.code = result?.action || 'reservation_review_required';
    reservationError.details = result || null;
    throw reservationError;
  }
  return result || { success: true, action: 'unknown' };
}

export async function startPullsheetRun(supabase, {
  source,
  orderId = null,
  requestId = null,
  metadata = {},
}) {
  try {
    const { data, error } = await supabase
      .from('sc_pullsheet_sync_runs')
      .insert({
        source: clean(source) || 'unknown',
        woocommerce_order_id: orderId ? Number(orderId) : null,
        request_id: clean(requestId) || null,
        metadata: metadata || {},
      })
      .select('id')
      .single();
    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    console.warn('Pull-sheet run logging unavailable:', error?.message || error);
    return null;
  }
}

export async function finishPullsheetRun(supabase, runId, values = {}) {
  if (!runId) return;
  try {
    const { error } = await supabase
      .from('sc_pullsheet_sync_runs')
      .update({
        ...values,
        completed_at: new Date().toISOString(),
      })
      .eq('id', Number(runId));
    if (error) throw error;
  } catch (error) {
    console.warn('Pull-sheet run completion logging unavailable:', error?.message || error);
  }
}
