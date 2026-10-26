<?php
require __DIR__.'/wp-fixture.php';
$fixed=isset($_GET['fixed']);
$GLOBALS['cg_options'] = $fixed ? [['id'=>cg_id(20),'label'=>'Fixed School A']] : [['id'=>cg_id(20),'label'=>'School A'],['id'=>cg_id(21),'label'=>'School B'],['id'=>cg_id(22),'label'=>'School C']];
?><!doctype html><html><head><title>Isolated WooCommerce Hook Fixture</title></head><body style="font-family:Arial;padding:30px"><h1>Isolated WooCommerce hook fixture</h1><p>Fictional school hoodie · no payment, order, inventory or external service connection.</p><p><a href="?fixed=1">Fixed design</a> | <a href="storefront.php">Three design choices</a></p>
<?php
if($_SERVER['REQUEST_METHOD']==='POST'){
 $valid=$GLOBALS['cg_hooks']['woocommerce_add_to_cart_validation'](true,700);
 if($valid){$data=$GLOBALS['cg_hooks']['woocommerce_add_cart_item_data']([],700);$item=new CgOrderItem();$GLOBALS['cg_hooks']['woocommerce_checkout_create_order_line_item']($item,'local-fixture',$data);echo '<h2>Simulated checkout metadata</h2><pre>'.esc_html(json_encode($item->meta,JSON_PRETTY_PRINT)).'</pre>';}
 else echo '<p role="alert">'.esc_html(implode(' ',$GLOBALS['cg_notices'])).'</p>';
}
?><form method="post"><?php $GLOBALS['cg_hooks']['woocommerce_before_add_to_cart_button'](); ?><button type="submit">Simulate checkout metadata</button></form></body></html>
