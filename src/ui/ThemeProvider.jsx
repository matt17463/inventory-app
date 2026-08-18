import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_THEME_PRESET,
  normalizeThemePreset,
} from '../themePresets';

const STORAGE_KEY = 'sc_display_preferences_v2';
const LEGACY_THEME_KEY = 'sc_theme';

const DEFAULT_PREFERENCES = Object.freeze({
  preset: DEFAULT_THEME_PRESET,
  mode: 'system',
  density: 'comfortable',
  showHelp: true,
  reduceMotion: false,
});

const ThemeContext = createContext({
  theme: DEFAULT_PREFERENCES,
  preset: DEFAULT_PREFERENCES.preset,
  mode: DEFAULT_PREFERENCES.mode,
  effectiveMode: 'light',
  density: DEFAULT_PREFERENCES.density,
  showHelp: DEFAULT_PREFERENCES.showHelp,
  reduceMotion: DEFAULT_PREFERENCES.reduceMotion,
  setTheme: () => {},
  setPreset: () => {},
  setMode: () => {},
  setDensity: () => {},
  setShowHelp: () => {},
  setReduceMotion: () => {},
  toggleTheme: () => {},
  resetTheme: () => {},
  isDark: false,
});

function normalizeMode(value) {
  return ['light', 'dark', 'system'].includes(value) ? value : 'system';
}

function normalizeDensity(value) {
  return ['compact', 'comfortable', 'spacious'].includes(value)
    ? value
    : 'comfortable';
}

function normalizePreferences(value = {}) {
  return {
    preset: normalizeThemePreset(value.preset),
    mode: normalizeMode(value.mode),
    density: normalizeDensity(value.density),
    showHelp: value.showHelp !== false,
    reduceMotion: value.reduceMotion === true,
  };
}

function getSystemMode() {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch (_error) {
    return 'light';
  }
}

function getInitialPreferences() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return normalizePreferences(JSON.parse(saved));
    }

    const legacyTheme = window.localStorage.getItem(LEGACY_THEME_KEY);
    if (legacyTheme === 'light' || legacyTheme === 'dark') {
      return normalizePreferences({
        ...DEFAULT_PREFERENCES,
        mode: legacyTheme,
      });
    }
  } catch (_error) {
    // Corrupt or blocked browser storage should never prevent the app loading.
  }

  return { ...DEFAULT_PREFERENCES };
}

function persistPreferences(preferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    // Keep the old key updated for older deployments opened in the same browser.
    window.localStorage.setItem(
      LEGACY_THEME_KEY,
      preferences.mode === 'system' ? getSystemMode() : preferences.mode,
    );
  } catch (_error) {
    // Theme preferences are optional and must not block application workflows.
  }
}

export function ThemeProvider({ children }) {
  const [preferences, setPreferences] = useState(getInitialPreferences);
  const [systemMode, setSystemMode] = useState(getSystemMode);

  const updatePreferences = useCallback((updater) => {
    setPreferences((current) => {
      const candidate = typeof updater === 'function'
        ? updater(current)
        : updater;
      const next = normalizePreferences({ ...current, ...candidate });
      persistPreferences(next);
      return next;
    });
  }, []);

  const setPreset = useCallback((preset) => {
    updatePreferences({ preset });
  }, [updatePreferences]);

  const setMode = useCallback((mode) => {
    updatePreferences({ mode });
  }, [updatePreferences]);

  // Backward-compatible setter used by the previous light/dark provider.
  const setTheme = useCallback((nextTheme) => {
    if (typeof nextTheme === 'string') {
      setMode(nextTheme);
      return;
    }
    updatePreferences(nextTheme || {});
  }, [setMode, updatePreferences]);

  const setDensity = useCallback((density) => {
    updatePreferences({ density });
  }, [updatePreferences]);

  const setShowHelp = useCallback((showHelp) => {
    updatePreferences({ showHelp: Boolean(showHelp) });
  }, [updatePreferences]);

  const setReduceMotion = useCallback((reduceMotion) => {
    updatePreferences({ reduceMotion: Boolean(reduceMotion) });
  }, [updatePreferences]);

  const effectiveMode = preferences.mode === 'system'
    ? systemMode
    : preferences.mode;

  const toggleTheme = useCallback(() => {
    setMode(effectiveMode === 'dark' ? 'light' : 'dark');
  }, [effectiveMode, setMode]);

  const resetTheme = useCallback(() => {
    const next = { ...DEFAULT_PREFERENCES };
    persistPreferences(next);
    setPreferences(next);
  }, []);

  useEffect(() => {
    if (!window.matchMedia) return undefined;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setSystemMode(event.matches ? 'dark' : 'light');

    setSystemMode(media.matches ? 'dark' : 'light');
    media.addEventListener?.('change', handleChange);

    return () => media.removeEventListener?.('change', handleChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const attributes = {
      'data-theme': effectiveMode,
      'data-mode': preferences.mode,
      'data-preset': preferences.preset,
      'data-density': preferences.density,
      'data-help': preferences.showHelp ? 'visible' : 'hidden',
      'data-motion': preferences.reduceMotion ? 'reduced' : 'full',
    };

    Object.entries(attributes).forEach(([name, value]) => {
      root.setAttribute(name, value);
      body.setAttribute(name, value);
    });

    root.classList.toggle('dark-mode', effectiveMode === 'dark');
    body.classList.toggle('dark-mode', effectiveMode === 'dark');
    root.style.colorScheme = effectiveMode;
  }, [effectiveMode, preferences]);

  const theme = useMemo(() => ({
    ...preferences,
    effectiveMode,
  }), [preferences, effectiveMode]);

  const value = useMemo(() => ({
    theme,
    preset: preferences.preset,
    mode: preferences.mode,
    effectiveMode,
    density: preferences.density,
    showHelp: preferences.showHelp,
    reduceMotion: preferences.reduceMotion,
    setTheme,
    setPreset,
    setMode,
    setDensity,
    setShowHelp,
    setReduceMotion,
    toggleTheme,
    resetTheme,
    isDark: effectiveMode === 'dark',
  }), [
    theme,
    preferences,
    effectiveMode,
    setTheme,
    setPreset,
    setMode,
    setDensity,
    setShowHelp,
    setReduceMotion,
    toggleTheme,
    resetTheme,
  ]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeProvider;
