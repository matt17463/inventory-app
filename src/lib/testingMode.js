const STORAGE_KEY = 'sc_inventory_testing_mode_v1';

const DEFAULT_SETTINGS = {
  enabled: false,
  simulateWrites: false,
  requireConfirmation: true,
  showBanner: true,
};

export function getTestingModeSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveTestingModeSettings(settings) {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const next = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('sc-testing-mode-change', { detail: next }));
  return next;
}

export function isTestingModeEnabled() {
  return Boolean(getTestingModeSettings().enabled);
}

export function shouldSimulateWrites() {
  const settings = getTestingModeSettings();
  return Boolean(settings.enabled && settings.simulateWrites);
}

export function requireTestingConfirmation() {
  const settings = getTestingModeSettings();
  return Boolean(settings.enabled && settings.requireConfirmation);
}

export function testingModeLabel() {
  const settings = getTestingModeSettings();
  if (!settings.enabled) return 'Live Mode';
  if (settings.simulateWrites) return 'Testing Mode: Simulated Writes';
  return 'Testing Mode: Live Writes With Extra Confirmation';
}
