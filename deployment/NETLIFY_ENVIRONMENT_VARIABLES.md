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
