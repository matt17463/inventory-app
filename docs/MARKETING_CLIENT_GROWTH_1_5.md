# Marketing & Client Growth — release 1.5.0

The Marketing workspace connects client acquisition to the existing operating system. Organizations own contacts and client pricing defaults; each campaign/season has its own opportunity, brief, commercial versions, tasks and linked operational records.

## Included workflows

- Prospect organizations and decision makers, source/referral tracking, owners, contact preferences, a staged opportunity pipeline, next actions, deadlines, CSV prospect import with preview/deduplication, reversible archival and pipeline export.
- Calls, emails, meetings, demos, sample interactions and feedback in a relationship timeline. Follow-up and launch tasks carry department, owner, date, status and blockers.
- Versioned promotional library for flyers, email drafts, presentations, pricing guides, samples and demo references. Private R2 uploads are limited to supported files up to 25 MB; the server verifies the uploaded size/type before completion. Approved content requires a new revision to change. Copying email text does not send it.
- Sample requests, preparation, delivery/return status and promotional cost. Physical stock stays in the existing sample/finished inventory workflows.
- Demo and live storefront references and review state. Existing Mockup Studio handles images, customer review links and WooCommerce product drafts; existing team-store workflows stage launch work.
- Independent pricing defaults for every client, with campaign-level overrides and immutable approved proposal versions. Managers approve terms and explain below-target margins. Client guide downloads omit internal costs and company margin.
- Acquisition reports, source performance, weighted pipeline, recent activity, promotional commitments, approved benefit/profit forecasts, and manager audit history.

## Commercial models

| Model | Client benefit | Company profit |
|---|---|---|
| Standard retail | None | Retail sales less entered costs |
| Wholesale → retail | Retail less supply price | Supply revenue less entered costs |
| Net-sales share | Adjustable percentage of item sales | Remaining sales less entered costs |
| Contribution-profit share | Adjustable percentage of positive sales less costs | Remaining contribution profit |

Sales exclude tax and shipping. Costs include blank, decoration, labor, other unit costs and line setup fees. Company margin is company profit divided by sales retained after the client share. Suggestions account for the selected sharing model and margin target; a wholesale suggestion sets the supply price. Proposal lines represent the selected order mix, not alternative quantity tiers.

Percentages and targets are client-specific. Changing client defaults affects future drafts only. Approved versions retain their exact config, lines, terms, expiry, approval and calculated money. A new approval supersedes the previous agreement without changing its historical content. Actual proceeds are settled using actual sales, returns and agreed fees; the Marketing report is a forecast rather than a payout/accounting ledger.

## Continuous handoff

1. **Design:** The manager confirms the brief and existing customer identity. One transaction creates or reuses a customer, native artwork request and linked Mockup Studio project. Marketing Design Briefs is available from Artwork Requests; WordPress-sourced artwork remains in its established queue.
2. **Operations:** A current approved proposal creates a linked team-store workflow, a draft partner supply estimate, imported mockup pricing and seven departmental readiness tasks. The supply estimate uses the company-retained rate; it is not a shopper invoice. Shopper retail, client benefit and full costs remain in the proposal.
3. **Launch:** Design, catalog, storefront, procurement, production, QC and shipping record owners/readiness. Artwork approval, product mapping, checkout checks and a storefront URL are required before Live. Product publishing and supplier/production actions use the existing reviewed workflows.
4. **Orders:** Incoming lines are attributed by an exact published Mockup Studio product ID. Mixed orders can link to multiple campaigns. Other jobs can be linked by an operator/manager. The workspace reads current job status rather than copying a second production lifecycle.
5. **Changes:** Repeating a handoff reuses customer/design/store records and tasks. A newly approved agreement creates one new supply estimate and replaces previously imported mockup prices; old imported rows remain in the audit and manually created rows are retained.

No marketing action sends outreach, publishes a storefront, submits a purchase order or moves physical stock automatically.

## Access and training

Marketing users can maintain acquisition and planning data, use the limited pricing catalog, and read linked operational status. They cannot read stock ledgers, relink customers/operations, approve terms or use shop mutations. Operators manage shop follow-through; managers approve material/commercial versions and handoffs. Administrators can assign/deactivate Marketing access for an existing registered employee from Reports. Self changes and administrator/manager changes are blocked in that scoped tool. No account was assigned or invited during this release.

The guide has a complete prospect-to-delivery chapter. Marketing guided training uses a browser-only Training Example School with sample contacts, material, pricing and follow-ups. Practice writes, uploads, access changes and handoffs are intercepted before requests. Marketing’s full-screen tour is limited to allowed routes. Training data is never inserted into production tables.

## Verification

- Twelve behavioral tests cover pricing bases/margins, independent settings and suggestions, loss handling, invalid amounts, CSV quoting/deduplication inputs, formula-safe exports, unsafe URLs, employee access, upload/revision boundaries, private file references and scoped access administration, and server startup without native WebSocket support.
- Fifteen rolled-back database checks cover pricing, cross-client contacts, immutable versions, stale approval detection, repeat-safe handoffs, readiness gates, pricing replacement/history, exact product attribution, imports, operator/viewer/Marketing/anonymous boundaries and unchanged physical inventory.
- The new tables and RPCs have no anonymous privileges. No real leads, contacts, demo orders or role assignments were created for testing.
- Full existing checks and compatibility validation are required before push. Screen verification uses the actual Marketing component with simulated data, tests compact and desktop widths and samples text contrast across all nine themes in light/dark mode (18 combinations; sampled minimum 6.44:1). It does not claim a live file upload or a published customer store was exercised.

Database setup is in `20261016221732_marketing_client_growth_workspace.sql`. Repeatable rollback fixtures are in `supabase/verification/962_marketing_growth_rollback_smoke.sql`. Role enforcement also applies at the server endpoints and table/RPC layers; navigation filtering is an additional usability measure.

## Deployment runtime

Netlify builds use Node 24, pinned through `.nvmrc` and `netlify.toml`. The current Supabase client requires native WebSocket support or an explicit transport when running below Node 22, including when constructing a service client for authentication. All server-side Supabase clients use the supported `ws` transport, so the existing Node 20 GitHub validation and older hosted runtimes remain compatible. This is runtime code, not a test-only shim. See [Supabase's compatibility notice](https://supabase.com/changelog/37869-change-in-realtime-js-affecting-node-js-22).

Netlify normally follows the build's Node version for Functions. If an existing site has an `AWS_LAMBDA_JS_RUNTIME` override, it must also target `nodejs24.x` using the site UI/API; that override cannot be set in `netlify.toml`. See [Netlify Functions runtime configuration](https://docs.netlify.com/build/functions/configuration/?fn-language=js#nodejs-version-for-runtime).
