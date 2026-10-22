# WordPress Commerce Integrity work results — October 22, 2026

**Read-only workstreams A/B/C complete under the handoff definition. End-to-end acceptance remains unperformed.** Production settings, products, SKUs, orders, inventory and integrations were not changed. No staging was created, data copied or Netlify preview deployed. Earlier broad WordPress audit files retain their original partial status.

## Decision summary

| Question | Confirmed answer | Remaining limit |
|---|---|---|
| Is live Storefronts different from repository 0.1.3? | Yes. Installed active 0.1.2 lacks the new product-context resolver, related-product category isolation, product body class and contextual recently-viewed CSS/enqueue behavior. Installed PHP/CSS read, not header-only inference. | No checksum attestation, update deployment, checkout or cross-client runtime leakage test |
| Which generator owns SKUs? | Custom builder and SkyVerge register competing enabled writers. WP Wham is active but its internal main generation switch is off. Application publisher supplies another explicit REST scheme. | Static path order is not a runtime save trace; no single canonical authority can be certified until owner policy and staged path tests |
| Can shipping charge incorrectly? | Two core thresholds use >=200 after discounts on displayed tax-exclusive subtotal; extension uses ==200 on pre-discount subtotal including tax. Both rate-hiding switches are off. Class fees mean base zero alone is not a free rate; specific zero/blank class combinations permit zero rates in source. | No checkout quotes or historical charge-error evidence. Campaign free organization delivery may be intentional; tax/discount/package/selection effects need tests |
| Is there safe existing staging? | Selected skilledcrafting.com installation in SiteGround lists no staging copies. Owner confirms no known isolated app/Supabase staging. | Isolation unverified; tests require approved setup, not a production-connected preview |

## Inspected evidence

Read the commerce handoff on branch `handoff/wordpress-commerce-integrity-audit-20261022` and earlier audit/preflight/snapshot reports before inspection. Refreshed main source to `7233f968e40ffd159d4142d5a1aff418ad8b423e`. Through the authorized browser, inspected live Installed Plugins; full companion PHP/CSS; three SKU plugins' relevant code/settings; Woo save lifecycle, flat/free calculation and cart code; the active Code Snippets record; existing QA draft and linked public product; both shipping zones/method dialogs; postcode/class/tax settings; the published extension rule; coupon controls; application GET diagnostic; and SiteGround staging list.

The refreshed application read at **11:21:43 AM Pacific** retained the bounded 50-record/0-missing/0-duplicate SKU result. A public five-variation sample also had five SKUs and no repeated values within itself; overlap with the 50 is unknown. No exhaustive catalog uniqueness assertion follows.

Evidence is transcribed into sanitized tables/source descriptions. No raw administrative screenshots or plugin source dumps are committed; customer data, coupon codes/links and secrets are excluded. Read-only plugin editor selection did not invoke Update File. No rebuild handler, SKU save, sync, repair, staging creation, coupon application or checkout transaction was invoked.

## Ranked proposed actions — none applied

1. **Review the published 100% coupon policy promptly.** C1 has free-shipping allowed and apparently broad eligibility with no entered expiry/spend/usage limits. Confirm intentional internal use before separately approving restrictions. This is configuration evidence, not a claim of misuse; code/link omitted.
2. **Harden the custom SKU rebuild route before any proposed use.** Its admin capability check is present, but source intentionally omits nonce validation on a state-changing GET batch action. Approve a separate nonce/POST design and staged failure/cross-request checks; no exploit was attempted.
3. **Choose an identity policy and remove competing write authority only after staged acceptance.** Custom builder rewrites existing SKUs; SkyVerge can subsequently rewrite variation SKUs on the AJAX path. Neither custom collision suffix nor application deterministic hash is a universal variation-ID suffix. Preserve placed-order provenance and blank mappings; SKU rebuild is not sync or relink.
4. **Agree on one ordinary-shipping threshold basis and explicit distribution exceptions.** Core/extension differ in comparator, tax and discount base. Heavy fallback class is blank with a configured zero base, while Spirit Wear explicitly describes free organization delivery and has 81 product assignments. Fix the policy rather than assuming all zero costs are mistakes. No class/rate changes without approval.
5. **Approve the tested two-file companion 0.1.3 deployment plan.** The functional delta is established; category-context frontend regression and rollback remain pending. Existing sample related products happened within category; no observed cross-client leak is claimed.
6. **Correct application plugin identity aliases in a separate code change.** Actual folders `skilled-crafting-client-stores` and `wc-sku-builder-manager-v3-clean` are missed by the current exact recognizer. A local pure-function reproduction explains “Not confirmed” and the two-candidate list. Activation must also remain distinct from WP Wham's internal enable switch.

## Approval and remaining acceptance gates

All feasible handoff A/B/C read-only inspections were performed. Unresolved runtime questions are explicitly documented: AJAX/non-AJAX/bulk/REST last-writer behavior and invalid SkyVerge callback reachability; lookup/cache consistency; full-catalog collisions and historical blank/order mapping; all four storefront template/category/checkout cases; actual offered/selected shipping rates across addresses/classes/tax/coupons/sessions/packages; and external integration isolation.

No single authoritative writer or observed customer under/overcharge is certified. Settings and source support concrete conflict/rate paths, which are sufficient for recommendations but do not replace controlled transactions. Owner approval is needed for environment setup, any copied data, fictional writes, remediation scope and production rollout. See the staging plan for isolation and a **12–24 engineering-hour planning estimate before remediation**; hosting may have no incremental cost if the existing plan includes staging, but account billing was not verified.

## Report index

- [Deployed storefront comparison](STOREFRONT_DEPLOYED_CODE_COMPARE.md)
- [SKU ownership and hook analysis](SKU_WRITER_OWNERSHIP.md)
- [Shipping rules, class costs and untested matrix](SHIPPING_RULE_VERIFICATION.md)
- [Staging availability, checklist and cost assumptions](COMMERCE_INTEGRITY_STAGING_PLAN.md)
- [Validation results](COMMERCE_INTEGRITY_VALIDATION_20261022.md)
- [Machine-readable completion scope](COMMERCE_INTEGRITY_HANDOFF_COMPLETE.json)

Return to the original Skilled Crafting ChatGPT conversation with the audit PR and: **“Work finished the storefront, SKU and shipping integrity checks. Review the results and prepare the approved remediation steps.”** That conversation handles final guide/training/PDF integration and only owner-approved remediation.
