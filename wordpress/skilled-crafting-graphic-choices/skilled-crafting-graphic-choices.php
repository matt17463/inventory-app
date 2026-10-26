<?php
/**
 * Plugin Name: Skilled Crafting Graphic Choices
 * Description: Optional product-level graphic selection bridge. Disabled until store-by-store verification.
 * Version: 0.2.1
 */
defined('ABSPATH') || exit;
const SC_GRAPHICS_OPTION = 'sc_graphics_selector_enabled';
function sc_graphics_enabled() { return get_option(SC_GRAPHICS_OPTION, 'no') === 'yes'; }
function sc_graphics_options_for_product($product_id, $variation_id = 0) {
  // Options are configured on the parent variable product, not each SKU variation.
  $parent_id = (int)$product_id;
  if (function_exists('wp_get_post_parent_id')) {
    // Store API/cart clients sometimes provide the variation as the sole product ID.
    $resolved_parent = (int)wp_get_post_parent_id((int)($variation_id ?: $product_id));
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
 // When the existing Mockup Variation Selector owns the logo dropdown, never render a second selector.
 // Its adapter must submit the canonical sc_graphic_family_id from the verified parent options.
 if(get_post_meta($product->get_id(), '_sc_graphic_external_selector', true)==='yes')return;
 echo '<div class="sc-graphic-selector"><label for="sc_graphic_family_id">Choose graphic</label><select id="sc_graphic_family_id" name="sc_graphic_family_id" required><option value="">Choose a design</option>';
 foreach($opts as $option)echo '<option value="'.esc_attr($option['id']).'">'.esc_html($option['label']).'</option>';
 echo '</select></div>';
});
add_filter('woocommerce_add_to_cart_validation', function($valid,$product_id,$quantity=1,$variation_id=0,$variation=[],$cart_item_data=[]) {
 if(!sc_graphics_enabled())return $valid;
 $opts=sc_graphics_options_for_product($product_id, $variation_id);
 if(count($opts)<2)return $valid;
 $selected=isset($_POST['sc_graphic_family_id'])?sanitize_text_field(wp_unslash($_POST['sc_graphic_family_id'])):'';
 // Store API passes a separately validated cart_item_data array before its own validation action.
 // Never trust a matching browser-submitted label; compare the ID to server options.
 if(!$selected && isset($cart_item_data['sc_graphic_family_id']))
  $selected=sanitize_text_field($cart_item_data['sc_graphic_family_id']);
 if(!in_array($selected,array_column($opts,'id'),true)){
  wc_add_notice(__('Please choose an available graphic.','skilledcrafting'),'error');return false;
 }
 return $valid;
},10,6);
add_filter('woocommerce_add_cart_item_data',function($data,$product_id,$variation_id=0){
 if(!sc_graphics_enabled())return $data;
 $opts=sc_graphics_options_for_product($product_id,$variation_id);
 if(!$opts)return $data;
 if(!empty($data['sc_graphic_family_id'])) {
  foreach($opts as $row)if($row['id']===$data['sc_graphic_family_id']){
   // Retain only the canonical, configured label, never a submitted label.
   $data['sc_graphic_label']=$row['label'];
   return $data;
  }
  unset($data['sc_graphic_family_id'],$data['sc_graphic_label']);
 }
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
 // Recheck cart ID against the parent-product allowlist at checkout as a final defense.
 $product_id=method_exists($item,'get_product_id')?(int)$item->get_product_id():0;
 $variation_id=method_exists($item,'get_variation_id')?(int)$item->get_variation_id():0;
 $verified=null;
 foreach(sc_graphics_options_for_product($product_id,$variation_id) as $option)if($option['id']===$values['sc_graphic_family_id']){$verified=$option;break;}
 if(!$verified)return;
 $item->add_meta_data('_sc_graphic_family_id',$verified['id'],true);
 $item->add_meta_data('_sc_graphic_label',$verified['label'],true);
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

// Optional server-rendered graphic selector block for *simple* Woo products.
// Place it in the product template instead of the ordinary add-to-cart control.
// Variable products still use the verified classic form until the variation
// selector and Store API variant payload are validated end-to-end.
function sc_graphic_choices_render_block($attributes=[]) {
 if(!sc_graphics_enabled() || !function_exists('wc_get_product'))return '';
 $product_id=(int)($attributes['productId']??0);
 if(!$product_id && function_exists('get_the_ID'))$product_id=(int)get_the_ID();
 $product=wc_get_product($product_id);
 if(!$product || !method_exists($product,'is_type') || !$product->is_type('simple'))return '';
 $options=sc_graphics_config($product_id);
 if(count($options)<2 || !method_exists($product,'is_purchasable') || !$product->is_purchasable())return '';
 if(!function_exists('wp_create_nonce') || !function_exists('rest_url'))return '';
 wp_enqueue_script('sc-graphic-block',plugins_url('assets/graphic-block.js',__FILE__),[], '0.3.0',true);
 $nonce=wp_create_nonce('wc_store_api');
 $api=rest_url('wc/store/v1/cart/add-item');
 $html='<div data-sc-graphic-block data-product-id="'.esc_attr($product_id).'" data-store-nonce="'.esc_attr($nonce).'" data-api-url="'.esc_attr($api).'">';
 $html.='<label for="sc-graphic-choice-'.esc_attr($product_id).'">Graphic design</label>';
 $html.='<select required id="sc-graphic-choice-'.esc_attr($product_id).'" data-sc-graphic-choice><option value="">Choose a design</option>';
 foreach($options as $opt)$html.='<option value="'.esc_attr($opt['id']).'">'.esc_html($opt['label']).'</option>';
 $html.='</select><button type="button" data-sc-graphic-submit>Add selected design to cart</button>';
 $html.='<p data-sc-graphic-message role="status" aria-live="polite"></p></div>';
 return $html;
}
add_action('init',function(){
 if(!function_exists('register_block_type'))return;
 register_block_type('skilled-crafting/graphic-add-to-cart',[
  'api_version'=>3,
  'title'=>'Skilled Crafting Graphic Add to Cart',
  'category'=>'woocommerce',
  'attributes'=>['productId'=>['type'=>'integer','default'=>0]],
  'render_callback'=>'sc_graphic_choices_render_block',
 ]);
});
// Block is registered inert; rendering still checks sc_graphics_selector_enabled.
