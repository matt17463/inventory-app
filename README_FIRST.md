# Skilled Crafting Inventory App v0.7.0

This complete source package adds **Mockup Studio — All Phases** to the v0.6.30 release.

Install the additive Supabase migration first:

`deployment/sql/18_MOCKUP_STUDIO_ALL_PHASES.sql`

Then follow:

`MOCKUP_STUDIO_DEPLOYMENT_GUIDE.md`

Validate with:

```bash
npm ci
npm run check
```

Expected final result:

```text
PASS: Required production bundle features are present.
```

The OpenAI key, Supabase service-role key, and WooCommerce credentials belong only in Netlify server environment variables. Never expose them through `VITE_` variables or commit them to GitHub.
