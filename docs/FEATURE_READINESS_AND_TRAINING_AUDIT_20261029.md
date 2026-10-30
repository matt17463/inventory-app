# Skilled Crafting - October 29, 2026 documentation and readiness audit

Scope: source and navigation review, October 22 live WordPress audit, and October 26-29 integration documentation. This is not a live end-to-end checkout, database, printer or production acceptance test.

## What changed

The October 22 printable guide covered 92 navigation screens and 1,239 source-detected controls across 224 pages. The current navigation declares 104 screens. Current areas include Creative Operations Suite, public design intake, a private PDF knowledge library, optional local-model gateway, AI Product Discovery, DTF Gemini background removal, catalog variation certification, Woo graphic mapping, grouped QR travelers and Print Order.

The online guide and role-based training have been expanded with technical control instructions, purpose, examples and scenario walks. The guide/training version is 2.0.0. The build-time PDF generator imports these new chapters on successful build.

The October 22 WordPress audit observed 51 installed plugins (50 active) at that time, but it was partial. The version/activation of every plugin must be rechecked on the live WordPress host. Skilled Crafting Graphic Choices version 0.2.0 was later reported installed, but its option switch and Netlify capture flags are not proven enabled.

## Source-of-truth handoffs

- Marketing CRM: organization, permission, opportunities and contact activities.
- WooCommerce: recurring client storefront, paid orders, selected product metadata.
- Team-order form and Client Orders: one-time group requests, deliberate conversion.
- QuickBooks: original manual order invoice, actual total, payment and balance.
- Client Graphics: approved source asset, version, placement and selected order graphic.
- Supabase ledger/real bins: exact size/color stock, reservations and movements.
- Production recipes and QR travelers: approved process, placement and line coverage.
- Print Center/Work Hub: verified customer invoice, DRAFT shop copy, saved 4x6 labels.
- QC/packing: actual item checks, issues, customer distribution and release.

## Feature readiness matrix

| Area | Source implementation | Verify before claiming operational completion |
| --- | --- | --- |
| Creative Operations/package builder | React suite and calculator | Cost assumptions and actual quotes |
| AI Product Discovery | Dashboard/server research | Provider key, free-tier limit, source review |
| Public design | Quote-only intake | Anonymous/mobile/rate-limit and Client Orders queue |
| Local Ollama | Gateway/setup code | Workshop host, model, TLS/Tailscale, employee JWT |
| PDF knowledge indexing | R2 indexer and app UI | Approved PDFs, actual index, OCR, permissions |
| DTF AI background guidance | Mask UI/background worker | Gemini secret/flag, synthetic preflight, real logo tests |
| Woo Graphic Choices | WordPress plugin and approved mapping | Selector enabled, cart metadata, webhook, traveler |
| Variation certification | Exact SKU readiness records | Catalog variation and production job sample |
| QuickBooks invoice verification | Print and reconciliation code | Exact invoice total and safe block on mismatch |
| Epson / D530 Pro | Pi agent/CUPS support | Real queue/paper/output test and dispatch flags |
| WordPress storefront publishing | App publisher/companion plugin | Credentials, version, sample campaign and checkout |
| NAS/R2 backup | Setup and storage dashboard | Actual schedule, RLS, restore test and monitoring |

## Remaining planned or blocked work

1. Scheduled unattended AI product discovery is explicitly marked not implemented in the research guide. It requires safe provider budgets and authorization before scheduled activation.
2. Local AI activation requires a powered host, Ollama download, private reverse proxy and permitted workstation/Tailscale connection. Source code cannot complete the physical setup.
3. Scanned, image-only PDF manuals still need a separately authorized OCR pipeline. The indexer handles approved PDF text but not automatic OCR.
4. Woo checkout-to-traveler must be accepted in an isolated fixture with exact graphic binding, no real charge or email, and observed final traveler.
5. Epson and D530 Pro need live Pi queue, 4x6 and letter print tests. Device network attachment is not proof of a working print agent.
6. CO-1006-type billing total mismatch should be resolved against the actual QuickBooks invoice; never override customer invoice verification to print.
7. Overlapping WordPress SKU writers, coupons, shipping rules and option plugins need staged identity and checkout tests before changing live settings.
8. Machine settings are starter recipes until they have actual test and signoff; manufacturer and safety instructions take priority.

## Before release

Verify current production commit, environment flags and schema; authenticated and unauthorized access; fictional-order creation, review, failure and rollback; exact Woo metadata and job; print preview and physical output; and no secrets in logs. Save evidence for each integration. Build and inspect the generated PDF; check the new training modules. A passed static test is not an end-to-end acceptance certificate.

Documentation coverage is expanded. Live activation and full integration testing remain unverified by this audit.
