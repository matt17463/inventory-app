# Skilled Crafting AI Product Discovery

**Route:** `/product-event-center` → **00 · AI Discovery**.

The Discover and save products action is an asynchronous, employee-authenticated Netlify background function. Each run researches 4–20 candidates across weddings/events, sports and coaches, business branding or gifts, or all areas. Results become draft product opportunities in the existing Product & Event Center with source references, provisional customer fit, demand, production fit and differentiation scoring.

## Operator walkthrough

1. Open Product & Event Center and select **00 · AI Discovery**.
2. Choose research focus and 4–20 candidates; press **Discover and save products**.
3. The run history displays queued/running/completed/partial/failed. While active, the dashboard refreshes about every 6.5 seconds.
4. Inspect each candidate, score component, public links and supplier/CRM signals.
5. Select **Review candidate & sources** to continue with the original Opportunity Radar, adjust manual scores, confirm suppliers and price, and record physical material tests in the Recipe & Test Lab before considering a sales launch.
6. If source records or actual prices are missing, import vendor catalog rows in the existing Supplier Catalog Import; a new run then re-evaluates with the updated data.

## Grounding and privacy

- CRM segments, pipeline titles, supplier costs and approved-recipe details stay server-side for matching. They are not sent to either AI provider. Free-provider material requests also omit free-form notes and user reference links; keep product/material identity fields public and generic.
- Free mode uses Tavily basic public searches, then Gemini structured generation. Discovery accepts only source URLs actually returned by search, with search-result titles. Legacy OpenAI mode remains an explicit configuration choice. References are always **unverified**.
- Supplier comparisons use already imported `supplier_catalog_items`; existing catalog entries are matched against candidate keywords and styles, with actual shop unit costs included only in the protected app dashboard.
- If there are no imported supplier items or CRM opportunities, the interface clearly reports missing evidence. It never invents wholesale prices or direct customer demand.
- A run with missing citations, unsupported machines, or duplicate names will not save invalid suggestions.
- Saved opportunities start in `idea`, never `validated` or `live`. Original production material recipe validation and approval gating is preserved.
- Sales projections are *not* statistical forecasts; automatic scores are conservative provisional leads, not confirmed revenue potential.

## Permissions and limits

- `admin`, `manager`, and `marketing` employees may start discovery and view run history.
- Run creation uses RLS requiring an active staff role, `created_by = auth.uid()`, and queued-only initial status.
- Only the authenticated backend service can advance progress and save source-linked product drafts. The backend checks that the same user started the run.
- A per-user daily research limit of 4 runs and maximum 2 concurrently running jobs prevent runaway costs. Only one in-progress run can be started from a given browser session.
- Training mode does not create a job.
- No external storefront products, invoices, purchases, production travelers or sample orders are created by discovery.

## Hosting requirements

For free mode, use a free-tier Google AI project and Tavily Researcher plan with billing/automatic recharge disabled. Netlify must have:
- `SC_AI_PROVIDER=gemini_tavily`: explicit activation, no automatic fallback to OpenAI.
- `GEMINI_API_KEY` and `TAVILY_API_KEY`: secret server-only Production variables including Functions scope.
- `GEMINI_RESEARCH_MODEL` (optional): defaults to `gemini-3.5-flash-lite`. Gemini 2.5 models are allowed only if the account has legacy access; no paid-only models or Google Search grounding tools are requested.

Free mode makes at most two basic Tavily searches per research call (one for manufacturer research), and one bounded Gemini generation. It has a best-effort 20-request/employee/hour guard based on server-side authorization records; provider quotas remain authoritative. A quota error stops without retries or fallback. An API key from a paid project can still incur provider charges: only use free-tier projects for a no-charge deployment. Tavily search results are untrusted evidence, not instructions. Gemini truncation/blocked output is rejected.

Legacy mode (`SC_AI_PROVIDER` unset or `openai`) uses:
- `OPENAI_API_KEY`: server-only OpenAI API credential with Responses API and web search access.
- `OPENAI_PRODUCT_RESEARCH_MODEL` (optional): defaults to `gpt-4.1`.
- `SUPABASE_URL` / `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` used by existing server-side employee authorization. Never expose service role keys in Vite/browser environment.
- Netlify background functions enabled (configured in `netlify.toml`).

**Not implemented:** scheduled unattended daily discovery, supplier-account API scraping or authenticated vendor quote fetching, CRM account-level purchase recommendations, verified cost of goods without imports, live customer email campaigns, automatic storefront publishing or manufacturing approval. Those require additional integration/security review.

## Known operational considerations

Netlify background worker responses mean **job accepted**, not research finished. Check the saved run's status and error message. The structured model response depends on the selected provider/model access; failed/partial runs are visible but should not be represented as complete results. If no candidates are saved, inspect missing citations, duplicates and errors, then retry with a narrower focus.

## Quality gates

- `npm run test:product-center` covers opportunities, math, source validation, scoring, RLS and component wiring.
- Existing manufacturing, material studio, customer-order, security and integration suites run under Product & Event Center Regression CI.
- Lint and production build must pass before merge and Netlify production deployment.
- Test a **non-billing discovery run** in an authenticated app account after production publication; confirm candidate sources, score readouts, and successful server-side provider access without printing keys in logs.
