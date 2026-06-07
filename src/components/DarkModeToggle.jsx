import React from 'react';
import { useTheme } from '../ui/ThemeProvider';

export default function DarkModeToggle() {
  const { theme, toggleDarkMode } = useTheme();
  const dark = theme.mode === 'dark';
  return (
    <button type="button" className="sc-ui-theme-toggle" onClick={toggleDarkMode} title="Toggle dark mode">
      <span className="sc-ui-theme-toggle__icon">{dark ? '☀️' : '🌙'}</span>
      <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  );
}
