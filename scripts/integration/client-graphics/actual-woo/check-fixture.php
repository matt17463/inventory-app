<?php
$_SERVER['HTTP_HOST']='127.0.0.1:4188';$_SERVER['REQUEST_URI']='/';$_SERVER['SERVER_PROTOCOL']='HTTP/1.1';
require __DIR__.'/wp-load.php';
echo 'WP '.get_bloginfo('version').' WC '.(defined('WC_VERSION')?WC_VERSION:'absent').PHP_EOL;
echo 'Active '.json_encode(get_option('active_plugins')).PHP_EOL;
require_once ABSPATH.'wp-admin/includes/plugin.php';
$r=activate_plugin('skilled-crafting-graphic-choices/skilled-crafting-graphic-choices.php','','',true);if(is_wp_error($r))throw new Exception($r->get_error_message());
echo 'Graphics activated locally'.PHP_EOL;

WC_Install::install();echo 'Woo tables installed'.PHP_EOL;
