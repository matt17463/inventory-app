# Netlify environment variables

Use `.env.example` only as a checklist. Do not commit or upload a `.env` file containing real secrets.

Required browser variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Required server variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SC_ALLOWED_ORIGINS`
- `WOO_SITE_URL`
- `WC_CONSUMER_KEY`
- `WC_CONSUMER_SECRET`
- `WC_WEBHOOK_SECRET`
- `MANUAL_PULLSHEET_SECRET` or the compatible secret already used by the WordPress integration
- `SC_ARTWORK_WEBHOOK_SECRET` or the compatible secret already used by the artwork integration

Never expose `SUPABASE_SERVICE_ROLE_KEY`, WooCommerce secrets, or shared integration secrets through a `VITE_` variable.
# Google Calendar Phase 1 (v0.6.30)

These values are server-only. Never prefix them with `VITE_`, commit them to GitHub, paste them into Supabase SQL, or send them in chat.

| Variable | Required | Purpose |
|---|---:|---|
| `GOOGLE_CALENDAR_CLIENT_ID` | Yes | Web application OAuth client ID from Google Cloud. |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Yes | Secret belonging to the OAuth client. |
| `GOOGLE_CALENDAR_STATE_SECRET` | Yes | Random secret used to sign short-lived OAuth state. Generate with `openssl rand -hex 32`. |
| `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY` | Yes | 32-byte key used for AES-256-GCM encryption of the Google refresh token. Generate with `openssl rand -base64 32`. |
| `GOOGLE_CALENDAR_REDIRECT_URI` | Yes | Exact callback: `https://inventory.skilledcrafting.com/.netlify/functions/google-calendar-oauth`. |
| `SC_APP_URL` | Yes | `https://inventory.skilledcrafting.com` for event links back to the app. |

The token-encryption key must remain stable. If it is changed after connecting Google, open **Tools & Admin → Google Calendar** and reconnect the Google account before the next sync.

# Mockup Studio — All Phases (v0.7.0)

These values are server-only. Never prefix the OpenAI key with `VITE_`.

| Variable | Required | Purpose |
|---|---:|---|
| `OPENAI_API_KEY` | Yes for AI Assist | Calls the OpenAI Images edit endpoint from the background function. |
| `OPENAI_IMAGE_MODEL` | Recommended | Image model name; defaults to `gpt-image-1.5`. |
| `SC_MOCKUP_ALLOWED_ASSET_HOSTS` | Recommended | Comma-separated HTTPS host allowlist for linked blank/artwork sources. Direct uploads do not need this. |

The existing `WOO_SITE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` values are reused. Captions and images are sent to WooCommerce only from server functions.

# Mockup Studio — Cloudflare R2 storage (v0.8.6)

All R2 values are server-only and must have the **Functions** scope. Never use a `VITE_` prefix for an R2 credential.

| Variable | Required | Value / purpose |
|---|---:|---|
| `MOCKUP_STORAGE_PROVIDER` | Yes | Set to `r2`. |
| `R2_ACCOUNT_ID` | Yes | Cloudflare Account ID. |
| `R2_ACCESS_KEY_ID` | Yes | Access Key ID from a bucket-scoped R2 API token. |
| `R2_SECRET_ACCESS_KEY` | Yes | Secret Access Key from the same R2 API token. Mark as secret in Netlify. |
| `R2_BUCKET_NAME` | Yes | Recommended: `skilled-crafting-mockups`. |
| `MOCKUP_PREVIEW_MAX_PIXELS` | Recommended | `800` |
| `MOCKUP_PREVIEW_QUALITY` | Recommended | `78` |

Use R2 **Standard** storage. The R2 token needs Object Read & Write access only for the selected bucket. The application never exposes the Access Key ID or Secret Access Key to the browser; Netlify creates short-lived, single-object URLs.

Artwork Requests, Reorders, and Vault URLs are downloaded once by the Netlify function and copied into R2 when selected for a Mockup Studio project. The source hostname must be the `WOO_SITE_URL` hostname or be listed in `SC_MOCKUP_ALLOWED_ASSET_HOSTS`. Include every exact WordPress/CDN hostname that serves approved artwork; never use wildcards or IP addresses.
