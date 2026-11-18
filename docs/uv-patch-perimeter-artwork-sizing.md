# UV Studio — Patch perimeter and artwork sizing

## What is new
In UV Studio → Faux embroidery & UV texture editor, use **Patch perimeter style** to choose whether the cut reference is a geometric patch or follows the artwork silhouette.

When Merrow-style rope border or Satin border is selected, **Patch outline shape** offers rounded rectangle, rectangle, oval, circle, capsule/stadium, octagon, hexagon, pentagon, diamond and shield. **No geometric perimeter** continues to follow the artwork contour and uses the separate contour cleanup options.

Patch width and height set the physical print canvas and the cut reference. **Artwork width in inches** controls only the size of the artwork inside that patch. Enter **0** to use the prior automatic fit-to-patch behavior. Enter a specific width to keep the artwork the same physical size while changing the patch dimensions. The original artwork aspect ratio is preserved. The horizontal and vertical positioning controls let you move artwork within the patch without moving the patch itself.

The dimensions line shows the resulting physical artwork size. Orange warnings identify when the artwork extends beyond the rectangular patch bounds. Irregular patches require checking the **Cutline proof** for overlap with angled or curved edges; the editor does not silently crop or auto-approve content.

## Workflow
1. Select the material and import customer-approved artwork.
2. Set patch width and height in the Artwork section.
3. Choose Merrow or Satin (or No geometric perimeter for silhouette cutting).
4. Choose the geometric shape, for example Octagon or Oval.
5. Enter the desired artwork width, and move the artwork if needed. Leave width at 0 to auto-fit.
6. Review Stitch artwork, Height map, White underbase, Highlights and Cutline proof.
7. Save the editable project JSON. The patch geometry, artwork width and offsets remain part of the project.
8. Export the production reference ZIP and cutline SVG; verify alignment, material margins, cutter tool compensation, printer settings and physical registration in xTool Studio before production.

## Compatibility and limitations
- Existing saved projects without an independent artwork width continue to auto-fit as before.
- The selected geometric patch dimensions are unchanged by artwork resizing. The cut SVG keeps the patch's own shape and units in millimeters.
- For circles on a non-square patch canvas, the geometric circle uses the smaller dimension as diameter and remains centered in the canvas.
- Artwork can extend beyond the intended patch shape. Verify all edges visually and do a physical first-article sample; artwork and cutline registration are not automatically certified.
- No database changes are needed. The feature uses existing local editable-project files and export paths.
