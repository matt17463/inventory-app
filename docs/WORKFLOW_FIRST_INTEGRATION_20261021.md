# Skilled Crafting — workflow-first integration build
Date: 2026-10-21. Branch: feature/workflow-first-production-20261021.

## Priorities
- Owner-operated; employee time/HR enhancements deferred.
- Preserve specialist pages, but offer one guided client/job flow for owner and occasional family helpers.
- Production recipes need verified garment placement drawings, size-specific measurements, materials, packaging and QR links.
- DTF artwork preflight first; BN2-30 / UV / laser preflight after, using existing Artwork Vault and Material Settings.
- Team stores, group orders, fundraising and repeat seasons are major growth initiatives.

## Changes implemented in this branch
- New Work Hub reads existing Production Board status and blockers, then links to relevant next-step pages. It does not mutate inventory, job status or customer promises.
- Existing Mockup Studio production packet: local QR encoding with authenticated internal same-origin link; illustrative hoodie, tee and polo print placements; saved project notes; printable nonpersistent packing checklist.
- DTF preparation: browser-local edge-connected near-white background removal, alpha bounds, source pixel warnings, dimensions and PNG metadata at 300 DPI. It does not upload to R2 or substitute for quality approval.
- No production Supabase changes, WooCommerce writes or new third-party integrations are included.

## Future: unified recipe and job traveler — DB changes not yet implemented
Create immutable recipe revisions and line-item traveler snapshots linked to authoritative jobs/job_items and existing Woo sources.
Recipe fields: blank SKU/style/size/color; approved source artwork and production file R2 IDs; decoration process and material setting reference; print dimensions; physically measured offsets and reference landmarks; equipment; material estimates; QC; bagging/pickup/shipping instructions; approver/date.
Each job traveler references exact approved recipe revision, quantity, fulfillment state and blocker evidence. QR must contain only the same-origin authenticated URL plus record ID, never an auth token. Role and tenant checks enforced server side via RLS.
No duplicate decrement of stock, no direct job status edits that bypass existing audit/RPC authority.
Authoritative state machine: enquiry -> quote -> artwork/customer approval -> stock ready -> production -> QC -> packaging -> delivered/reorder. These are user-facing steps derived from actual evidence, not alternative status columns.
QR on pull sheet, garment-size label or production packet should reopen current job traveler, show approved artwork, placements, machine/material settings, pack instructions, and let authorized user progress it.

## Next: artwork storage and machine-specific preflight
Persist source and derived files through existing Artwork Vault / R2 with version history and approval. Explicit warnings for low effective PPI, color halos, weak antialiasing, text or logo fidelity, and stray pixels.
BN2-30: add printable-area, scale/media and cut-contour validation, then verified handoff into manufacturer RIP. Omni UV: mask and height-map preview, white/varnish intent and measured jig/fixture coordinates, not proprietary xTool job output.
Laser S1/P2/MOPA: vector paths, units, duplicate line / open shape tests, checked substrate safety and manufacturer-supported output formats; no guessed production machine settings.

## Team store / group order / fundraising roadmap
Campaign record: organization, season, coordinator, approved assortment, artwork, pricing model, fundraising program, deadline and delivery/pickup policy.
Public approved Woo store links plus roster/name/number personalization; client proof and approval; consolidated blank purchasing and transfer/print batches; per-player fulfillment sheets.
Fundraising ledger must account explicitly for eligible items, discounts, refunds, taxes, shipping, payouts, reconciliation and approvals; do not conflate gross revenue with net eligible fundraiser proceeds.
Limited coordinator portal should show only their own campaign, sales progress and aggregate roster/packing information; never wholesale costs or unrelated personal customer data.
Keep a repeat-season store clone workflow referencing previously approved logos and product recipes with new prices/inventory verification.

## Verification before release
Run exact-commit CI: npm ci, npm run test:workflow-first, npm run check; check live mockup project with multiple garment types.
Scan paper QR on mobile; user must authenticate. Verify PNG is 3600x3600 for 12x12 inches, correct 300-DPI pHYs, and transparent edge rendering on source samples.
Physical positioning MUST be confirmed per garment size and brand; SVG guides are schematic, not to scale. Saved offsets override general guide suggestions.
Run Supabase schema, grants and RLS audit when introducing production traveler tables. Do not deploy the migration or promise complete team-store automation until end-to-end tests pass.

## Placement sources
- https://www.stahls.ca/en-ca/design-placement-tips
- https://blog.stahls.com/how-to-heat-print-hoodies/
These are optional starting references, not a substitute for fitting and measuring the actual blank.