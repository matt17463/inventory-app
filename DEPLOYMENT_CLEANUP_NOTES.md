# Clean deployable project

This project has been stripped to Netlify deploy essentials only:

- `src/`
- `public/`
- `netlify/functions/`
- `package.json`
- `package-lock.json`
- `.npmrc`
- `netlify.toml`
- `vite.config.js`
- `eslint.config.js`
- `index.html`

Removed extraneous root duplicate JSX/JS/CSS files, markdown repair notes, SQL files, PHP plugins, XLSX samples, `.vs`, duplicate `_redirects.js`, and other non-build files.

## Important fix

The previous `package-lock.json` had the `xlsx` package resolved to an internal OpenAI package proxy. This caused Netlify to fail at dependency install with `ETIMEDOUT`.

This clean project fixes that by:

1. Replacing internal package URLs in `package-lock.json` with `https://registry.npmjs.org/`.
2. Adding `.npmrc` to force npm to use the public npm registry with longer retry timeouts.

## Deploy

Push the contents of this folder to GitHub root and redeploy Netlify.
