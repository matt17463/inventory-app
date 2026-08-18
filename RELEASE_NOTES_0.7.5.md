# Release notes — v0.7.5

## WooCommerce connection resilience

- Retries WooCommerce GET requests when Netlify encounters temporary connection failures.
- Retries write requests only when the failure code proves the TCP connection was never established, preventing ambiguous product requests from creating duplicates.
- Handles `UND_ERR_CONNECT_TIMEOUT`, `ETIMEDOUT`, DNS retry, refused-host, and unreachable-host conditions.
- Retries HTTP 429, 502, 503, and 504 responses for safe GET requests.
- Returns an actionable error containing the request method, resource, connection code, address when available, and attempt count.
- Includes all cumulative Mockup Studio fixes through v0.7.4.
- Requires no Supabase SQL migration or new environment variables.

The triggering production log showed `UND_ERR_CONNECT_TIMEOUT` while Netlify attempted to connect to the WooCommerce host. Selected output images were verified at 1000×1250 and approximately 0.4–1.3 MB, ruling out oversized image processing as the cause of that failure.
