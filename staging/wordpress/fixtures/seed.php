<?php
// Fictional-only shop seed. No imports, emails, customers, real orders or payments.
if (!defined('ABSPATH')) exit;
if (get_option('sc_fictional_fixture_seeded')) {
    WP_CLI::log('Fixture already seeded; no changes made.');
    return;
}
if (DB_NAME !== 'fictional_wordpress' || !class_exists('WC_Product_Simple')) {
    WP_CLI::error('Refusing to seed: isolated DB or WooCommerce is unavailable.');
}
$fixtures = [
    ['name' => 'FICTIONAL School Spirit Hoodie', 'sku' => 'FIX-SCHOOL-HOODIE-M', 'price' => '199.99'],
    ['name' => 'FICTIONAL Team Polo', 'sku' => 'FIX-TEAM-POLO-L', 'price' => '200.00'],
    ['name' => 'FICTIONAL Workshop Coat', 'sku' => 'FIX-WORKSHOP-COAT-XL', 'price' => '200.01'],
    ['name' => 'FICTIONAL Blank Tee', 'sku' => 'FIX-TEE-BLACK-S', 'price' => '22.50'],
    ['name' => 'FICTIONAL Heavy Equipment Cover', 'sku' => 'FIX-HEAVY-001', 'price' => '58.00'],
];
foreach ($fixtures as $f) {
    $p = new WC_Product_Simple();
    $p->set_name($f['name']);
    $p->set_sku($f['sku']);
    $p->set_regular_price($f['price']);
    $p->set_status('publish');
    $p->set_catalog_visibility('visible');
    $p->set_manage_stock(false);
    $p->set_description('Fictional data for isolated staging. Not for sale.');
    $p->save();
    WP_CLI::log('Created fictional product '. $p->get_id());
}
$classes = [
    ['slug'=>'fictional-clothing','name'=>'Fictional Clothing'],
    ['slug'=>'fictional-team-distribution','name'=>'Fictional Team Distribution'],
    ['slug'=>'fictional-heavy','name'=>'Fictional Heavy'],
];
foreach ($classes as $c) {
    if (!term_exists($c['slug'], 'product_shipping_class')) {
        wp_insert_term($c['name'], 'product_shipping_class', ['slug'=>$c['slug']]);
    }
}
$zone = new WC_Shipping_Zone();
$zone->set_zone_name('FICTIONAL WA ZIP Fixture');
$zone->set_zone_order(1);
$zone->save();
$zone->add_location('98366','postcode');
$free_id = $zone->add_shipping_method('free_shipping');
update_option('woocommerce_free_shipping_'.$free_id.'_settings', [
    'title'=>'Fictional threshold shipping',
    'enabled'=>'yes',
    'requires'=>'min_amount',
    'min_amount'=>'200',
    'ignore_discounts'=>'no',
]);
$flat_id = $zone->add_shipping_method('flat_rate');
update_option('woocommerce_flat_rate_'.$flat_id.'_settings', [
    'title'=>'Fictional flat rate',
    'enabled'=>'yes',
    'cost'=>'8.50',
    'tax_status'=>'taxable',
    'type'=>'class',
]);
update_option('woocommerce_currency','USD');
update_option('woocommerce_default_country','US:WA');
update_option('woocommerce_store_address','NOT A REAL ADDRESS');
update_option('woocommerce_store_city','Fictional City');
update_option('woocommerce_store_postcode','98366');
update_option('blog_public', '0');
update_option('sc_fictional_fixture_seeded','2026-10-22');
WP_CLI::success('Fictional staging products and shipping fixtures seeded. No orders/customers/payments were created.');
