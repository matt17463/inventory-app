import { jsonResponse } from './_shared/security.js';
import { parseJsonBody, sha256 } from './_shared/mockupUtils.js';
import { createServiceClient } from './_shared/security.js';
import { signedStoredAssetUrl } from './_shared/mockupStorage.js';

async function resolveToken(supabase, token, forWrite = false) {
  if (!token || String(token).length < 32) throw new Error('The mockup review token is invalid.');
  const { data, error } = await supabase.from('mockup_review_tokens').select('*').eq('token_hash', sha256(token)).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('The mockup review link was not found.');
  if (data.status === 'revoked' || data.status === 'expired' || (forWrite && data.status === 'used')) throw new Error('This mockup review link is no longer active.');
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await supabase.from('mockup_review_tokens').update({ status: 'expired' }).eq('id', data.id);
    throw new Error('This mockup review link has expired.');
  }
  return data;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (!['GET', 'POST'].includes(event.httpMethod)) return jsonResponse(405, { success: false, error: 'Method not allowed.' }, event);
  try {
    const supabase = createServiceClient();
    const body = event.httpMethod === 'POST' ? parseJsonBody(event) : {};
    const token = event.httpMethod === 'GET' ? event.queryStringParameters?.token : body.token;
    const tokenRow = await resolveToken(supabase, token, event.httpMethod === 'POST');
    const { data: project, error: projectError } = await supabase.from('mockup_projects').select('id,project_name,customer_name,campaign_name,status').eq('id', tokenRow.project_id).single();
    if (projectError) throw projectError;

    if (event.httpMethod === 'GET') {
      const { data: outputs, error: outputsError } = await supabase.from('mockup_outputs').select('id,output_name,caption_text,storage_provider,storage_bucket,storage_path,preview_storage_provider,preview_storage_bucket,preview_storage_path,approval_status,mime_type').eq('project_id', project.id).eq('is_selected', true).order('woo_position');
      if (outputsError) throw outputsError;
      const signedOutputs = [];
      for (const output of outputs || []) {
        signedOutputs.push({ ...output, signed_url: await signedStoredAssetUrl(supabase, output, 3600, { preferPreview: true }) });
      }
      await supabase.from('mockup_review_tokens').update({ last_accessed_at: new Date().toISOString() }).eq('id', tokenRow.id);
      return jsonResponse(200, { success: true, project, outputs: signedOutputs }, event);
    }

    const decision = String(body.decision || '');
    if (!['approved', 'changes_requested', 'comment'].includes(decision)) throw new Error('Choose approve or request changes.');
    const { data: output, error: outputError } = await supabase.from('mockup_outputs').select('id,project_id').eq('id', body.output_id).eq('project_id', project.id).single();
    if (outputError || !output) throw new Error('The selected mockup was not found in this review.');

    const { error: reviewError } = await supabase.rpc('sc_mockup_apply_customer_review', {
      p_token_id: tokenRow.id,
      p_project_id: project.id,
      p_output_id: output.id,
      p_decision: decision,
      p_reviewer_name: String(body.reviewer_name || '').trim(),
      p_reviewer_email: String(body.reviewer_email || '').trim(),
      p_notes: String(body.notes || '').trim(),
      p_metadata: { user_agent: event.headers?.['user-agent'] || null },
    });
    if (reviewError) throw reviewError;
    return jsonResponse(200, { success: true, decision }, event);
  } catch (error) {
    console.error('Mockup customer review failed:', error);
    const expected = /invalid|expired|no longer active|not found|choose approve|selected mockup/i.test(String(error?.message || ''));
    return jsonResponse(expected ? 400 : 500, { success: false, error: error.message || 'Mockup review failed.' }, event);
  }
}
