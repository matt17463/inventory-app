# UV Studio — magnets, coasters and hard-goods printing

UV Studio now supports ordinary full-color UV printing in addition to dimensional embroidery-style patches. The common artwork engine is used across product templates, printable materials and export workflows.

## Choose your product
Go to **UV Studio → Faux embroidery & UV texture editor**. In **Product & material**, select **What are you making?**:
- Apparel / hat patches (existing behavior)
- Printed magnets: acrylic or ceramic, round and rectangular presets
- Coasters: round and square ceramic/stone
- Keychains / bag tags: acrylic
- Signs / plaques: acrylic or wood
- Nameplates / badges: metal
- Ornaments: acrylic
- Challenge coins / medallions: metal
- Decorative tiles: ceramic
- Other flat UV blanks: custom

The **Quick product template** sets approximate face dimensions, shape, material, finish and cutline policy. These values are examples only: **measure your purchased blank before production.** Adjust the width/height and **Artwork width / position** as needed.

## Preview while editing
The right-hand proof stays visible in a compact mode while you scroll to layout and export tools. Use **Enlarge proof** for close inspection or **Pop out preview** to move a read-only live proof to another display. Restore compact mode to reach lower controls on small desktop screens.

## Choose the appearance
- **Flat full-color artwork** preserves the source artwork colors and alpha. UV Studio outputs a flat color PNG and visual white/varnish guidance; the height map is neutral, and no buildup threshold masks are created.
- **Surface texture** creates a tonal surface-pattern reference; xTool Studio must determine real texture settings.
- **Raised relief** generates relative grayscale relief guidance rather than physical printer layer commands.
- **Embroidery simulation** retains the earlier stitched appearance and Merrow-style/satin edges for patches or novelty products.

These are *prepress concepts*, not validated print recipes, ICC color conversions, RIP data or commands for UV white/varnish channel passes.

## Cutting a blank
Most finished magnets, ceramic coasters, metal blanks and purchased acrylic pieces should use **Finished blank — no cutting required**. The production ZIP includes a **NO-CUT-REQUIRED** notice instead of a cutter SVG. The printer does not automatically cut.

If you are printing onto a larger sheet to cut later, choose **Geometric outline reference** or **Artwork silhouette reference**. The SVG provides a registration *reference* only. Set up the actual cutter, registration, tool compensation and test scrap manually. Always keep required safe margins for odd or circular shapes.

The older patch mode continues to follow the existing geometric Merrow/satin versus artwork-silhouette logic, and keeps its legacy individual-patch-outline SVG filename. If a browser blocks a stand-alone SVG download, use **Cutline SVG ZIP (reliable alternative)**, extract the SVG from the archive, and open the extracted file in your cutter software.

## Example: a 2.5-inch acrylic fridge magnet
1. Choose **Printed magnet**, then **Round printed magnet**.
2. Confirm the actual blank size and print face; 2.5 inches is a starting example.
3. Select acrylic type and follow its cleaning/primer instructions.
4. Keep **Flat full-color artwork** and **Finished blank — no cutting required**.
5. Import artwork; adjust its width and X/Y position to fit inside the circular edge.
6. Inspect color artwork, white underbase reference and Cutline proof (the blue guide is not a printer registration command). Use a small test print for accuracy.
7. Export the ZIP and inspect the operator's xTool Studio guide. Set the **Flat** mode, prepare the blank/adhesive and primer as supported, use the software's native white/varnish controls, inspect the alignment and perform an adhesion test.
8. Record the physical test, material batch, settings, orientation and result before processing a customer order.

## Example: raised ceramic magnet or metal coin
Choose the product, change appearance to **Raised relief**, adjust relative grayscale/depth intent, and inspect the height map. Follow xTool's *native* Relief workflow and measure actual output; no grayscale amount guarantees any physical height.

## Material restrictions
- Clear acrylic, metal, smooth plastic and glass often need matched primers. Verify orientation and white underbase for transparent items.
- Rough/porous wood may need sealing. Ceramic/glazed surfaces can require cleaning and glass/ceramic primer.
- UV-printed food-contact surfaces, drinking rims and children's toys are excluded from these recipes.
- Confirm actual printer edition, material compatibility, blank thickness, fixture clearance, UV curing and required accessories in the current xTool Studio build.
- Product preview mockups are illustrative; they are not photographs, calibrated color proofs, or dimensional measurements.

## Engineering / compatibility
The existing React parent embeds the local-first UV editor at `public/uv-studio/index.html`. Product type, preset, surface profile, finish mode and cutline policy are stored in the editable JSON and production manifest. The common R2 bridge and cloud-hand-off continue using the existing project data, with no new tables or RLS policies.

Legacy projects lacking product-type fields default to the existing patch/embroidery/cutline behavior. Do not substitute a new blank as an approved material profile without a physical first-article test.

## Manufacturer references
- https://support.xtool.com/article/3666
- https://support.xtool.com/article/3739
- https://support.xtool.com/article/3738
- https://support.xtool.com/article/3704

Documentation is design-stage guidance, not authorization to run unattended production or to skip material qualification.
