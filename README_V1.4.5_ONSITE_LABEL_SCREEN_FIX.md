# v1.4.5 On-site Label Screen/Print Fix

Fixes an On-site Sales regression where the production/test label was created in React state but the entire `.onsite-label` element was hidden on screen by `display:none`. Because the Print label button is inside that element, no print action was available.

Changes:
- `src/OnsiteSales.css`: label preview is visible on screen; print media still isolates only the label.
- `scripts/tests/onsite-sales-and-reconciliation.test.mjs`: regression assertions require a visible screen label and the `window.print()` action.

No SQL changes. No inventory logic changes. Test Mode remains non-mutating.
