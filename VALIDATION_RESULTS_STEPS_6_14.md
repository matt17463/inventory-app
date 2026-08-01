# Steps 6–14 Validation Results

## Passed

- All 12 deployed Netlify JavaScript files passed the ESM validator.
- All JavaScript and MJS files passed `node --check`.
- All 89 JSX/TSX files parsed without syntax diagnostics using the TypeScript parser.
- All relative source and Netlify imports resolve.
- All configured navigation paths resolve to active routes.
- The public customer portal remains outside employee `AuthGate`.
- `/create-product` is a compatibility redirect to the current blank-item editor.
- Unknown employee routes use `NotFound`.
- Known stale deployable files are absent.
- WooCommerce HMAC, raw-body, and timing-safe comparison tests passed.
- The source-derived database contract was refreshed from the current source, including shared Netlify helpers.
- Required migrations passed static non-destructive SQL checks.
- All created ZIP archives are integrity-tested before delivery.

## Not executable in the generation environment

A clean `npm ci` did not complete because package-registry access stalled in the container. Consequently, ESLint and the Vite production build could not be executed here. Run `npm ci && npm run check` in the normal development/CI environment before production deployment.

The SQL was not executed against the live Supabase project. The supplied preflight and live smoke tests are required before certification.
