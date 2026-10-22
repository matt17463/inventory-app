# Guided Work Hub Phase 2 — production evidence and family training

## Implemented
- The official QC Checklist now accepts `/qc-checklist?job={jobId}` and selects the relevant existing QC queue item or explains that the job is not currently eligible.
- The Production Photo Proof page accepts `/production-photo-proof?job={jobId}`, pre-fills the production job and filters displayed evidence to that job, using private R2 display URLs from the existing storage helper.
- Job Work Hub now shows photo counts, links directly to that job's proof page, and offers a linked-artwork review workflow.
- `sc_job_artwork_links` adds audited job-to-existing-artwork-handoff references without modifying approval status or creating new artwork copies. Database insert checks a nonblank production file and rejects handoffs assigned to another job.
- `sc_job_fulfillment_checks` records private, append-only packing/ready/pickup/shipped/exception evidence. DB guard requires latest QC pass before marking pickup or shipment and refuses production deliveries on cancelled jobs.
- A six-step family training drill is embedded in the job workspace, entirely browser-state only: choose order channel, check artwork, inventory, QR recipe, QC/packing, customer handoff. It performs no database write or order mutation.
- Testing Mode's simulated-write flag explicitly prevents real artwork linking and packing events from these new screens.

## Important distinctions
- Merely linking an artwork file is not proof of customer approval. Confirm source approval and print-ready file revision separately.
- A passing QC record is not shipment evidence; a packing event is not a customer receipt.
- Logging pickup/shipping is not a WooCommerce shipping request, label purchase, QBO transaction, or official Production Board completion.
- Earlier production photo and artwork source tables have legacy broad access policies; the new link and fulfillment tables are restricted, but legacy source-table RLS should be reviewed in a separate security hardening change before adding additional customer-private material.

## End-to-end checks
- From a production job select the guided Work Hub, open exact job QC and production photo views, and return without re-searching.
- Link a valid approved artwork file; verify different-job handoffs are rejected, no manual approval is generated, and production status remains unchanged.
- Enter a packing check; ensure this does not close the job. Confirm latest failed or absent QC blocks pickup/shipping at both UI and DB layers.
- Record actual handoff after passed QC; verify notes have actor/time and report `delivery: verified` only after pickup or shipping evidence.
- Run family training exercise and verify no R2 upload, job, WooCommerce, invoice, inventory, or QC mutation.
- Run CI and Supabase migration prior to production merge; no Netlify preview deployments.

## Remaining follow-up
- Real source approval workflow linkage, including approved-by/customer timestamp and immutable asset revision; current approval source itself uses a legacy status model.
- Rich packaging checklists with quantities per line and pickup signature/label integration, when real shop use validates the first phase.
- Dedicated sandbox training data for safe interactive practice across screens (current drill is read-only and does not simulate writes across the whole app).
