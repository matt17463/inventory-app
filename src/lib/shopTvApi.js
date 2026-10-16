import { addSavedJobStatuses, boardColumnForRow, productionStatusForRow } from './productionStatusApi';
import { isOpenShopJob, shopMetrics } from './shopJobs';
import { supabase } from '../supabaseClient';

function unwrapRpc(response, fallbackMessage) {
  if (response.error) {
    const message = [response.error.message, response.error.details, response.error.hint]
      .filter(Boolean)
      .join(' — ');
    throw new Error(message || fallbackMessage);
  }

  return response.data;
}

export async function getShopTouchMode({ station = 'all', search = '', limit = 80 } = {}) {
  const response = await supabase.rpc('sc_shop_touch_mode_v2', {
    p_station: station || 'all',
    p_search: search?.trim() || null,
    p_limit: Number(limit || 80),
  });

  const data = unwrapRpc(response, 'Unable to load Shop TV / Touch Mode data') || {};
  const jobs = (await addSavedJobStatuses(Array.isArray(data.jobs) ? data.jobs : []))
    .filter(isOpenShopJob)
    .map((job) => ({ ...job, board_column: boardColumnForRow(job), production_status: productionStatusForRow(job), status_bucket: boardColumnForRow(job) }));
  return { ...data, jobs, metrics: shopMetrics(jobs) };
}
