<?php
// Execute the real plugin's cart rules against isolated WordPress/Woo fixtures.
define('ABSPATH',__DIR__);
define('OBJECT','OBJECT');
function add_action(...$args) {}
function add_filter($name,$fn,...$args) {global $filters;$filters[$name][]=$fn;}
function add_shortcode(...$args) {}
function register_activation_hook(...$args) {}
function register_deactivation_hook(...$args) {}
function is_product(){return true;}
function sanitize_title($v){return $v;}
function wp_unslash($v){return $v;}
function get_queried_object_id(){global $queried;return $queried;}
function get_page_by_path($slug,...$args){return get_post($slug==='fixture-live'?1:2);}
function get_post_field($field,$id){return $id===1?'fixture-live':'fixture-draft';}
function add_query_arg($key,$value,$url){return $url.(strpos($url,'?')===false?'?':'&').$key.'='.rawurlencode($value);}
function absint($v) { return abs((int)$v); }
$posts=[1=>(object)['ID'=>1,'post_type'=>'sc_client_store','post_status'=>'publish'],
2=>(object)['ID'=>2,'post_type'=>'sc_client_store','post_status'=>'draft'],
3=>(object)['ID'=>3,'post_type'=>'page','post_status'=>'draft']];
function get_post($id) { global $posts; return $posts[$id]??null; }
function get_post_status($id) { $p=get_post($id);return $p?$p->post_status:false; }
function current_user_can($cap,...$args) { global $permissions; return in_array($cap,$permissions,true); }
function get_post_meta($id,$key,$single) { return $key==='scs_category_id'?92:''; }
function wp_get_post_terms($id,$tax,$args) { return $id===100?[92]:[123]; }
function is_wp_error($v) { return false; }
function term_is_ancestor_of($parent,$child,$taxonomy) { return false; }
class FixtureSession {public $id=1;function get($key){return $this->id;}}
class FixtureCart {public $items=[['product_id'=>100]];function get_cart(){return $this->items;}}
$wc=(object)['session'=>new FixtureSession(),'cart'=>new FixtureCart()];
function WC(){global $wc;return $wc;}
$permissions=[];
require __DIR__.'/../../wordpress/skilled-crafting-client-stores/skilled-crafting-client-stores.php';
$count=0;
function expect($actual,$expected,$label){global $count;if($actual!==$expected)throw new Exception($label.': '.var_export($actual,true));$count++;echo "PASS $label\n";}
expect(scs_cart_store(),1,'matching published cart keeps client branding');
$wc->cart->items[]=['product_id'=>200];
expect(scs_cart_store(),null,'mixed-category cart is neutral');
$wc->cart->items=[['product_id'=>100]];$wc->session->id=2;
expect(scs_cart_store(),null,'draft session never brands a customer checkout');
$_GET=['scs_preview_store'=>'2'];
expect(scs_cart_store(),null,'anonymous preview request is denied');
$permissions=['edit_post'];expect(scs_cart_store(),null,'page editing alone cannot preview Woo checkout');
$permissions=['edit_post','manage_woocommerce'];$wc->session->id=1;
expect(scs_cart_store(),2,'authorized employee can review draft checkout');
expect($wc->session->id,1,'preview never changes the session');
$_GET=['scs_preview_store'=>'3'];expect(scs_cart_store(),1,'non-store preview leaves normal published cart branding unchanged');
$_GET=['scs_preview_store'=>'2'];$wc->cart->items[]=['product_id'=>200];
expect(scs_cart_store(),null,'authorized draft preview still rejects a mixed cart');
$wc->cart->items=[['product_id'=>100]];$wc->session->id=1;
$_GET=[];$permissions=[];expect(scs_cart_store(),1,'normal published shopper flow remains available');
expect(scs_ink('#2040a0'),'#ffffff','dark logo secondary uses white button text');
expect(scs_ink('#f0b83a'),'#000000','light logo secondary uses dark button text');
$queried=100;$_GET=['scs_store'=>'fixture-live'];$permissions=[];
expect(scs_product_store(),1,'published product context recognizes client store');
$related=$filters['woocommerce_related_products'][0];
expect($related([100,200]),[100],'related recommendations exclude other client categories');
$link=$filters['woocommerce_loop_product_link'][0];
expect($link('https://example.test/product/?size=m'),'https://example.test/product/?size=m&scs_store=fixture-live','related product links preserve client context and existing options');
$_GET=['scs_store'=>'fixture-draft'];
expect(scs_product_store(),null,'anonymous draft product context is denied');
expect($link('https://example.test/product/'),'https://example.test/product/','anonymous draft cannot propagate private context');
$permissions=['edit_post','manage_woocommerce'];
expect(scs_product_store(),2,'authorized private product preview works');
$queried=200;expect(scs_product_store(),null,'unrelated current product cannot adopt client context');
$_GET=[];expect($link('https://example.test/product/'),'https://example.test/product/','ordinary catalog links remain unchanged');
echo "$count WordPress runtime checks passed.\n";
