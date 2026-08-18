# Release Notes — 0.6.24

## Pull-sheet growth containment

Opening a pull sheet is now strictly read-only.

The previous screen performed several operations during load:

- Updated out-of-stock bin assignments.
- Called multiple pull-sheet RPCs.
- Merged rows returned by different sources.
- Automatically saved some source-bin changes.

Those operations made a simple page view capable of exposing a database
function or trigger that inserted duplicate lines.

Version 0.6.24:

- Reads the pull sheet directly from `jobs` and `job_items`.
- Does not call pairing/catalog RPCs during page load.
- Does not update Pending Stock assignments during page load.
- Does not automatically persist source-bin changes during page load.
- Continues to save a source bin when the employee actively changes it.
- Does not delete existing duplicate job-item rows.

Use the separate read-only diagnostic for pull sheet 170 before cleaning up
existing duplicates.
