# Validation Results — 0.6.21

## Passed checks

- 11 static application contract tests passed.
- 3 security-helper tests passed.
- 12 Netlify JavaScript functions passed ESM validation.
- 114 JavaScript and JSX source files passed TypeScript syntax parsing.
- All relative JavaScript/JSX imports resolve to existing source files.
- `src/themes.css` passed structural validation and includes all six presets.
- Protected operational files were byte-for-byte unchanged:
  - `src/lib/inventoryApi.js`
  - `src/PullSheetView.jsx`
  - `src/Purchasing.jsx`
  - `src/PurchaseOrderGenerator.jsx`
  - `src/ReceivePurchaseOrder.jsx`
  - `src/WaitingOn.jsx`
  - `src/supabaseClient.js`
- All 12 Netlify function files were unchanged.
- All 9 deployment SQL files were unchanged.

## Full dependency build

The workspace npm registry returned repeated HTTP 503 errors while downloading
dependencies, so `npm ci` and the Vite production build could not be completed
inside this environment.

Before deployment, run on the deployment Mac:

```bash
npm ci
npm run check
```

Do not deploy unless the final output includes:

```text
PASS: Required production bundle features are present.
```
