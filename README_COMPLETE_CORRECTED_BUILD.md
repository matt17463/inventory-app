# Skilled Crafting Inventory Application — Complete Corrected Build

**Release:** 0.6.16  
**Purpose:** Consolidated application containing all source, Netlify function, validation, and Supabase migration corrections from Steps 1–14, plus the final Deployment Health and ESLint corrections.

## What is included

- Complete React/Vite application source.
- All Netlify functions in ESM format.
- Public token-scoped customer portal routing.
- Authenticated employee functions and fail-closed server integrations.
- Timing-safe WooCommerce webhook HMAC verification.
- WooCommerce status auditing.
- Resumable supplier-feed synchronization.
- Pull-sheet reservation repair and duplicate-line protection SQL.
- Deployment Health page, route, navigation item, and secured Netlify function.
- Complete Supabase migration, verification, contract, optional, and rollback files.
- Static route/security tests and validation scripts.
- Correct ESLint browser/Node environments.
- Renamed ordinary functions that were incorrectly interpreted as React hooks.
- Stale deployable files removed.

## Important

This source package contains no production secrets. Netlify environment variables must still be configured separately.

The supplied Supabase audit showed the required Steps 1–14 database objects were already installed. Do not rerun all migrations against production. Run only SQL that your audit or deployment guide specifically identifies as needed.

## Recommended deployment

1. Extract this folder to a new location.
2. Copy your existing local `.env` only when needed for local development; never commit it.
3. Run `npm ci`.
4. Run `npm run check`.
5. Link the folder to the existing Netlify site with `npx netlify link`.
6. Create a draft deploy with `npx netlify deploy --build`.
7. Verify `/deployment-health` and the menu item.
8. Publish with `npx netlify deploy --build --prod`.

See `COMPLETE_BUILD_DEPLOYMENT_GUIDE.md` for novice instructions.
