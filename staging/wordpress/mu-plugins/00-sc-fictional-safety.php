<?php
/**
 * Plugin Name: Skilled Crafting Fictional Staging Guard
 * Description: Safety boundaries for ONLY the isolated local testing fixture.
 * Version: 1.0.0
 */
if (!defined('ABSPATH')) exit;

// Fail closed if this MU plugin was accidentally copied outside the fictional fixture.
if (defined('DB_NAME') && DB_NAME !== 'fictional_wordpress') {
    wp_die('Fictional staging guard was installed on an unexpected database. Remove the staging plugin from that environment.', 'Wrong staging environment', ['response' => 503]);
}
add_filter('pre_wp_mail', static function ($short_circuit) {
    // Report simulated acceptance, but never transmit email.
    return true;
}, PHP_INT_MAX, 1);
add_filter('pre_http_request', static function ($preempt, $args, $url) {
    return new WP_Error('sc_staging_network_block', 'External HTTP requests are disabled in the isolated fictional fixture.');
}, PHP_INT_MAX, 3);
add_filter('woocommerce_available_payment_gateways', static function ($gateways) {
    // Rate computation is allowed; payment/order completion is not.
    return [];
}, PHP_INT_MAX, 1);
add_filter('woocommerce_webhook_should_deliver', '__return_false', PHP_INT_MAX, 1);
add_filter('woocommerce_allow_tracking', '__return_no', PHP_INT_MAX, 1);
add_filter('pre_option_blog_public', static function () { return '0'; }, PHP_INT_MAX);
add_filter('pre_option_woocommerce_email_from_address', static function () {
    return 'noreply@example.invalid';
}, PHP_INT_MAX);
