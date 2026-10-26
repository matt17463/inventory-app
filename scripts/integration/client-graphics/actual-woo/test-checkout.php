<?php
$_SERVER['HTTP_HOST']='127.0.0.1:4188';$_SERVER['REQUEST_URI']='/';$_SERVER['SERVER_PROTOCOL']='HTTP/1.1';
require __DIR__.'/wp-load.php';
if(DB_NAME!=='fictional_wordpress'||WP_ENVIRONMENT_TYPE!=='local')throw new Exception('Wrong fixture');
function check($ok,$name){if(!$ok)throw new Exception('FAIL '.$name);echo 'PASS '.$name.PHP_EOL;}
function family($n){return sprintf('00000000-0000-4000-8000-%012d',$n);}
require_once ABSPATH.'wp-admin/includes/plugin.php';
activate_plugin('skilled-crafting-mockup-variation-selector/skilled-crafting-mockup-variation-selector.php','','',true);
// Explicitly require on the first activation request only.
if(!function_exists('sc_mockup_graphic_for_variation'))require WP_PLUGIN_DIR.'/skilled-crafting-mockup-variation-selector/skilled-crafting-mockup-variation-selector.php';
update_option('sc_graphics_selector_enabled','yes');
$p=new WC_Product_Variable();$p->set_name('NONCUSTOMER FICTIONAL Team Hoodie');$p->set_status('publish');$p->set_sku('NONCUSTOMER-'.uniqid());$p->set_manage_stock(false);$p->set_virtual(true);
$attrs=[];foreach(['Color'=>['Black','Blue'],'Size'=>['M','YM'],'Logo'=>['Home','Away','Third']] as $name=>$options){$a=new WC_Product_Attribute();$a->set_name($name);$a->set_options($options);$a->set_visible(true);$a->set_variation(true);$attrs[]=$a;}$p->set_attributes($attrs);$p->update_meta_data('_sc_mockup_project_id','NONCUSTOMER-ISOLATED');$p->update_meta_data('_sc_graphic_external_selector','yes');$p->update_meta_data('_sc_graphic_options',array_map(fn($n)=>['id'=>family($n),'label'=>'TRUSTED DESIGN '.$n],[20,21,22]));$pid=$p->save();
$variants=[];foreach(['Black','Blue'] as $color)foreach(['M','YM'] as $size)foreach(['Home','Away','Third'] as $i=>$logo){$v=new WC_Product_Variation();$v->set_parent_id($pid);$v->set_attributes(['color'=>$color,'size'=>$size,'logo'=>$logo]);$v->set_regular_price('1.00');$v->set_status('publish');$v->set_virtual(true);$v->set_manage_stock(false);$v->update_meta_data('_sc_graphic_family_id',family(20+$i));$v->save();$variants[$color.'-'.$size.'-'.$logo]=$v->get_id();}WC_Product_Variable::sync($pid);wc_delete_product_transients($pid);$p=wc_get_product($pid);
check(count($p->get_children())===12,'actual Woo variable product has two colors adult/youth sizes and three logos');
file_put_contents(__DIR__.'/actual-woo-variations.json',json_encode($p->get_available_variations()));
$vid=$variants['Black-M-Home'];$data=$p->get_available_variation($vid);check($data['sc_graphic_family_id']===family(20),'actual Woo variation data includes exact canonical UUID');
check(sc_mockup_graphic_for_variation($pid,$vid)['label']==='TRUSTED DESIGN 20','server label comes from parent allowlist');
$GLOBALS['wp_query']=new WP_Query(['p'=>$pid,'post_type'=>'product']);$GLOBALS['product']=$p;
ob_start();do_action('woocommerce_before_add_to_cart_button');$selector_output=ob_get_clean();check(strpos($selector_output,'sc-graphic-selector')===false,'external-selector marker suppresses duplicate chooser');
$other=new WC_Product_Variable();$other->set_name('NONCUSTOMER unrelated');$other_id=$other->save();
check(sc_mockup_graphic_for_variation($other_id,$vid)===null,'foreign parent cannot claim another product variation');
update_option('sc_graphics_selector_enabled','no');check(!sc_mockup_graphics_bridge_enabled($pid),'global disabled leaves bridge inert');update_option('sc_graphics_selector_enabled','yes');
update_post_meta($pid,'_sc_graphic_external_selector','no');check(!sc_mockup_graphics_bridge_enabled($pid),'unmarked product leaves bridge inert');update_post_meta($pid,'_sc_graphic_external_selector','yes');
WC()->initialize_session();WC()->initialize_cart();WC()->cart->empty_cart();
function localAdd($pid,$qty,$vid,$attributes,$extra=[]){
 $before=array_keys(WC()->cart->get_cart());
 $_POST=array_merge($_POST,$attributes,['add-to-cart'=>$pid,'quantity'=>$qty,'variation_id'=>$vid]);$_REQUEST=$_POST;
 $GLOBALS['fixture_personalization']=$extra['fixture_personalization']??[];
 WC_Form_Handler::add_to_cart_action(false);
 $keys=array_values(array_diff(array_keys(WC()->cart->get_cart()),$before));return $keys[0]??false;
}
update_option('woocommerce_cart_redirect_after_add','no');add_filter('woocommerce_add_to_cart_redirect','__return_false');
add_filter('woocommerce_add_cart_item_data',function($data){if($GLOBALS['fixture_personalization']??[])$data['fixture_personalization']=$GLOBALS['fixture_personalization'];return $data;},20);
$attributes=['attribute_color'=>'Black','attribute_size'=>'M','attribute_logo'=>'Home'];
$_POST=[];check(localAdd($pid,1,$vid,$attributes)===false,'actual Woo cart rejects missing UUID');wc_clear_notices();
$_POST=['sc_graphic_family_id'=>family(99)];check(localAdd($pid,1,$vid,$attributes)===false,'actual Woo cart rejects unknown UUID');wc_clear_notices();
$_POST=['sc_graphic_family_id'=>family(21)];check(localAdd($pid,1,$vid,$attributes)===false,'actual Woo cart rejects another allowed UUID for wrong variation');wc_clear_notices();
$_POST=['sc_graphic_family_id'=>family(20),'sc_graphic_label'=>'FORGED'];$key=localAdd($pid,1,$vid,$attributes,['fixture_personalization'=>['Player name'=>'NONCUSTOMER Alex','Player number'=>'7']]);check((bool)$key,'actual Woo cart accepts mapped variation');
$vid2=$variants['Blue-YM-Away'];$_POST=['sc_graphic_family_id'=>family(21)];$key2=localAdd($pid,1,$vid2,['attribute_color'=>'Blue','attribute_size'=>'YM','attribute_logo'=>'Away'],['fixture_personalization'=>['Student name'=>'NONCUSTOMER Casey','Teacher'=>'Fictional Teacher']]);check((bool)$key2&&$key!==$key2,'different variation and graphic remain separate actual cart lines');
$cart=WC()->cart->get_cart();check($cart[$key]['sc_graphic_label']==='TRUSTED DESIGN 20'&&$cart[$key2]['sc_graphic_family_id']===family(21),'cart preserves trusted per-line UUID and label');check($cart[$key]['fixture_personalization']['Player number']==='7','graphics bridge preserves unrelated personalization cart data');
add_action('woocommerce_checkout_create_order_line_item',function($item,$key,$values){foreach($values['fixture_personalization']??[] as $name=>$value)$item->add_meta_data($name,$value,true);$item->add_meta_data('placement','full_front',true);},20,3);
WC()->cart->calculate_totals();
$posted=['billing_first_name'=>'NONCUSTOMER','billing_last_name'=>'Fixture','billing_email'=>'fixture@example.invalid','billing_country'=>'US','billing_state'=>'WA','billing_city'=>'Fictional','billing_address_1'=>'NONCUSTOMER TEST ONLY','billing_postcode'=>'98366','payment_method'=>'','shipping_method'=>[],'order_comments'=>'NONCUSTOMER LOCAL ISOLATED TEST'];
$oid=WC()->checkout()->create_order($posted);check(!is_wp_error($oid)&&$oid>0,'actual WC_Checkout creates isolated pending order without payment');$order=wc_get_order($oid);$items=array_values($order->get_items());check(count($items)===2,'actual saved Woo order contains exactly two product lines');check($items[0]->get_meta('_sc_graphic_family_id')===family(20)&&$items[1]->get_meta('_sc_graphic_family_id')===family(21),'saved order lines retain independent canonical IDs');check($items[0]->get_meta('_sc_graphic_label')==='TRUSTED DESIGN 20','saved order ignores forged label');check($items[0]->get_meta('Player number')==='7'&&$items[1]->get_meta('Teacher')==='Fictional Teacher','saved order retains independent personalization');
check($items[0]->get_variation_id()===$vid&&$items[1]->get_variation_id()===$vid2,'saved order retains exact variation identities');
$hook=new WC_Webhook();$hook->set_user_id(get_user_by('login','fictional_admin')->ID);$hook->set_topic('order.created');$hook->set_api_version('wp_api_v3');$payload=$hook->build_payload($oid);check(is_array($payload)&&count($payload['line_items'])===2,'actual Woo webhook builder produces both exact order lines');
file_put_contents(__DIR__.'/actual-woo-order.json',json_encode($payload,JSON_PRETTY_PRINT));$hook->set_secret('NONCUSTOMER-LOCAL-ONLY-SIGNING-SECRET-20261026');file_put_contents(__DIR__.'/actual-woo-delivery.json',json_encode(['body'=>wp_json_encode($payload),'signature'=>$hook->generate_signature(wp_json_encode($payload))]));file_put_contents(__DIR__.'/actual-woo-fixture.json',json_encode(['parent'=>$pid,'variations'=>$variants,'order'=>$oid,'line_ids'=>array_map(fn($i)=>$i->get_id(),$items)],JSON_PRETTY_PRINT));
check(get_option('sc_graphics_selector_enabled')==='yes','enablement confined to fictional local database');
echo 'LOCAL CHECKOUT COMPLETE; no payment, email, outbound webhook or production connection'.PHP_EOL;
