import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'sc_inventory_theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;

  root.dataset.theme = theme;
  body.dataset.theme = theme;
  root.classList.toggle('dark-mode', theme === 'dark');
  body.classList.toggle('dark-mode', theme === 'dark');
  root.classList.toggle('light-mode', theme === 'light');
  body.classList.toggle('light-mode', theme === 'light');
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {
      // localStorage can be unavailable in some private browsing modes.
    }
  }, [theme]);

  const value = useMemo(() => {
    const setTheme = (nextTheme) => {
      if (nextTheme !== 'light' && nextTheme !== 'dark') return;
      setThemeState(nextTheme);
    };

    const toggleTheme = () => {
      setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
    };

    return {
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    };
  }, [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
