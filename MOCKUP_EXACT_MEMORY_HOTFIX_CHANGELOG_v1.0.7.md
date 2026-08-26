# Mockup Studio Exact Clean Memory Hotfix v1.0.7

## Fixed

- Prevented high-resolution artwork from being fully expanded before resizing.
- Bounded ecommerce mockup output dimensions while preserving original R2 assets.
- Reduced Sharp concurrency and cache use in the Exact Clean renderer.
- Reduced PNG compression memory and processing cost.
- Added actionable HTTP status reporting when Netlify cannot return JSON.

## Deployment impact

- No SQL migration.
- No required environment-variable changes.
- Existing projects, placements, source images, AI mockups, and WooCommerce mappings are unchanged.
