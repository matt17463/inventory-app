# Deployed Client Storefronts versus repository 0.1.3

Reviewed 2026-10-22. **Confirmed functional difference, not merely a header mismatch.** This is a read-only source/configuration review; no deployment or publishing occurred.

## Evidence and method

- Refreshed repository `main`: `7233f968e40ffd159d4142d5a1aff418ad8b423e`. Handoff branch HEAD: `6fdac5154609ffca32e5e18dc2e389096e55c083` (adds the instructions, not different plugin code).
- Live Plugins > Installed Plugins: **Skilled Crafting Client Storefronts**, active, header **0.1.2**, plugin basename `skilled-crafting-client-stores/skilled-crafting-client-stores.php`. No update notice for this custom plugin was displayed. A missing update notice is not a deployment-equivalence check.
- Read the entire displayed installed PHP and `assets/storefront.css` through WordPress Plugin File Editor. Only selection/navigation was used; **Update File was never clicked**. Reviewed those two rendered files against the repository's two companion files and the change in commit `ef38277` (“Keep client product recommendations within the assigned category”). No installed-file download, filesystem checksum attestation, or PHP execution was performed.
- Historical repository comparison `4c47fa6..ef38277` corroborates the identified 0.1.2 → 0.1.3 changes. This is separate from live source evidence; a historical diff by itself would not prove what is installed.

## File/function comparison

| Area | Actual installed 0.1.2 source | Repository 0.1.3 | Practical impact |
|---|---|---|---|
| PHP version and stylesheet cache version | Header and enqueue version `0.1.2` | Both `0.1.3` | Cache/version change accompanies real behavior changes |
| Product-context resolver | No `scs_product_store()` | Adds resolver using `scs_store`, store type/status, permissions for draft preview, and product-category membership | Identifies a valid client context on a product page, including authorized draft QA |
| Related-product filter | No category-isolation filter in companion PHP | Adds `woocommerce_related_products` filter at priority 20, retaining candidates in the store category or descendants | Prevents the companion from recommending other-category candidates; does not guarantee a full number of replacements |
| Product body class | No `scs-client-product` class | Adds it when resolver succeeds | Enables contextual presentation rules |
| CSS enqueue scope | Storefront, cart, checkout or directory only | Also enqueues on valid client product context | Required for the new product widget rule to take effect |
| `assets/storefront.css` | No contextual recently-viewed suppression | Adds `body.scs-client-product .widget_recently_viewed_products{display:none!important}` | Hides a history widget which can otherwise contain other clients' goods; does not delete history |
| REST creation/update route | `skilled-crafting/v1/client-store`, CREATABLE; requires `manage_woocommerce` AND `edit_pages`; validates campaign/category/title/logo/slug, reuses campaign record | Same reviewed behavior | No identified route/payload/permission change in this version delta; endpoint was not submitted |
| Templates and landing collection | Athletics, scholastic, business and fundraising; published/authorized native preview; category plus descendants; configured messaging/colors/logo | Same reviewed behavior | Updating is not justified as “adding all branded templates”; those already exist in installed PHP |
| Checkout/session context | Published-store session handling, category membership, mixed-cart neutral branding, authorized draft checkout preview, classic/block banner hooks | Same reviewed behavior | No identified checkout logic change in this delta; actual cart/checkout regression testing remains required |
| Shortcodes/directory | `sc_client_storefront`, published-only `sc_client_store_directory` | Same reviewed behavior | The ordinary public directory may instead be managed site content; do not assume shortcode ownership from its title |

This review identifies the functional differences above. It does not claim byte-for-byte equivalence of every other deployed file, PHP opcode/cache state, or behavior under all third-party filters.

## Safe observed behavior

The Client Storefronts list still contains **one QA draft**, “Internal QA Fall 2026 — Do Not Publish,” and no published store in that list. Its existing preview rendered the SKSC collection with ten product cards and the QA-only ordering/delivery copy. No draft was created, changed or published.

Following the preview's first product link preserved the `scs_store` query context. The resulting product page had **no `scs-client-product` body class**, did **not load the companion stylesheet**, and its recently-viewed product widget was visible. Those observations agree with installed 0.1.2 source. The three related products in this particular render happened to belong to the SKSC collection; this sample did **not** demonstrate a cross-category recommendation leak. The missing enforcement is confirmed in source, rather than an invented incident.

The one active Code Snippets record, “SC — Storefront policy links and product recommendations,” also filters related products at priority 20, twice, excluding four fixed legacy category IDs, and customizes the checkout policy link. It is **not** a store-category resolver and does not replace the new companion filter. Five other snippets were inactive. No snippet was edited. Other theme/plugin filters remain an integration consideration.

## Diagnostic correction needed

The application's `wpPluginSlug()` takes the first plugin-basename folder. `summarizePlugins()` looks for `skilled-crafting-client-storefronts`, but live basename folder is **`skilled-crafting-client-stores`**. A local pure-function reproduction using the actual live basename returns `storefront:null`, matching the visible “Not confirmed” result.

Therefore, in this installation, “Not confirmed” has a demonstrated identifier-normalization cause. Do not report it as proof of missing plugin or insufficient REST permission. REST permission/WAF failures remain other possible failure modes generally. Recommended separate application fix: recognize this exact basename alias, retain the original identifier in evidence, and add a regression case using the actual installed basename. Do not broadly match arbitrary plugin names.

## Approval-ready remediation, prerequisites and rollback

1. Owner approves testing the **two-file 0.1.3 companion update**, not an unreviewed plugin replacement or automatic live update. Confirm the desired category/recommendation behavior and whether recently-viewed history should be hidden within client context.
2. Prepare an isolated, fictional-data WordPress fixture as specified in `COMMERCE_INTEGRITY_STAGING_PLAN.md`. Test the current code first. Keep PHP/CSS versions together; verify plugin path and WordPress/Woo/PHP compatibility.
3. On that fixture test all four templates, draft versus published permissions, invalid/missing context, product outside assigned category, child categories, related candidates from another client, recent-history widget visibility, mixed cart neutrality, classic and block checkout, mobile layout, directory and REST validation. No real payments or emails.
4. Before an approved production change, save a restricted backup of the installed plugin folder and relevant store metadata. Record hashes at that time, inventory current campaigns, and schedule a low-traffic window. The PHP/CSS delta shows no database migration, but that does not replace a tested backup.
5. Deploy both reviewed files only after approval and acceptance. Any cache purge is a separate intentional live action, not part of this audit.
6. Roll back both files together to the backed-up 0.1.2 package, restore its cache version, then recheck preview, products and checkout branding. Do not restore an entire live Woo database over orders received during the deployment window.

Estimated engineering effort: 1–2 hours for comparison packaging/rollback rehearsal after staging exists, plus 2–4 hours for contextual frontend checks. Planning estimate, not a quotation. No update was performed.
