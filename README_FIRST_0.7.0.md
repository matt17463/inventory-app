# Read This First — Skilled Crafting v0.7.0

This is the complete replacement source package for **Mockup Studio — All Phases**. It is based on the v0.6.30 Google Calendar release and preserves the existing inventory, reservations, pull-sheet, production, customer portal, and WooCommerce workflows.

Before deploying the application, run this one additive Supabase migration:

`deployment/sql/18_MOCKUP_STUDIO_ALL_PHASES.sql`

Then follow:

`MOCKUP_STUDIO_DEPLOYMENT_GUIDE.md`

New employee routes:

- `/mockup-studio`
- `/mockup-studio/:projectId/production-packet`

New public, token-protected review route:

- `/mockup-review?token=...`

The OpenAI and WooCommerce credentials are server-only Netlify variables. Never add them to a `VITE_` variable, source file, GitHub commit, Supabase SQL, or browser storage.

