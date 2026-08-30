# v1.2.0 Asset Storage Health build hotfix

The v1.2.0 incremental package included an `App.jsx` route for Asset Storage Health but omitted the page and its complete Netlify function dependency chain. Netlify therefore stopped during Vite import resolution.

This hotfix adds:

- `src/AssetStorageHealth.jsx`
- `netlify/functions/asset-storage-health.js`
- `netlify/functions/_shared/operationalStorage.js`

No SQL or environment-variable changes are required. Apply this hotfix to the existing `feature/product-blank-mapping-lifecycle-v1.2.0` branch, run `npm run check`, commit, and push. The existing pull request will update automatically.
