import { signedStoredAssetUrl } from './_shared/mockupStorage.js';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';

const TABLES = new Set(['mockup_artwork_assets', 'mockup_blank_assets', 'mockup_outputs']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUSTOMER_SCOPED_PATHS = new Map([['mockup_outputs','outputs'],['mockup_artwork_assets','artwork']]);
export function marketingSharedAssetPathAllowed(source,asset){
 const required=CUSTOMER_SCOPED_PATHS.get(source);
 if(!required)return source==='mockup_blank_assets'&&asset?.storage_provider==='r2'&&Boolean(asset.storage_bucket&&asset.storage_path);
 const [owner,project,directory]=String(asset?.storage_path||'').split('/');
 return UUID.test(owner)&&project===String(asset?.project_id||'')&&directory===required;
}
export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { message: 'Method not allowed' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'marketing-shared-asset', allowedRoles: ['admin', 'manager', 'operator', 'marketing'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { message: auth.message }, event);
  try {
    const body = JSON.parse(event.body || '{}');
    if (!UUID.test(body.account_id || '')) return jsonResponse(400, { message: 'Invalid account' }, event);
    if (body.action === 'list_shared_blanks') {
      const page = Math.max(0, Math.min(100, Number.parseInt(body.page, 10) || 0));
      const { data, error } = await auth.supabase.from('mockup_blank_assets')
        .select('id,project_id,asset_name,product_type,product_color,blank_product_id_text,storage_provider,storage_bucket,storage_path')
        .eq('storage_provider', 'r2').not('storage_path', 'is', null).not('storage_bucket', 'is', null)
        .order('id').range(page * 50, page * 50 + 49);
      if (error) throw error;
      return jsonResponse(200, { assets: (data || []).filter(a => a.storage_path && a.storage_bucket).map(({ id, project_id, asset_name, product_type, product_color, blank_product_id_text }) => ({ id, project_id, asset_name, product_type, product_color, blank_product_id_text })), has_more: (data || []).length === 50 }, event);
    }
    if (!UUID.test(body.asset_id || '')) return jsonResponse(400, { message: 'Invalid asset' }, event);
    if (!TABLES.has(body.source)) return jsonResponse(400, { message: 'Unsupported private asset source' }, event);
    const { data: account, error: accountError } = await auth.supabase.from('sc_growth_accounts').select('id,customer_id').eq('id', body.account_id).maybeSingle();
    if (accountError) throw accountError;
    if (!account) return jsonResponse(404, { message: 'Marketing account not found' }, event);
    if (!account.customer_id && body.source !== 'mockup_blank_assets') return jsonResponse(403, { message: 'Marketing account must be linked to a customer' }, event);
    const { data: asset, error: assetError } = await auth.supabase.from(body.source).select('*').eq('id', body.asset_id).maybeSingle();
    if (assetError) throw assetError;
    if (!asset?.project_id) return jsonResponse(404, { message: 'Asset not found' }, event);
    const { data: project, error: projectError } = await auth.supabase.from('mockup_projects').select('id,customer_id_text').eq('id', asset.project_id).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return jsonResponse(404, { message: 'Project not found' }, event);
    const reusableBlank = body.source === 'mockup_blank_assets' && asset.storage_provider === 'r2' && !!asset.storage_bucket && !!asset.storage_path;
    if (String(project.customer_id_text) !== String(account.customer_id) && !reusableBlank) return jsonResponse(403, { message: 'Asset is not linked to this customer' }, event);
    if (body.source === 'mockup_outputs' && !['internal_approved', 'customer_approved'].includes(asset.approval_status)) return jsonResponse(403, { message: 'Mockup is not approved' }, event);
    if (!marketingSharedAssetPathAllowed(body.source,asset)) return jsonResponse(403, { message: 'Asset storage does not belong to the approved project' }, event);
    let url;
    if (body.sign_download) {
      try {
        url = await signedStoredAssetUrl(auth.supabase, asset, 300);
      } catch (storageError) {
        console.error('Shared asset R2 signing failed', { source: body.source, assetId: asset.id, code: storageError?.name || storageError?.Code || 'storage_error' });
        return jsonResponse(422, { message: 'This blank graphic cannot be retrieved from R2. Check its stored file and R2 bucket configuration in Mockup Studio.' }, event);
      }
      if (!url) return jsonResponse(422, { message: 'This graphic has no retrievable stored file. Upload the blank graphic to R2 in Mockup Studio.' }, event);
    }
    return jsonResponse(200, { reference: { source: body.source, asset_id: asset.id, project_id: project.id }, ...(url ? { url } : {}) }, event);
  } catch (error) {
    console.error('Shared asset reference validation failed', error);
    return jsonResponse(500, { message: 'Unable to validate shared asset' }, event);
  }
}
