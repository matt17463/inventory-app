export const DEFAULT_THEME_PRESET = 'professional-enterprise';

export const THEME_PRESET_ALIASES = Object.freeze({
  'skilled-signature': 'formal-executive',
  'operations-blue': 'professional-enterprise',
  'industrial-workshop': 'technical-blueprint',
  'night-shift': 'futuristic-interface',
  'clean-office': 'professional-enterprise',
  'high-contrast': 'cyberpunk-neon',
});

export const THEME_PRESETS = [
  {
    id: 'technical-blueprint',
    name: 'Technical Blueprint',
    icon: '⌖',
    category: 'Technical',
    visualStyle: 'technical',
    description: 'Blueprint grids, indexed labels, squared panels, bracketed controls, and drafting-style typography.',
    bestFor: 'Inventory analysis, diagnostics, data mapping, and technical workstations',
    traits: ['Monospace headings', 'Grid surfaces', 'Bracketed controls', 'Drafting marks'],
    preview: {
      background: '#e8f4f8',
      panel: '#f8fdff',
      sidebar: '#0b3558',
      primary: '#007f9e',
      accent: '#f59e0b',
      text: '#0d2c3f',
    },
  },
  {
    id: 'futuristic-interface',
    name: 'Futuristic Interface',
    icon: '◉',
    category: 'Futuristic',
    visualStyle: 'futuristic',
    description: 'Layered glass surfaces, luminous gradients, orbital graphics, pill controls, and floating information panels.',
    bestFor: 'Command-center displays, dashboards, presentations, and modern touchscreens',
    traits: ['Glass panels', 'Luminous controls', 'Orbital graphics', 'Floating depth'],
    preview: {
      background: '#eaf1ff',
      panel: '#f8fbff',
      sidebar: '#111943',
      primary: '#4f46e5',
      accent: '#06b6d4',
      text: '#172044',
    },
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    icon: '⚡',
    category: 'Cyberpunk',
    visualStyle: 'cyberpunk',
    description: 'Neon cyan and magenta, clipped controls, scan lines, signal labels, and high-energy digital panels.',
    bestFor: 'Night-shift stations, wall displays, bold presentations, and high-visibility environments',
    traits: ['Neon glow', 'Clipped corners', 'Scan lines', 'Signal typography'],
    preview: {
      background: '#090712',
      panel: '#151022',
      sidebar: '#05030a',
      primary: '#00f5ff',
      accent: '#ff2bd6',
      text: '#f8f7ff',
    },
  },
  {
    id: 'formal-executive',
    name: 'Formal Executive',
    icon: '◆',
    category: 'Formal',
    visualStyle: 'formal',
    description: 'Serif headings, fine rules, navy and gold detailing, paper-like surfaces, and restrained executive controls.',
    bestFor: 'Quotes, management reports, client meetings, and formal office use',
    traits: ['Serif headings', 'Gold rules', 'Paper surfaces', 'Executive restraint'],
    preview: {
      background: '#f4efe5',
      panel: '#fffdf8',
      sidebar: '#17243b',
      primary: '#8a6a2f',
      accent: '#7a263a',
      text: '#27231d',
    },
  },
  {
    id: 'professional-enterprise',
    name: 'Professional Enterprise',
    icon: '▦',
    category: 'Professional',
    visualStyle: 'professional',
    description: 'Structured corporate layouts, crisp cards, restrained depth, clear hierarchy, and practical controls.',
    bestFor: 'Everyday office work, purchasing, administration, and general operations',
    traits: ['Corporate hierarchy', 'Crisp controls', 'Subtle accents', 'Data-first layout'],
    preview: {
      background: '#f3f6fa',
      panel: '#ffffff',
      sidebar: '#172033',
      primary: '#2563eb',
      accent: '#0f766e',
      text: '#182230',
    },
  },
  {
    id: 'industrial-command',
    name: 'Industrial Command',
    icon: '⚙',
    category: 'Industrial',
    visualStyle: 'industrial',
    description: 'Rugged steel panels, hazard accents, rivet details, heavy controls, and production-floor typography.',
    bestFor: 'Receiving, production, warehouse screens, and shop-floor touchstations',
    traits: ['Steel panels', 'Hazard accents', 'Riveted cards', 'Heavy controls'],
    preview: {
      background: '#dfe3e6',
      panel: '#f7f8f8',
      sidebar: '#20252a',
      primary: '#e85d04',
      accent: '#f6c90e',
      text: '#1c252c',
    },
  },
];

export function normalizeThemePreset(presetId) {
  const candidate = THEME_PRESET_ALIASES[presetId] || presetId;
  return THEME_PRESETS.some((preset) => preset.id === candidate)
    ? candidate
    : DEFAULT_THEME_PRESET;
}

export function getThemePreset(presetId) {
  const normalized = normalizeThemePreset(presetId);
  return THEME_PRESETS.find((preset) => preset.id === normalized)
    || THEME_PRESETS.find((preset) => preset.id === DEFAULT_THEME_PRESET)
    || THEME_PRESETS[0];
}

export function isValidThemePreset(presetId) {
  const candidate = THEME_PRESET_ALIASES[presetId] || presetId;
  return THEME_PRESETS.some((preset) => preset.id === candidate);
}
