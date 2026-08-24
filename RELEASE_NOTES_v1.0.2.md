# Skilled Crafting Inventory v1.0.2

## UUID Resolve Case correction

- Corrects `sc_canonical_blank_product_id` from bigint to UUID.
- Converts only an empty wrong-type column from a partial attempt; populated incompatible data causes a safe stop.
- Uses UUID arrays and UUID casts throughout preview and atomic resolution functions.
- Replaces the unusable bigint guarded-product-update overload with a UUID function.
- Sends product IDs from Netlify as UUID strings instead of converting them to JavaScript numbers.
- Adds verification for the UUID column, UUID RPC signature, and removal of the legacy bigint overload.
- Adds regression tests that reject bigint blank-product identifiers in this workflow.
- Retains all v1.0.1 safety controls: expiring preview, exact phrase, transaction rollback, reference repointing, archival, aliases, and audit history.
- Never changes inventory movement quantity values and never deletes blank-product rows.

This package supersedes v1.0.1. No new Netlify environment variables are required.
