# Release Notes — v0.6.29

## Pull-sheet row-dialog placement correction

Version 0.6.29 corrects the workflows that were missed in v0.6.28.

### Corrected

- **Edit Non-Inventory Settings** now opens inside the selected pull-sheet line card.
- **Mark Non-Inventory** opens the same row-local settings panel.
- **Override Blank Pairing** now opens its search and results directly beneath the selected pull-sheet line.
- Opening either pull-sheet editor closes the other editor so the active context stays unambiguous.
- Bin receiving history now opens directly beneath the selected bin item instead of after the entire bin page.
- Save and cancel actions remain visible within the relevant editor panel.
- The selected line or row is visibly associated with its editor.

### Modal boundary

The source was scanned for remaining page-level dialogs. The only remaining true modal is the Sample Inventory image preview. It is intentionally retained as an overlay because it displays an image and does not edit a record.

### Database

No Supabase SQL migration is required.

