# Production Schema Baseline

This directory is intentionally empty until the exact production schema is exported.

Run from the application root:

```bash
export SUPABASE_PROJECT_REF=your-project-ref
bash scripts/step2_capture_production_baseline.sh
```

The script creates:

- A schema-only public-schema dump
- A migration-history listing
- Generated TypeScript database definitions
- SHA-256 checksums

The schema dump contains definitions, not inventory or order row data. Keep a separate managed Supabase backup or point-in-time recovery checkpoint before any migration work.

Do not fabricate a replacement baseline from source-code guesses. The live database is currently operational and therefore remains the source of truth for the initial baseline.

## Important restriction

Never run `supabase db reset --linked` against the production project. A linked reset can drop the remote user-created schema before replaying migrations.
