import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('mockup database migration contains the complete isolated schema', async () => {
  const sql = await read('deployment/sql/18_MOCKUP_STUDIO_ALL_PHASES.sql');
  for (const table of [
    'mockup_projects', 'mockup_blank_assets', 'mockup_artwork_assets',
    'mockup_placements', 'mockup_generation_jobs', 'mockup_outputs',
    'mockup_review_tokens', 'mockup_reviews', 'mockup_pricing_items',
    'mockup_woo_exports', 'mockup_production_packets',
  ]) assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'));
  for (const bucket of ['sc-mockup-source', 'sc-mockup-output', 'sc-mockup-production']) assert.match(sql, new RegExp(bucket));
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all privileges on table[\s\S]*from public, anon/i);
  assert.match(sql, /security invoker/i);
});

test('mockup routes include employee studio, production packet, and public review', async () => {
  const app = await read('src/App.jsx');
  const navigation = await read('src/navigationConfig.js');
  assert.match(app, /path="\/mockup-studio"/);
  assert.match(app, /path="\/mockup-studio\/:projectId\/production-packet"/);
  assert.match(app, /path="\/mockup-review"/);
  assert.match(navigation, /Mockup Studio/);
});

test('AI generation uses an authenticated background function and server-only key', async () => {
  const api = await read('src/lib/mockupStudioApi.js');
  const fn = await read('netlify/functions/mockup-generate-background.js');
  assert.match(api, /mockup-generate-background/);
  assert.match(api, /mockup_generation_jobs/);
  assert.match(fn, /authorizeEmployee/);
  assert.match(fn, /requiredEnv\('OPENAI_API_KEY'\)/);
  assert.doesNotMatch(fn, /VITE_OPENAI/);
  assert.match(fn, /input_fidelity', 'high'/);
});

test('customer approval uses hashed tokens and private signed images', async () => {
  const fn = await read('netlify/functions/mockup-customer-review.js');
  const sql = await read('deployment/sql/18_MOCKUP_STUDIO_ALL_PHASES.sql');
  assert.match(fn, /sha256\(token\)/);
  assert.match(fn, /signedStoredAssetUrl/);
  assert.match(sql, /public\s*=\s*false/i);
  assert.match(sql, /sc_mockup_create_review_token/i);
});

test('WooCommerce export supports catalog attributes, logo variations, image mapping, and updates', async () => {
  const fn = await read('netlify/functions/mockup-publish-woocommerce.js');
  const backgroundFn = await read('netlify/functions/mockup-publish-woocommerce-background.js');
  const options = await read('netlify/functions/mockup-woo-options.js');
  const studio = await read('src/MockupStudio.jsx');
  const api = await read('src/lib/mockupStudioApi.js');
  const netlify = await read('netlify.toml');
  assert.match(fn, /allowedRoles: \['admin', 'manager'\]/);
  assert.match(fn, /signedStoredAssetUrl/);
  assert.match(fn, /_sc_mockup_captions/);
  assert.match(fn, /pa_brand/);
  assert.match(fn, /pa_style/);
  assert.match(fn, /Logo Selection/);
  assert.match(fn, /variation_image_map/);
  assert.match(fn, /row\.image = \{ id: imageId \}/);
  assert.match(fn, /main_product_image_output_id/);
  assert.match(fn, /shipping_class/);
  assert.match(fn, /dimensions:/);
  assert.match(fn, /weight:/);
  assert.match(fn, /listExistingVariations/);
  assert.match(fn, /WOO_BATCH_SIZE = 25/);
  assert.match(fn, /WOO_IMAGE_BATCH_SIZE = 1/);
  assert.match(fn, /variations\/batch/);
  assert.match(fn, /incomplete variation batch response/);
  assert.match(fn, /variation reconciliation failed/);
  assert.match(fn, /createHash\('sha256'\)/);
  assert.match(fn, /woo_product_id: product\.id[\s\S]*syncVariations/);
  assert.match(fn, /findExistingProjectProduct/);
  assert.match(fn, /syncProductImages/);
  assert.match(fn, /stage: 'images'/);
  assert.doesNotMatch(fn, /const productPayload = \{[\s\S]*?images: imageRowsFor\(storeOutputs\)/);
  assert.match(fn, /variations_processed/);
  assert.match(api, /status: 'queued'/);
  assert.match(api, /export_id: exportRow\.id/);
  assert.match(api, /mockup-publish-woocommerce-background/);
  assert.match(api, /current\.status !== 'queued' \|\| current\.woo_product_id/);
  assert.match(api, /Creating WooCommerce variations:/);
  assert.match(api, /Adding WooCommerce mockup images:/);
  assert.match(backgroundFn, /export \{ handler \} from '\.\/mockup-publish-woocommerce\.js'/);
  assert.match(netlify, /\[functions\."mockup-publish-woocommerce-background"\][\s\S]*background = true/);
  assert.match(fn, /'draft'/);
  assert.match(options, /mockup-woo-options/);
  assert.match(options, /products\/attributes/);
  assert.match(options, /products\/categories/);
  assert.match(options, /products\/shipping_classes/);
  assert.match(options, /products\/tags/);
  assert.match(options, /checked_at/);
  assert.match(options, /optionalWooRows/);
  assert.match(options, /warnings/);
  assert.match(studio, /WooCommerce category IDs/);
  assert.match(studio, /Existing shipping-class slug/);
  assert.match(studio, /Retry WooCommerce Connection/);
  assert.match(studio, /Color × Size × Logo/);
  assert.match(studio, /Variation mockup mapping/);
  assert.match(studio, /Main product image and gallery/);
  assert.match(studio, /Product categories/);
});

test('project deletion is privileged and cleans private storage', async () => {
  const api = await read('src/lib/mockupStudioApi.js');
  const fn = await read('netlify/functions/mockup-delete-project.js');
  assert.match(api, /mockup-delete-project/);
  assert.match(fn, /allowedRoles: \['admin', 'manager'\]/);
  assert.match(fn, /deleteStoredAsset/);
});

test('local archives verify files before batched cloud cleanup and support restore', async () => {
  const sql = await read('deployment/sql/22_MOCKUP_LOCAL_ARCHIVES.sql');
  const studio = await read('src/MockupStudio.jsx');
  const local = await read('src/lib/mockupLocalArchive.js');
  const api = await read('src/lib/mockupStudioApi.js');
  const fn = await read('netlify/functions/mockup-archive-project.js');
  assert.match(sql, /create table if not exists public\.mockup_project_archives/i);
  assert.match(sql, /previous_project_status/);
  assert.match(sql, /deleted_file_keys/);
  assert.match(local, /showDirectoryPicker/);
  assert.match(local, /SHA-256/);
  assert.match(local, /savedChecksum !== checksum/);
  assert.match(local, /mockup-archive-manifest\.json/);
  assert.match(local, /restoreMockupStoredFile/);
  assert.match(api, /beginMockupLocalArchive/);
  assert.match(api, /continueMockupLocalArchive/);
  assert.match(api, /completeMockupLocalArchiveRestore/);
  assert.match(fn, /allowedRoles: \['admin', 'manager'\]/);
  assert.match(fn, /DELETE_BATCH_SIZE = 40/);
  assert.match(fn, /missing\.length \|\| extra\.length/);
  assert.match(fn, /status: completed \? 'active' : 'deleting'/);
  assert.match(fn, /status: 'restored'/);
  assert.match(studio, /Archive Project Images to My Computer/);
  assert.match(studio, /Reconnect Local Folder/);
  assert.match(studio, /Restore Files to Supabase|Restore Files/);
});

test('exact compositor preserves an AI-free rendering path with captions', async () => {
  const canvas = await read('src/lib/mockupCanvas.js');
  const studio = await read('src/MockupStudio.jsx');
  const api = await read('src/lib/mockupStudioApi.js');
  const server = await read('netlify/functions/mockup-generate-exact.js');
  assert.match(canvas, /renderMockupComposite/);
  assert.match(canvas, /caption/);
  assert.match(canvas, /font/);
  assert.match(canvas, /fillText/);
  assert.match(canvas, /preserveWhiteInk \? 'source-over'/);
  assert.match(canvas, /inspectArtworkFile/);
  assert.match(studio, /requestExactMockup/);
  assert.doesNotMatch(studio, /renderMockupComposite\(\{ blankUrl/);
  assert.match(api, /mockup-generate-exact-background/);
  assert.match(api, /generation_mode: 'exact_composite'/);
  assert.match(server, /loadMockupAsset/);
  assert.match(server, /renderExactMockup/);
  assert.match(server, /cors_independent: true/);
  const background = await read('netlify/functions/mockup-generate-exact-background.js');
  const netlify = await read('netlify.toml');
  assert.match(background, /mockup-generate-exact\.js/);
  assert.match(netlify, /\[functions\."mockup-generate-exact-background"\][\s\S]*background = true/);
});

test('server exact compositor preserves dimensions and creates caption space', async () => {
  const sharp = (await import('sharp')).default;
  const { renderExactMockup } = await import('../../netlify/functions/_shared/exactMockupRenderer.js');
  const blank = await sharp({ create: { width: 500, height: 600, channels: 4, background: '#202020' } }).png().toBuffer();
  const artwork = await sharp({ create: { width: 200, height: 100, channels: 4, background: '#ffffff' } }).png().toBuffer();
  const clean = await renderExactMockup({ blankBytes: blank, artworkBytes: artwork, placement: { width_pct: 40, x_pct: 50, y_pct: 45, perspective_config: { preserve_white_ink: true } } });
  assert.equal(clean.width, 500);
  assert.equal(clean.height, 600);
  assert.ok(clean.data.length > 0);
  const captioned = await renderExactMockup({ blankBytes: blank, artworkBytes: artwork, placement: { width_pct: 40 }, caption: { text: 'Test mockup', size: 36, padding: 32 } });
  assert.ok(captioned.height > clean.height);
});

test('placement geometry is identical before and after adding a caption', async () => {
  const sharp = (await import('sharp')).default;
  const { renderExactMockup } = await import('../../netlify/functions/_shared/exactMockupRenderer.js');
  const blank = await sharp({ create: { width: 500, height: 600, channels: 4, background: '#303030' } }).png().toBuffer();
  const artwork = await sharp({ create: { width: 180, height: 90, channels: 4, background: '#ffffff' } }).png().toBuffer();
  const placement = { width_pct: 37, x_pct: 42, y_pct: 39, rotation_degrees: 7, shadow_strength: 0, perspective_config: { preserve_white_ink: true } };
  const clean = await renderExactMockup({ blankBytes: blank, artworkBytes: artwork, placement });
  const captioned = await renderExactMockup({ blankBytes: blank, artworkBytes: artwork, placement, caption: { text: 'Same placement', size: 28, padding: 20 } });
  const cleanPixels = await sharp(clean.data).raw().toBuffer();
  const captionProductPixels = await sharp(captioned.data).extract({ left: 0, top: 0, width: clean.width, height: clean.height }).raw().toBuffer();
  assert.deepEqual(captionProductPixels, cleanPixels);

  const studio = await read('src/MockupStudio.jsx');
  const css = await read('src/MockupStudio.css');
  assert.match(studio, /mockup-placement-canvas/);
  assert.match(studio, /blankAsset=\{blank\}/);
  assert.match(css, /\.mockup-placement-canvas \{ position: relative; width: 100%; overflow: hidden; \}/);
  assert.match(css, /\.mockup-output-card > img \{ display: block; width: 100%; height: auto;/);
  assert.doesNotMatch(css, /\.mockup-generation-card \.mockup-placement-preview > img:first-child/);
});

test('server exact compositor bounds large 300-DPI sources before compositing', async () => {
  const sharp = (await import('sharp')).default;
  const { renderExactMockup } = await import('../../netlify/functions/_shared/exactMockupRenderer.js');
  const blank = await sharp({ create: { width: 4200, height: 5400, channels: 4, background: '#202020' } }).jpeg({ quality: 85 }).toBuffer();
  const artwork = await sharp({ create: { width: 6000, height: 6000, channels: 4, background: '#ffffff' } }).png({ compressionLevel: 9 }).toBuffer();
  const rendered = await renderExactMockup({
    blankBytes: blank,
    artworkBytes: artwork,
    placement: { width_pct: 40, x_pct: 50, y_pct: 45, perspective_config: { preserve_white_ink: true } },
  });
  assert.ok(rendered.width <= 2400);
  assert.ok(rendered.height <= 2400);
  assert.ok(rendered.data.length > 0);
});

test('white artwork is protected as opaque print in exact and AI mockups', async () => {
  const studio = await read('src/MockupStudio.jsx');
  const api = await read('src/lib/mockupStudioApi.js');
  const ai = await read('netlify/functions/mockup-generate-background.js');
  assert.match(studio, /Protect visible white as opaque printed ink/);
  assert.match(studio, /Normal — opaque print/);
  assert.match(studio, /function protectsWhiteInk/);
  assert.match(api, /preserve_white_ink/);
  assert.match(ai, /CRITICAL WHITE INK RULE/);
  assert.match(ai, /Do not treat white artwork/);
  assert.match(ai, /alpha-transparent/);
});

test('blank photos and artwork support editable bulk upload queues', async () => {
  const studio = await read('src/MockupStudio.jsx');
  const css = await read('src/MockupStudio.css');
  assert.match(studio, /function runUploadQueue/);
  assert.match(studio, /multiple accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(studio, /multiple accept="image\/png,image\/jpeg,image\/webp,image\/svg\+xml,application\/pdf"/);
  assert.match(studio, /Upload \$\{uploadRows\.length\} Blank Images/);
  assert.match(studio, /Upload \$\{uploadRows\.length\} Artwork Files/);
  assert.match(studio, /Apply defaults to all queued files/);
  assert.match(studio, /failed and remain in the queue/);
  assert.match(css, /\.mockup-upload-queue/);
});

test('copy to all verifies every blank placement individually', async () => {
  const api = await read('src/lib/mockupStudioApi.js');
  const studio = await read('src/MockupStudio.jsx');
  assert.match(api, /const targetIds = \[\.\.\.new Set\(blankAssetIds\)\]/);
  assert.match(api, /for \(const blankAssetId of targetIds\)/);
  assert.match(api, /\.upsert\(\{ \.\.\.basePayload, blank_asset_id: blankAssetId \}/);
  assert.match(api, /copied\.length !== targetIds\.length/);
  assert.match(studio, /Placement copied to \$\{copied\.length\} additional blank photo/);
});

test('generated mockups can be permanently removed from store choices and storage', async () => {
  const api = await read('src/lib/mockupStudioApi.js');
  const studio = await read('src/MockupStudio.jsx');
  const fn = await read('netlify/functions/mockup-delete-output.js');
  assert.match(api, /mockup-delete-output/);
  assert.match(studio, /Delete Mockup/);
  assert.match(studio, /removed from WooCommerce variation choices/);
  assert.match(fn, /allowedRoles: \['admin', 'manager', 'operator'\]/);
  assert.match(fn, /from\('mockup_outputs'\)[\s\S]*\.delete\(\)/);
  assert.match(fn, /storage_bucket/);
  assert.match(fn, /deleteStoredAsset/);
});

test('Cloudflare R2 storage is private, resumable, and preserves Supabase compatibility', async () => {
  const { cleanObjectName, createPreviewBuffer, safeObjectKey } = await import('../../netlify/functions/_shared/mockupStorage.js');
  const sql = await read('deployment/sql/24_MOCKUP_R2_STORAGE.sql');
  const shared = await read('netlify/functions/_shared/mockupStorage.js');
  const storage = await read('netlify/functions/mockup-storage.js');
  const migration = await read('netlify/functions/mockup-migrate-storage.js');
  const api = await read('src/lib/mockupStudioApi.js');
  const studio = await read('src/MockupStudio.jsx');
  assert.match(sql, /storage_provider/);
  assert.match(sql, /preview_storage_path/);
  assert.match(sql, /mockup_storage_inventory/);
  assert.match(shared, /S3Client/);
  assert.match(shared, /GetObjectCommand/);
  assert.match(shared, /PutObjectCommand/);
  assert.match(shared, /createPreviewBuffer/);
  assert.match(storage, /presignedR2Put/);
  assert.match(storage, /allowedRoles: \['admin', 'manager', 'employee'\]/);
  assert.match(migration, /verifiedR2Upload/);
  assert.match(migration, /remaining/);
  assert.match(migration, /deleteStoredReference/);
  assert.match(api, /preview_content_type/);
  assert.match(api, /migrateMockupProjectStorage/);
  assert.match(studio, /Move This Project to R2/);
  assert.match(studio, /urlsForWorkflowTab/);
  assert.match(storage, /record_type/);
  assert.match(storage, /record_id/);
  assert.match(storage, /storage_field/);
  assert.match(storage, /cancel_upload/);
  assert.match(api, /_pending_upload_cleanup/);
  assert.equal(cleanObjectName('Gildan 18500 Black FRONT.PNG'), 'gildan-18500-black-front.png');
  assert.throws(() => safeObjectKey('../secret'), /Invalid mockup storage path/);
  const sharp = (await import('sharp')).default;
  const onePixelPng = await sharp({ create: { width: 1, height: 1, channels: 4, background: '#ffffff' } }).png().toBuffer();
  const preview = await createPreviewBuffer(onePixelPng, 'image/png');
  assert.ok(preview?.length > 0);
});

test('Artwork Requests, Reorders, and Vault files are imported once into private R2', async () => {
  const api = await read('src/lib/mockupStudioApi.js');
  const studio = await read('src/MockupStudio.jsx');
  const storage = await read('netlify/functions/mockup-storage.js');
  const utils = await read('netlify/functions/_shared/mockupUtils.js');
  assert.match(api, /sc_artwork_system_reorders/);
  assert.match(api, /import_external_artwork/);
  assert.match(storage, /external_source_url/);
  assert.match(api, /!row\.storage_path && row\.source_url/);
  assert.match(studio, /Import Artwork to R2/);
  assert.match(studio, /_source_row_id/);
  assert.match(storage, /importExternalArtwork/);
  assert.match(storage, /putMockupObject/);
  assert.match(storage, /location\.storage_provider !== 'r2'/);
  assert.match(storage, /source_url: sourceUrl/);
  assert.match(storage, /deleteStoredAsset\(supabase, location\)/);
  assert.match(storage, /mockup_artwork_assets'\)\.insert\(insert\)/);
  assert.match(utils, /fetchSafeExternalAsset/);
  assert.match(utils, /redirect: 'manual'/);
  assert.match(utils, /assertSafeExternalAssetUrl\(new URL\(location, currentUrl\)\.toString\(\)\)/);
  assert.match(utils, /bytes\.length > maxBytes/);
});

test('unwanted Color and Logo combinations are excluded from WooCommerce variations', async () => {
  const studio = await read('src/MockupStudio.jsx');
  const fn = await read('netlify/functions/mockup-publish-woocommerce.js');
  assert.match(studio, /excluded_variation_pairs/);
  assert.match(studio, /Include in product/);
  assert.match(studio, /Excluded combinations are not created in WooCommerce/);
  assert.match(fn, /excludedPairs\.has\(imageMapKey\(color, logo\)\)/);
  assert.match(fn, /_sc_excluded_variation_pairs/);
  assert.match(fn, /staleProjectVariations/);
  assert.match(fn, /status: 'private'/);
});

test('legacy variation image mappings survive punctuation normalization', async () => {
  const {
    canonicalVariationImageMap,
    canonicalExcludedVariationPairs,
  } = await import('../../netlify/functions/mockup-publish-woocommerce.js');
  const legacyKey = JSON.stringify(['Grey', 'EPO Orcas Black & White (1)']);
  const canonicalKey = JSON.stringify(['grey', 'epo orcas black and white 1']);

  assert.deepEqual(
    canonicalVariationImageMap({ [legacyKey]: 'mockup-output-1' }),
    { [canonicalKey]: 'mockup-output-1' },
  );
  assert.deepEqual(canonicalExcludedVariationPairs([legacyKey]), [canonicalKey]);

  const studio = await read('src/MockupStudio.jsx');
  assert.match(studio, /function canonicalSavedVariationKey/);
  assert.match(studio, /variation_image_map: canonicalVariationImageMap/);
  assert.match(studio, /excluded_variation_pairs: canonicalExcludedVariationPairs/);
  assert.match(studio, /replace\(\/&\/g, ' and '\)/);
});

test('WooCommerce product descriptions and separate pricing paths are supported', async () => {
  const studio = await read('src/MockupStudio.jsx');
  const api = await read('src/lib/mockupStudioApi.js');
  const publish = await read('netlify/functions/mockup-publish-woocommerce.js');
  const migration = await read('deployment/sql/36_MOCKUP_STUDIO_PLACEMENT_PRICING.sql');
  const verify = await read('deployment/sql/37_VERIFY_MOCKUP_STUDIO_PLACEMENT_PRICING.sql');
  assert.match(studio, /label="Product description"/);
  assert.match(studio, /Direct Retail/);
  assert.match(studio, /Wholesale price/);
  assert.match(studio, /Retail price/);
  assert.match(api, /pricing_path: pricingPath/);
  assert.match(api, /wholesale_price: pricingPath === 'wholesale'/);
  assert.match(publish, /description: String\(config\.description \|\| ''\)/);
  assert.match(migration, /add column if not exists pricing_path/i);
  assert.match(migration, /add column if not exists wholesale_price/i);
  assert.match(migration, /pricing_path in \('direct_retail', 'wholesale'\)/i);
  assert.match(verify, /pricing_path_ready/);
  assert.match(verify, /existing_rows_valid/);
});

test('WooCommerce reads retry transient connection failures without duplicating ambiguous writes', async () => {
  const utils = await read('netlify/functions/_shared/mockupUtils.js');
  assert.match(utils, /UND_ERR_CONNECT_TIMEOUT/);
  assert.match(utils, /const maximumAttempts = 3/);
  assert.match(utils, /safeConnectionRetry \|\| safeReadRetry/);
  assert.match(utils, /requestMethod === 'GET'/);
  assert.match(utils, /requestMethod === 'GET' \? 60000 : 180000/);
  assert.match(utils, /WooCommerce connection failed after \$\{attempt\} attempt/);
  assert.match(utils, /Accept: 'application\/json'/);
  assert.match(utils, /Cache-Control': 'no-cache, no-store, max-age=0'/);
  assert.match(utils, /returned invalid JSON on attempt/);
});

test('Mockup reliability migration separates selection from approval and enforces production readiness', async () => {
  const sql = await read('deployment/sql/34_MOCKUP_STUDIO_RELIABILITY_SECURITY.sql');
  const verify = await read('deployment/sql/35_VERIFY_MOCKUP_STUDIO_RELIABILITY_SECURITY.sql');
  const api = await read('src/lib/mockupStudioApi.js');
  const studio = await read('src/MockupStudio.jsx');
  const production = await read('src/MockupProductionPacket.jsx');
  assert.match(sql, /sc_mockup_active_employee/);
  assert.match(sql, /sc_mockup_internal_review/);
  assert.match(sql, /sc_mockup_apply_customer_review/);
  assert.match(sql, /sc_mockup_mark_production_ready/);
  assert.doesNotMatch(sql, /create policy sc_mockup_authenticated_all/i);
  assert.match(sql, /Every active placement requires a selected approved mockup/);
  assert.match(verify, /active_employee_policy_count/);
  assert.match(api, /rpc\('sc_mockup_internal_review'/);
  assert.match(api, /rpc\('sc_mockup_mark_production_ready'/);
  assert.match(studio, /Approve & Select/);
  assert.match(production, /Validate & Mark Production Ready/);
});

test('Mockup cleanup is durable and caption changes cannot silently export stale pixels', async () => {
  const sql = await read('deployment/sql/34_MOCKUP_STUDIO_RELIABILITY_SECURITY.sql');
  const cleanup = await read('netlify/functions/mockup-storage-cleanup.js');
  const shared = await read('netlify/functions/_shared/mockupStorage.js');
  const publish = await read('netlify/functions/mockup-publish-woocommerce.js');
  const studio = await read('src/MockupStudio.jsx');
  assert.match(sql, /mockup_storage_cleanup_queue/);
  assert.match(shared, /queueStoredAssetCleanup/);
  assert.match(cleanup, /in\('status', \['pending', 'failed'\]\)/);
  assert.match(cleanup, /deleteStoredReference/);
  assert.match(studio, /Retry Deferred File Cleanup/);
  assert.match(studio, /caption_render_state: captionChanged \? 'stale'/);
  assert.match(publish, /caption_render_state === 'stale'/);
});

test('Stale caption regeneration replaces the selected output and WooCommerce references', async () => {
  const api = await read('src/lib/mockupStudioApi.js');
  const studio = await read('src/MockupStudio.jsx');
  const exact = await read('netlify/functions/mockup-generate-exact.js');
  const publish = await read('netlify/functions/mockup-publish-woocommerce.js');
  assert.match(api, /replaceOutputId = null/);
  assert.match(api, /replace_output_id: replaceOutputId \|\| null/);
  assert.match(studio, /Regenerate Caption/);
  assert.match(studio, /replaceOutputId: output\.id/);
  assert.match(studio, /selectedIds\.has\(String\(nextMap\[key\]/);
  assert.match(exact, /replaceWooOutputReferences/);
  assert.match(exact, /replaces_output_id: replacement\?\.id \|\| null/);
  assert.match(exact, /approval_status: 'pending'/);
  assert.match(publish, /output\.output_kind === 'captioned' && output\.metadata\?\.caption_render_state === 'stale'/);
});

test('WooCommerce list responses and legacy saved settings are normalized before spreading', async () => {
  const { wooCollection } = await import('../../netlify/functions/_shared/mockupUtils.js');
  const utils = await read('netlify/functions/_shared/mockupUtils.js');
  const publish = await read('netlify/functions/mockup-publish-woocommerce.js');
  const options = await read('netlify/functions/mockup-woo-options.js');
  const studio = await read('src/MockupStudio.jsx');
  assert.match(utils, /export function wooCollection/);
  assert.match(utils, /entries\.every\(\(\[key\]\) => \/\^\\d\+\$\//);
  assert.match(publish, /wooCollection/);
  assert.match(options, /wooCollection/);
  assert.match(studio, /function objectValue/);
  assert.match(studio, /new Set\(optionList\(form\.excluded_variation_pairs\)\)/);
  assert.match(studio, /objectValue\(form\.variation_image_map\)/);
  assert.deepEqual(wooCollection([{ id: 1 }], 'test'), [{ id: 1 }]);
  assert.deepEqual(wooCollection({ 1: { id: 2 }, 0: { id: 1 } }, 'test'), [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(wooCollection({ data: [{ id: 3 }] }, 'test'), [{ id: 3 }]);
  assert.throws(() => wooCollection({ code: 'unexpected' }, 'test'), /unexpected response/);
});
