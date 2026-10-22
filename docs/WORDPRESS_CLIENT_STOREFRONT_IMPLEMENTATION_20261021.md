# Skilled Crafting WordPress client storefront — deployment and operating guide (2026-10-21)

## Website review
- WordPress/Divi WooCommerce at https://skilledcrafting.com/ already exposes organization product categories, such as /product-category/sksc/.
- Client category pages are standard Woo product grids and lack branded landing content and coordinated checkout styling.
- The live /team-orders/ page still describes a download/print/email Word order form; replace those instructions with a link to the online team order form and QuickBooks billing process.
- Standardize new and old header/menu variants so they link to Find Your Store for recurring Woo stores and Request a Group Order for one-time invoiced jobs.

## Installable WordPress companion plugin
Source directory: wordpress/skilled-crafting-client-stores/
ZIP build: GitHub Actions workflow WordPress Client Stores Plugin (no Netlify previews).
Registers native publicly accessible WordPress client store pages /stores/{client-slug}/.
POST WordPress REST /wp-json/skilled-crafting/v1/client-store requires authenticated WordPress edit_pages and manage_woocommerce permissions (Application Password).
Four genuinely distinct layouts: Varsity / Athletics scoreboard and angular stripes; School Pride crest and collegiate band; Corporate split hero and purchasing steps; Fundraiser impact-led hero.
All layouts include ordering instructions, delivery information, deadlines and product cards restricted by approved WooCommerce product_cat category ID.
Checkout remains the existing WooCommerce checkout; classic and Checkout Blocks styling uses the store's colors when a cart contains only that client's category items. Mixed-category carts use the default shop theme.
Dedicated landing pages use a self-contained navigation rather than the global Divi multi-client Shop menu. WordPress public directory shortcode: [sc_client_store_directory].

## REQUIRED WordPress host activation
1. WordPress Admin > Plugins > Add New > Upload Plugin. Upload ZIP from GitHub Actions and activate.
2. If /stores/slug/ fails, WordPress Settings > Permalinks > Save Changes once to flush rules.
3. Use a dedicated WordPress automation account with edit_pages, manage_woocommerce and media upload permissions. Generate an Application Password from its WordPress profile.
4. In Netlify production env set SC_WP_USERNAME and SC_WP_APP_PASSWORD. WOO_SITE_URL and WC_CONSUMER_KEY / WC_CONSUMER_SECRET must target the same WordPress shop. Never put these secrets in public VITE variables or the repo.
5. Create a WordPress Find Your Store page at /find-your-store/ with [sc_client_store_directory] and add it to the active Divi menu.
6. Replace the obsolete form-instructions on WordPress /team-orders/ with: recurring stores -> /find-your-store/; occasional team/group orders -> https://inventory.skilledcrafting.com/team-order (QuickBooks invoice, not checkout).
7. Test Divi responsive layouts, WooCommerce Checkout Blocks/classic, session/cache behavior, category filtering, WP API auth and SiteGround anti-bot restrictions.

## Owner workflow for recurring stores
Start/choose an approved WooCommerce campaign in /team-stores; choose a template, upload logo, suggest brand colors, edit landing/order/delivery copy, save.
Create a category automatically with a unique slug or select a verified existing client Woo product category.
Assign approved products to that category using WordPress Products. The app's product selector rejects Woo items outside the category.
Generate WordPress draft. Review the draft while logged into WordPress and obtain customer art/pricing approval.
Manager confirms customer approval and publishes. The app verifies all linked Woo products, calls the real WordPress page publisher, then marks app campaign live. Failure leaves app campaign draft. No Netlify standalone storefront checkout.
Season cloning reuses logo/design/instructions only and creates a new draft; never copies old linked products, payouts, paid orders, client approvals or deadlines.

## Two channels remain separate
Recurring store = WordPress landing page -> WooCommerce products -> Woo checkout -> existing Woo order/job sync.
Occasional group = public online team order form -> Client Orders mapping and quote -> QuickBooks invoice and payment -> deliberate conversion to manual order and production job.
Both share inventory, artwork, equipment recipes, QC and QR production traveler.

## Shared next-stage features
Team purchasing rollup: from exact paid Woo line items or paid converted QBO group jobs, grouped by blank SKU/size/color. Informational demand only, not automatic PO or reservation adjustment.
Coordinator invitations: manager creates a single 90-day revocable private link. Aggregate Woo paid sales and tentative fundraiser totals or group requests/paid/conversion counts. No customer PII or accounting credentials.

## Release gates
Apply Supabase migration 202610220005_wp_client_stores_and_seasons.sql, inspect role policies and syntax, validate CI and WordPress PHP lint.
The GitHub repo cannot itself install a plugin into the external WordPress host. Live client WordPress page publication requires plugin activation and Netlify production WordPress Application Password configuration.
Do not announce full end-to-end WordPress readiness until a WP draft/publication and Woo checkout smoke test succeeds.