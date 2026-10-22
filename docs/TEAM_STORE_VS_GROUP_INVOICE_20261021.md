# Team and group order processing — recurring store vs one-time invoice

## Business rule (explicit user requirement)
**Track A: Recurring school/team store.** A client needing ongoing reorders gets a dedicated storefront that presents campaign-specific WooCommerce products. Shoppers open approved Woo product pages and check out on the established Skilled Crafting WooCommerce site. Existing Woo webhook/order sync remains the sole authority for paid orders, inventory and production jobs. Storefront does not operate its own cart, collect card payments or modify Woo checkout.
**Track B: Occasional team/group order.** The group uses the existing online `/team-order` request form, keyed by a campaign-specific code. Skilled Crafting reviews the intake in Client Orders, prepares existing QBO CSV/manual QuickBooks invoice, marks actual payment, then deliberately converts the request to a manual order and production job. No Woo products or store are required.

These tracks share artwork, approved manufacturing recipes, QR travelers, purchasing and QC, but NOT their checkout/invoice creation. The `order_channel` field governs which experience is shown. Do not insert an occasional group order into Woo or automatically invoice a recurring-store buyer in QuickBooks.

## Added capabilities
- Campaign planning backed by existing `sc_team_store_workflows`; explicit `woocommerce` / `quickbooks_invoice` channel, safeguarded against switching after orders exist.
- Public `/stores/:slug` shows a published campaign and links to verified same-origin WooCommerce product pages. Manager publication requires approval, valid deadline and assigned dedicated products.
- Campaign product assignment uses trusted server-side Woo REST reads. A product ID can belong to only one campaign and requires an explicit dedication confirmation. Reusing a general shared Woo product would attribute unrelated sales to this campaign, so do not do that.
- Closing a campaign removes the campaign landing page only and leaves Woo products and existing orders intact. To stop direct product checkout, review/draft dedicated Woo products separately in WooCommerce.
- Public group form verifies its campaign code server-side, pre-fills organization and date, then stores `campaign_id` on the authoritative `sc_client_order_requests` record. It does not change pricing, confirmation gates, taxes or invoice conversion.
- Group campaigns display linked client requests and status via scoped RPC, with links to Client Orders and the Work Hub. Sensitive customer email/payment data is not included in the summary.
- Team rosters can be imported/exported and tracked for packing. Roster entries are not paid orders or reserved inventory; personalized names/numbers must also be captured in the authoritative customer order.
- Woo order reconciliation reads verified order line items and refunds, excludes unpaid and ambiguous-refund lines from estimated fundraising, and handles Woo paging. Final payouts require manual reconciliation in Woo and QBO; no auto-disbursement.

## Rollout and checks
- `npm ci`, `npm test`, `npm run lint`, `npm run build`, `npm run functions:esm`, `npm run check` via GitHub Actions; no Netlify branch previews (existing ignore command remains enabled).
- Apply additive `202610220003_team_store_commerce.sql` before `202610220004_team_campaign_dual_channels.sql`, validate table grants, RLS and security advisor after changes.
- Test one real recurring-store Woo product through its original Woo checkout (not a simulated payment) and reconcile an actual paid/refunded order before relying on fundraiser totals.
- Test a one-off form submission with group code, QBO CSV creation, payment approval, and production conversion; verify `campaign_id` and that no Woo order was created.
- Confirm manager-only publishing and no unauthenticated access to admin campaign data.
- No public store should be marked live without client artwork/pricing approval. No automatic product publication or QBO invoice sending occurs on page load.

## Follow-on improvements
- Season cloning and client-facing coordinator reporting with aggregation/minimized personal information.
- Woo product ownership validation (e.g. dedicated campaign metadata) and automated campaign-specific checkout tagging before making fundraising payout fully automatic.
- Product-variation personalization linked to order-line meta; do not assume a separate roster is authoritative customer approval.
- Group-specific consolidated purchasing and packing batches based on paid Woo order lines or approved manual-order job items, not unsent client requests.
