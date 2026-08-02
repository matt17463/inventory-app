# Skilled Crafting Inventory App v0.6.29

This release corrects the remaining pull-sheet and bin dialogs that v0.6.28 left at the bottom of long pages.

- Non-inventory settings are row-local.
- Blank-pairing override is row-local.
- Bin receiving history is row-local.
- All v0.6.23–v0.6.28 safety, search, and usability improvements remain included.
- No Supabase SQL migration is required.

Validate with:

```bash
npm ci
npm run check
```

Expected final result:

```text
PASS: Required production bundle features are present.
```

