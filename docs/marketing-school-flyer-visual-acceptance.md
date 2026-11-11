# School Flyer Visual Acceptance — Original Designs

## Release gate
Do not merge PR #233 solely because unit tests and SVG fixtures pass. The current generated fixture is a geometric approximation and **does not match the three original, user-approved designs**. Require side-by-side visual approval using the actual original PDFs, not synthetic initials badges or flat garment illustrations.

## Source of truth
The original full-page flyers supplied by the owner on November 11, 2026:
- Greywolf Elementary: deep blue, white, gold; wolf head mascot; blue mountain/pine scenery; blue hoodie, gray tee, blue tee, knit cap and water bottle; brushstroke headings.
- Helen Haller Elementary: forest green and gold; cougar mascot; green forest scenery; green hoodie, white tee, charcoal hoodie, cap and bottle; brushstroke headings.
- Sequim High School: purple and gold; wolf head mascot; mountain/pine scenery; purple tee, gray hoodie, black quarter-zip, cap and bottle; brushstroke headings.

## Layout and illustration acceptance
1. The hero occupies the upper third of the page and combines **actual mascot artwork**, prominent custom athletic school lettering, layered illustrated landscape, bold contrasting brushstroke tagline, and school-specific branding. Synthetic initials badges are not an acceptable substitute.
2. The garment showcase must use **photorealistic, school-branded product mockups** with overlapping placement and depth, not the fixture's flat SVG tee shapes. The editor must reject or clearly flag missing approved mockups.
3. Below the hero: three dark-color benefit columns with bright pictograms, a two-column How It Works / Fundraising Example panel with a legible profit highlight, artwork-modernization before/after imagery, and a dark-color call-to-action footer.
4. All school colors, school names, mascots, product mockups, prices, fundraising counts, and contact fields must derive from client-approved inputs. No fabricated contact information or financial guarantees.
5. Check all three schools at print resolution (minimum 300 dpi for raster images used in print) and at a normal on-screen preview size. No overlapping text, clipped headings, tiny copy, blurry images, or unsafe margins.
6. Compare a generated output against the original side by side at equal dimensions. The criterion is **recognizably the same illustrated marketing style**, not simply identical section order.
7. Preserve one guided workflow, editable saved drafts, private artwork storage, and the exact preview/download output.

## Known blockers in current branch
- Fixture samples use initials circles labeled TEST ART rather than school mascots.
- Fixture apparel is synthetic flat illustration rather than the reference's realistic branded merchandise.
- Landscape and brushstroke treatments are geometric and lack the original's texture, depth and lighting.
- Typeface hierarchy is generic Arial rather than athletic/display lettering.
- Current 216 dpi cover rasterization falls below the requested 300 dpi print target.
- Existing regression checks verify content/structure, not visual fidelity. A green check is **not** visual acceptance.

## Required next implementation
Create a reusable, layered graphic template with high-quality school-specific artwork assets and image compositing. Load approved school mascot and product images from private client storage. Use the three original designs as fixed visual acceptance references, and review actual outputs before merging.
