<?php
/**
 * Plugin Name: Skilled Crafting Client Storefronts
 * Description: Branded WooCommerce category-only client stores, site-native landing pages and coordinated checkout.
 * Version: 0.1.0
 * Requires Plugins: woocommerce
 * Text Domain: skilled-crafting-stores
 */
if (!defined('ABSPATH')) exit;

add_action('init', function () {
    register_post_type('sc_client_store', [
        'labels' => ['name'=>'Client Storefronts', 'singular_name'=>'Client Storefront'],
        'public'=>true, 'publicly_queryable'=>true, 'has_archive'=>false, 'show_ui'=>true,
        'show_in_rest'=>false, 'supports'=>['title','editor','thumbnail'],
        'rewrite'=>['slug'=>'stores','with_front'=>false], 'menu_icon'=>'dashicons-store',
        'exclude_from_search'=>true,
    ]);
});
register_activation_hook(__FILE__, function () {
    register_post_type('sc_client_store', ['public'=>true,'rewrite'=>['slug'=>'stores','with_front'=>false]]);
    flush_rewrite_rules();
});
register_deactivation_hook(__FILE__, 'flush_rewrite_rules');

function scs_read($id, $key, $default = '') {
    $value = get_post_meta($id, 'scs_'.$key, true);
    return $value === '' ? $default : $value;
}
function scs_color($value, $fallback) {
    $value = sanitize_hex_color($value);
    return $value ?: $fallback;
}
function scs_template($value) {
    return in_array($value,['athletics','scholastic','business','fundraising'],true) ? $value : 'athletics';
}
function scs_text($v) { return sanitize_text_field((string)$v); }
function scs_category($id) {
    $term = get_term((int)$id,'product_cat');
    return $term && !is_wp_error($term) ? $term : null;
}
function scs_product_in_category($product_id,$category_id) {
    $cats=wp_get_post_terms((int)$product_id,'product_cat',['fields'=>'ids']);
    if (is_wp_error($cats)) return false;
    foreach ($cats as $child) {
        if ((int)$child===(int)$category_id || term_is_ancestor_of((int)$category_id,(int)$child,'product_cat')) return true;
    }
    return false;
}
function scs_products($category_id, $limit=24) {
    if (!class_exists('WooCommerce')) return '<p>WooCommerce is unavailable.</p>';
    $q = new WP_Query([
        'post_type'=>'product','post_status'=>'publish','posts_per_page'=>min(60,max(1,$limit)),
        'tax_query'=>[[ 'taxonomy'=>'product_cat', 'field'=>'term_id', 'terms'=>[(int)$category_id], 'include_children'=>true ]],
        'orderby'=>'menu_order title','order'=>'ASC',
    ]);
    ob_start();
    echo '<div class="scs-products">';
    while ($q->have_posts()) {
        $q->the_post();
        $product=wc_get_product(get_the_ID());
        if (!$product || !$product->is_visible()) continue;
        echo '<article class="scs-product">';
        echo '<a href="'.esc_url(add_query_arg('scs_store',get_post_field('post_name',get_queried_object_id()),get_permalink())).'" class="scs-product-thumb">';
        echo get_the_post_thumbnail(get_the_ID(),'woocommerce_thumbnail',['loading'=>'lazy']);
        echo '</a><div class="scs-product-body"><h3>'.esc_html(get_the_title()).'</h3>';
        echo '<p class="scs-price">'.wp_kses_post($product->get_price_html()).'</p>';
        echo '<a class="scs-button" href="'.esc_url(add_query_arg('scs_store',get_post_field('post_name',get_queried_object_id()),get_permalink())).'">Select options &amp; shop</a></div></article>';
    }
    wp_reset_postdata();
    echo '</div>';
    return ob_get_clean();
}
function scs_store_markup($id) {
    $post=get_post($id);
    if (!$post || $post->post_type!=='sc_client_store' || $post->post_status!=='publish') return '';
    $category=scs_category((int)scs_read($id,'category_id',0));
    if (!$category) return '<p>This store is being configured.</p>';
    $theme=scs_template(scs_read($id,'template'));
    $logo=wp_get_attachment_image((int)scs_read($id,'logo_media_id',0),'medium',false,['class'=>'scs-logo']);
    $primary=scs_color(scs_read($id,'primary'),'#16443b');
    $secondary=scs_color(scs_read($id,'secondary'),'#f0b83a');
    $accent=scs_color(scs_read($id,'accent'),'#f6f9fb');
    $organization=scs_read($id,'organization',$post->post_title);
    $headline=scs_read($id,'headline',$post->post_title);
    $intro=scs_read($id,'description');
    $instructions=scs_read($id,'instructions','Select an item, choose your options, and finish checkout securely on Skilled Crafting.');
    $delivery=scs_read($id,'delivery','Delivery and pickup choices are confirmed at checkout.');
    $deadline=scs_read($id,'deadline');
    $style='--scs-primary:'.esc_attr($primary).';--scs-secondary:'.esc_attr($secondary).';--scs-accent:'.esc_attr($accent).';';
    $cart_url=wc_get_cart_url();
    ob_start();
    echo '<main class="scs-store scs-'.esc_attr($theme).'" style="'.esc_attr($style).'">';
    echo '<div class="scs-store-nav"><a href="'.esc_url(home_url('/')).'">Skilled Crafting</a><span>'.esc_html($organization).'</span><a href="'.esc_url($cart_url).'">Cart &amp; checkout →</a></div>';
    $badge=$logo ?: '<span class="scs-logo-fallback">'.esc_html(mb_substr($organization,0,1)).'</span>';
    if ($theme==='athletics') {
        echo '<header class="scs-hero scs-athletics-hero"><div class="scs-scoreboard"><span>OFFICIAL GEAR</span><span>TEAM STORE</span></div>';
        echo '<div class="scs-hero-core">'.$badge.'<div><p class="scs-kicker">'.esc_html($organization).' • Spirit wear</p><h1>'.esc_html($headline).'</h1><p>'.esc_html($intro).'</p><a class="scs-button" href="#scs-shop">Shop team gear ↓</a></div></div></header>';
        echo '<div class="scs-ribbon"><strong>Show your colors</strong><span>Official gear, made for your community</span></div>';
    } elseif ($theme==='scholastic') {
        echo '<header class="scs-hero scs-scholastic-hero"><div class="scs-school-overline">THE SPIRIT SHOP • '.esc_html($organization).'</div>'.$badge;
        echo '<h1>'.esc_html($headline).'</h1><p>'.esc_html($intro).'</p><a class="scs-button" href="#scs-shop">Browse school collection ↓</a></header>';
        echo '<div class="scs-school-band"><span>Learn</span><span>Belong</span><span>Represent</span></div>';
    } elseif ($theme==='business') {
        echo '<header class="scs-hero scs-business-hero"><div><p class="scs-kicker">Branded merchandise • '.esc_html($organization).'</p><h1>'.esc_html($headline).'</h1><p>'.esc_html($intro).'</p><a class="scs-button" href="#scs-shop">Explore approved collection →</a></div>';
        echo '<div class="scs-business-seal">'.$badge.'<span>PROFESSIONAL GEAR</span></div></header>';
    } else {
        echo '<header class="scs-hero scs-fundraiser-hero"><div class="scs-fundraiser-mark">'.$badge.'</div><div><p class="scs-kicker">Wear it forward • '.esc_html($organization).'</p><h1>'.esc_html($headline).'</h1><p>'.esc_html($intro).'</p><a class="scs-button" href="#scs-shop">Support the campaign ↓</a></div></header>';
        echo '<div class="scs-impact"><strong>Every order matters</strong><span>Fundraiser details and eligible purchases are confirmed by the organization.</span></div>';
    }
    echo '<div class="scs-store-inner">';
    if ($theme==='business') echo '<section class="scs-steps scs-business-steps"><div><b>01</b> Browse approved goods</div><div><b>02</b> Choose options</div><div><b>03</b> Secure WooCommerce checkout</div></section>';
    echo '<section class="scs-shop" id="scs-shop"><div class="scs-section-heading"><p>PRODUCT COLLECTION</p><h2>'.esc_html($category->name).'</h2><p>Only items in this organization’s approved product category are presented here.</p></div>';
    echo scs_products($category->term_id);echo '</section>';
    echo '<section class="scs-details"><div><h2>How to order</h2><p>'.nl2br(esc_html($instructions)).'</p></div>';
    echo '<div><h2>Delivery &amp; pickup</h2><p>'.nl2br(esc_html($delivery)).'</p>';
    if ($deadline) echo '<p class="scs-deadline"><strong>Ordering deadline:</strong> '.esc_html($deadline).'</p>';
    echo '</div></section>';
    echo '<footer class="scs-store-footer"><span>'.esc_html($organization).'</span><a href="'.esc_url(wc_get_cart_url()).'">View cart →</a></footer></div></main>';
    return ob_get_clean();
}
add_filter('the_content',function($content){
    if (is_singular('sc_client_store') && in_the_loop() && is_main_query()) return scs_store_markup(get_the_ID());
    return $content;
}, 20);

add_action('template_redirect',function(){
    if (!function_exists('WC') || !WC()->session) return;
    $id=is_singular('sc_client_store') ? get_queried_object_id() : 0;
    if (!$id && function_exists('is_product') && is_product() && isset($_GET['scs_store'])) {
        $slug=sanitize_title(wp_unslash($_GET['scs_store']));
        $candidate=get_page_by_path($slug,OBJECT,'sc_client_store');
        if ($candidate && $candidate->post_status==='publish'
            && scs_product_in_category(get_queried_object_id(),(int)scs_read($candidate->ID,'category_id',0))) {
            $id=$candidate->ID;
        }
    }
    if (!$id || get_post_status($id)!=='publish') return;
    WC()->session->set('scs_store_id',(int)$id);
    if (method_exists(WC()->session,'set_customer_session_cookie')) WC()->session->set_customer_session_cookie(true);
});
function scs_cart_store() {
    if (!function_exists('WC') || !WC()->session || !WC()->cart) return null;
    $id=(int)WC()->session->get('scs_store_id');
    if (!$id || get_post_status($id)!=='publish') return null;
    $category=(int)scs_read($id,'category_id',0);
    if (!$category) return null;
    foreach (WC()->cart->get_cart() as $cart_item) {
        if (!scs_product_in_category($cart_item['product_id'],$category)) {
            return null; // Mixed cart is deliberately neutral, not misbranded.
        }
    }
    return $id;
}
add_filter('body_class',function($classes){
    if (is_singular('sc_client_store')) $classes[]='scs-wp-storefront';
    if ((is_checkout() || is_cart()) && scs_cart_store()) $classes[]='scs-client-checkout';
    return $classes;
});
add_action('woocommerce_before_checkout_form',function(){
    $id=scs_cart_store();
    if ($id) echo '<div class="scs-checkout-banner"><strong>'.esc_html(scs_read($id,'organization',get_the_title($id))).' checkout</strong><span>'.esc_html(scs_read($id,'delivery','Shipping and pickup confirmed below.')).'</span></div>';
},5);
add_filter('the_content',function($content){
    if (function_exists('is_checkout') && is_checkout() && is_main_query() && in_the_loop()
        && function_exists('has_block') && has_block('woocommerce/checkout',get_the_ID())) {
        $id=scs_cart_store();
        if ($id) {
            $banner='<div class="scs-checkout-banner"><strong>'.
              esc_html(scs_read($id,'organization',get_the_title($id))).' checkout</strong><span>'.
              esc_html(scs_read($id,'delivery','Shipping and pickup confirmed below.')).'</span></div>';
            return $banner.$content;
        }
    }
    return $content;
},21);
add_shortcode('sc_client_storefront',function(){return is_singular('sc_client_store')?scs_store_markup(get_the_ID()):'';});
add_shortcode('sc_client_store_directory',function(){
    $pages=get_posts(['post_type'=>'sc_client_store','post_status'=>'publish','numberposts'=>100,'orderby'=>'title','order'=>'ASC']);
    if (!$pages) return '<p>New team stores are being prepared. Please check back soon.</p>';
    $html='<div class="scs-directory"><h2>Find Your Store</h2><p>Choose your organization to browse its approved merchandise.</p><div class="scs-directory-grid">';
    foreach ($pages as $page) {
        $logo=wp_get_attachment_image((int)scs_read($page->ID,'logo_media_id',0),'thumbnail');
        $html.='<a class="scs-directory-item" href="'.esc_url(get_permalink($page->ID)).'">'.$logo.
          '<strong>'.esc_html(scs_read($page->ID,'organization',$page->post_title)).'</strong>'.
          '<span>Open storefront →</span></a>';
    }
    return $html.'</div></div>';
});
add_action('wp_enqueue_scripts',function(){
    $directory=is_page() && get_post() && has_shortcode(get_post()->post_content,'sc_client_store_directory');
    if (!is_singular('sc_client_store') && !is_cart() && !is_checkout() && !$directory) return;
    wp_enqueue_style('scs-client-stores',plugins_url('assets/storefront.css',__FILE__),[], '0.1.0');
    if (is_cart() || is_checkout()) {
        $id=scs_cart_store();if (!$id)return;
        $p=scs_color(scs_read($id,'primary'),'#16443b');
        $s=scs_color(scs_read($id,'secondary'),'#f0b83a');
        wp_add_inline_style('scs-client-stores',
            'body.scs-client-checkout{--scs-primary:'.esc_html($p).';--scs-secondary:'.esc_html($s).';}');
    }
});

add_action('rest_api_init',function(){
    register_rest_route('skilled-crafting/v1','/client-store',[
        'methods'=>WP_REST_Server::CREATABLE,
        'permission_callback'=>function(){return current_user_can('manage_woocommerce') && current_user_can('edit_pages');},
        'callback'=>function(WP_REST_Request $request){
            $r=$request->get_json_params();
            if (!is_array($r)) return new WP_Error('invalid_body','JSON payload required',['status'=>400]);
            $campaign=scs_text($r['campaign_id']??'');
            if (!preg_match('/^[0-9a-f-]{36}$/i',$campaign)) return new WP_Error('invalid_campaign','Campaign UUID required',['status'=>400]);
            $category=(int)($r['category_id']??0);
            if (!scs_category($category)) return new WP_Error('invalid_category','Existing WooCommerce product category is required',['status'=>400]);
            $title=scs_text($r['name']??'');
            if (!$title || strlen($title)>150) return new WP_Error('invalid_title','Store name required',['status'=>400]);
            $status=($r['status']??'draft')==='publish'?'publish':'draft';
            $logo=(int)($r['logo_media_id']??0);
            if ($logo && !wp_attachment_is_image($logo)) return new WP_Error('invalid_logo','Logo must be a WordPress image attachment',['status'=>400]);
            $existing=get_posts(['post_type'=>'sc_client_store','post_status'=>'any','meta_key'=>'scs_campaign_id',
                'meta_value'=>$campaign,'posts_per_page'=>1,'fields'=>'ids']);
            $slug=sanitize_title($r['slug']??$title);
            if (!preg_match('/^[a-z0-9][a-z0-9-]{2,59}$/',$slug)) return new WP_Error('invalid_slug','Invalid store slug',['status'=>400]);
            $data=['post_type'=>'sc_client_store','post_title'=>$title,'post_name'=>$slug,
                   'post_status'=>$status,'post_content'=>'[sc_client_storefront]'];
            if ($existing) $data['ID']=(int)$existing[0];
            $id=wp_insert_post(wp_slash($data),true);
            if (is_wp_error($id))return $id;
            $map=[
                'campaign_id'=>$campaign,'category_id'=>$category,'organization'=>scs_text($r['organization']??$title),
                'headline'=>scs_text($r['headline']??$title),'description'=>sanitize_textarea_field($r['description']??''),
                'instructions'=>sanitize_textarea_field($r['instructions']??''),
                'delivery'=>sanitize_textarea_field($r['delivery']??''),
                'deadline'=>scs_text($r['deadline']??''),
                'template'=>scs_template($r['template']??'athletics'),
                'primary'=>scs_color($r['primary']??'','#16443b'),
                'secondary'=>scs_color($r['secondary']??'','#f0b83a'),
                'accent'=>scs_color($r['accent']??'','#f6f9fb'),
                'logo_media_id'=>$logo,
            ];
            foreach ($map as $key=>$value)update_post_meta($id,'scs_'.$key,$value);
            return rest_ensure_response(['success'=>true,'post_id'=>$id,'status'=>get_post_status($id),'url'=>get_permalink($id),'category_id'=>$category]);
        },
    ]);
});
