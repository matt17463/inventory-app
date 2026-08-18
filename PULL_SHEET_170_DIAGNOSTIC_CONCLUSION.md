# Pull Sheet 170 Diagnostic Conclusion

The before and after diagnostic CSV files are byte-for-byte identical.

Both report:

- 265 saved `job_items` for job 170.
- 53 active manual-order source lines for manual order 14.
- 53 unique current mappings to job-item IDs 570–622.
- 212 rows, IDs 358–569, not referenced by the current manual-order mappings.

The row count did not increase when the pull sheet was opened during the
controlled test.

The 265 rows form exactly five batches of 53, indicating four historical
orphaned copies plus the current mapped batch. The current database triggers
do not insert job items, and the pull-sheet read functions do not insert job
items. The manual-order generation/synchronization functions are the relevant
write paths.

The safe repair preserves all rows for audit, cancels only the 212 orphaned
copies, releases their reservations, and prevents multiple active rows for one
manual source line.
