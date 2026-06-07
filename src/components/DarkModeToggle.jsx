import React from 'react';
import { useTheme } from '../ui/ThemeProvider';

export default function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button type="button" className="sc-theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode">
      {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
    </button>
  );
}
