<?php
/**
 * Plugin Name: Skilled Crafting Graphic Choices
 * Description: Optional product-level graphic selection bridge. Disabled until store-by-store verification.
 * Version: 0.2.0
 */
defined('ABSPATH') || exit;
const SC_GRAPHICS_OPTION = 'sc_graphics_selector_enabled';
function sc_graphics_enabled() { return get_option(SC_GRAPHICS_OPTION, 'no') === 'yes'; }
function sc_graphics_options_for_product($product_id, $variation_id = 0) {
  // Options are configured on the parent variable product, not each SKU variation.
  $parent_id = (int)$product_id;
  if ($variation_id && function_exists('wp_get_post_parent_id')) {
    $resolved_parent = (int)wp_get_post_parent_id((int)$variation_id);
    if ($resolved_parent > 0) $parent_id = $resolved_parent;
  }
  return sc_graphics_config($parent_id);
}
function sc_graphics_config($product_id) {
  $rows = get_post_meta($product_id, '_sc_graphic_options', true);
  if (!is_array($rows)) return [];
  $out = [];
  foreach($rows as $row) {
    $id = isset($row['id']) ? sanitize_text_field($row['id']) : '';
    if(!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i',$id))continue;
    if(empty($row['label']))continue;
    $out[$id] = ['id'=>$id,'label'=>sanitize_text_field($row['label'])];
  }
  return array_values($out);
}
add_action('woocommerce_before_add_to_cart_button', function () {
 if (!sc_graphics_enabled() || !is_product())return;
 global $product;
 $opts=sc_graphics_config($product->get_id());
 if(count($opts)<2)return;
 echo '<div class="sc-graphic-selector"><label for="sc_graphic_family_id">Choose graphic</label><select id="sc_graphic_family_id" name="sc_graphic_family_id" required><option value="">Choose a design</option>';
 foreach($opts as $option)echo '<option value="'.esc_attr($option['id']).'">'.esc_html($option['label']).'</option>';
 echo '</select></div>';
});
add_filter('woocommerce_add_to_cart_validation', function($valid,$product_id,$quantity=1,$variation_id=0) {
 if(!sc_graphics_enabled())return $valid;
 $opts=sc_graphics_options_for_product($product_id, $variation_id);
 if(count($opts)<2)return $valid;
 $selected=isset($_POST['sc_graphic_family_id'])?sanitize_text_field(wp_unslash($_POST['sc_graphic_family_id'])):'';
 if(!in_array($selected,array_column($opts,'id'),true)){
  wc_add_notice(__('Please choose an available graphic.','skilledcrafting'),'error');return false;
 }
 return $valid;
},10,4);
add_filter('woocommerce_add_cart_item_data',function($data,$product_id,$variation_id=0){
 if(!sc_graphics_enabled())return $data;
 $opts=sc_graphics_options_for_product($product_id,$variation_id);
 if(!$opts)return $data;
 $selected=isset($_POST['sc_graphic_family_id'])?sanitize_text_field(wp_unslash($_POST['sc_graphic_family_id'])):'';
 if(count($opts)===1)$selected=$opts[0]['id'];
 if(count($opts)>1 && !in_array($selected,array_column($opts,'id'),true))return $data;
 foreach($opts as $row)if($row['id']===$selected){$data['sc_graphic_family_id']=$row['id'];$data['sc_graphic_label']=$row['label'];break;}
 return $data;
},10,3);
add_filter('woocommerce_get_item_data',function($items,$cart_item){
 if(!empty($cart_item['sc_graphic_label']))$items[]=['key'=>__('Graphic design','skilledcrafting'),'value'=>wc_clean($cart_item['sc_graphic_label'])];
 return $items;
},10,2);
add_action('woocommerce_checkout_create_order_line_item',function($item,$cart_item_key,$values){
 if(empty($values['sc_graphic_family_id']))return;
 $item->add_meta_data('_sc_graphic_family_id',sanitize_text_field($values['sc_graphic_family_id']),true);
 $item->add_meta_data('_sc_graphic_label',sanitize_text_field($values['sc_graphic_label']??''),true);
},10,3);

// The Woo Store API may submit a server-verified graphic ID as an explicit
// request parameter. Never trust the client-supplied label or a free-text name.
add_filter('woocommerce_store_api_add_to_cart_data',function($cart_data,$request){
 if(!sc_graphics_enabled())return $cart_data;
 $product_id=(int)($request['id']??0);
 $variation_id=0;
 if(function_exists('wp_get_post_parent_id')){
  $parent_id=(int)wp_get_post_parent_id($product_id);
  if($parent_id>0){$variation_id=$product_id;$product_id=$parent_id;}
 }
 $opts=sc_graphics_options_for_product($product_id,$variation_id);
 if(!$opts)return $cart_data;
 $selected=sanitize_text_field((string)($request['sc_graphic_family_id']??''));
 if(count($opts)===1)$selected=$opts[0]['id'];
 foreach($opts as $row){
  if($row['id']!==$selected)continue;
  $cart_data['cart_item_data']['sc_graphic_family_id']=$row['id'];
  $cart_data['cart_item_data']['sc_graphic_label']=$row['label'];
  break;
 }
 return $cart_data;
},10,2);
// Store API / Blocks requests do not submit the classic product-form selector.
// The Store API requires a verified ID and still needs a supported Blocks UI,
// reject managed multi-choice products rather than silently dropping customer art.
add_action('woocommerce_store_api_validate_add_to_cart',function($product,$request){
 if(!sc_graphics_enabled() || !is_object($product) || !method_exists($product,'get_id'))return;
 $id=(int)$product->get_id();
 $parent=method_exists($product,'get_parent_id')?(int)$product->get_parent_id():0;
 $options=sc_graphics_config($parent>0?$parent:$id);
 if(count($options)>1){
  $selected=sanitize_text_field((string)($request['sc_graphic_family_id']??''));
  if(!in_array($selected,array_column($options,'id'),true))
   throw new Exception(__('Please select an available graphic design.','skilledcrafting'));
 }
},10,2);
// Activation deliberately never flips SC_GRAPHICS_OPTION.
// Product graphic options must be populated only after explicit reconciliation.
