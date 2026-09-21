import { supabase } from '../supabaseClient';
import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function parseFunctionResponse(response, fallbackMessage) {
  const text = await response.text().catch(() => '');
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok || body?.success === false) {
    const requestId = response.headers.get('x-nf-request-id');
    const detail = `HTTP ${response.status}${requestId ? `; request ${requestId}` : ''}`;
    throw new Error(body?.message || `${fallbackMessage} (${detail})`);
  }

  return body || {};
}

export async function getPullSheetPurchasingIntegrity(jobId) {
  if (!jobId) return [];

  const { data, error } = await supabase.rpc(
    'sc_pullsheet_purchasing_integrity_v1',
    { p_job_id: Number(jobId) }
  );

  if (error) throw error;
  return data || [];
}

export async function repairPullSheetPurchasingIntegrity(jobId) {
  if (!jobId) throw new Error('Missing pull sheet ID.');

  const response = await authenticatedFunctionFetch(
    '/.netlify/functions/pullsheet-purchasing-integrity',
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'repair',
        job_id: Number(jobId),
      }),
    }
  );

  return parseFunctionResponse(
    response,
    'The pull-sheet Purchasing reconciliation failed.'
  );
}
