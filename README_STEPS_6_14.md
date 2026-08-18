# Skilled Crafting Inventory App — Steps 6–14

This release completes the remaining operational hardening and deployment-safety work after Steps 1–5.

Read `docs/STEPS_6_14_SAFE_DEPLOYMENT.md` before applying SQL or deploying code.

## Required order

1. Back up the linked Supabase project and current Netlify deployment.
2. Run `supabase/verification/000_steps6_14_preflight_read_only_v3.sql`.
3. Resolve every `STOP` result and review every `REVIEW` result.
4. Run these additive migrations in order:
   - `supabase/migrations/202607250501_step6_woocommerce_status_audit.sql`
   - `supabase/migrations/202607250601_step7_supplier_sync_runs_and_cache.sql`
   - `supabase/migrations/202607250701_step8_pullsheet_idempotency_support.sql`
   - `supabase/migrations/202607251301_step14_deployment_health.sql`
5. Deploy the updated application and Netlify functions.
6. Run `supabase/verification/900_steps6_14_post_install_verification.sql`.
7. Complete the smoke tests in the deployment guide.

The optional unique index in `supabase/optional/202607250702_optional_pullsheet_unique_index.sql` must be run only after the preflight reports zero duplicate job/line-item groups.

## Safety boundary

The required migrations do not delete, migrate, merge, or rewrite existing inventory, order, job, job-item, reservation, product, mapping, sample, supplier-catalog, or WooCommerce records. They add audit/run metadata, a reservation compatibility helper, a private supplier cache bucket when missing, and deployment-health metadata.
