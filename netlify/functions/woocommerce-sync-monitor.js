import { authorizeEmployee, jsonResponse, wooSignatureForBody } from './_shared/security.js';
import { wooRequest } from './_shared/mockupUtils.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (!['GET','POST'].includes(event.httpMethod)) return jsonResponse(405, { success:false, message:'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName:'woocommerce-sync-monitor' });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success:false, message:auth.message }, event);
  try {
    if (event.httpMethod === 'GET') {
      const result = await auth.supabase.rpc('sc_woocommerce_sync_health_v1');
      if (result.error) throw result.error;
      return jsonResponse(200, { success:true, data:result.data }, event);
    }
    const body = JSON.parse(event.body || '{}');
    const orderId = Number(body.order_id);
    if (body.action !== 'retry_order' || !Number.isSafeInteger(orderId) || orderId <= 0) {
      return jsonResponse(400, { success:false, message:'Choose a valid WooCommerce order to retry.' }, event);
    }
    if (!process.env.WC_WEBHOOK_SECRET) throw new Error('The WooCommerce webhook secret is not configured.');
    // Fetch the current authoritative order rather than replaying a stale or
    // browser-supplied payload. The same lease/idempotency checks protect both.
    const order = await wooRequest(`orders/${orderId}`);
    if (Number(order?.id) !== orderId) throw new Error('WooCommerce returned an unexpected order.');
    const rawBody = JSON.stringify(order);
    const { handler: syncOrder } = await import('./woocommerce-webhook.js');
    const response = await syncOrder({ httpMethod:'POST', body:rawBody, headers:{
      'content-type':'application/json', 'x-sc-sync-source':'manager_replay',
      'x-wc-webhook-signature':wooSignatureForBody(rawBody,process.env.WC_WEBHOOK_SECRET),
    }});
    const result = JSON.parse(response.body || '{}');
    return jsonResponse(response.statusCode, { ...result, message:result.errors?.length
      ? 'Order refreshed with items requiring review. Open the pull sheet for details.'
      : result.success ? 'Order refreshed from WooCommerce. Production progress was preserved.' : result.error }, event);
  } catch (error) {
    return jsonResponse(502, { success:false, message:error.message || 'WooCommerce sync check failed.' }, event);
  }
}
