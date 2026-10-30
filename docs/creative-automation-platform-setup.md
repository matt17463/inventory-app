# Skilled Crafting long-term creative automation (October 29, 2026)

## Delivered in this branch
- Public `/design` customer product concept builder, with visual placement, size/color/quantity choices and optional uploaded source artwork; submits **quote requests only** through existing `client-order-submit` function and its existing IP-based throttling, R2 attachment storage, and customer review queue. It does not collect payments, set prices, publish Woo listings, or create travelers.
- Staff manual library using private `knowledge/manuals/*.pdf` R2 objects, server-side PDF.js text extraction, page/chunk citations, Postgres full-text search, SHA256/ETag dedup, OCR-needed status and an hourly scheduled scanner (one new/changed file per run).
- Optional local Ollama gateway `scripts/local-knowledge-agent.mjs` with staff JWT and app-role verification, model query bounded by approved excerpts, source-linked citations and optional package marketing copy. Strict loopback Ollama address and HTTP server binding. No paid inference fallback. The gateway requires an **explicit private HTTPS reverse proxy** before the Vite client can connect.
- Admin manual upload and index status through `/.netlify/functions/knowledge-manual-admin`; limited PDF size and staff roles.
- Unit tests and database RLS policies. Additive migration applied to connected Supabase project.

## Activate private local language model
1. Choose a powered-on Mac with enough RAM for an appropriately sized Ollama text model, or a dedicated inference server. A Pi 5 can work with a small model but may be slow. Install Ollama and pull an openly licensed model; review its license before production use.
2. Keep Ollama at `http://127.0.0.1:11434`, never exposed publicly.
3. On that same trusted computer, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SC_LOCAL_AI_MODEL`, `SC_LOCAL_AI_ORIGIN=https://inventory.skilledcrafting.com` and optionally `SC_LOCAL_AI_PORT=8788`. **Service role key stays ONLY on the trusted local server**, never in `VITE_*` or browser code. Launch `node scripts/local-knowledge-agent.mjs`.
4. Put the gateway behind a private TLS reverse proxy with access restricted to Tailscale, on a distinct authenticated HTTPS hostname. Do not expose 8788 or 11434 on the public internet. The gateway verifies employee JWTs and active app roles on every request.
5. Configure Netlify build variable `VITE_SC_LOCAL_AI_URL` to the final private HTTPS gateway hostname and redeploy. Browser clients must be on Tailscale to connect. If this variable is absent, search works but AI buttons are disabled.
6. Check source citations, response quality, application login, errors when Ollama is stopped, and role-denied behavior. Never use the model to bypass machine-safety guidance or customer approvals.

## PDF indexing
- Upload PDF manuals through the staff Knowledge tab (up to 4 MB each in this interface) or place PDF objects beneath **only** the private R2 `knowledge/manuals/` prefix. Files already elsewhere in R2 are **not automatically ingested**, to prevent unintentionally indexing customer artwork, personnel records, or other sensitive documents.
- Hourly scanner indexes one new/changed PDF per run to limit processing costs and function time. The dedicated admin endpoint indexes a small upload immediately.
- Source citations expose title, page number and bounded excerpt; raw R2 keys are not public links.
- Existing manuals stored on NAS or other unallowlisted storage need an explicit reviewed inventory/import plan and access-control check before copying to the approved R2 prefix.
- Image-only/scanned PDFs need OCR, not automatically enabled. Large documents above 12 MB or 400 pages should be split or handled by a separate controlled ingestion worker.
- Staff admin/manager can upload, and staff read roles only; anonymous users receive no Supabase table grants.

## Before production publishing
- Verify full GitHub Actions CI including the new tests and `npm run build`.
- Verify public anonymous /design on desktop/mobile, different browsers, no price/checkout/traveler bypass, and rate limiting.
- Verify Netlify PDF worker bundling and scheduled function registration.
- Confirm Supabase RLS and restricted source visibility with role tests.
- Do not claim local AI is *running* until the hardware, model download, tunnel and hostname are provisioned.

## Approved NAS / business Mac manual sync
- On a trusted workstation or Pi with access to an explicitly approved business-manuals-only folder, install Node dependencies and configure the existing private R2 environment variables on that machine.
- Set `SC_MANUAL_SYNC_ENABLED=1` and `SC_MANUAL_SOURCE_DIR=/path/to/approved/business-manuals`. Do not point this at the home directory, NAS root, personnel files, customer records, or broad file shares.
- Run `node scripts/sync-approved-manuals.mjs` manually once. It scans at most 250 PDFs, ignores symlinks and hidden items, imposes a 12 MB/file limit and only uploads changed files to the private `knowledge/manuals/` namespace.
- After checking output, schedule the same command on the trusted host (e.g., systemd timer or cron) to pick up new files. A Netlify scheduled index task checks the approved R2 prefix every 15 minutes and processes one new or changed PDF per run. Existing files outside that prefix are never ingested automatically.
- Scanned image-only documents need a separate OCR workflow and human review. No documents were moved out of the existing NAS or deleted by this release.
