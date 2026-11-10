import { signedStoredAssetUrl } from './_shared/mockupStorage.js';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';

const TABLES = new Set(['mockup_artwork_assets', 'mockup_blank_assets', 'mockup_outputs']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { message: 'Method not allowed' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'marketing-shared-asset', allowedRoles: ['admin', 'manager', 'operator', 'marketing'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { message: auth.message }, event);
  try {
    const body = JSON.parse(event.body || '{}');
    if (!UUID.test(body.account_id || '') || !UUID.test(body.asset_id || '')) return jsonResponse(400, { message: 'Invalid account or asset' }, event);
    if (!TABLES.has(body.source)) return jsonResponse(400, { message: 'Unsupported private asset source' }, event);
    const { data: account, error: accountError } = await auth.supabase.from('sc_growth_accounts').select('id,customer_id').eq('id', body.account_id).maybeSingle();
    if (accountError) throw accountError;
    if (!account?.customer_id) return jsonResponse(403, { message: 'Marketing account must be linked to a customer' }, event);
    const { data: asset, error: assetError } = await auth.supabase.from(body.source).select('*').eq('id', body.asset_id).maybeSingle();
    if (assetError) throw assetError;
    if (!asset?.project_id) return jsonResponse(404, { message: 'Asset not found' }, event);
    const { data: project, error: projectError } = await auth.supabase.from('mockup_projects').select('id,customer_id_text').eq('id', asset.project_id).maybeSingle();
    if (projectError) throw projectError;
    if (!project || String(project.customer_id_text) !== String(account.customer_id)) return jsonResponse(403, { message: 'Asset is not linked to this customer' }, event);
    if (body.source === 'mockup_outputs' && !['internal_approved', 'customer_approved'].includes(asset.approval_status)) return jsonResponse(403, { message: 'Mockup is not approved' }, event);
    const url = body.sign_download ? await signedStoredAssetUrl(auth.supabase, asset, 300) : undefined;
    return jsonResponse(200, { reference: { source: body.source, asset_id: asset.id, project_id: project.id }, ...(url ? { url } : {}) }, event);
  } catch (error) {
    console.error('Shared asset reference validation failed', error);
    return jsonResponse(500, { message: 'Unable to validate shared asset' }, event);
  }
}
