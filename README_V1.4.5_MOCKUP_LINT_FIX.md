# Skilled Crafting Inventory v1.4.5 — Mockup Studio lint correction

Corrects the WooCommerce tag toggle helper scope in `src/MockupStudio.jsx`.

The prior cumulative package accidentally appended `toggleTag()` after the closing brace of the main component. That left `form` and `setForm` outside their `WooCommerceTab` scope and caused ESLint `no-undef` errors.

This correction:
- removes the stray trailing helper;
- places `toggleTag(id, checked)` inside `WooCommerceTab` beside `toggleCategory()`;
- preserves checkbox tag selection and Clear all tags behavior;
- does not change application version or database schema.
