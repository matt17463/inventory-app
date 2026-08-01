# Release Notes — 0.6.27

## Inventory Overview universal product search

The Inventory Overview search previously filtered only the rows returned in a
single app-view response. That caused three problems:

- Supabase response limits could leave later products outside the client-side
  search set.
- Linked WooCommerce SKUs were excluded unless a separate checkbox was enabled.
- Product descriptions and other descriptive fields were not searched.

Version 0.6.27:

- Loads inventory views in deterministic 1,000-row pages instead of assuming
  one oversized response contains the complete catalog.
- Searches blank SKUs, linked Woo SKUs, product names, descriptions, short
  descriptions, product content/excerpts, brands, styles, colors, sizes,
  barcodes, supplier fields, attributes, variations, bins, and statuses.
- Searches all SKU sources automatically; the old linked-Woo checkbox is no
  longer necessary.
- Supplements inventory rows with searchable metadata from `blank_products`,
  `products`, and `finished_products` when those relations are available.
- Adds a Description column to both Blank Products and Finished Products.
- Keeps a compatibility fallback when supplemental catalog tables are not
  directly readable by the authenticated user.

No SQL migration is required.
