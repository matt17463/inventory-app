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
