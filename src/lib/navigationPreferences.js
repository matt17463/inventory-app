// Navigation layouts contain presentation preferences only; they never grant page access.
export const NAV_STORAGE_PREFIX = 'sc_navigation_layout_v1:';

export function defaultNavigationLayout(sections) {
  return { groups: sections.map((s) => ({
    id: s.id || s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: s.title,
    icon: s.icon || '',
    paths: [...new Set(s.items.map((item) => item.path))],
  })), hiddenPaths: [] };
}

export function sanitizeNavigationLayout(sections, candidate) {
  const defaults = defaultNavigationLayout(sections);
  if (!candidate || !Array.isArray(candidate.groups)) return defaults;
  const known = new Set(sections.flatMap((s) => s.items.map((item) => item.path)));
  const used = new Set();
  const ids = new Set();
  const groups = [];
  for (const group of candidate.groups.slice(0, 50)) {
    const id = typeof group?.id === 'string' ? group.id.slice(0, 80) : '';
    if (!id || ids.has(id)) continue;
    ids.add(id);
    const paths = (Array.isArray(group.paths) ? group.paths : []).filter((path) => {
      if (!known.has(path) || used.has(path)) return false;
      used.add(path);
      return true;
    });
    groups.push({
      id,
      title: typeof group.title === 'string' && group.title.trim() ? group.title.slice(0, 60) : 'Custom Group',
      icon: typeof group.icon === 'string' ? group.icon.slice(0, 8) : '',
      paths,
    });
  }
  for (const original of defaults.groups) {
    const missing = original.paths.filter((path) => !used.has(path));
    if (!missing.length) continue;
    let group = groups.find((g) => g.id === original.id);
    if (!group) {
      group = { ...original, paths: [] };
      groups.push(group);
    }
    group.paths.push(...missing);
    missing.forEach((path) => used.add(path));
  }
  return {
    groups: groups.length ? groups : defaults.groups,
    hiddenPaths: Array.isArray(candidate.hiddenPaths)
      ? [...new Set(candidate.hiddenPaths.filter((path) => known.has(path)))] : [],
  };
}

export function materializeNavigation(sections, layout) {
  const available = new Map(sections.flatMap((section) => section.items.map((item) => [item.path, item])));
  const clean = sanitizeNavigationLayout(sections, layout);
  return clean.groups.map((group) => ({
    ...group,
    items: group.paths.filter((p) => !clean.hiddenPaths.includes(p)).map((p) => available.get(p)).filter(Boolean),
  })).filter((group) => group.items.length);
}

export function moveNavigationItem(layout, path, destinationId, toIndex = -1) {
  const groups = layout.groups.map((group) => ({ ...group, paths: group.paths.filter((p) => p !== path) }));
  const destination = groups.find((group) => group.id === destinationId);
  if (!destination) return layout;
  destination.paths.splice(toIndex < 0 ? destination.paths.length : Math.max(0, toIndex), 0, path);
  return { ...layout, groups };
}

export function navigationStorageKey(userId) {
  return NAV_STORAGE_PREFIX + userId;
}
