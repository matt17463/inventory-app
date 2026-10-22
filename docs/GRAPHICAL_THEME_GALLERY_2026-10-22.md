# Graphical Theme Gallery — October 22, 2026

## Goal
Provide **layout-distinct** Skilled Crafting interface presets inspired by modern commerce,
financial, equipment, and project dashboards, with safe per-browser curation.

## New selectable presets
- **Ecom Canvas:** light editorial shell, commerce KPI accents, white navigation, clean tables.
- **Aurora Command:** floating dark console, glowing interface accents and luminous cards.
- **Prism Ledger:** visually dual-railed finance workspace, report panels, purple and green cues.
- **Workflow Gallery:** rounded floating project canvas, pastel task lanes, airy card treatments.

Unlike palette-only changes, these presets adjust sidebar width / silhouette,
brand/navigation hierarchy, topbar placement, panel construction, card geometry,
table styling, shadows, accent motifs and miniature theme previews. Screen content,
routing, inventory calculations, security and integration behaviors are unchanged.

## Use
1. Open **Themes** from the application toolbar, or browse to **/theme-settings**.
2. Choose a new preset. The app will apply it immediately in this browser.
3. Open **Manage visible themes** below the gallery to hide unwanted legacy presets.
4. Choose **Show** beside a hidden preset or **Restore All Themes** to undo curation.
5. To hide the currently active preset, first switch to a different preset.

Theme selection and hidden-state preferences are **browser local**, matching the
existing app's display settings. Hiding does *not* delete theme code, change other
users' screens, or change a theme already in use.

## Verification
- `npm run test:graphical-themes`: unique presets, alias compatibility,
  visibility and restoration, active-theme protection, responsive CSS hooks.
- `npm run lint`: application lint.
- `npm run build:vite`: compile the React app and theme CSS.

Graphical CSS contains mobile navigation safeguards and respects the existing
reduced-motion setting. Full real-browser visual QA remains important, especially
on longer purchasing tables, mobile, Pi touchscreen and shop TV dashboards.

## Release / rollback
- New styles are opt-in; `professional-enterprise` remains the default.
- Existing saved theme IDs remain valid, and aliases are unchanged.
- No Supabase migrations or Netlify environment changes required.
- Roll back the merge/deployment if any production screens become unusable;
  restoring display settings from the Theme Settings page affects appearance only.
