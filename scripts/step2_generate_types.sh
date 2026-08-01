#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "Set SUPABASE_PROJECT_REF before running this script."
  exit 1
fi

mkdir -p src/types
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public > src/types/database.generated.ts
echo "Updated src/types/database.generated.ts"
