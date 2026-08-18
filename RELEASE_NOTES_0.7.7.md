# Mockup Studio 0.7.7

## WooCommerce collection compatibility

This update fixes `Spread syntax requires ...iterable[Symbol.iterator] to be a function` while preparing or exporting a WooCommerce product.

- Normalizes standard WooCommerce arrays, wrapped list responses, and numerically keyed JSON objects before processing them.
- Normalizes older saved WooCommerce configuration values before using array or object spread syntax.
- Preserves saved logo choices, excluded Color + Logo pairs, and variation-image mappings.
- Returns an actionable response-format error if a WordPress cache or security plugin transforms the WooCommerce REST response into an unsupported shape.
- Includes the v0.7.6 background variation export and missing-variation-first repair.

No SQL migration or environment-variable change is required.

