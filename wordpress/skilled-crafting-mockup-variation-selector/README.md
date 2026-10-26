# Mockup Variation Selector 1.1.0

Preserves the installed 1.0.0 Color → Size → Logo behavior and adds an opt-in canonical graphics bridge for classic WooCommerce variable-product forms.

The bridge requires Graphic Choices 0.2.1 active, global `sc_graphics_selector_enabled=yes`, a Mockup Studio variable parent with `_sc_mockup_project_id`, and parent `_sc_graphic_external_selector=yes`. It otherwise leaves the original selection flow unchanged. Do not set the external-selector marker before integration and approved mapping validation: Graphic Choices uses it to suppress its separate chooser.

Configure each exact variation's `_sc_graphic_family_id` from its manager-reviewed canonical mapping. The parent `_sc_graphic_options` allowlist must contain that ID and its authoritative label. Never derive IDs from visible Logo labels, SKUs or filenames. The resolved Woo variation data supplies the hidden `sc_graphic_family_id`; changing/resetting variations clears it. Server validation rejects missing, unlisted, mismatched and foreign-parent mappings. Graphic Choices owns cart data and `_sc_graphic_family_id`/`_sc_graphic_label` order metadata, and supplies the trusted label.

This plugin does not replace or alter personalization metadata, approve application bindings, enable webhook capture, or activate the global selector. Existing Product Options and paid Product Add-Ons code are not bundled. Actual Woo tests exercise unrelated personalization through test hooks; a real product's installed add-on controls and Divi appearance still require a controlled product preview before activation. The bridge targets the existing classic form, not a custom Blocks variation interface.

## Verification

From the repository root, prepare a **new** temporary directory:

```
npm ci --prefix scripts/integration/client-graphics
python3 scripts/integration/client-graphics/actual-woo/prepare.py /tmp/sc-actual-woo
php /tmp/sc-actual-woo/wordpress/install-fixture.php
php /tmp/sc-actual-woo/wordpress/check-fixture.php
php /tmp/sc-actual-woo/wordpress/test-checkout.php
node scripts/integration/client-graphics/verify-mockup-selector-ui.mjs /tmp/sc-actual-woo/wordpress
node --experimental-test-module-mocks scripts/integration/client-graphics/verify-actual-woo-payload.mjs /tmp/sc-actual-woo/wordpress
```

Requires PHP with SQLite support; `scripts/integration/client-graphics/node_modules/.bin/php-wasm-cli` can replace `php`. No HTTP server is opened. Downloads pinned official WordPress 7.1.3, WooCommerce 11.2.1 and SQLite Integration 3.1.1. The local fixture blocks mail, outbound HTTP, payments, outbound webhooks and cron, and contains only fictional data. Application SQL runs in isolated PGlite, with real application functions and receipt/traveler triggers. R2 HEAD responses and employee authentication are simulated; no production secrets or database are loaded. The test builds and locally verifies a real Woo webhook signature; it does not deliver it to the production webhook endpoint.
