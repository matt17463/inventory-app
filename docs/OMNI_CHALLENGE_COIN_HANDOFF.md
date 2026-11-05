# Omni Challenge Coin — design-to-Studio handoff

Route: `/laser-relief` → **Omni challenge coin · color and print layer handoff**.

## Operator instructions
1. Select the metal challenge coin template and the **xTool Omni UV** target. Import PNG, JPEG, or WebP artwork. Generate/refine a relative-depth map using existing relief tools.
2. Set the design diameter in millimeters; select the correct metal and approved material recipe. Decide the intended color matches, tolerance, Studio order, and ink/effect for base and detail layers.
3. Click **Export Omni coin design + Studio instructions**. The browser downloads an 8-bit grayscale depth PNG, individually aligned transparent color PNG files, and a JSON manifest. All color images retain the same pixel dimensions as the normalized source. This is a **handoff**, not an xTool .xs project file.
4. In xTool Studio, connect the Omni, choose the appropriate UV flatbed material and configuration, import PNG files, set their sizes to the manifest width and height, and align their centers. Ensure the coin fixture is suitable for the actual blank.
5. Organize the artwork using Layer and Object List. Colors are an organizational aid; **xTool layer colors do not automatically assign print parameters**. Select each object and configure supported mode, physical print order, white, CMYK, varnish, relief/texture and pass counts in Studio.
6. Verify whether the specific Omni firmware/Studio mode supports the imported grayscale image as a relief/texture input. The relative-depth PNG **does not prescribe millimeters of printed height**. If it is not supported as a direct depth source, use Studio's available texture/relief setup and treat the depth PNG as a visual reference.
7. Preview every object, check positioning and any overprint, run a physical metal test coupon, record adhesion, registration and texture, and save the native project in xTool Studio.

## Limitations / safeguards
- The first version includes two editable color match bands; it does not provide a full arbitrary palette editor.
- Color separation assigns the source pixel to the nearest enabled layer **only** when within that layer's RGB tolerance. Pixels outside tolerance are omitted and counted. Avoid exporting before checking unmatched pixel count.
- Source art is normalized to at most 512px by the existing relief editor, so these exports are for initial prototyping, not an independently verified high-resolution production raster. Recheck effective print resolution in xTool Studio.
- Original project asset permissions and physical-test/manager-approval safeguards remain unchanged. Saving the relief project persists color layer choices in existing project settings; no new database table or migration.
- Exports run in the operator's browser. No print commands, ink-channel APIs or machine controls are sent.
- Existing UV Studio production ZIP handling is not changed.

## References
- https://support.xtool.com/article/2532 — layers group objects; parameters still require selection/configuration.
- https://support.xtool.com/article/3701 — white and varnish for Omni.
- https://support.xtool.com/article/3704 — metal adhesion and primer checks.
- https://support.xtool.com/article/2805 — supported Studio import formats.

## Validation
Run `node --test scripts/tests/omni-coin-layers.test.mjs`, `node --test scripts/tests/laser-relief-studio.test.mjs`, `npm run lint`, `npm run build`. Confirm xTool Studio import, mode compatibility and physical printer output manually before deploying or approving production.
