# Release Notes — 0.6.16

## Critical build correction

- Disabled Rolldown tree-shaking for the frontend application route graph.
- Prevents reachable React Router pages from being removed from production.
- Restores Deployment Health in the compiled application bundle.
- Adds `scripts/verify_build_features.mjs`.
- Makes `npm run build` fail when required Deployment Health markers are absent.
- Keeps all Steps 1–14 source, Netlify functions, tests, and SQL documentation
  from the complete corrected 0.6.15 source set.
- Does not include API keys, `.env` files, `node_modules`, or build output.
- Requires no new Supabase migration.
