<?php
// Local WordPress/WooCommerce hook simulation. No WordPress database or external HTTP.
define('ABSPATH', __DIR__);
$GLOBALS['cg_hooks'] = [];
$GLOBALS['cg_enabled'] = 'yes';
$GLOBALS['cg_options'] = [];
$GLOBALS['cg_notices'] = [];
function add_action($name, $callback, $priority=10, $args=1) { $GLOBALS['cg_hooks'][$name] = $callback; }
function add_filter($name, $callback, $priority=10, $args=1) { add_action($name,$callback,$priority,$args); }
function get_option($name, $default=null) { return $GLOBALS['cg_enabled']; }
function get_post_meta($id, $name, $single=true) { if ($name==='_sc_graphic_external_selector') return $GLOBALS['cg_external_selector'][$id] ?? ''; return $GLOBALS['cg_options_by_id'][$id] ?? $GLOBALS['cg_options']; }
function wp_get_post_parent_id($id) { return $GLOBALS['cg_variation_parents'][$id] ?? 0; }
function sanitize_text_field($v) { return trim(strip_tags((string)$v)); }
function wp_unslash($v) { return stripslashes($v); }
function is_product() { return true; }
function esc_attr($v) { return htmlspecialchars($v, ENT_QUOTES); }
function esc_html($v) { return htmlspecialchars($v, ENT_QUOTES); }
function __($v, $domain='') { return $v; }
function wc_clean($v) { return sanitize_text_field($v); }
function wc_add_notice($v, $type) { $GLOBALS['cg_notices'][]=$v; }
function cg_id($n) { return '00000000-0000-4000-8000-'.str_pad((string)$n,12,'0',STR_PAD_LEFT); }
class CgProduct { function get_id() { return 700; } }
class CgOrderItem { public $meta=[]; function get_product_id(){return 700;} function get_variation_id(){return 0;} function add_meta_data($key,$value,$unique) { $this->meta[$key]=$value; } }
$GLOBALS['product'] = new CgProduct();
require dirname(__DIR__,3).'/wordpress/skilled-crafting-graphic-choices/skilled-crafting-graphic-choices.php';
