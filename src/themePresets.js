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
    id: 'midnight-industrial',
    name: 'Midnight Industrial',
    icon: '◈',
    category: 'Industrial',
    visualStyle: 'industrial',
    description: 'Deep navy production-control surfaces, slim steel borders, cyan telemetry accents, and compact equipment cards.',
    bestFor: 'Equipment monitoring, workshop dashboards, production status, and low-light workstations',
    traits: ['Midnight navy', 'Cyan indicators', 'Telemetry cards', 'High-contrast labels'],
    preview: {
      background: '#08111e',
      panel: '#122338',
      sidebar: '#070f1b',
      primary: '#42c9eb',
      accent: '#61d5c0',
      text: '#f1f7fc',
    },
  },
  ...[
    { id: 'copper-foundry', name: 'Copper Foundry', icon: '◒', accent: '#efb17b', background: '#17120f', panel: '#30231d', text: '#fff3e8', description: 'Warm copper, charcoal steel, equipment photographs and clear workshop controls.' },
    { id: 'evergreen-workshop', name: 'Evergreen Workshop', icon: '◩', accent: '#74d7b4', background: '#0c1916', panel: '#17342b', text: '#effcf5', description: 'Forest green, brushed metal, equipment photographs and calm telemetry surfaces.' },
  ].map((theme) => ({
    ...theme, category: 'Industrial', visualStyle: 'industrial',
    bestFor: 'Equipment monitoring, shop televisions and everyday production',
    traits: ['Equipment photos', 'Readable telemetry', 'Light and dark modes', 'Touch controls'],
    preview: { background: theme.background, panel: theme.panel, sidebar: theme.background, primary: theme.accent, accent: theme.accent, text: theme.text },
  })),
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

  {
    id: 'ecom-canvas',
    name: 'Ecom Canvas',
    icon: '▤',
    category: 'Editorial dashboard',
    visualStyle: 'ecom',
    layout: 'Split navigation and editorial KPI cards',
    description: 'A bright commerce dashboard with a light navigation workspace, editorial metrics, clean hairline charts, and quiet orange highlights.',
    bestFor: 'Daily operations, inventory summaries, WooCommerce orders, and purchasing',
    traits: ['Light sidebar', 'Editorial metrics', 'Graph-paper details', 'Compact insights'],
    preview: {
      background: '#f0f2f5', panel: '#ffffff', sidebar: '#ffffff',
      primary: '#e95d35', accent: '#0e9d8a', text: '#202b37',
    },
  },
  {
    id: 'aurora-command',
    name: 'Aurora Command',
    icon: '✦',
    category: 'Immersive dark',
    visualStyle: 'aurora',
    layout: 'Floating glass console and layered panels',
    description: 'An immersive midnight control deck, with distinct layered glass panels, vibrant aurora highlights, navigation capsules, and luminous charts.',
    bestFor: 'Equipment monitoring, late-shift production, and overview dashboards',
    traits: ['Glass consoles', 'Neon data strips', 'Floating navigation', 'Luminous charts'],
    preview: {
      background: '#070b2a', panel: '#151e4a', sidebar: '#0d163e',
      primary: '#9275ff', accent: '#24c9e5', text: '#f3f5ff',
    },
  },
  {
    id: 'prism-ledger',
    name: 'Prism Ledger',
    icon: '◧',
    category: 'Financial workspace',
    visualStyle: 'ledger',
    layout: 'Dual-rail workspace with report cards',
    description: 'A polished finance-and-reporting workspace with a narrow dark utility rail, distinct white data panels, purple graphs, and green performance markers.',
    bestFor: 'Sales, pricing, purchasing, invoicing, analytics, and contractor reports',
    traits: ['Dual-rail feel', 'Report panels', 'Purple graph accents', 'Clear transactions'],
    preview: {
      background: '#e9eaf1', panel: '#ffffff', sidebar: '#171522',
      primary: '#7652f4', accent: '#13aa78', text: '#252536',
    },
  },
  {
    id: 'workflow-gallery',
    name: 'Workflow Gallery',
    icon: '◫',
    category: 'Project canvas',
    visualStyle: 'workflow',
    layout: 'Floating canvas and timeline-like cards',
    description: 'A playful project-management canvas with pastel task panels, timeline-inspired card treatments, a pill-shaped toolbar, and airy navigation.',
    bestFor: 'Production board, artwork requests, team orders, training, and projects',
    traits: ['Pastel task lanes', 'Floating shell', 'Timeline cards', 'Soft gradients'],
    preview: {
      background: '#eae7f9', panel: '#ffffff', sidebar: '#ffffff',
      primary: '#7667e9', accent: '#ea85bb', text: '#292840',
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
