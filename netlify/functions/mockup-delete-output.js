import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { parseJsonBody } from './_shared/mockupUtils.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, error: 'Method not allowed.' }, event);

  const auth = await authorizeEmployee(event, {
    functionName: 'mockup-delete-output',
    allowedRoles: ['admin', 'manager', 'operator'],
  });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);

  try {
    const outputId = String(parseJsonBody(event).output_id || '');
    if (!outputId) throw new Error('Missing generated mockup ID.');

    const { data: output, error: outputError } = await auth.supabase
      .from('mockup_outputs')
      .select('id,project_id,output_name,storage_bucket,storage_path')
      .eq('id', outputId)
      .maybeSingle();
    if (outputError) throw outputError;
    if (!output) return jsonResponse(404, { success: false, error: 'Generated mockup was not found.' }, event);

    const { data: deleted, error: deleteError } = await auth.supabase
      .from('mockup_outputs')
      .delete()
      .eq('id', outputId)
      .select('id')
      .maybeSingle();
    if (deleteError) throw deleteError;
    if (!deleted) throw new Error('Generated mockup could not be removed from the project.');

    let cleanupWarning = '';
    if (output.storage_bucket && output.storage_path) {
      const { error: storageError } = await auth.supabase.storage
        .from(output.storage_bucket)
        .remove([output.storage_path]);
      if (storageError) {
        cleanupWarning = storageError.message || 'The private image file could not be removed.';
        console.warn('Deleted mockup record but storage cleanup failed:', cleanupWarning);
      }
    }

    return jsonResponse(200, {
      success: true,
      deleted_output_id: output.id,
      project_id: output.project_id,
      cleanup_warning: cleanupWarning || null,
    }, event);
  } catch (error) {
    console.error('Mockup output deletion failed:', error);
    return jsonResponse(500, { success: false, error: error.message || 'Generated mockup deletion failed.' }, event);
  }
}
