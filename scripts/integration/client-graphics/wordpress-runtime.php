<?php
require __DIR__.'/wp-fixture.php';
function cg_check($condition,$name) { if(!$condition) { fwrite(STDERR,"FAIL $name\n");exit(1); } echo "PASS $name\n"; }
$ids=[cg_id(20),cg_id(21),cg_id(22)];
$GLOBALS['cg_options'] = array_map(fn($id,$n)=>['id'=>$id,'label'=>'School '.($n+1)],$ids,array_keys($ids));
ob_start();$GLOBALS['cg_hooks']['woocommerce_before_add_to_cart_button']();$html=ob_get_clean();
cg_check(substr_count($html,'<option')===4,'three customer designs rendered plus placeholder');
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
}
$GLOBALS['cg_options'] = [['id'=>cg_id(20),'label'=>'Fixed logo']];$_POST=[];
$data=$GLOBALS['cg_hooks']['woocommerce_add_cart_item_data']([],700);cg_check($data['sc_graphic_family_id']===cg_id(20),'fixed design assigned without customer input');
$GLOBALS['cg_enabled']='no';cg_check($GLOBALS['cg_hooks']['woocommerce_add_cart_item_data']([],700)===[],'disabled storefront selector leaves cart untouched');

$GLOBALS['cg_variation_parents']=[801=>700];
$GLOBALS['cg_options_by_id']=[700=>$GLOBALS['cg_options'],801=>[]];
$GLOBALS['cg_options_by_id'][700]=[['id'=>cg_id(20),'label'=>'Home'],['id'=>cg_id(21),'label'=>'Away']];
$_POST=['sc_graphic_family_id'=>cg_id(21)];
cg_check($GLOBALS['cg_hooks']['woocommerce_add_to_cart_validation'](true,700,1,801)===true,'variation uses parent configured graphic options');
$variationData=$GLOBALS['cg_hooks']['woocommerce_add_cart_item_data']([],700,801);
cg_check($variationData['sc_graphic_family_id']===cg_id(21),'variation retains selected parent design');
$_POST=['sc_graphic_family_id'=>cg_id(22)];
cg_check($GLOBALS['cg_hooks']['woocommerce_add_to_cart_validation'](true,700,1,801)===false,'variation rejects unavailable parent design');
unset($GLOBALS['cg_options_by_id'],$GLOBALS['cg_variation_parents']);
echo "VARIATION CHECKS COMPLETE\n";
