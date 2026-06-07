import React from 'react';
import { useTheme } from '../ui/ThemeProvider';

export default function DarkModeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`sc-theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="sc-theme-toggle__icon" aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
      <span className="sc-theme-toggle__text">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  );
}
