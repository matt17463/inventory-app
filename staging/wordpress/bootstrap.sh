#!/usr/bin/env bash
# Creates a localhost-only fictional WordPress + WooCommerce test shop.
# Never copy production wp-config.php, DB, API keys, emails or orders.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
for tool in docker curl unzip openssl; do
 command -v "$tool" >/dev/null 2>&1 || { printf 'Missing prerequisite: %s\n' "$tool" >&2; exit 1; }
done
docker compose version >/dev/null || { echo "Docker Compose v2 required." >&2; exit 1; }
if env | grep -Eq '^(SC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|WOO_CONSUMER_KEY|WC_CONSUMER_KEY|SC_WP_APP_PASSWORD|SC_EASYPOST_PRODUCTION_KEY)='; then
 echo "Refusing fixture bootstrap: production-capable integration environment variables are present." >&2
 exit 1
fi
if [[ -e "$ROOT/.env" ]]; then
 echo "Existing fixture .env detected. Keep its credentials private."
else
 umask 077
 {
  printf 'STAGE_DATABASE_PASSWORD=%s\n' "$(openssl rand -hex 24)"
  printf 'STAGE_DB_ROOT_PASSWORD=%s\n' "$(openssl rand -hex 24)"
  printf 'STAGE_ADMIN_PASSWORD=%s\n' "$(openssl rand -hex 24)"
 } > "$ROOT/.env"
 echo "Generated LOCAL fixture credentials in staging/wordpress/.env (gitignored)."
fi
if grep -Eq 'skilledcrafting\.com|inventory\.skilledcrafting\.com|supabase\.co|api\.stripe\.com|easypost\.com' "$ROOT/.env"; then
 echo 'Refusing a fixture .env containing possible production hosts.' >&2
 exit 1
fi
WC_VERSION="$(printenv SC_STAGING_WC_VERSION || true)"
WC_VERSION="$(printf '%s' "$WC_VERSION" | tr -d '\r')"
if [[ -z "$WC_VERSION" ]]; then WC_VERSION="10.8.1"; fi
[[ "$WC_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
 { echo "Invalid WooCommerce version. Pin x.y.z."; exit 1; }
if [[ ! -f "$ROOT/packages/woocommerce/woocommerce.php" ]]; then
 mkdir -p "$ROOT/packages"
 archive="$(mktemp /tmp/sc-wc-XXXXXX.zip)"
 trap 'rm -f "$archive"' EXIT
 url="https://downloads.wordpress.org/plugin/woocommerce.$WC_VERSION.zip"
 echo "Downloading pinned WooCommerce $WC_VERSION from WordPress.org BEFORE private WordPress startup."
 curl --fail --location --retry 2 --proto '=https' --tlsv1.2 --silent --show-error "$url" -o "$archive"
 unzip -q "$archive" -d "$ROOT/packages"
 [[ -f "$ROOT/packages/woocommerce/woocommerce.php" ]] ||
  { echo 'WooCommerce package missing expected entrypoint.' >&2; exit 1; }
fi
dc() { docker compose --env-file "$ROOT/.env" -f "$ROOT/compose.yaml" "$@"; }
cli() { dc run --rm wpcli "$@"; }
dc up -d db wordpress
admin_password="$(sed -n 's/^STAGE_ADMIN_PASSWORD=//p' "$ROOT/.env" | head -1)"
test "$(printf %s "$admin_password" | wc -c | tr -d ' ')" -ge 20 ||
 { echo "Local fixture password invalid."; exit 1; }
if ! cli core is-installed >/dev/null 2>&1; then
 cli core install \
  --url="http://localhost:8088" \
  --title="FICTIONAL Skilled Crafting Staging - NO REAL ORDERS" \
  --admin_user="fictional_admin" \
  --admin_password="$admin_password" \
  --admin_email="admin@example.invalid" \
  --skip-email
fi
cli plugin activate woocommerce
cli plugin activate skilled-crafting-client-stores
cli eval-file /fixtures/seed.php
cli option update blog_public 0
echo ""
echo 'Local fixture: http://127.0.0.1:8088'
echo 'Account: fictional_admin; password stored LOCALLY in staging/wordpress/.env'
echo 'Payments disabled; email suppressed; cron disabled; Docker network internal-only.'
echo 'This is NOT a live SiteGround test website. Never import real customer data.'
