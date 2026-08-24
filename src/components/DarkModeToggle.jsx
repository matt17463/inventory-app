import React from 'react';
import { useTheme } from '../ui/themeContext';

export default function DarkModeToggle() {
  const { isDark, mode, toggleTheme } = useTheme();
  const nextMode = isDark ? 'light' : 'dark';
  const label = isDark ? 'Light Mode' : 'Dark Mode';
  const systemNote = mode === 'system' ? ' (currently following system)' : '';

  return (
    <button
      type="button"
      className="sc-theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextMode} mode${systemNote}`}
      title={`Switch to ${nextMode} mode${systemNote}`}
    >
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
      <span>{label}</span>
    </button>
  );
}
