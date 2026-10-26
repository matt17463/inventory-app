"""Create a fresh, non-public WordPress fixture; never accepts an existing installation."""
from pathlib import Path
import hashlib, shutil, sys, urllib.request, zipfile
root=Path(__file__).resolve().parents[4]
out=Path(sys.argv[1]).resolve()
if out.exists(): raise SystemExit('Fixture path must not exist')
out.mkdir(parents=True)
archives=[('wordpress','https://wordpress.org/wordpress-7.1.3.zip',out),('woocommerce','https://downloads.wordpress.org/plugin/woocommerce.11.2.1.zip',out/'wordpress/wp-content/plugins'),('sqlite','https://downloads.wordpress.org/plugin/sqlite-database-integration.3.1.1.zip',out/'wordpress/wp-content/plugins')]
for name,url,target in archives:
    archive=out/(name+'.zip')
    urllib.request.urlretrieve(url,archive)
    with zipfile.ZipFile(archive) as z:
        if any('..' in Path(n).parts or Path(n).is_absolute() for n in z.namelist()): raise SystemExit('Unsafe archive')
        z.extractall(target)
    print(name,hashlib.sha256(archive.read_bytes()).hexdigest())
p=out/'wordpress'
shutil.copy(p/'wp-content/plugins/sqlite-database-integration/db.copy',p/'wp-content/db.php')
(p/'wp-content/mu-plugins').mkdir(exist_ok=True)
(p/'wp-config.php').write_text('''<?php
 define('DB_NAME','fictional_wordpress');define('DB_USER','fictional');define('DB_PASSWORD','local-only');define('DB_HOST','127.0.0.1');
 define('WP_HOME','http://127.0.0.1:4188');define('WP_SITEURL','http://127.0.0.1:4188');
 define('WP_ENVIRONMENT_TYPE','local');define('DISABLE_WP_CRON',true);define('WP_HTTP_BLOCK_EXTERNAL',true);define('AUTOMATIC_UPDATER_DISABLED',true);define('WP_AUTO_UPDATE_CORE',false);
 define('AUTH_KEY','noncustomer-local-key');define('SECURE_AUTH_KEY','noncustomer-local-secure');define('LOGGED_IN_KEY','noncustomer-local-login');define('NONCE_KEY','noncustomer-local-nonce');
 define('WP_DEBUG',true);define('WP_DEBUG_LOG',true);define('WP_DEBUG_DISPLAY',false);define('WP_MEMORY_LIMIT','512M');
 $table_prefix='scfictional_';if(!defined('ABSPATH'))define('ABSPATH',__DIR__.'/');require_once ABSPATH.'wp-settings.php';
''')
(p/'wp-content/mu-plugins/00-sc-isolation.php').write_text('''<?php
if(!defined('ABSPATH'))exit;
if(DB_NAME!=='fictional_wordpress'||WP_ENVIRONMENT_TYPE!=='local')wp_die('Wrong fixture');
add_filter('pre_wp_mail',static function(){return true;},PHP_INT_MAX);
add_filter('pre_http_request',static function(){return new WP_Error('local_only','External HTTP disabled');},PHP_INT_MAX);
add_filter('woocommerce_available_payment_gateways',static function(){return [];},PHP_INT_MAX);
add_filter('woocommerce_webhook_should_deliver','__return_false',PHP_INT_MAX);
add_filter('woocommerce_allow_tracking','__return_false',PHP_INT_MAX);
''')

for plugin in ['skilled-crafting-graphic-choices','skilled-crafting-mockup-variation-selector']:
 shutil.copytree(root/'wordpress'/plugin,p/'wp-content/plugins'/plugin)
for name in ['install-fixture.php','check-fixture.php','test-checkout.php']:
 shutil.copy(Path(__file__).parent/name,p/name)
print('Prepared local-only fixture',p)
