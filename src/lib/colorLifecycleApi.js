import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function responseBody(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) throw new Error(body?.message || `Color cleanup failed (HTTP ${response.status}).`);
  return body;
}

export async function getColorLifecyclePreview() {
  return responseBody(await authenticatedFunctionFetch('/.netlify/functions/color-lifecycle'));
}

export async function archiveUnusedColors(keys) {
  return responseBody(await authenticatedFunctionFetch('/.netlify/functions/color-lifecycle', {
    method: 'POST', body: JSON.stringify({ action: 'archive_selected', keys }),
  }));
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
