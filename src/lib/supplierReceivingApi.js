import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function responseBody(response, fallback) {
  const responseText = await response.text().catch(() => '');
  let body = null;
  try {
    body = responseText ? JSON.parse(responseText) : null;
  } catch {
    body = null;
  }
  if (!response.ok || body?.success === false) {
    const requestId = response.headers.get('x-nf-request-id');
    const statusDetail = `HTTP ${response.status}${requestId ? `; request ${requestId}` : ''}`;
    throw new Error(body?.message || `${fallback || 'The request failed.'} (${statusDetail})`);
  }
  return body;
}

export async function parseSupplierConfirmation(file) {
  const fileBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The supplier confirmation file could not be read from this device.'));
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.readAsDataURL(file);
  });
  const response = await authenticatedFunctionFetch('/.netlify/functions/supplier-confirmation-parse', {
    method: 'POST', body: JSON.stringify({ file_name: file.name, mime_type: file.type, file_base64: fileBase64 }),
  });
  return responseBody(response, 'The supplier confirmation could not be parsed.');
}

export async function supplierReceivingAction(payload) {
  const response = await authenticatedFunctionFetch('/.netlify/functions/supplier-receiving-action', {
    method: 'POST', body: JSON.stringify(payload),
  });
  return responseBody(response, 'The supplier receiving action failed.');
}

export async function getSupplierReceivingHistory() {
  const response = await authenticatedFunctionFetch('/.netlify/functions/supplier-receiving-action');
  return responseBody(response, 'Receiving history could not be loaded.');
}


export async function startSupplierReceivingCommit(payload) {
  const queued = await supplierReceivingAction({
    ...payload,
    action: 'queue_commit',
  });

  if (queued.duplicate_request) {
    return queued;
  }

  const response = await authenticatedFunctionFetch(
    '/.netlify/functions/supplier-receiving-background',
    {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        action: 'commit',
      }),
    },
  );

  // Netlify Background Functions acknowledge accepted work with 202.
  if (!response.ok && response.status !== 202) {
    return responseBody(
      response,
      'The supplier receiving background job could not be started.',
    );
  }

  return queued;
}

export async function getSupplierReceivingCommitStatus(
  idempotencyKey
) {
  return supplierReceivingAction({
    action: 'commit_status',
    idempotency_key: idempotencyKey,
  });
}
