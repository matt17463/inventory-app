# Skilled Crafting v1.4.5 — Artwork R2 Storage + Workflow Reliability

v1.4.5 supersedes the not-yet-deployed v1.4.4 package. Do not deploy v1.4.4 first.

It contains every v1.4.4 application change plus a new authenticated Artwork R2 storage bridge and the WordPress companion plugin **Skilled Crafting Artwork R2 Storage & Review Reliability v1.1.0**.

## Artwork Request storage architecture

- Cloudflare R2 becomes the durable master file store for migrated Artwork System files.
- WordPress continues to own request/customer/review/approval/revision/Vault workflow records.
- WooCommerce Media Library remains only a downstream publishing copy when a Woo product needs an image.
- The compatibility release retains the current WordPress Media Library copy after R2 migration so existing DTF readiness checks and older admin controls continue to work.
- Customer/staff image URLs stored in the Artwork System become durable WordPress proxy URLs. The proxy validates a capability signature and creates a fresh 5-minute private R2 URL on each request.
- Existing files are migrated in resumable 25-file passes.
- New/replaced Artwork System files are automatically considered for R2 migration after the existing WordPress action finishes.
- Each migrated object records file size and SHA-256.
- Exact approved mockups receive an immutable approval snapshot containing the R2 object key, file size and SHA-256.
- Inventory handoff payloads are enriched with R2 storage metadata while retaining a usable HTTPS file URL for existing consumers.

## New Inventory App backend

`netlify/functions/artwork-r2-storage.js`

The bridge:

- authenticates with the existing Artwork System webhook secret;
- uses the existing private R2 configuration already used by Mockup Studio;
- returns presigned R2 PUT URLs so large file bodies do not pass through Netlify;
- verifies uploaded object size with R2 HEAD;
- returns short-lived private R2 download URLs;
- restricts deletion to `artwork-system/` object keys.

No new Supabase SQL is required by v1.4.5.

## Previous v1.4.4/v1.4.3 functionality retained

- Safe Batch Updates v1.1.0 with post-save verification.
- On-site Sales Test Mode with zero inventory deduction and TEST labels.
- Phone / Tablet / Laptop On-site layouts.
- SiteGround CAPTCHA-aware Woo GET retries and category caching.
- Mockup Studio placement deletion.
- Clearable Woo tags and Clear All Tags.
- Youth + Adult / Youth only / Adult only size presets.
- Global Size Upcharges v1.0.0.
- Hardened Artwork customer review: no-cache token page, exact visible mockup selection and redirect-after-submit.
