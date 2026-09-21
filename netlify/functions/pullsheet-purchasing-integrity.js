import {
  authorizeEmployee,
  jsonResponse,
} from './_shared/security.js';

const FUNCTION_NAME = 'pullsheet-purchasing-integrity';

function numericId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {}, event);
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(
      405,
      { success: false, message: 'Method not allowed.' },
      event
    );
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(
      400,
      { success: false, message: 'Invalid JSON request.' },
      event
    );
  }

  const action = String(body.action || '').trim().toLowerCase();
  const allowedRoles = action === 'repair'
    ? ['admin', 'manager']
    : ['admin', 'manager', 'operator'];

  const auth = await authorizeEmployee(event, {
    functionName: FUNCTION_NAME,
    allowedRoles,
  });

  if (!auth.ok) {
    return jsonResponse(
      auth.statusCode,
      { success: false, message: auth.message },
      event
    );
  }

  try {
    const jobId = numericId(body.job_id);

    if (action === 'audit') {
      const result = await auth.supabase.rpc(
        'sc_pullsheet_purchasing_integrity_v1',
        { p_job_id: jobId }
      );

      if (result.error) throw result.error;

      return jsonResponse(
        200,
        { success: true, rows: result.data || [] },
        event
      );
    }

    if (action === 'repair') {
      if (!jobId) {
        return jsonResponse(
          400,
          {
            success: false,
            message: 'A valid pull sheet ID is required.',
          },
          event
        );
      }

      const repair = await auth.supabase.rpc(
        'sc_repair_pullsheet_purchasing_integrity_v1',
        {
          p_job_id: jobId,
          p_actor: auth.user.id,
        }
      );

      if (repair.error) throw repair.error;

      const audit = await auth.supabase.rpc(
        'sc_pullsheet_purchasing_integrity_v1',
        { p_job_id: jobId }
      );

      if (audit.error) throw audit.error;

      return jsonResponse(
        200,
        {
          success: true,
          ...(repair.data || {}),
          rows: audit.data || [],
        },
        event
      );
    }

    return jsonResponse(
      400,
      { success: false, message: 'Unknown integrity action.' },
      event
    );
  } catch (error) {
    console.error('Pull-sheet Purchasing integrity action failed:', error);

    return jsonResponse(
      400,
      {
        success: false,
        message:
          error.message
          || 'Pull-sheet Purchasing integrity action failed.',
      },
      event
    );
  }
}
