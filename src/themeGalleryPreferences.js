// Local, reversible gallery curation. Hiding a preset never removes its definition
// or changes a user's active theme or operational application settings.
export const THEME_GALLERY_STORAGE_KEY = 'sc_hidden_theme_presets_v1';

export function normalizeHiddenThemeIds(value, presets) {
  const valid = new Set(presets.map((preset) => preset.id));
  return [...new Set(Array.isArray(value) ? value : [])]
    .filter((id) => typeof id === 'string' && valid.has(id));
}

export function getVisibleThemePresets(presets, hiddenIds, activeId) {
  const hidden = new Set(normalizeHiddenThemeIds(hiddenIds, presets));
  return presets.filter((preset) => !hidden.has(preset.id) || preset.id === activeId);
}

export function toggleHiddenThemeId(hiddenIds, targetId, presets, activeId) {
  const normalized = normalizeHiddenThemeIds(hiddenIds, presets);
  if (targetId === activeId || !presets.some((preset) => preset.id === targetId)) {
    return normalized;
  }
  return normalized.includes(targetId)
    ? normalized.filter((id) => id !== targetId)
    : [...normalized, targetId];
}
