# Steps 6–14 Preflight V3

The original preflight used a temporary table that could disappear between statements in Supabase SQL Editor. V3 uses `ON COMMIT PRESERVE ROWS` and distinguishes:

- `PASS`: installed and recorded
- `REVIEW`: installed but missing a ledger record, or a non-blocking data condition needs review
- `STOP`: required object or incompatible prerequisite is missing

Use:

`supabase/verification/000_steps6_14_preflight_read_only_v3.sql`

Run the complete file at once. Do not highlight only the last `SELECT`.
