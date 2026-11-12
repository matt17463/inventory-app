# AI Marketing Design Studio — release readiness review

**Release policy:** Development stays on `feat/design-studio-v6-art-direction-preflight-20261111` and PR #245 until functional, security, and visual acceptance are complete. Never merge `main` merely because tests pass; `main` automatically triggers Netlify production deployment. The owner requested a single controlled release after the whole project is finished.

## Implementation now on the development branch

| Area | Implementation | Verification |
| --- | --- | --- |
| Client-adaptive campaign themes | School, business, nonprofit, team/club, wedding/event and general profiles with distinct headlines, mood, vector motifs, benefits, steps, product modules, customization panel and contact CTA | `scripts/tests/marketing-campaign-profiles.test.mjs`; real-browser category PDFs |
| School design-reference structure | Dominant approved crest, layered graphic hero, decorated merchandise section, program benefits band, how-it-works panel, optional funding comparison, logo/season/sport/club design panel, CTA | Reference spec `docs/marketing-ai-design-studio-master-spec.md`; full-page Playwright proof |
| Private AI planner | Mac Qwen Ollama generates structured layout plans through authenticated Tailscale Serve; deterministic offline fallback when unavailable | `scripts/tests/test_mac_layout_bridge.py`, existing `local-workshop` tests; live Mac restart/retest still required |
| Private copy assistant | Optional Qwen suggestions for headline, description, benefits, steps, CTA; uses no paid API; must be explicitly imported as unverified editable copy | `scripts/tests/test_mac_layout_bridge.py`; live Mac restart/retest still required |
| Approved merchandise imagery | Client-scoped approval-reference lookup, preview-and-confirm selection, up to 5 edited or uploaded product images | `marketing-approved-photo-assets.test.mjs`; R2 live test remains |
| Mockup compositing | Editable relative placement on licensed garment photo, presets, recipe saved/reopened in private client draft, flattening for marketing proof only | `marketing-apparel-composite.test.mjs`; real garment visual QA remains |
| Program financial information | User-confirmed actual wholesale/retail and quantities, gross-margin illustration with disclaimers; never fabricated | `marketing-school-creative-system.test.mjs` |
| Print QA | Logo, merchandise and scenic raster dimension checks; brand/content review attestations; PDF browser print uses same HTML as preview | `marketing-print-preflight.test.mjs`; `scripts/render-marketing-design-studio-proofs.mjs` |
| Saved design fidelity | Three concepts, user copy, products, brand palette/logo snapshot, edited 2D mockup recipes, optional scene and alternate logo are stored in private R2 references | Runtime sign-in and R2 load/save smoke test still required |

## Objective visual benchmark

The supplied one-page reference demonstrates rich school-specific branding, decorated product heroes, bold brushstroke, three benefit columns, four process steps, approved financial illustrations, alternate/seasonal logo art examples, and full CTA. A green software test is not evidence that the page aesthetically meets this bar.

Visual workflow: `.github/workflows/marketing-school-flyer-visual.yml` installs Chromium and produces eight US Letter `.html`, `.png`, `.pdf` proofs for three generic school contexts and five additional client categories. It asserts one page, essential sections, safe margins, no content/footer overlap, and a school-specific empty-space threshold. These fixtures are **TEST-ONLY** and use synthetic merchandise/identity. Retrieve the `school-flyer-layout-samples` artifact from GitHub Actions. Compare screenshots visually to the original PDF at equal scale.

## Explicit pre-deployment blockers

1. **Visual quality acceptance:** human review with genuinely approved product imagery and approved school logo across at least three distinct brand palettes. Never mistake synthetic fixture success for the realism of the reference page.
2. **Local Mac runtime update:** install and restart the updated `scripts/local-ai/mac-layout-bridge.py` after controlled release, then verify authenticated `/layout` and new `/copy` routes via the Tailscale hostname. No public Funnel.
3. **Private storage acceptance:** save/reopen proof for a CRM client with approved logo, five image assets, alternate logo, scene and editable mockup recipe; verify original content and access boundaries for a second client.
4. **Print acceptance:** generate PDF in Chrome on macOS, verify Letter, background graphics, no clipping, legibility and full-color output; check pixel resolution of actual user assets rather than synthetic QA art.
5. **Category-specific real proofs:** a business uniform campaign, nonprofit awareness program, sports team kit and wedding/event collection with appropriate licensed images, corrected copy and approved colors.
6. **Production control:** keep PR #245 unmerged. Once all above pass, take a Netlify deployment baseline, merge once into `main`, check the exact published commit and run logged-in end-to-end marketing workflow regression. Roll back on a mismatch.

## Environment and expenses

No new paid OpenAI image or text API. Local Ollama planning/copy is optional and tailnet-only. Rendering, copy fallback and mockup compositing work without Mac access. Automatic photorealistic scene synthesis with local Windows ComfyUI is not live: the Windows installation was explicitly deferred; do not describe it as available until installed and proven.

## Manual visual feedback checklist

- Does the client-specific school crest dominate appropriately and remain undistorted?
- Are the hero and merchandise imagery convincingly layered rather than five isolated flat stock photos?
- Are benefits, ordering, verified fundraising, and the artwork/season/club panel clearly legible?
- Are concepts genuinely different in visual structure, and are the styles appropriate to age group and category?
- Is there no unexplained large whitespace, clipping or logo/product overlap at US Letter?
- Is each number, promise, contact and logo version approved and faithfully represented?
- Does the saved draft reopen with precisely the same approved brand identity and selected assets?
