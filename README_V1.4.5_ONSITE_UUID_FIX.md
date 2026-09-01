# Skilled Crafting v1.4.5 On-site UUID Contract Fix

This corrective overlay restores the UUID-safe SQL 50 file expected by the current schema and v1.4.5 regression suite.

Changed file:
- deployment/sql/50_ONSITE_SALES_PURCHASING_AND_CATALOG_RECONCILIATION.sql

Reason:
- public.blank_products.id is UUID.
- The stale repository copy declared blank_product_id and p_blank_product_id as bigint and cast movement/reservation IDs to bigint.
- The corrected file consistently uses UUID for blank product IDs while retaining bigint for bin/color IDs where appropriate.

No database migration should be run from SQL 50 during this corrective step unless specifically required by a separate deployment instruction. The immediate purpose is to restore the repository source-of-truth and pass the regression suite.
