# Mockup Studio 0.7.8

## Opaque white-ink protection

This update prevents visible white artwork—such as white lettering—from being treated as transparent in DTF and other opaque-print mockups.

- New artwork defaults to **Protect visible white as opaque printed ink**.
- New DTF placements default to **Normal — opaque print** instead of Multiply.
- White-ink protection overrides destructive blend modes in Exact Composite.
- AI Assist now receives an explicit white-ink rule: visible white and near-white letters, outlines, and artwork elements must remain solid; only pixels actually marked transparent in the source alpha channel may reveal the garment.
- Placement previews show the same opaque treatment used by generated Exact Composite outputs.
- Uploaded raster artwork is inspected for actual transparency and detectable opaque white pixels.
- A preflight warning appears when a transparent source file contains no detectable opaque white pixels, allowing the user to catch a file in which white artwork was already erased.
- Existing placements default to white-ink protection even if they were created before this setting existed.

Already-generated images do not change automatically. Delete or deselect affected outputs and regenerate them after deployment.

No SQL migration or environment-variable change is required.

