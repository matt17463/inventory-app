import React from 'react';
import { useTheme } from '../ui/ThemeProvider';

export default function DarkModeToggle() {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button type="button" className="sc-theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode">
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
      <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  );
}
