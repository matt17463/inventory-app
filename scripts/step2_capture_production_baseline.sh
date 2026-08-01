#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "Set SUPABASE_PROJECT_REF to the project ref shown in your Supabase dashboard URL."
  echo "Example: export SUPABASE_PROJECT_REF=abcdefghijklmnopqrst"
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Node.js/npx is required."
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASELINE_DIR="$ROOT_DIR/supabase/baseline"
TYPE_DIR="$ROOT_DIR/src/types"
mkdir -p "$BASELINE_DIR" "$TYPE_DIR"

SCHEMA_FILE="$BASELINE_DIR/${STAMP}_production_public_schema.sql"
STATUS_FILE="$BASELINE_DIR/${STAMP}_migration_status.txt"
TYPE_FILE="$TYPE_DIR/database.generated.ts"
CHECKSUM_FILE="$BASELINE_DIR/${STAMP}_checksums.txt"

cat <<'EOF'
This script performs read-only database inspection and schema export operations.
It does not run db push, db pull, migration repair, or db reset.
EOF

npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
npx supabase migration list | tee "$STATUS_FILE"
npx supabase db dump --linked --schema public --keep-comments -f "$SCHEMA_FILE"
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public > "$TYPE_FILE"

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$SCHEMA_FILE" "$STATUS_FILE" "$TYPE_FILE" > "$CHECKSUM_FILE"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$SCHEMA_FILE" "$STATUS_FILE" "$TYPE_FILE" > "$CHECKSUM_FILE"
else
  echo "No SHA-256 utility found; checksum file was not created." >&2
fi

printf '\nCreated:\n- %s\n- %s\n- %s\n' "$SCHEMA_FILE" "$STATUS_FILE" "$TYPE_FILE"
