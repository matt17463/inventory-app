# Guided Job Workspace — owner-first integration (October 22, 2026)

## Scope delivered in this increment
Enhanced `/work-hub` is a per-job guided workspace, not a second job board or status authority. A new `Guided Job Workspace` link on each Production Board job card opens `/work-hub?job={jobId}`.
The job queue supports searching, stage and attention filters, and urgency sorting from source due dates and existing Production Board blockers. A selected job reads only its linked records:
- Authoritative `jobs`/`job_items` and `inventory_reservations`.
- Immutable `sc_job_travelers` linked to approved manufacturing recipes.
- Existing `sc_approval_production_handoffs` approved-file reference (presence requires human validation; never treated as customer approval).
- `phase5_qc_checklists` most recent passing/failing QC records.
- New append-only `sc_job_work_handoffs` for small actionable owner/family notes; notes do not change official job status or inventory.

Seven evidence cards: source order and payment, approved artwork, blanks/reservations, QR recipe, production, QC, and packaging/delivery. Each shows a conservative evidence label, reason and linked authoritative tool. If a linked DB table is unavailable or not readable, the card shows unknown rather than implying completion.

Next-action priority:
1. Completed / cancelled jobs → closeout or stop.
2. Unpaid manual invoice → existing Client Orders/QuickBooks, never WooCommerce.
3. Authoritative Production Board blockers and missing blank pairing → Exception Center/pull sheet.
4. QC stage without last passing record → QC Checklist.
5. Ready-to-ship → packing and fulfillment review.
6. Missing linked artwork / QR traveler → approval automation / production traveler.
7. Ready-to-produce / in-production → source production workflow.

## Security and integrity
`202610220006_guided_work_handoffs.sql` adds only `sc_job_work_handoffs`. RLS restricts reading to active internal staff and insert to admin/manager/operator, tied to `auth.uid()`. No update/delete grant. No client-facing access. The app never calls order status, inventory movement, WooCommerce or QuickBooks write actions through the Work Hub.
Existing specialist screens remain responsible for status approval, QC completion, stock deduction, supplier ordering, invoicing and delivery confirmation. The Work Hub is an evidence-backed guide to those workflows.

## Follow-on work
Connect explicit customer artwork approval IDs and durable packing/shipping handoff records to every job; current legacy projects may lack linked evidence. Link a single job-specific QC screen via a supported URL route to eliminate a second selection step. Add dynamic per-step guided training for new family operators, plus safe rehearsal mode (without writes). Add better non-inventory/service job rules and pagination for large shops. Track workflow cycle time and repeated blockers, with the owner as default assignee.

## Rollout
Run npm test/lint/build and GitHub Actions on the exact branch head. Apply the additive migration to the connected Supabase project, verify grants/RLS, and merge only when green; no Netlify previews.
Real-world smoke: select paid Woo job, unpaid manual invoice job, unpaired blank, job with/without travelers, completed/cancelled job; verify correct priority, missing-data warnings, write-safe notes, and back-links. Always verify that changing a note never updates source status, inventory or billing.