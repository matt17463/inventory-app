import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { commitReceipt } from './supplier-receiving-action.js';

const FUNCTION_NAME = 'supplier-receiving-background';

function clean(value) {
  return String(value ?? '').trim();
}

async function markFailed(supabase, key, message) {
  if (!key) return;

  await supabase
    .from('sc_integration_jobs')
    .update({
      status: 'failed',
      last_error: String(
        message || 'Supplier receiving background job failed.'
      ).slice(0, 4000),
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('idempotency_key', `supplier-receiving:${key}`);
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {}, event);
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(
      405,
      { success: false, message: 'Method not allowed.' },
      event,
    );
  }

  const auth = await authorizeEmployee(event, {
    functionName: FUNCTION_NAME,
    allowedRoles: ['admin', 'manager', 'operator'],
  });

  if (!auth.ok) {
    return jsonResponse(
      auth.statusCode,
      { success: false, message: auth.message },
      event,
    );
  }

  let body = {};
  let key = '';

  try {
    body = JSON.parse(event.body || '{}');
    key = clean(body.idempotency_key);

    if (clean(body.action) !== 'commit') {
      throw new Error(
        'Unknown supplier receiving background action.'
      );
    }

    if (!key) {
      throw new Error('Receiving request key is required.');
    }

    const result = await commitReceipt(
      auth.supabase,
      body,
      auth.user.id,
    );

    return jsonResponse(
      200,
      { success: true, ...result },
      event,
    );
  } catch (error) {
    console.error(
      'Supplier receiving background job failed:',
      error
    );

    await markFailed(
      auth.supabase,
      key,
      error.message ||
        'Supplier receiving background job failed.',
    ).catch(() => {});

    return jsonResponse(
      500,
      {
        success: false,
        message:
          error.message ||
          'Supplier receiving background job failed.',
      },
      event,
    );
  }
}
