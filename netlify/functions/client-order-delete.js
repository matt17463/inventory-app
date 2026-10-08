import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { deleteOperationalObject } from './_shared/operationalStorage.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, error: 'Method not allowed.' }, event);

  const auth = await authorizeEmployee(event, { functionName: 'client-order-delete', allowedRoles: ['admin', 'manager'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);

  try {
    const body = JSON.parse(event.body || '{}');
    const requestId = String(body.request_id || '').trim();
    const confirmation = String(body.confirmation || '').trim();
    if (!requestId) return jsonResponse(400, { success: false, error: 'Client order ID is required.' }, event);

    const requestQuery = await auth.supabase
      .from('sc_client_order_requests')
      .select('id,order_number,status,manual_order_id,generated_job_id,converted_at')
      .eq('id', requestId)
      .single();

    if (requestQuery.error || !requestQuery.data) {
      return jsonResponse(404, { success: false, error: 'Client order was not found.' }, event);
    }

    const request = requestQuery.data;
    if (confirmation !== request.order_number) {
      return jsonResponse(400, { success: false, error: `Type ${request.order_number} exactly to confirm deletion.` }, event);
    }

    if (request.manual_order_id || request.generated_job_id || request.converted_at) {
      return jsonResponse(409, {
        success: false,
        error: 'This client order has already been converted to production and cannot be deleted. Cancel/void the downstream production records instead.',
      }, event);
    }

    const attachmentQuery = await auth.supabase
      .from('sc_client_order_attachments')
      .select('id,storage_provider,storage_bucket,storage_path')
      .eq('request_id', requestId);
    if (attachmentQuery.error) throw attachmentQuery.error;

    const cleanupWarnings = [];
    for (const attachment of attachmentQuery.data || []) {
      try {
        await deleteOperationalObject(auth.supabase, attachment);
      } catch (error) {
        cleanupWarnings.push(error.message || String(error));
      }
    }

    const deleted = await auth.supabase
      .from('sc_client_order_requests')
      .delete()
      .eq('id', requestId)
      .select('id,order_number')
      .single();
    if (deleted.error) throw deleted.error;

    return jsonResponse(200, {
      success: true,
      order_number: deleted.data.order_number,
      attachment_cleanup_warnings: cleanupWarnings,
    }, event);
  } catch (error) {
    console.error('client-order-delete failed:', error);
    return jsonResponse(500, { success: false, error: error.message || 'Client order could not be deleted.' }, event);
  }
}
