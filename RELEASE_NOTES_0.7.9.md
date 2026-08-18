# Mockup Studio 0.7.9

## Bulk blank and artwork uploads

- Blank Photos accepts up to 50 PNG, JPEG, or WebP files in one selection.
- Every queued blank has its own editable display name, color, product type, and view.
- Default blank type, color, and view can be applied across the entire queue.
- Artwork accepts up to 50 PNG, JPEG, WebP, SVG, or PDF files in one selection.
- Every queued logo or graphic has its own editable artwork name.
- Accuracy locking and white-ink protection apply to the artwork batch.
- Uploads run with a concurrency limit of three to avoid overwhelming the browser or Supabase storage.
- Live messages report how many files have completed.
- Successful files remain saved if another file fails. Only failed files stay in the queue for correction and retry.
- Each batch can be cleared, and individual queued files can be removed before upload.
- Selecting a catalog blank or artwork-vault record switches cleanly back to the existing single-record workflow.

No SQL migration or environment-variable change is required.

