import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wpStoreConfigured,wpStorePayload} from '../../netlify/functions/_shared/wpClientStores.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('WordPress client-store plugin enforces Woo category and permission-gated publishing',()=>{
 const php=read('../../wordpress/skilled-crafting-client-stores/skilled-crafting-client-stores.php');
 assert.match(php,/register_post_type\('sc_client_store'/);
 assert.match(php,/register_rest_route\('skilled-crafting\/v1','\/client-store'/);
 assert.match(php,/current_user_can\('manage_woocommerce'\)/);
 assert.match(php,/tax_query/);assert.match(php,/'product_cat'/);
 assert.match(php,/scs_cart_store\(\)/);
 assert.match(php,/woocommerce\/checkout/);
 assert.match(php,/sc_client_store_directory/);
 for(const theme of ['athletics','scholastic','business','fundraising'])
   assert(php.includes(theme),theme+' template missing');
});
test('WordPress helper includes exact client category, sanitized palette and URL from configured site only',()=>{
 const c={id:'a3d164c5-ccbf-442e-aa6f-f426ba96d1ff',order_channel:'woocommerce',
  workflow_name:'School Winter Store',storefront_slug:'school-winter',
  customer_name:'School',wp_category_id:123,wp_template:'scholastic',wp_primary_color:'#112233',
  wp_secondary_color:'#ddeeff',wp_accent_color:'#f6f9fb'};
 const d=wpStorePayload(c,'draft');
 assert.equal(d.category_id,123);assert.equal(d.template,'scholastic');
 assert.equal(d.slug,'school-winter');assert.equal(d.status,'draft');
 assert.equal(wpStoreConfigured(),false,'CI should not rely on real WP credentials');
});
test('manager publication must create real WP landing after full category verification',()=>{
 const site=read('../../netlify/functions/team-store-site.js');
 const admin=read('../../netlify/functions/team-store-admin.js');
 assert.match(site,/wpStoreConfigured/);
 assert.match(site,/upsertWpStore\(c,'draft'\)/);
 assert.match(site,/action==='clone'/);
 assert.match(site,/wp_logo_media_id/);
 assert.match(admin,/await verifyCategoryProducts/);
 assert.match(admin,/await upsertWpStore\(c,'publish'\)/);
 assert.match(admin,/wp_store_url:page.url/);
 assert.match(admin,/await upsertWpStore\(c,'draft'\)/);
 assert.match(admin,/customer_approval_at/);
 assert.match(admin,/Previously approved|Approved\/published|before approval/);
});
test('WordPress designs use four structurally distinct sections, not recolors only',()=>{
 const php=read('../../wordpress/skilled-crafting-client-stores/skilled-crafting-client-stores.php');
 for(const section of ['scs-scoreboard','scs-school-band','scs-business-steps','scs-impact'])
   assert(php.includes(section),section);
 const css=read('../../wordpress/skilled-crafting-client-stores/assets/storefront.css');
 for(const section of ['.scs-athletics','.scs-scholastic','.scs-business','.scs-fundraising'])
   assert(css.includes(section),section);
});
test('season cloning clears old products and approvals, does not copy Woo order data',()=>{
 const site=read('../../netlify/functions/team-store-site.js');
 const part=site.slice(site.indexOf("if(action==='clone')"),site.indexOf("return jsonResponse(400",site.indexOf("if(action==='clone')")));
 assert.match(part,/cloned_from_campaign_id:c.id/);
 assert.match(part,/stage:'request',status:'active'/);
 for(const forbidden of ['customer_approval_at:','wp_category_id:','wp_store_post_id:','woo_product_ids:','woo_order_id:'])
   assert(!part.includes(forbidden),'cloning must not copy '+forbidden);
});
test('team purchasing groups only paid/converted job item lines and is readonly',()=>{
 const sql=read('../../supabase/migrations/202610220005_wp_client_stores_and_seasons.sql');
 assert.match(sql,/sc_team_campaign_purchasing/);
 assert.match(sql,/l.woo_line_item_id=i.woocommerce_line_item_id/);
 assert.match(sql,/o.payment_received_at is not null/);
 assert.match(sql,/join source_item_ids s on s.id=i.id/);
 assert.doesNotMatch(sql,/update public\.(?:inventory|jobs|job_items)/i);
 assert.match(sql,/scs_guard_published_wp_details/);
});
test('coordinator links are server-generated, hashed, revocable, expire, and expose only aggregate metrics',()=>{
 const code=read('../../netlify/functions/team-store-coordinator.js');
 assert.match(code,/randomBytes\(32\)/);
 assert.match(code,/createHash\('sha256'\)/);
 assert.match(code,/revoked_at/);
 assert.match(code,/90\*24\*3600/);
 assert.match(code,/new Set\(paid.map/);
 assert(!code.includes('contact_email'));
 const sql=read('../../supabase/migrations/202610220005_wp_client_stores_and_seasons.sql');
 assert.match(sql,/sc_team_coordinator_access enable row level security/);
 assert.match(sql,/revoke all on public.sc_team_coordinator_access from public,anon,authenticated/);
});
test('app offers logo palette, WP draft, season cloning, production and public coordinator routes',()=>{
 const d=read('../../src/StorefrontDesigner.jsx');
 const ops=read('../../src/TeamCampaignOperations.jsx');
 const app=read('../../src/App.jsx');
 assert.match(d,/extractLogoPalette/);assert.match(d,/Automatically create client category/);
 assert.match(d,/Create \/ refresh WordPress draft/);
 assert.match(ops,/sc_team_campaign_purchasing/);assert.match(ops,/team-store-coordinator/);
 assert.match(ops,/action:'clone'/);
 assert.match(app,/path="\/coordinator\/:token"/);
});

test('WordPress configuration accepts legacy secret name without requiring rotation',()=>{
 const keys=['SC_WP_USERNAME','SC_WP_APP_PASSWORD','SC_WP_APP_PASSWPRD','WOO_SITE_URL'];
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try {
  process.env.SC_WP_USERNAME='fixture'; process.env.WOO_SITE_URL='https://example.com';
  delete process.env.SC_WP_APP_PASSWORD; delete process.env.SC_WP_APP_PASSWPRD;
  assert.equal(wpStoreConfigured(),false);
  process.env.SC_WP_APP_PASSWPRD='fixture-password';
  assert.equal(wpStoreConfigured(),true);
  delete process.env.SC_WP_APP_PASSWPRD; process.env.SC_WP_APP_PASSWORD='fixture-password';
  assert.equal(wpStoreConfigured(),true);
 } finally { for(const k of keys) { if(before[k]===undefined)delete process.env[k]; else process.env[k]=before[k]; } }
});

test('draft rendering is restricted to authorized native previews and live campaigns cannot regenerate drafts',()=>{
 const php=read('../../wordpress/skilled-crafting-client-stores/skilled-crafting-client-stores.php');
 assert(php.includes("is_preview() && current_user_can('edit_post',$id)"));
 const site=read('../../netlify/functions/team-store-site.js');
 const draft=site.slice(site.indexOf("if(action==='draft')"),site.indexOf("if(action==='clone')"));
 assert(draft.indexOf('requireDraft(c)') < draft.indexOf("upsertWpStore(c,'draft')"));
});
