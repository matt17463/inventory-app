import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { signedOperationalUrl } from './_shared/operationalStorage.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, error: 'Method not allowed.' }, event);

  const auth = await authorizeEmployee(event, { functionName: 'client-order-file', allowedRoles: [] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);

  try {
    const body = JSON.parse(event.body || '{}');
    const id = String(body.attachment_id || '').trim();
    if (!id) return jsonResponse(400, { success: false, error: 'Attachment ID is required.' }, event);

    const { data, error } = await auth.supabase
      .from('sc_client_order_attachments')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return jsonResponse(404, { success: false, error: 'Attachment was not found.' }, event);

    const url = await signedOperationalUrl(auth.supabase, data, 900);
    return jsonResponse(200, { success: true, url, filename: data.file_name }, event);
  } catch (error) {
    console.error('client-order-file failed:', error);
    return jsonResponse(500, { success: false, error: error.message || 'Could not open attachment.' }, event);
  }
}
