import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function responseBody(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) throw new Error(body?.message || `Color cleanup failed (HTTP ${response.status}).`);
  return body;
}

export async function getColorLifecyclePreview() {
  return responseBody(await authenticatedFunctionFetch('/.netlify/functions/color-lifecycle-fast'));
}

export async function startColorLifecycleJob(action, keys = []) {
  const jobId = globalThis.crypto?.randomUUID?.() || `color-job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await responseBody(await authenticatedFunctionFetch('/.netlify/functions/color-lifecycle-fast', {
    method: 'POST', body: JSON.stringify({ action, job_id: jobId, keys }),
  }));
  const response = await authenticatedFunctionFetch('/.netlify/functions/color-lifecycle-background', {
    method: 'POST', body: JSON.stringify({ action, job_id: jobId, keys }),
  });
  if (!response.ok && response.status !== 202) await responseBody(response);
  return { job_id: jobId };
}

export async function getColorLifecycleJob(jobId) {
  return responseBody(await authenticatedFunctionFetch(`/.netlify/functions/color-lifecycle-fast?job_id=${encodeURIComponent(jobId)}`));
}

export async function resolveImportColors(sourceSystem, values) {
  return responseBody(await authenticatedFunctionFetch('/.netlify/functions/color-lifecycle', {
    method: 'POST', body: JSON.stringify({ action: 'resolve_import_colors', source_system: sourceSystem, values }),
  }));
}

export async function saveImportColorAliases(sourceSystem, mappings) {
  return responseBody(await authenticatedFunctionFetch('/.netlify/functions/color-lifecycle', {
    method: 'POST', body: JSON.stringify({ action: 'save_import_aliases', source_system: sourceSystem, mappings }),
  }));
}
