# Client Graphics — generic production recipe compatibility decision

**Release blocker — production unchanged.** Work's read-only live audit found that all three approved production recipe versions have valid generic placement instructions but no linked artwork asset IDs:
- `4145a078-6c78-48a3-a4e7-d8de7874c162` — two placements
- `8e8682f1-2046-4fa6-a6a1-e76fdafca002` — three placements
- `7266f928-290b-4da4-8884-0df2e48eee46` — three placements

Migrations 003 and 005 plus the current preflight endpoint would reject all three; **do not deploy as-is**.

## Correct compatibility contract

1. Approved recipes with no embedded artwork are **reusable templates**. They specify process, physical locations and placement parameters, not customer design identity. Preserve the approved revisions.
2. Before creating a traveler, require an explicitly approved, unambiguous job-line artwork assignment for every decoration placement actually required by that line. Source may be a verified Woo managed choice, a reviewed QuickBooks/manual assignment, or a separately approved legacy artwork binding. Never guess from text, product name or unrelated project; never auto-migrate historical mappings.
3. Resolve the effective art per line **and exact placement**. A full-front file cannot satisfy a back or left-chest position merely because the file exists on the job or recipe. Unassigned, conflicting or partially assigned decoration locations block the traveler and produce an actionable UI message.
4. The server-only preflight endpoint verifies actual storage object presence, nonzero size and approved artwork status for **every effective file** before issuing short-lived, employee-, job-, recipe- and line-scoped receipts. Receipts must cover all effective file IDs, placement associations and storage references; SQL must independently reproduce the same fingerprint from trusted records so a caller cannot omit an unverified placement.
5. SQL `sc_create_grouped_traveler` and its line triggers must enforce that the full expected placement/artwork set is resolved, approved, available and receipt-verified. Missing or stale receipts and partial multi-line jobs roll back atomically.
6. Explicitly approved fixed-art recipes keep their current inherited-artwork behavior. Do not weaken legacy, approval, revision immutability, RLS or managed Woo selection guarantees.
7. Snapshot the resolved job-line artwork, placement, dimensions and recipe revision in the traveler. Changing the source assignment afterward must not silently change already approved output.

## Required new release regressions

- Exercise the **three actual production-approved recipe shapes** in disposable PostgreSQL (same placement counts and null artwork references; no customer content).
- Generic recipe + no job artwork: reject with clear incomplete-job-artwork error.
- Generic recipe + approved, storage-present, exact per-placement job assignments: allow traveler and retain snapshots.
- Generic recipe with two/three placements where any one file is absent, unapproved, wrong placement, zero-byte or missing receipt: reject and roll back all lines.
- Managed Woo first-write outage, failed capture and wrong-order assignment remain blocked.
- QuickBooks/manual assignment must be bound to exact job line and invoice before being used.
- Existing recipe-level inherited artwork and approved sample workflows still pass.
- Changes to storage key/asset approval/assignment invalidate previous receipts; requests cannot reuse someone else's receipt.
- No direct RPC or alternative single-line traveler path may bypass the checks.

## Rollout

Keep the current production app untouched until these tests pass on a single SHA. Existing generic recipes must remain available to staff with a visible, approved per-job artwork assignment workflow **before** migrations 001–005 are applied. Freeze traveler writes during coordinated DB migration plus matching Netlify functions/UI deploy; resume only after an authenticated fictional sample validates both fixed and generic recipes. Storefront customer selection stays disabled.

**No automatic data fixes.** The three approved recipe IDs are evidence of reusable templates, not authorization to attach arbitrary artwork. The user's backup waiver remains in effect.
