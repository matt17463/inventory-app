# Unified Creative Operations Suite — implementation package

Branch: `feature/unified-creative-operations-suite-20261029`
Route: `/creative-operations`
Scope: Command Center (1), Artwork Engineer (2), Customer Design Studio (3), Product & Package Creator (5), Knowledge Assistant (10).

## Current implementation

- Integrated, responsive five-tab workspace with navigation to existing operational modules.
- Existing Daily Command Center, Work Hub, Equipment Center, customer orders, mockups, quote builder, product/event development and device recipe tools are reused instead of forked.
- Local browser artwork inspection for pixel dimensions, printable size at 300 PPI, alpha statistics, partial transparency, and potentially unintended white borders. Does not upload the image.
- Editable wedding, coach recognition and corporate package economics with costs, selling prices, setup expenses, gross contribution and draft copy.
- Searchable, source-linked in-app knowledge entry points. Results are based on a curated index, not embeddings or retrieval of document contents.
- Existing product approvals, billing verification, and travelers remain enforced. No machine controls or customer checkout bypass.

## No paid AI API rule

Never require a paid model provider for features in this package. Default pathway:
- Browser: Canvas 2D image preprocessing, transparency diagnostics, deterministic editing and preview.
- Pi/local workshop node: **optional** self-hosted background removal worker using open-source segmentation software (e.g., rembg / ONNX runtime) on suitable compute. Must be explicitly networked and health-checked before enabling.
- Optional local text model on machine with adequate RAM/compute, with a model gateway restricted to Tailscale/private network; never expose Ollama or similar inference ports publicly.
- For unconfigured local model, show an honest `Not connected` state and permit deterministic tools and conventional text search.
- Do not silently fall back to OpenAI/Gemini or another chargeable endpoint.
- Model artifacts must be reviewed for licensing and quality before production use.

## Next engineering integration contracts

### Command Center
1. Reuse authorized RLS operations queries for jobs, QC, purchasing, inventory, workload.
2. Add signed telemetry ingestion from the shop Pi for equipment state, wattage, temperature and humidity; store `last_seen`, source and confidence.
3. Distinguish `offline`, `no sensor`, `stale`, and `running`. Never infer machine health from an absence of alerts.
4. Queue operations only through existing approved Work Hub workflows.

### Local Artwork Engineer
1. Implement authenticated local worker gateway with task IDs, max-size limits, rate limits and progress polling.
2. Segmentation: return a transparent mask with selectable exterior/interior regions, color threshold options, edge refinement, and user-visible alpha diagnostics.
3. Integrate as optional new backend in existing `DTFPrepStudio` engine. Preserve source and history; require proof review before saving.
4. Preserve 300 PPI metadata, prevent RGBA premultiplication artifacts; never claim CMYK ICC transforms without RIP/profile support.
5. Introduce golden image fixtures (white logo interior, white exterior, semi-transparent antialias, dark garment) and false-positive tests.
6. Avoid propagating customer image content to third-party inference servers.

### Customer Design Studio
1. Add token-based customer sessions anchored to existing `CustomerPortal` and mockup permissions, not broad anonymous Supabase table access.
2. Implement garment/product selection using active catalog and confirmed variants, upload scanning, safe R2 signed operations, and per-placement artwork.
3. Validate mockup-to-order/quote mapping; persist proofs with explicit version IDs and audit who approved what.
4. Rate-limit uploads, disable SVG scripts, sanitize all generated images, reject unverified price changes.
5. Build WooCommerce handoff only after verified pricing, variation certification, inventory and graphic selection.

### Product / Package Creator
1. Promote package draft into current Product Development Center with RLS customer ownership, stock checks, tiered pricing, material costs, time, spoilage, and fixed setup.
2. Offer deterministic suggestions from approved recipes/catalog before optional local-model generated copy.
3. Proposals must display assumed vs verified costs. Customer approval and shop authorization gate publishing, invoices and travelers.
4. Do not import fabricated supplier prices. Verified costs must have provenance and date.

### Knowledge Assistant
1. Register manuals, equipment recipes, approved artwork metadata, policies and application documentation using an allowlisted source catalog.
2. Index documents with source ACL and version metadata. Prefer PostgreSQL full-text search initially; optional self-hosted embeddings (pgvector) only if measurable benefit.
3. Apply RLS at retrieval time, not only at indexing time; do not expose customer source content across tenants.
4. Always return citations to document, page/section and modified-at. If no grounded source exists, say it was not found.
5. Prohibit automatic external transmission of restricted client data.

## Launch and regression gates

- Run `npm run check` including existing security, printing, customer graphics and traveler tests.
- Test marketing and admin/manager/operator permissions separately; verify marketing route.
- Test mobile and light/dark high-contrast themes and tab keyboard interactions.
- Test 24 MB/24 MP image caps, malformed images, transparent logo, JPEG, and upload-disabled case.
- Validate package calculations, decimal costs, zero quantities and pricing edge cases.
- Confirm all in-app module links resolve and permission rules are preserved.
- Confirm Netlify production env does not accidentally enable paid API fallback.
- Stage and sign off customer-approval, Woo checkout, webhook, traveler, invoicing and printing regression before production promotion.
- Do not publish to production until tests and external integration checks have actually passed.

## Current known limitations

This is an **integrated usable foundation**, not a finished five-module automation deployment. There is no connected local inference worker, no public interactive customer configurator, no indexed private document corpus, and no new data migration yet. Nothing here claims a verified production deploy.
