# Skilled Crafting Inventory v1.4.6

## Product Type Manager

Adds a dedicated **Tools & Admin → Product Type Manager** page for classifying blank catalog styles as Tee, Hoodie, Sweatshirt, Drinkware, etc.

### Key behavior
- Lists active blank catalog records grouped by **Brand + Style**.
- Filters by Brand, current Item Type, Unclassified, and search text.
- Sorts by Brand, Style, Current Type, or WooCommerce match count.
- Supports select-all-visible and bulk assignment.
- Creates new Item Types directly from the application.
- Assignments immediately drive the On-site Sales **Type → Brand → Style → Color → Size** picker.
- Optional WooCommerce synchronization updates matching existing parent products with:
  - `_sc_blank_item_type` metadata; and
  - a hidden `Item Type` product attribute.
- New Mockup Studio Woo exports write the same Brand + Style mapping and Item Type attribute.

## Safer classification model
SQL 56 adds `sc_brand_style_item_types` so classification is keyed by **Brand + Style**, not just Style. Existing style-level classifications are migrated into brand/style mappings and remain available as a compatibility fallback.

This avoids unintended cross-brand changes if two brands ever use the same Style label/code.

## No inventory mutation
Product Type Manager does not change inventory quantities, costs, SKUs, colors, sizes, reservations, or movements.

## Included cumulative fixes
The cumulative v1.4.6 patch includes the v1.4.5 On-site label preview/print correction and all earlier v1.4.5 workflow/R2 corrections.
