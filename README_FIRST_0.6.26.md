# Skilled Crafting Inventory App 0.6.26 Deployment

## Step 1 — Repair the database and install safe completion

Run this file in a new Supabase SQL Editor query:

```text
16_PULL_SHEET_COMPLETION_IDEMPOTENCY_AND_165_REPAIR.sql
```

The migration is guarded and will stop without committing if movement 960,
job item 215, its released reservation, or the current backpack quantity no
longer match the supplied diagnostics.

Expected verification:

```text
job_item_215_status = completed
movement_960_job_item_id = 215
backpack_on_hand = 1
linked_completion_movements = 3
active_reservations_for_215 = 0
safe_function_installed = true
```

## Step 2 — Build

```bash
cd ~/Downloads/inventory-app-main-complete-corrected-v0.6.26
npm ci
npm run check
```

The build verifier must pass.

## Step 3 — Preview deploy

```bash
rm -rf dist
npx netlify build --context production
npx netlify deploy --dir=dist --functions=netlify/functions
```

Verify:

1. Pull sheet 165 shows the backpack line completed.
2. Backpack quantity remains 1.
3. Retrying a completed line reports that completion is already recorded.
4. Retrying does not create another inventory movement.

## Step 4 — Production deploy

```bash
npx netlify deploy --dir=dist --functions=netlify/functions --prod
```
