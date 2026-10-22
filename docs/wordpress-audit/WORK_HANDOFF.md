# ChatGPT Work handoff: live WordPress plugin documentation audit

Project: Skilled Crafting complete application and WordPress documentation.
WordPress: https://skilledcrafting.com/ (use the authorized Work cloud browser).
App guide: https://inventory.skilledcrafting.com/application-guide
Repo: https://github.com/matt17463/inventory-app

## Goal and handback
Audit conditional dialogs and active WordPress plugins that are unavailable in the inventory-app repository. Return structured verified findings, redacted evidence, and operational notes to GitHub. After finishing, EXPLICITLY prompt the user to return to the ORIGINAL ChatGPT conversation for completion of online training, PDF, and remaining live application documentation.

## Read first
- src/application-guide/wordpressPluginAudits.json (starter registry; does not assert installation)
- src/application-guide/conditionalDialogs.json (source-reviewed, not automatically live verified)
- docs/wordpress-audit/WORK_HANDOFF.md (this plan)
- src/application-guide/DocumentationAuditPanel.jsx (review UI)
- WordPress companion plugin in wordpress/skilled-crafting-client-stores/
- Current guide at src/application-guide/guideData.js and trainingData.js

## WordPress audit instructions
1. Navigate to Plugins > Installed Plugins. Document the full installed active/inactive plugin inventory, exact versions, authors/vendors, functional dependencies. Do not assume a plugin is present just because source or old documentation mentions it. Focus on WooCommerce, Skilled Crafting Client Storefronts, WC/Supabase sync, personalization/product options, artwork submissions/proofs, checkout/payments/shipping/tax, forms, invoices/packing slips, Divi and caching/security integrations.
2. For every active plugin relevant to Skilled Crafting: inspect admin screens/tabs/settings, product/category editor controls, configuration dialogs, conditional states, roles, required/optional fields, dropdown options and defaults. Describe every actual field and button in novice language with deeper operating and data-integrity notes, what saves trigger and what errors mean.
3. Inspect safe client-facing pages where possible: Find Your Store, individual client store landing and product/category pages, Team Orders page, WooCommerce checkout, and any relevant forms. Check responsive/mobile states. Distinguish standard Woo orders for recurring stores from occasional group forms that go to QuickBooks and manual jobs.
4. Test dialog visibility by observing already-existing, safe UI states and viewing non-mutating previews. Do NOT publish pages, alter settings or customers, submit orders, charge cards, buy postage, delete assets, update Woo/QuickBooks/inventory, email anyone, or click irreversible buttons simply to document them.
5. Note integration ownership and possible failure paths: WordPress REST/App Password, WAF/hosting, plugin version mismatch, product category assignment, Woo sync, R2 artwork, QC/packing/fulfillment, tax/shipping and safety/security.
6. Take screenshot evidence only when fully REDACTED of customer data, emails, addresses, secrets, account/API keys, payment info and session tokens. When not safe to capture, mark no screenshot. Do not put raw admin screenshots into publicly served application assets.

## REQUIRED structured output
Update src/application-guide/wordpressPluginAudits.json, preserving schemaVersion 1 and the existing source-only caveat, with a record for each relevant installed plugin. For each plugin include:
- slug, name, installedVersion, activationStatus (active/inactive/unverified), reviewStatus (live-verified/partial-live-review/source-only/unverified), businessPurpose, source or official documentation reference.
- adminScreens and publicScreens, each with name, pathHint (no private tokens), conditions, verified, screenshot (only a sanitized path), controls array.
- For each control: label, type, purpose (novice), advancedNotes, when, required, options, effect, errors, safety, relatedWorkflow.
- conditionalDialogs: id, name, trigger, visibleWhen, fields, confirmation, effects, errors, safeTrainingScenario.
- dependencies, integrationPoints, knownTroubleshooting, securityNotes, sourceReviewNotes and auditEvidence with reviewedAt/reviewedBy/missing conditions.
Only mark live-verified after the actual relevant interface and its meaningful conditional states were checked; never invent defaults or post-save effects. Keep unverified gaps explicit.
Update src/application-guide/conditionalDialogs.json only where live verification truly justifies changing status.

Produce these reports:
- docs/wordpress-audit/active-plugin-inventory.md: all installed plugins, versions, active status, priority and audit coverage.
- docs/wordpress-audit/screen-audit.md: per-screen field, action, dialog and conditional-state matrix; sanitized screenshot references.
- docs/wordpress-audit/operations-integrity.md: integration map, cross-workflow data ownership, risks, troubleshooting and blockers.
- Optional redacted screenshots under docs/wordpress-audit/sanitized/ (not a public app asset).
- docs/wordpress-audit/AUDIT_COMPLETE.json with status complete or partial, completedAt, audited counts, reportPaths, remainingGaps and safeForGuideBuild. Do not mark complete if coverage is substantially missing.

## Return to original chat
Run documentation-registry validation, existing tests, lint and PDF regeneration check where feasible. Do not create Netlify previews. Create GitHub PR titled WordPress documentation audit - verified plugin screens and workflows. Merge only if authorized and verified. Never change plugin configuration or operational records as part of an audit.

Your LAST Work reply MUST tell the user:
"WordPress audit complete [or partial: explain gaps]. Please return to the original Skilled Crafting ChatGPT conversation and say: Work finished the WordPress audit. Review the findings and complete the guide, training, and PDF integration. Here is the PR link: [link]."
