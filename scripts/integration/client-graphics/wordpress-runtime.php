<?php
require __DIR__.'/wp-fixture.php';
function cg_check($condition,$name) { if(!$condition) { fwrite(STDERR,"FAIL $name\n");exit(1); } echo "PASS $name\n"; }
$ids=[cg_id(20),cg_id(21),cg_id(22)];
$GLOBALS['cg_options'] = array_map(fn($id,$n)=>['id'=>$id,'label'=>'School '.($n+1)],$ids,array_keys($ids));
ob_start();$GLOBALS['cg_hooks']['woocommerce_before_add_to_cart_button']();$html=ob_get_clean();
cg_check(substr_count($html,'<option')===4,'three customer designs rendered plus placeholder');
$GLOBALS['cg_external_selector'][700]='yes';ob_start();$GLOBALS['cg_hooks']['woocommerce_before_add_to_cart_button']();$externalHtml=ob_get_clean();cg_check($externalHtml==='','external Mockup Variation Selector suppresses duplicate graphic dropdown');unset($GLOBALS['cg_external_selector'][700]);
$_POST=[];cg_check($GLOBALS['cg_hooks']['woocommerce_add_to_cart_validation'](true,700)===false,'missing selection rejected');
$_POST=['sc_graphic_family_id'=>'bad'];cg_check($GLOBALS['cg_hooks']['woocommerce_add_to_cart_validation'](true,700)===false,'invalid UUID rejected');
$_POST=['sc_graphic_family_id'=>cg_id(99)];cg_check($GLOBALS['cg_hooks']['woocommerce_add_to_cart_validation'](true,700)===false,'unconfigured UUID rejected');
foreach($ids as $id) {
 $_POST=['sc_graphic_family_id'=>$id,'sc_graphic_label'=>'Forged customer label'];
 cg_check($GLOBALS['cg_hooks']['woocommerce_add_to_cart_validation'](true,700)===true,'configured design accepted '.$id);
 $data=$GLOBALS['cg_hooks']['woocommerce_add_cart_item_data']([],700);
 cg_check($data['sc_graphic_family_id']===$id&&$data['sc_graphic_label']!=='Forged customer label','trusted family and label preserved');
 $item=new CgOrderItem();$GLOBALS['cg_hooks']['woocommerce_checkout_create_order_line_item']($item,'fixture',$data);
 cg_check($item->meta['_sc_graphic_family_id']===$id&&$item->meta['_sc_graphic_label']===$data['sc_graphic_label'],'checkout metadata preserved');
 $forgedCheckout=new CgOrderItem();$GLOBALS['cg_hooks']['woocommerce_checkout_create_order_line_item']($forgedCheckout,'fixture',['sc_graphic_family_id'=>$id,'sc_graphic_label'=>'FAKE']);cg_check($forgedCheckout->meta['_sc_graphic_label']===$data['sc_graphic_label'],'checkout overrides forged cart display name');
}
$GLOBALS['cg_options'] = [['id'=>cg_id(20),'label'=>'Fixed logo']];$_POST=[];
$data=$GLOBALS['cg_hooks']['woocommerce_add_cart_item_data']([],700);cg_check($data['sc_graphic_family_id']===cg_id(20),'fixed design assigned without customer input');
$GLOBALS['cg_enabled']='no';cg_check($GLOBALS['cg_hooks']['woocommerce_add_cart_item_data']([],700)===[],'disabled storefront selector leaves cart untouched');

$GLOBALS['cg_enabled']='yes';
$GLOBALS['cg_variation_parents']=[801=>700];
$GLOBALS['cg_options_by_id']=[700=>$GLOBALS['cg_options'],801=>[]];
$GLOBALS['cg_options_by_id'][700]=[['id'=>cg_id(20),'label'=>'Home'],['id'=>cg_id(21),'label'=>'Away']];
$_POST=['sc_graphic_family_id'=>cg_id(21)];
cg_check($GLOBALS['cg_hooks']['woocommerce_add_to_cart_validation'](true,700,1,801)===true,'variation uses parent configured graphic options');
$variationData=$GLOBALS['cg_hooks']['woocommerce_add_cart_item_data']([],700,801);
cg_check($variationData['sc_graphic_family_id']===cg_id(21),'variation retains selected parent design');
$directVariation=$GLOBALS['cg_hooks']['woocommerce_add_cart_item_data']([],801,0);
cg_check($directVariation['sc_graphic_family_id']===cg_id(21),'Store API direct variation ID uses verified parent options');
$_POST=['sc_graphic_family_id'=>cg_id(22)];
cg_check($GLOBALS['cg_hooks']['woocommerce_add_to_cart_validation'](true,700,1,801)===false,'variation rejects unavailable parent design');
$invalidVariation=$GLOBALS['cg_hooks']['woocommerce_add_cart_item_data']([],700,801);
cg_check(empty($invalidVariation['sc_graphic_family_id']),'invalid variation selection does not persist into cart');
unset($GLOBALS['cg_options_by_id'],$GLOBALS['cg_variation_parents']);

$blockProduct=new class { function get_id(){return 801;} function get_parent_id(){return 700;} };
$GLOBALS['cg_options_by_id']=[700=>[['id'=>cg_id(20),'label'=>'Home'],['id'=>cg_id(21),'label'=>'Away']]];
$GLOBALS['cg_variation_parents']=[801=>700];
$GLOBALS['cg_enabled']='yes';
$storeBlocked=false;
try{$GLOBALS['cg_hooks']['woocommerce_store_api_validate_add_to_cart']($blockProduct,[]);}catch(Exception $e){$storeBlocked=true;}
cg_check($storeBlocked,'Store API blocks unverified multi-choice graphic product');
$validRequest=['id'=>801,'sc_graphic_family_id'=>cg_id(21),'sc_graphic_label'=>'FORGED'];
$GLOBALS['cg_hooks']['woocommerce_store_api_validate_add_to_cart']($blockProduct,$validRequest);
$stored=$GLOBALS['cg_hooks']['woocommerce_store_api_add_to_cart_data'](['cart_item_data'=>[]],$validRequest);
$_POST=[];
cg_check($GLOBALS['cg_hooks']['woocommerce_add_to_cart_validation'](true,700,1,801,[],$stored['cart_item_data'])===true,'legacy validation accepts verified Store API cart ID without form POST');
cg_check($GLOBALS['cg_hooks']['woocommerce_add_to_cart_validation'](true,700,1,801,[],[])===false,'legacy validation blocks Store API choice missing from cart data');
cg_check($stored['cart_item_data']['sc_graphic_family_id']===cg_id(21),'Store API validates selected graphic for parent variation');
cg_check($stored['cart_item_data']['sc_graphic_label']==='Away','Store API ignores forged customer graphic label');
$forgedCart=$GLOBALS['cg_hooks']['woocommerce_add_cart_item_data'](['sc_graphic_family_id'=>cg_id(21),'sc_graphic_label'=>'UNTRUSTED-LABEL'],700,801);
cg_check($forgedCart['sc_graphic_label']==='Away','prepopulated cart data replaces forged label with configured design');
$unknownCart=$GLOBALS['cg_hooks']['woocommerce_add_cart_item_data'](['sc_graphic_family_id'=>cg_id(99),'sc_graphic_label'=>'FORGED'],700,801);
cg_check(empty($unknownCart['sc_graphic_family_id']) && empty($unknownCart['sc_graphic_label']),'invalid prepopulated graphic metadata is removed');
$bad=$GLOBALS['cg_hooks']['woocommerce_store_api_add_to_cart_data'](['cart_item_data'=>[]],['id'=>801,'sc_graphic_family_id'=>cg_id(99)]);
cg_check(empty($bad['cart_item_data']['sc_graphic_family_id']),'Store API does not attach unknown artwork IDs');
$GLOBALS['cg_options_by_id'][700]=[['id'=>cg_id(20),'label'=>'Fixed logo']];
$GLOBALS['cg_hooks']['woocommerce_store_api_validate_add_to_cart']($blockProduct,[]);
cg_check(true,'Store API permits fixed-design product');
$GLOBALS['cg_enabled']='no';
$GLOBALS['cg_options_by_id'][700]=[['id'=>cg_id(20),'label'=>'Home'],['id'=>cg_id(21),'label'=>'Away']];
$GLOBALS['cg_hooks']['woocommerce_store_api_validate_add_to_cart']($blockProduct,[]);
cg_check(true,'disabled selector never blocks Store API');
unset($GLOBALS['cg_options_by_id'],$GLOBALS['cg_variation_parents']);

function wc_get_product($id){return new class {function is_type($type){return $type==='simple';} function is_purchasable(){return true;}};}
function wp_create_nonce($type){return $type==='wc_store_api'?'NONCUSTOMER-NONCE':'';}
function rest_url($path){return 'https://store.example.invalid/wp-json/'.$path;}
function plugins_url($path,$file){return 'https://store.example.invalid/fixture/'.$path;}
function wp_enqueue_script($handle,$url,$deps,$version,$footer){$GLOBALS['cg_enqueued'][]=$handle;}
$GLOBALS['cg_enabled']='yes';
$GLOBALS['cg_options_by_id']=[700=>[['id'=>cg_id(20),'label'=>'Home'],['id'=>cg_id(21),'label'=>'Away']]];
$blockHtml=sc_graphic_choices_render_block(['productId'=>700]);
cg_check(str_contains($blockHtml,'data-sc-graphic-block') && str_contains($blockHtml,'data-sc-graphic-choice'),'opt-in simple product Blocks graphic selector renders');
cg_check(str_contains($blockHtml,'NONCUSTOMER-NONCE') && str_contains($blockHtml,'cart/add-item'),'selector includes Store API endpoint and nonce');
$GLOBALS['cg_enabled']='no';
cg_check(sc_graphic_choices_render_block(['productId'=>700])==='','disabled selector does not render in Blocks');
unset($GLOBALS['cg_options_by_id']);
echo "VARIATION AND BLOCKS FAIL-CLOSED CHECKS COMPLETE\n";
