# Skilled Crafting unified printing — first implementation (2026-10-22)

## Status
Feature branch: `feature/unified-print-center-20261022`
Draft PR: #114
**Not merged or deployed to production. No real printer or accounting integration was changed.**

## Current first-stage behavior
Go to Work Hub → select a job → Print invoices + labels. Managers and admins may open Print Center. 
The new read-only Netlify function uses the linked job's source order:
- WooCommerce: fetch current original order using server-side Woo REST credentials; the function returns only normalized order details and authoritative totals. It never writes to Woo, inventory, payment, or production.
- Manual/QuickBooks pathway: read existing `sc_manual_invoice_order_totals` and `sc_manual_invoice_order_items_detail`. These are not live QuickBooks API totals and must **not** be labeled financially verified.

Documents:
1. **Customer invoice** (US Letter, one or more pages), with financial details from the verified Woo original. Customer copy is blocked for unverified manual orders.
2. **Internal SHOP invoice** (US Letter, one or more pages), with original source financial details plus staff-authenticated Work Hub QR, due date and recipe/traveler references. Clearly marked DRAFT if QuickBooks reconciliation is unavailable.
3. **Distribution labels** (4x6 points, black and white, one per selected package) for Munbyn 941B. Default staff QR is off; this is not paid carrier postage. When multiple packages have no recorded per-package allocation, the labels explicitly **do not claim that every item is inside each package**.
4. **Production packet** (US Letter) built from existing immutable approved job traveler snapshots, including a QR URL to the authenticated traveler, placement offsets/visual references, saved machine settings, work steps, and approved R2 artwork preview when available. If preview cannot be fetched, the document says so instead of using substitute artwork.

Layout controls include invoice font sizes, label font size, package count, SKU, personalization, phone, visible label fields and opt-in staff QR. **First-stage defaults are saved only to the current browser**, not across all shop devices.

## Deliberate limitations
- No direct one-click dispatch or print-completed claims; PDF download is available. The Pi/CUPS or Mac print bridge must be tested with the physical Munbyn 941B and Epson before automatic routing.
- The new invoice has a Skilled Crafting visual design but is **not yet a pixel-matched port** of the WooCommerce Print Documents plugin. The existing Woo plugin remains the production fallback.
- QuickBooks API reconciliation is not yet present. Do not use a manual-order draft customer copy as a finalized invoice, and do not rely on manual source payment flags as QuickBooks verification.
- Recipe assignment remains a separate deliberate workflow; no automatic creation of travelers or adoption of old unapproved artwork.
- No printer driver installation or queue changes have been made. No Supabase schema changes were required for the first release.
- No per-player/team/classroom distribution allocation yet; the current labels are package labels, not roster-bag routing.
- No central shared template editor or printed-status audit yet.

## Next development phases
1. Capture the exact WooCommerce plugin template appearance and adapt into centrally stored application template settings, including page-break verification for 50+ item team invoices.
2. Implement explicit, auditable QuickBooks original-invoice reconciliation (API or reviewed matching invoice PDF/totals); only then unlock manual-order customer invoice.
3. Product → approved artwork/recipe/size-based placement assignment with bulk mapping and review for existing Woo storefronts; auto-attach appropriate approved traveler to a real job without editing original orders.
4. On-site setup: connect 941B USB to Pi, check device recognition/CUPS and driver support, test 4x6 and 203 DPI legibility; verify Epson network printer queue. Evaluate 300 DPI upgrade only if those tests show legibility problems.
5. Build an authenticated, auditable local print-agent bridge: no anonymous network print service; signed/authorized print requests, idempotent job IDs, queue/result status and explicit retries, printer routing by document type. Never infer physical print completion from job submission.
6. Add exact packed-per-package contents, grouped team/roster labels and separate USPS carrier label handling.
7. Run dry-run and real physical QA; only merge/deploy after requirements and validation.

## Sample QA matrix
- Paid Woo store order: 2 letter copies with matching Woo taxes, shipping and coupons; external label should not show staff secrets.
- Woo order with 50+ lines: multiple pages with complete line items and totals exactly once.
- Manual QuickBooks order: only draft SHOP copy, customer invoice unavailable until QBO reconciling is implemented.
- Missing production traveler: print operations show warning, no fabricated logo/settings.
- Approved multiple-size travelers: each displays appropriate revision, measured placement and machine settings.
- Two packages: no duplicated “full order contents” list on both labels.
- Epson US Letter output and Munbyn 941B 4x6 output: print sample labels, scan QR, verify margin, barcode and fonts.
- Test mode: ensure printer dispatch and accounting transactions are disabled or do not exist.
