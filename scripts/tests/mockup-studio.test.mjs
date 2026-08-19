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
  assert.match(fn, /createSignedUrl/);
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
  assert.match(fn, /createSignedUrl/);
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
  assert.match(fn, /WOO_BATCH_SIZE = 50/);
  assert.match(fn, /WOO_IMAGE_BATCH_SIZE = 5/);
  assert.match(fn, /variations\/batch/);
  assert.match(fn, /const operations = \[\.\.\.creates, \.\.\.updates, \.\.\.deactivates\]/);
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
  assert.match(fn, /storage\.from\(bucket\)\.remove/);
});

test('exact compositor preserves an AI-free rendering path with captions', async () => {
  const canvas = await read('src/lib/mockupCanvas.js');
  assert.match(canvas, /renderMockupComposite/);
  assert.match(canvas, /caption/);
  assert.match(canvas, /font/);
  assert.match(canvas, /fillText/);
  assert.match(canvas, /preserveWhiteInk \? 'source-over'/);
  assert.match(canvas, /inspectArtworkFile/);
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
  assert.match(fn, /\.remove\(\[output\.storage_path\]\)/);
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

test('WooCommerce reads retry transient connection failures without duplicating ambiguous writes', async () => {
  const utils = await read('netlify/functions/_shared/mockupUtils.js');
  assert.match(utils, /UND_ERR_CONNECT_TIMEOUT/);
  assert.match(utils, /const maximumAttempts = 3/);
  assert.match(utils, /safeConnectionRetry \|\| safeReadRetry/);
  assert.match(utils, /requestMethod === 'GET'/);
  assert.match(utils, /requestMethod === 'GET' \? 60000 : 180000/);
  assert.match(utils, /WooCommerce connection failed after \$\{attempt\} attempt/);
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
