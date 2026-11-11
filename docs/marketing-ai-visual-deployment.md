# AI Visual Generation — Deployment and Verification

## Architecture
- Existing CRM client and approved artwork feed the Marketing Document Builder.
- `netlify/functions/marketing-ai-visual.js` verifies employee roles and the CRM account, then uses the server-only OpenAI Responses API with `image_generation`.
- Shared creative direction lives in `src/lib/marketingVisualBrief.js` for every document category.
- The school flyer editor generates optional scenic artwork and places editable headings, product photos and prices over it.
- Other templates place generated artwork in an illustrated hero section of the HTML preview and export.
- Saved drafts store generated artwork in the existing client-scoped private R2 asset service, not in Supabase base64 fields.
- Generation never auto-approves or publishes client materials.

## Required environment
- `OPENAI_API_KEY` must exist as a server-side Netlify environment variable, with access to Responses image generation.
- Optional `OPENAI_MARKETING_VISUAL_MODEL` (defaults to `gpt-4.1`).
- Existing Supabase auth and private R2 storage credentials remain required.
- Image generation incurs provider charges and may exceed standard synchronous function execution limits; verify the deployed Netlify plan/function timeout. Failures are surfaced in the UI, not silently replaced with fabricated artwork.

## Production acceptance checklist
1. GitHub CI passes: build/lint, Marketing Document Builder Regression, visual fixtures, security and production activation acceptance.
2. Sign in as a marketing-role employee and select a real CRM account with an approved logo.
3. Generate an image in the school flyer, sports brochure, business brochure, wedding package and a non-brochure template.
4. Confirm images preserve the school/brand identity, avoid fake lettering, and don't contain unapproved logos. Regenerate or reject otherwise.
5. Preview, export, save draft, reload and reopen each document; confirm private R2 artwork restores correctly.
6. Confirm client A cannot access client B's artwork, and users without permitted roles cannot generate.
7. Verify actual deployed image-generation credentials, response sizes, cost behavior and timeouts. Confirm error messages when credentials or quota are unavailable.
8. Compare school flyer outputs visually against the three approved reference PDFs before calling visual fidelity accepted.

## Limitations
AI image generation is non-deterministic. Reference logos may be distorted inside the generated scenery; the app overlays the real approved logo separately. Factual details must be kept in verified editable layers. Generated artwork requires human approval.
