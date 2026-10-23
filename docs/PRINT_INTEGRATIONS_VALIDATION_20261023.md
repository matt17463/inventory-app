# QuickBooks connection hardening and configuration follow-up

Draft PR #114 remains unmerged. No production deployment or printing cutover is authorized by this change.

## Resulting behavior

- `/quickbooks` provides administrator-only connection, reconnection and explicit disconnection without selecting a job. Opening `/print-center` without a job also reaches connection settings.
- An OAuth request uses Intuit's published discovery document, validates expected Intuit destinations, and binds its single-use state to an HttpOnly/Secure/SameSite=Lax browser cookie. Unexpected endpoints fail closed for review.
- Expired access tokens refresh before invoice reads. An unexpected 401 triggers one refresh and one retry; subsequent errors stop with reconnect guidance. Refreshed tokens remain encrypted and versioned.
- Disconnect invalidates pending consent states, revokes the saved refresh token with Intuit, then removes the version-matched encrypted connection. Failed revocation retains the connection for retry. No invoice/order/payment record is written.
- QuickBooks invoices supply the original customer, date, lines, discounts, tax, total, paid amount and outstanding balance. Customer names must match the linked manual order after case/whitespace normalization; ambiguous identities fail closed. Missing/invalid balances no longer become paid. Identity, currency, unsupported-line and arithmetic discrepancies block customer copies. USD invoices with supported sales/discount lines are covered; group lines and foreign currencies require further support before printing.
- QuickBooks PDFs include paid amount and outstanding balance. Printing remains independently disabled by the existing flags.

## Configuration completed outside source control

Production Intuit client credentials and the 32-byte token-encryption key were saved directly as Netlify secrets with Production-only values. Values are never included here. Netlify uses `SC_QBO_ENVIRONMENT=production` and `SC_QBO_REDIRECT_URI=https://app.skilledcrafting.com/.netlify/functions/qbo-print-connect`. Both printer feature flags remain false.

The owner approved registration of that exact URI in Intuit's Production redirect list; the saved list was verified. These settings alone do not deploy the callback or connect a real company. The temporary Intuit disconnect landing URL remains the app root; after approval and deployment it can point to `/quickbooks`, where disconnect requires an authenticated admin action. A GET landing-page visit never revokes a connection.

## Validation and limits

Behavioral tests use synthetic financial data, mocked Intuit HTTP responses and an in-memory connection/state store. They exercise balance/customer mismatch, partial payments, line arithmetic, encrypted-token integrity, state expiry/replay/browser binding, refresh rotation, bounded 401 recovery, invalid grant, missing/ambiguous invoices, discovery destination checks, and revoke-before-delete behavior.

The existing full test command, lint, build, Netlify ESM validation and steps 6–14 validation were run locally. The latest CI run should also be reviewed before deployment. Passing mocked tests is not evidence of a live sandbox consent flow, real token refresh, actual invoice reconciliation or printed application output.

Netlify preview cancellation is intentional: `scripts/netlify-ignore-non-production.mjs` skips nonproduction builds unless `SC_NETLIFY_FORCE_PREVIEW=1`. Do not lift this safeguard or expose Production credentials to previews. A live sandbox exercise requires isolated nonproduction token/state storage plus Intuit Development credentials, a matching Development callback, and print dispatch disabled. Never overwrite the Production singleton connection with sandbox tokens.

## Remaining activation gates

1. Review the development change and passing CI.
2. Establish isolated sandbox hosting/storage and Development credentials. Exercise connect/disconnect/reconnect, refresh, known original invoice, intentional mismatch, QR authentication and PDF output.
3. Obtain explicit production deployment approval. Deploy with printing disabled; do not merge or publish solely to make OAuth setup easier.
4. Complete owner-approved real-company consent and read-only invoice verification on the deployed callback.
5. Privately configure the matching print-agent token on Netlify/Pi, verify polling, and schedule a Pi reboot check.
6. Obtain explicit controlled Epson activation approval, queue one internal shop document, and confirm its physical output. Leave thermal printing disabled and retain the WooCommerce fallback.
