# Skilled Crafting v1.4.2 — On-site Sales Cascading Picker

- Fixes WooCommerce `Invalid parameter(s): orderby` by using `orderby=title` for products.
- Builds the logo/graphic menu from all published products in the active WooCommerce category.
- Replaces the flat blank catalog with Type → Brand → Style → Color → Size selectors using only available inventory.
- Adds an Item Type classification above existing Style records without changing blank IDs or inventory quantities.
- Adds Item Type to Mockup Studio's blank-catalog setup. Updating an older Woo draft through Mockup Studio classifies its style and creates/reuses missing zero-on-hand blanks.
- Keeps unclassified legacy styles visible as `Unclassified` instead of guessing numeric/catalog styles.
