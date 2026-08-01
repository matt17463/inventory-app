#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "Set SUPABASE_PROJECT_REF before running this script."
  exit 1
fi

npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
npx supabase migration list
printf '\nPending migration dry run:\n'
npx supabase db push --dry-run
