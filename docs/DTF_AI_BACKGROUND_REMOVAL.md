# DTF AI background removal

Gemini suggests foreground/background points from a maximum 768-pixel thumbnail. A deterministic connected-color flood engine resolves those regions against the immutable source at full resolution. This is hybrid AI guidance, not a native precision matte, and never regenerates branded artwork. Keep guidance restores connected original pixels; brush restore corrects finer details. Multiple regions accumulate. All AI results require review before PNG/SVG/R2 export; low-confidence local removal and removal above 90% also require review. A mask that erases everything is rejected.

## Configuration and deployment

Reuse the existing server-only `GEMINI_API_KEY`. Production must explicitly configure `GEMINI_IMAGE_MODEL=gemini-3.5-flash-lite` and `DTF_GEMINI_ENABLED=true`. Supported explicit alternatives are `gemini-2.5-flash` and `gemini-2.5-flash-lite`; there is no automatic fallback. Research settings, Tavily and OpenAI are not used. The selected 3.5 Flash-Lite model is the same free-tier-capable model used by the existing research integration. Free-tier eligibility depends on the configured Google project, not a model name; no payment/billing setting is changed. Current pricing: https://ai.google.dev/gemini-api/docs/pricing . Image capabilities: https://ai.google.dev/gemini-api/docs/image-understanding .

The production Netlify prebuild verifies model access and a real, tiny synthetic image request **before publication**. It verifies that the guidance removes the white exterior and preserves the original central foreground color. Failure blocks publication. Local/CI builds skip this request. Keep Gemini values available to Functions and the hosted build for this gate. No key, provider response body or image is written to build logs. Customer artwork is never used by this build gate. A successful gate proves model/image access and this synthetic case; it does not certify every customer logo or available future quota.

Netlify secret values are masked outside hosted Netlify code. Do not copy them locally, test their masked API representation, remove their secret flag or broaden their contexts to obtain the value. Policy: https://docs.netlify.com/build/environment-variables/secrets-controller/ .

No database migration or R2 bucket change is needed. After CI passes, merge through the existing main-to-Netlify production workflow. Verify the published commit and deploy ID, then the authenticated `/dtf-studio` action. The endpoint remains off when the explicit enable flag is absent or false. To stop external AI calls, set that flag false and redeploy; local methods remain available.

## Security and data handling

The POST endpoint uses the existing server-verified Supabase employee authorization (`admin`, `manager`, `operator`), active role lookup and audit conventions. It reserves an audit record before checking the rolling 10-attempt employee and 60-attempt site hourly limits. Failed attempts consume a slot; failure to persist/read usage fails closed. The cap is an operational guard, not a replacement for provider billing controls.

Only PNG/JPEG/WebP still thumbnails are accepted, with byte signatures, strict base64, a 1.5 MB request limit and a 1024-pixel/1-megapixel decode limit. Sharp strips metadata and reduces external image content to 768 pixels. Analysis has a 22-second timeout and bounded output. Responses must contain finite normalized coordinates, allowed point types, bounded point count and confidence. Image text is untrusted input, never an instruction source. No tools, external URLs, creative image generation, web research, retries or paid-provider fallback are invoked.

Audits store outcome, model and point count, never image content, credentials or provider text. Responses are `no-store`. The UI explains transmission to Google and possible free-tier data use before invocation. The browser never receives Gemini/service-role keys. Sharp is patched to 0.35.5 and the existing jsPDF dependency's DOMPurify is overridden to 3.4.17 to resolve current dependency advisories.

## Fidelity and revisions

Source files remain immutable. Mask computation runs in a worker and is cached independently of proof backdrop. Original RGB values are retained by region masking; optional edge decontamination is an explicit local refinement. Source masks resolve before resizing, cropping, halftoning and output alpha policy. PNG exports retain RGBA, actual 300 DPI metadata and 3600 × 3600 pixels for 12-inch output. Padding does not count as removal. The proof/exports use the same deterministic recipe; preview channel isolation is excluded from exports.

Recipes, accumulated points, brush edits and Gemini provenance are saved in the existing derived R2 artwork metadata. Reopening a derivative resolves its linked immutable source before replay; it refuses replay if that source is unavailable. Existing approved assets are not replaced. Existing approval/traveler/Woo/QuickBooks workflows are unchanged.

## Limits and validation

Connected-color regions are not photographic matting. Differing background colors may need additional points; ambiguous white art requires keep points/brush restore. Global white removal is opt-in and explicitly warns about intentional white ink. AI confidence is not a calibrated accuracy measure. Complex logos and customer proofs still require human visual review. Source uploads are limited to 20 MB and 24 megapixels. Image decode, canvas resampling and final halftone work still use the browser; segmentation is off the main thread.

Run `npm run check`, `npm audit --omit=dev` and the production hosted gate. `npm run test:dtf-studio` includes source/color preservation, independent regions, restores, geometry, alpha policy, AI schema/provider failure paths, authorization, durable quota guards, no sensitive audit data and hosted gate behavior. Browser acceptance should cover multiple picks, keep/brush restore, undo/redo, zoom/pan, split comparison, review gating, output alpha/dimensions/DPI, saved revision replay and authenticated live AI. Test success on synthetic fixtures does not substitute for live customer-logo review.
