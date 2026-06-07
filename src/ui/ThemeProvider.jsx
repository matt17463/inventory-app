import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: false,
});

function getInitialTheme() {
  try {
    const saved = window.localStorage.getItem('sc_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch (_) {}
  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  const setTheme = (nextTheme) => {
    const safeTheme = nextTheme === 'dark' ? 'dark' : 'light';
    setThemeState(safeTheme);
    try { window.localStorage.setItem('sc_theme', safeTheme); } catch (_) {}
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.setAttribute('data-theme', theme);
    body.setAttribute('data-theme', theme);
    root.classList.toggle('dark-mode', theme === 'dark');
    body.classList.toggle('dark-mode', theme === 'dark');
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme, isDark: theme === 'dark' }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeProvider;
