# Graphical Theme System Scope Audit — 0.6.22

## Files changed

- `src/themePresets.js`
- `src/themes.css`
- `src/ui/ThemeProvider.jsx`
- `src/ThemeSettings.jsx`
- Theme contract tests and build markers
- Package version and release documentation

## Operational files not changed

- Inventory APIs and calculations
- Pull-sheet assignment and deduction logic
- Purchasing calculations
- Purchase-order calculations
- WooCommerce synchronization
- Supabase client and database access
- Netlify functions
- Routes and permissions
- SQL and migration files

## Compatibility behavior

Saved version 0.6.21 preset IDs are mapped to the closest new graphical
interface style. The browser-storage key remains unchanged, so density,
appearance mode, help-panel, and reduced-motion preferences are preserved.
