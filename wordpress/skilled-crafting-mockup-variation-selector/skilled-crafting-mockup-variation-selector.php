<?php
/**
 * Plugin Name: Skilled Crafting Mockup Variation Selector
 * Description: Provides dependent Color → Size → Logo selectors for variable products exported by Skilled Crafting Mockup Studio.
 * Version: 1.1.0
 * Author: Skilled Crafting
 * Requires Plugins: woocommerce
 * Text Domain: sc-mockup-variation-selector
 */
if (!defined('ABSPATH')) { exit; }
define('SC_MOCKUP_VARIATION_SELECTOR_VERSION', '1.1.0');
function sc_mockup_selector_is_supported_product($product) {
 return class_exists('WC_Product_Variable') && $product instanceof WC_Product_Variable
  && '' !== (string) $product->get_meta('_sc_mockup_project_id', true);
}
function sc_mockup_selector_ajax_variation_threshold($threshold, $product) {
 if (!sc_mockup_selector_is_supported_product($product)) return $threshold;
 $variation_count=count($product->get_children());
 if ($variation_count<1) return $threshold;
 return max((int)$threshold,min(500,$variation_count));
}
add_filter('woocommerce_ajax_variation_threshold','sc_mockup_selector_ajax_variation_threshold',10,2);
function sc_mockup_selector_enqueue_assets() {
 if (!function_exists('is_product') || !function_exists('wc_get_product') || !is_product()) return;
 $product=wc_get_product(get_queried_object_id());
 if (!sc_mockup_selector_is_supported_product($product)) return;
 wp_enqueue_script('wc-add-to-cart-variation');
 wp_enqueue_script('sc-mockup-variation-selector',plugin_dir_url(__FILE__).'assets/mockup-variation-selector.js',array('jquery','wc-add-to-cart-variation'),SC_MOCKUP_VARIATION_SELECTOR_VERSION,true);
}
add_action('wp_enqueue_scripts','sc_mockup_selector_enqueue_assets',30);

// Canonical graphics bridge. All production behavior stays inert until explicit opt-in.
function sc_mockup_graphics_bridge_enabled($product_id) {
 return function_exists('sc_graphics_enabled') && sc_graphics_enabled()
  && get_post_meta($product_id,'_sc_graphic_external_selector',true)==='yes'
  && sc_mockup_selector_is_supported_product(wc_get_product($product_id));
}
function sc_mockup_graphic_for_variation($product_id,$variation_id) {
 if(!sc_mockup_graphics_bridge_enabled($product_id))return null;
 $variation=wc_get_product($variation_id);
 if(!$variation || !$variation->is_type('variation') || (int)$variation->get_parent_id()!==(int)$product_id)return null;
 // Exact variation ID metadata is configured only after manager reconciliation.
 // Never derive a family from a logo label, SKU, file name, or attribute slug.
 $family=(string)$variation->get_meta('_sc_graphic_family_id',true);
 foreach(sc_graphics_options_for_product($product_id,$variation_id) as $option)
  if($option['id']===$family)return $option;
 return null;
}
add_filter('woocommerce_available_variation',function($data,$product,$variation){
 if(!sc_mockup_graphics_bridge_enabled($product->get_id()))return $data;
 $graphic=sc_mockup_graphic_for_variation($product->get_id(),$variation->get_id());
 $data['sc_graphic_bridge_enabled']=true;
 $data['sc_graphic_family_id']=$graphic?$graphic['id']:'';
 return $data;
},10,3);
add_filter('woocommerce_add_to_cart_validation',function($valid,$product_id,$quantity=1,$variation_id=0,$attributes=[],$cart_data=[]){
 $product=wc_get_product($product_id);
 if($product && $product->is_type('variation')){$variation_id=$product_id;$product_id=$product->get_parent_id();}
 if(!sc_mockup_graphics_bridge_enabled($product_id))return $valid;
 $expected=sc_mockup_graphic_for_variation($product_id,$variation_id);
 $submitted=isset($_POST['sc_graphic_family_id'])?sanitize_text_field(wp_unslash($_POST['sc_graphic_family_id'])):($cart_data['sc_graphic_family_id']??'');
 if(!$expected || $submitted!==$expected['id']){
  wc_add_notice(__('Please select a verified logo for this exact garment variation.','sc-mockup-variation-selector'),'error');return false;
 }
 return $valid;
},5,6);
