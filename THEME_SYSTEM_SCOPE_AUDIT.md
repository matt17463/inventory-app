# Theme System Scope Audit — 0.6.21

## Purpose

Confirm that the visual-theme release does not change operational application
behavior.

## Files changed for runtime behavior

- `src/themePresets.js`
- `src/themes.css`
- `src/ui/ThemeProvider.jsx`
- `src/ThemeSettings.jsx`
- `src/components/DarkModeToggle.jsx`
- `src/components/AppShell.jsx`
- `src/main.jsx`
- `src/navigationConfig.js`

## Files not modified

The release does not modify:

- Supabase clients or queries
- Inventory APIs
- Pull-sheet APIs or calculations
- Purchasing calculations
- Purchase-order calculations
- WooCommerce synchronization
- Netlify functions
- Authentication
- Route destinations
- SQL schema or migrations

## Persistence

The only new persistence is browser `localStorage`:

```text
sc_display_preferences_v2
```

It contains display preferences only. It does not contain inventory, customer,
order, purchasing, or authentication data.
