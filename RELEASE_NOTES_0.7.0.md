# Release Notes — v0.7.0

## Added

- Full Mockup Studio workspace for blank products, artwork, placement, output selection, captions, review, price, WooCommerce, and production handoff.
- Exact browser compositor and OpenAI-powered high-fidelity background generation.
- Private Supabase source, output, and production storage.
- Expiring, hashed customer approval links.
- Caption font, size, text color, background, alignment, and padding controls.
- Draft/publish WooCommerce export with images, captions, categories, tags, colors, sizes, and optional variations.
- Printable production packets and placement CSV/JSON downloads.
- Deployment Health checks and a dedicated Mockup Studio validation suite.

## Compatibility

- Built on Skilled Crafting v0.6.30.
- Existing inventory, reservation, pull-sheet, production, customer portal, and Google Calendar features remain in place.
- The new database migration is additive and isolated under `mockup_*` and `sc_mockup_*` names.

## Operational note

AI images can vary and can imperfectly reproduce artwork. Use the exact compositor for critical lettering and obtain approval before publication or production.

