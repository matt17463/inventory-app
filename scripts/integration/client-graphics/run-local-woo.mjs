import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'');
assert.equal((await readFile(join(root,'.sc-fictional-woo'),'utf8')).trim(),'Fresh noncustomer local WordPress fixture');
const wp=join(root,'wordpress');
const config=await readFile(join(wp,'wp-config.php'),'utf8');
assert(config.includes("define('DB_NAME','fictional_wordpress')")&&config.includes("define('WP_ENVIRONMENT_TYPE','local')"));
const isolation=await readFile(join(wp,'wp-content/mu-plugins/00-sc-isolation.php'),'utf8');
for(const guard of ['pre_wp_mail','pre_http_request','woocommerce_available_payment_gateways','woocommerce_webhook_should_deliver'])assert(isolation.includes(guard));
const php=resolve('scripts/integration/client-graphics/node_modules/.bin/php-wasm-cli');
for(const [file,marker] of [['install-fixture.php','Woo activation complete'],['check-fixture.php','Graphics activated locally'],['test-checkout.php','LOCAL CHECKOUT COMPLETE']]){
 const output=execFileSync(php,[join(wp,file)],{encoding:'utf8',timeout:120000});
 process.stdout.write(output);assert(output.includes(marker),'PHP must reach the acceptance marker; an exit code alone does not prove success.');
}
const pipeline=execFileSync(process.execPath,['--experimental-test-module-mocks','scripts/integration/client-graphics/verify-actual-woo-payload.mjs',wp],{encoding:'utf8',timeout:120000});
process.stdout.write(pipeline);assert(pipeline.includes('ACTUAL WOO PAYLOAD PIPELINE COMPLETE'));
