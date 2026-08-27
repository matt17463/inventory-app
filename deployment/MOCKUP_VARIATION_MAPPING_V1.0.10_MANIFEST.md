# Mockup Variation Mapping Hotfix v1.0.10

## Corrected behavior

- Existing variation-image mappings are canonicalized on both the browser and server.
- `&` and `and`, punctuation, parentheses, apostrophes, accents, whitespace, and letter case resolve to the same Color/Logo pair.
- Existing exclusions use the same canonical keys as variation mappings.
- Canonical keys take precedence if an old and a new key both point to the same combination.
- Existing saved projects are repaired in memory without a data migration or manual re-pairing.

## Files included

- `src/MockupStudio.jsx`
- `netlify/functions/mockup-publish-woocommerce.js`
- `scripts/tests/mockup-studio.test.mjs`
- `package.json`
- `package-lock.json`
- `deployment/MOCKUP_VARIATION_MAPPING_V1.0.10_DEPLOYMENT_GUIDE.md`
- `deployment/MOCKUP_VARIATION_MAPPING_V1.0.10_MANIFEST.md`

## Database and environment

- SQL migrations: none
- New Netlify environment variables: none
- Required prerequisite: Mockup Studio Reliability v1.0.9 merged into `main`

## Validation

- 22 Mockup Studio tests, including the exact Grey / EPO Orcas Black & White (1) regression
- 84 total automated tests
- Netlify ESM validation
- ESLint
- Vite production build
- Production bundle verification
