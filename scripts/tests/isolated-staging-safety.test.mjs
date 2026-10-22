import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const compose=read('../../staging/wordpress/compose.yaml');
const guard=read('../../staging/wordpress/mu-plugins/00-sc-fictional-safety.php');
const bootstrap=read('../../staging/wordpress/bootstrap.sh');
const seed=read('../../staging/wordpress/fixtures/seed.php');
test('staging container network is private and website listens on loopback only',()=>{
 assert.match(compose,/internal_only:\s*\n\s*internal: true/);
 assert.match(compose,/"127\.0\.0\.1:8088:80"/);
 assert.doesNotMatch(compose,/["']?(?:0\.0\.0\.0:|443:443|80:80)["']?/);
 assert.match(compose,/fictional_db:/);
 assert.match(compose,/fictional_wordpress/);
 assert.doesNotMatch(compose,/supabase\.co|skilledcrafting\.com|stripe.*secret|WC_CONSUMER_SECRET|SC_WP_APP_PASSWORD/i);
});
test('test fixture suppresses external HTTP, email, payment, Woo webhooks, scheduled jobs',()=>{
 assert.match(compose,/DISABLE_WP_CRON/);
 assert.match(compose,/WP_HTTP_BLOCK_EXTERNAL/);
 assert.match(guard,/pre_wp_mail/);
 assert.match(guard,/pre_http_request/);
 assert.match(guard,/woocommerce_available_payment_gateways/);
 assert.match(guard,/woocommerce_webhook_should_deliver/);
 assert.match(guard,/pre_option_blog_public/);
 assert.match(guard,/DB_NAME !== 'fictional_wordpress'/);
});
test('bootstrap generates local-only secrets and downloads Woo plugin before starting isolated containers',()=>{
 assert.match(bootstrap,/openssl rand -hex 24/);
 assert.match(bootstrap,/downloads\.wordpress\.org\/plugin\/woocommerce/);
 assert(bootstrap.indexOf('curl --fail')<bootstrap.indexOf('dc up -d db wordpress'));
 assert.match(bootstrap,/supabase/);
 assert.match(bootstrap,/wpcli/);
 assert.match(bootstrap,/test -ge|test "\$\(printf %s/);
 const shell=spawnSync('bash',['-n'],{input:bootstrap,encoding:'utf8'});
 assert.equal(shell.status,0,shell.stderr);
});
test('WordPress fixture is fictional and cannot seed production orders/customers',()=>{
 assert.match(seed,/DB_NAME !== 'fictional_wordpress'/);
 assert.match(seed,/sc_fictional_fixture_seeded/);
 assert.match(seed,/199\.99/);assert.match(seed,/200\.00/);assert.match(seed,/200\.01/);
 assert.match(seed,/WC_Product_Simple/);
 assert.doesNotMatch(seed,/wc_create_order|wp_insert_user|customer_email|skilledcrafting\.com/i);
 const ignore=read('../../staging/wordpress/.gitignore');
 assert.match(ignore,/\.env/);assert.match(ignore,/packages\//);
});
