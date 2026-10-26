<?php
 define('WP_INSTALLING',true);$_SERVER['HTTP_HOST']='127.0.0.1:4188';$_SERVER['REQUEST_URI']='/';$_SERVER['SERVER_PROTOCOL']='HTTP/1.1';
 require __DIR__.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/upgrade.php';
 if(!is_blog_installed()){wp_install('NONCUSTOMER ISOLATED WOO','fictional_admin','admin@example.invalid',false,'','local-noncustomer-strong-test-only');echo "WordPress installed locally\n";}
 require_once ABSPATH.'wp-admin/includes/plugin.php';
 $r=activate_plugin('woocommerce/woocommerce.php','','',true);if(is_wp_error($r))throw new Exception($r->get_error_message());
 update_option('blog_public',0);update_option('woocommerce_enable_guest_checkout','yes');update_option('woocommerce_calc_taxes','no');
 echo "Woo activation complete\n";
