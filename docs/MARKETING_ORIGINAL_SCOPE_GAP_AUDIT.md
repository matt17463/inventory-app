# Marketing & Client Growth — original scope / release gap register

Audit date: 2026-10-19. Based on original user marketing goals and the currently merged code. **A compiled UI is not proof an outside service works**. All incomplete items remain explicitly open.

| Requirement | Current evidence / disposition | Follow-up |
|---|---|---|
| AI discovery of prospective organizations by industry and geography | Implemented in this branch; not deployed | Verify live web-search output, source URL and location; add research result acceptance testing |
| Human-reviewed transfer of AI-discovered clients into CRM | Implemented in this branch with duplicate-name/site guard | Browser verification and role checks |
| AI identification of actual decision makers / public contact sourcing | NOT COMPLETE | Verified official-source contact discovery with opt-out and contact permission |
| CRM organizations / contacts / pipeline | Released | Browser regression tests and usability for multiple related contacts |
| Personalized researched outreach drafts | PARTIAL: original AI drafting exists, but research context is not carried automatically | Link selected prospect evidence into an editable outreach draft; human review only |
| Prospect prioritization / scoring by likely need | NOT COMPLETE | Evidence-based scoring with explanations, never fictional buying intent |
| Scheduled sales follow-up / reminders and reorder campaigns | PARTIAL: CRM tasks and follow-up UI exist | Rules-driven recurring tasks and opt-in automation; no unsolicited sending |
| Approved import of CSV prospect lists | Released | Verify validation, deduplication, opt-out protections |
| Client brand guide; logo colors and approximated CMYK | Released as editable/printable concepts | Add persistent image assets, proofs, branded design templates and licensed Pantone workflow |
| Artwork Vault / R2 persistent logo versions | PARTIAL in marketing: image pasted as local data, not durable marketing library asset | Integrate with existing R2 Artwork Vault and version history |
| Industry-specific branded brochures and product catalogs | PARTIAL: templates and AI copy; printable drafts | Polished reusable layouts, selected real product imagery, client approval |
| Supplier catalog and price comparison | PARTIAL: imported search and manual source-checked costs | SanMar/S&S private account-authorized feeds; JPPlus/USCutter approved catalog sources |
| Supplier catalog freshness / import operations | Feed-readiness dashboard released | Map per-supplier imports and status to CRM product picker; reject stale prices |
| Real blank-product photo mockups | Real photo + original-artwork PNG compositor released | QA on sizes/perspective; licensed source assets |
| Perspective-aware/AI-enhanced product mockups | Existing Mockup Studio feature, linked from marketing | Deep handoff carrying chosen product + artwork and saved client approval history |
| Personalized storefront concepts / proof | Released as non-transactional HTML concept | Production WooCommerce campaign/store creation and verified product links |
| Unified markup, margin and customer-facing pricing | Released using shared pricing rules | End-to-end quote scenarios and audit price parity |
| Manager approvals, customer review, sample-to-production queue | Released with database migrations | Full browser/permission acceptance testing (staging was waived by user) |
| Employee online guided training/test mode for marketing | PARTIAL via existing guide/training | Workflow-specific tutorials for discovery, brochures, approvals and supplier verification |

## Deployment rule
Do not mark features complete based solely on the existence of UI components or passing source-pattern tests. Keep supplier account credentials server-side. No automated mass outreach, speculative contact data, private-cost leaks, or inventory commitments. Document real end-to-end results before release.
