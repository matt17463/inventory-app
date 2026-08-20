import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function responseBody(response, fallback) {
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) throw new Error(body?.message || fallback || `Request failed: HTTP ${response.status}`);
  return body;
}

export async function parseSupplierConfirmation(file) {
  const fileBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The PDF could not be read from this device.'));
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
