# Release notes — v0.7.4

## Generated mockup deletion

- Adds **Delete Mockup** to every card in Phase 5, Generate.
- Requires confirmation before deletion.
- Removes the generated output from captions, approvals, customer review, product gallery selection, and WooCommerce variation-image choices.
- Adds an **Include in product** checkbox for every Color + Logo combination in the WooCommerce phase.
- Completely omits excluded Color + Logo combinations across every size when creating a product.
- Deactivates previously app-created variations when their Color + Logo combination is later excluded during an update.
- Removes the private generated image from Supabase Storage through an authenticated server function.
- Allows admin, manager, and operator employee roles to delete generated mockups.
- Does not remove a product or media file that was already published to WooCommerce.
- Includes the v0.7.3 verified **Copy to all** repair.
- Requires no Supabase SQL migration or new environment variables.
