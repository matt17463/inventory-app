# Release Notes — 0.6.21

## Visual theme system

Version 0.6.21 adds a display-only theme system. It does not change inventory,
pull-sheet, purchasing, purchase-order, WooCommerce, Supabase, authentication,
route, or Netlify-function behavior.

### Six theme presets

1. **Skilled Crafting Signature** — purple, blue, and gold branded styling.
2. **Operations Blue** — the familiar blue and teal operational appearance.
3. **Industrial Workshop** — high-visibility orange and steel styling.
4. **Night Shift** — graphite, electric blue, and violet styling.
5. **Clean Office** — minimal, restrained styling for reports and data review.
6. **High Contrast** — strong outlines and focus indicators for accessibility.

### Display controls

- Light appearance
- Dark appearance
- System appearance
- Compact density
- Comfortable density
- Spacious density
- Show or hide instructional help panels
- Standard or reduced animation
- Live component preview
- Reset to default

### Access

The theme page is available from:

- **Tools & Admin → Visual Themes & Layout**
- The **Themes** button in the top navigation bar

### Preference storage

Preferences are saved locally in the current browser under:

```text
sc_display_preferences_v2
```

No Supabase migration is required. Different computers can use different
visual themes without affecting shared business data.
