# Mockup Studio 0.7.10

## Reliable exports for products with 400+ variations

- WooCommerce publishing now invokes an explicitly named Netlify Background Function.
- The function is also marked as background in `netlify.toml`, providing two independent safeguards against a synchronous timeout.
- Netlify can acknowledge the job immediately while variation processing continues for up to the background-function execution limit.
- Variation writes use batches of 50. This remains below WooCommerce's documented 100-object batch limit while cutting the number of API round trips in half.
- If the browser request disconnects after the server accepted the job, the application checks the durable export record instead of incorrectly reporting that the export could not be started.
- The WooCommerce parent product ID remains saved before any variation batches begin.
- Retrying an interrupted export updates the same draft, compares existing variations, and creates missing combinations before updating existing combinations.
- The existing 500-variation application safety limit remains in place.

No SQL migration or environment-variable change is required.
