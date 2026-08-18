# Release Notes — 0.6.25

## Pull sheet 170 confirmed duplicate repair

Diagnostics confirmed that manual order 14 contains 53 legitimate source
lines, while pull sheet 170 contains 265 saved rows: five batches of 53.

The current source mappings reference job-item IDs 570–622. IDs 358–569 are
212 orphaned historical copies.

Version 0.6.25:

- Keeps pull-sheet loading read-only.
- Hides cancelled, voided, and deleted historical lines.
- Includes a guarded, non-destructive repair for pull sheet 170.
- Backs up orphaned job items and reservations.
- Releases orphaned reservations.
- Cancels rather than deletes duplicate rows.
- Adds a partial unique index preventing multiple active job items for the
  same manual-order source line.

The repair aborts without committing when the database no longer matches the
confirmed diagnostic counts or when an orphaned row appears processed.
