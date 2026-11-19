# UV Studio — smooth vector cutlines and exact proof

## Why the jagged cutline happened

The supplied production sample `individual-patch-outline.svg` (19 November 2026) has `<title>Artwork silhouette with user offset</title>`, not a geometric rounded rectangle. Its path contains **195 L segments and 196 Q segments** over a 79.250 × 53.750 mm SVG viewBox. Those tiny curves follow the pixel edges of the artwork and leave jagged horizontal edges and stepped corners. The earlier "Smooth raster cut corners" switch rounded individual steps without removing their underlying stair-step detail.

A geometric patch shape and an artwork-following contour are different operations. Do not use the latter when the desired cut is a clean rounded rectangle.

## For a smooth rounded rectangle

1. Open **UV Studio → UV Product Designer** and choose your product preset.
2. Under **Cutline handling**, choose **Geometric outline reference**, not **Artwork silhouette reference**.
3. Under **Blank / reference outline shape**, select **Rounded rectangle**.
4. Set **Rounded rectangle corner radius (mm)**. `0` retains the automatic radius; e.g. `5.5` requests 5.5 mm radius at each corner. The radius is limited to half the shortest dimension internally.
5. Set the blank's width/height independently from the logo's artwork size and location.
6. Open the **Cutline proof** tab. The **red line is drawn from the exact same SVG vector path used in downloads**. The dashed **blue line is the actual physical blank boundary** for registration comparison, *not* another cutter command.
7. Use **2×/4× zoom** and the horizontal/vertical focus controls to inspect straight sections and corners. Toggle artwork and the blue reference guide separately; visual zoom does not change exported dimensions.
8. Export **Cutline SVG ZIP** if the browser refuses a direct SVG download. Extract the SVG before importing into cutter software. The operator must verify cutter alignment and material margins on a test piece.

## For true artwork-following cut paths

Choose **Artwork silhouette reference**. The cutline follows the alpha edges of the image, including loops, holes and disconnected objects, instead of a chosen rectangle.

- **Cut offset (mm)**: how far to move the path outside the artwork
- **Opacity threshold / suppress islands / fill holes / minimum bridge width**: cleanup and safety controls for small details
- **Smooth artwork-following cutline**: enables the smoothing controls
- **Remove fine edge bumps (mm)**: simplifies tiny raster stair-steps without automatically switching to a rectangle
- **Round silhouette corners (mm)**: rounds remaining path corners
- **Cutline proof**: reports cutter mode, number of closed loops, how many corners were retained after smoothing, and warnings when multiple loops or thin bridges need physical checking

Start with moderate smoothing (0.30 mm simplification and 0.35 mm rounding). Increase gradually while monitoring individual letters, narrow bridges, small holes and detached art. Strong simplification may remove or distort fine features. For regular patch outlines always prefer the exact geometric mode.

## Notes

The export SVG and the preview both use `scCutPath`. The proof includes the extra physical offset area for silhouette cuts so it does not silently crop the outer cut path. Smoothing and corner radius are stored in editable project JSON and export manifest; saved legacy projects retain their pre-existing cut mode unless the user changes it.

This is a **reference cutter path**. It does not run the xTool Omni cutting process or replace registration calibration, cutter compensation, approved materials or first-article quality inspection. Do not cut customer stock without testing on scrap first.

## Engineering regression checks

- Geometric rounded rectangles export genuine circular arcs, with no artwork-pixel jagged path
- Rounded corner radius is reflected in downloaded vector, saved JSON, and live proof
- Artwork silhouette simplification reduces unneeded points, preserves loop count and flags risk
- Zoom, guide toggles, cloud export, standalone SVG ZIP, batch positioning and older patch variants continue functioning
- Different output shapes (circle, oval, octagon, rectangle, patch and finished blank no-cut) remain unaffected
- 300 DPI color/white/height/varnish reference exports and product presets remain unchanged
