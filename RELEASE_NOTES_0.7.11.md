# Mockup Studio 0.7.11

## WooCommerce parent-product timeout fix

- The parent product is created or updated before WooCommerce imports the mockup gallery.
- Mockup images are added in resumable batches of five instead of embedding the entire gallery in the initial `POST products` request.
- Each returned WooCommerce media ID is saved as its image batch completes.
- The finished gallery is placed in the selected Mockup Studio order before variation processing begins.
- WooCommerce write requests can run for up to 180 seconds; read requests retain the 60-second timeout.
- Before creating a new parent, the exporter searches WooCommerce for a product carrying the same `_sc_mockup_project_id` metadata.
- A draft created by a previously timed-out request is recovered and updated instead of intentionally creating a duplicate.
- Export progress now separately reports image-import and variation-processing stages.
- The reliable background export, missing-variations-first behavior, 50-variation batches, and 500-variation safety limit from version 0.7.10 remain in place.

No SQL migration or environment-variable change is required.
