# Operations Integrity User Guide

Open **Tools & Admin → Operations Integrity**.

## Product Identity

Use this before creating a blank when a supplier SKU, barcode, product SKU, color, or size is uncertain.

1. Enter as many known fields as possible.
2. Click **Resolve Existing Product**.
3. Review confidence and match method.
4. If the correct existing product is shown, select it.
5. For a supplier item, enter Source System and Supplier SKU, then click **Remember Selected Match**.
6. If no record appears, click **Preview Product Creation**.

Only deterministic matches are automatic. A partial match is evidence for a person to review, not permission to reuse or create a record.

## Product Creation Preview

- **Use existing** — one deterministic record already matches. Use that product.
- **Ambiguous** — multiple deterministic records conflict. Open Duplicate Workbench.
- **Create allowed** — no deterministic existing record was found. Product creation may proceed.

The Scan Inventory create form runs this preview automatically.

## Duplicate Workbench

1. Select at least two records that appear to represent the same physical blank.
2. Choose the proposed survivor with the radio button.
3. Enter why they appear to be duplicates.
4. Click **Create Review Case**.

The case records product snapshots and counts references such as inventory movements, pull-sheet lines, reservations, WooCommerce records, and supplier mappings. It does not change either product.

Do not choose a survivor only because its name looks cleaner. Prefer the record that carries the correct SKU/barcode and the most valid operational references.

## Receiving Inbox

After an S&S Activewear or Momentec PDF parses, the order is saved as a review draft. Use the inbox to see ordered, received, and remaining units.

Click **Open Receiving** to finish the work. On the receiving screen:

1. Search within the parsed lines when the order is large.
2. Turn on **Show review rows only** to focus on incomplete mappings.
3. Select the rows you want to change.
4. Choose a bulk bin, color, or size.
5. Click **Apply to Selected**.
6. Confirm every selected row has a bin, brand, style, canonical color, and size.
7. Receive only the physical quantity actually delivered.

Remembered supplier SKU and color mappings are reused on future confirmations.

## Reconciliation

Run reconciliation after a large import, receiving session, mapping repair, or suspected data conflict.

- **Product integrity** identifies duplicate or incomplete product records.
- **Unlocated movement** means an inventory movement is missing its product or bin reference and needs investigation.
- **Purchasing demand** means on-hand is negative. This is not a request to edit the quantity; it represents stock that must be purchased or otherwise fulfilled.

Use the existing inventory, purchasing, pull-sheet, and audit tools to resolve the cause. Never update an inventory quantity directly in Supabase.

## Integration Jobs

Use this tab when AI mockups, WooCommerce exports, color cleanup, or supplier synchronization appears stuck.

- Application-owned queued/failed jobs may be retried.
- Application-owned active jobs may be cancelled.
- Jobs owned by an existing source workflow show “Managed by source workflow”; use that workflow’s controls.
- Read the exact error before retrying. Fix configuration, credentials, attributes, or network access first.

## Team Stores

Create one workflow per customer store or campaign. Move it through:

1. Request
2. Artwork
3. Mockups
4. Approval
5. WooCommerce Draft
6. Ready to Publish
7. Live
8. Complete

Use the Artwork Requests, Mockup Studio, and Woo Sync links for the actual work. The workflow is the coordination record and makes the current stage visible.

WooCommerce should remain a draft until products, prices, categories, brand/style, shipping, images, and valid variations have been reviewed.

## Role and audit behavior

- Operators may view operational integrity information and perform ordinary receiving work.
- Managers and admins may create identity mappings, duplicate cases, product changes, pull-sheet changes, workflow changes, and job retry/cancel requests.
- Core mutations record actor, before/after evidence, reason, and timestamp in `sc_core_mutation_audit`.
- A signed-in account without an active application role cannot open employee pages.
