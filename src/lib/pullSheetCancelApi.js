import { supabase } from '../supabaseClient';
import { shouldSimulateWrites, isTestingModeEnabled } from './testingMode';

export async function getPullSheetCancelPreview(jobId) {
  const { data, error } = await supabase.rpc('sc_pull_sheet_cancel_preview', {
    p_job_id: Number(jobId),
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function cancelPullSheet({ jobId, reason, notes, releaseReservations = true, cancelledBy = 'Inventory app user' }) {
  const payload = {
    jobId: Number(jobId),
    reason,
    notes,
    releaseReservations,
    cancelledBy,
  };

  if (shouldSimulateWrites()) {
    await supabase.rpc('sc_log_testing_mode_event', {
      p_event_type: 'simulated_pull_sheet_cancel',
      p_entity_type: 'job',
      p_entity_id: String(jobId),
      p_action_summary: `Simulated pull sheet cancellation: ${reason || 'No reason provided'}`,
      p_payload: payload,
      p_created_by: cancelledBy,
    }).catch(() => null);

    return {
      testing_mode: true,
      simulated: true,
      job_id: Number(jobId),
      previous_status: null,
      new_status: 'cancelled',
      affected_job_items: 0,
      affected_reservations: 0,
      message: 'Testing mode simulated cancellation. No live pull sheet, job items, or reservations were changed.',
    };
  }

  if (isTestingModeEnabled()) {
    await supabase.rpc('sc_log_testing_mode_event', {
      p_event_type: 'live_pull_sheet_cancel_from_testing_mode',
      p_entity_type: 'job',
      p_entity_id: String(jobId),
      p_action_summary: `Live cancellation executed while testing mode was enabled: ${reason || 'No reason provided'}`,
      p_payload: payload,
      p_created_by: cancelledBy,
    }).catch(() => null);
  }

  const { data, error } = await supabase.rpc('sc_cancel_pull_sheet', {
    p_job_id: Number(jobId),
    p_reason: reason || 'Cancelled from inventory app',
    p_notes: notes || null,
    p_release_reservations: Boolean(releaseReservations),
    p_cancelled_by: cancelledBy || 'Inventory app user',
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
