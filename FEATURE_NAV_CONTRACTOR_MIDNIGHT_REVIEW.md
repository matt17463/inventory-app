# Review checklist — navigation, contractor hours, Midnight Industrial

Branch: `feature/navigation-contractor-hours-midnight-20261012`

This branch is for review only. It must not be merged, deployed, or applied to the production Supabase project until approved.

## Included
- Menu Manager at `/menu-manager`: create/rename groups, move and reorder items by touch-friendly arrow controls, drag/drop, show/hide, reset defaults. Navigation preferences are stored **per authenticated user in this browser**, not synchronized across machines. Hidden links are not authorization gates.
- Contractor Hours at `/contractor-hours`: manual time submission by user or manager, server-timestamp clock in/out, corrections and voids with reasons, manager approve/reject/mark-paid, weekly/monthly/quarterly/yearly/custom reports, historical rates, and CSV export. `paid` is an administrative reconciliation flag, not an actual payment.
- Midnight Industrial: optional preset on Theme Settings with deep-navy surfaces, cyan status highlights and structured telemetry-like panels. Choosing the preset initially switches to dark appearance; the rest of the app's theme choices remain available. Actual live equipment integrations are not part of this branch.
- Migration `supabase/migrations/202610120001_contractor_hours.sql`: new tables, strict RLS, authenticated security-definer RPC writes, one open clock session per user, audit triggers, manager corrections, and effective-dated rates.

## Before a release
1. Confirm GitHub Actions `Validate Inventory App` passes on the final commit: schema validation, function validation, all tests, lint and Vite production build.
2. In a **staging Supabase project**, run the migration. Do **not** run it in production before approval. Confirm all objects/permissions are created without errors.
3. Test with three separate real logins: contractor, manager, inactive account. Verify that contractor A cannot read B's hours or pay rates or call manager RPCs. Verify that an inactive role cannot initialize or submit hours.
4. Confirm clock in, duplicate clock-in refusal, clock out, forgotten-shift manager correction, manual entry/edit/void, approve/reject/paid transitions and immutable audit records.
5. Change a contractor rate with a new effective date; verify earlier periods retain earlier pay calculations. Validate CSV in QuickBooks' intended downstream workflow, and check spreadsheet-formula protection.
6. Test menu reorder and hidden items, refresh, account switch on shared hardware, restore defaults, new navigation links after an upgrade, narrow touchscreen widths and dark-theme contrast.
7. Verify Netlify settings don't automatically deploy feature branches. Only open/merge the PR or trigger a deployment after explicit approval.

## Dependencies and limitations
- Requires the existing `sc_app_user_roles` table and `sc_current_app_role()` security helper.
- A contractor must have an active Supabase Auth / application-role account; managers can register an existing account by email in the page.
- Currency totals are estimates based on hourly-rate history. Payments, tax reporting, and invoicing are not processed.
- The UI reads data only after the migration exists. Without the migration it provides an installation warning.
- This branch does not create Home Assistant/Raspberry Pi equipment telemetry. That will be a separate integration phase.
- Navigation preferences are intentionally local to each user's browser for this version; cross-device synchronization can be added later.

## CI check
`npm test` includes `scripts/tests/navigation-contractors-theme.test.mjs` with navigation sanitization, week/quarter reporting boundaries, historical rates, CSV safety and migration contracts.
