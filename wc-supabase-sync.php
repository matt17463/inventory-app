<?php
/**
 * Plugin Name: WooCommerce to Supabase Product Sync
 * Description: Sync WooCommerce products to Supabase products table and link them to the Supabase blank product master catalog. Does not create blank_products.
 * Version: 2.0.0-blank-master-source
 * Author: Matthew + ChatGPT
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Recommended wp-config.php constants:
 *
 * define( 'WCSB_SUPABASE_URL', 'https://YOUR-PROJECT.supabase.co' );
 * define( 'WCSB_SUPABASE_SERVICE_KEY', 'YOUR_SERVICE_ROLE_KEY' );
 * define( 'WCSB_BATCH_SIZE', 10 );
 *
 * IMPORTANT:
 * Use the Supabase SERVICE ROLE key, not anon key.
 */

if ( ! defined( 'WCSB_SUPABASE_URL' ) ) {
    define( 'WCSB_SUPABASE_URL', '' );
}

if ( ! defined( 'WCSB_SUPABASE_SERVICE_KEY' ) ) {
    define( 'WCSB_SUPABASE_SERVICE_KEY', '' );
}

if ( ! defined( 'WCSB_BATCH_SIZE' ) ) {
    define( 'WCSB_BATCH_SIZE', 10 );
}

if ( ! defined( 'WCSB_LOG_PREFIX' ) ) {
    define( 'WCSB_LOG_PREFIX', '[WC Supabase Sync] ' );
}

function wcsb_log( $message ) {
    if ( is_array( $message ) || is_object( $message ) ) {
        $message = print_r( $message, true );
    }

    error_log( WCSB_LOG_PREFIX . $message );
}

function wcsb_is_configured() {
    return (
        WCSB_SUPABASE_URL
        && WCSB_SUPABASE_SERVICE_KEY
        && strpos( WCSB_SUPABASE_SERVICE_KEY, 'YOUR_' ) === false
    );
}

function wcsb_get_batch_size() {
    $saved = get_option( 'wcsb_batch_size', WCSB_BATCH_SIZE );
    $saved = absint( $saved );

    if ( $saved < 1 ) {
        $saved = 10;
    }

    if ( $saved > 100 ) {
        $saved = 100;
    }

    return $saved;
}

function wcsb_update_batch_size_from_request() {
    if ( ! current_user_can( 'manage_woocommerce' ) ) {
        return;
    }

    if ( isset( $_GET['wcsb_batch_size'] ) ) {
        $batch_size = absint( $_GET['wcsb_batch_size'] );

        if ( $batch_size < 1 ) {
            $batch_size = 1;
        }

        if ( $batch_size > 100 ) {
            $batch_size = 100;
        }

        update_option( 'wcsb_batch_size', $batch_size );
    }
}

function wcsb_supabase_endpoint( $table ) {
    return rtrim( WCSB_SUPABASE_URL, '/' ) . '/rest/v1/' . $table;
}

function wcsb_clean_text( $value ) {
    $value = wp_strip_all_tags( (string) $value );
    $value = html_entity_decode( $value, ENT_QUOTES, 'UTF-8' );
    return trim( $value );
}

function wcsb_normalize_code( $value ) {
    $value = wcsb_clean_text( $value );

    if ( $value === '' ) {
        return 'NA';
    }

    $value = strtoupper( $value );
    $value = str_replace( array( '&#8217;', '&#039;', '&APOS;', '’', "'", '"', '`' ), '', $value );
    $value = preg_replace( '/[^A-Z0-9]+/', '', $value );

    return $value !== '' ? $value : 'NA';
}

function wcsb_get_parent_product( $product ) {
    if ( ! $product || ! $product->is_type( 'variation' ) ) {
        return null;
    }

    $parent_id = $product->get_parent_id();

    return $parent_id ? wc_get_product( $parent_id ) : null;
}

function wcsb_attribute_value_to_name( $attribute_key, $value ) {
    $value = wcsb_clean_text( $value );

    if ( $value === '' ) {
        return '';
    }

    $taxonomy = (string) $attribute_key;

    if ( strpos( $taxonomy, 'attribute_' ) === 0 ) {
        $taxonomy = substr( $taxonomy, strlen( 'attribute_' ) );
    }

    if ( taxonomy_exists( $taxonomy ) ) {
        $term = get_term_by( 'slug', $value, $taxonomy );

        if ( $term && ! is_wp_error( $term ) ) {
            return $term->name;
        }

        $term = get_term_by( 'name', $value, $taxonomy );

        if ( $term && ! is_wp_error( $term ) ) {
            return $term->name;
        }
    }

    return $value;
}

function wcsb_get_attribute_value( $product, $keys ) {
    if ( ! $product ) {
        return '';
    }

    if ( is_string( $keys ) ) {
        $keys = array( $keys );
    }

    foreach ( $keys as $key ) {
        $key = trim( (string) $key );

        if ( $key === '' ) {
            continue;
        }

        $value = '';

        if ( $product->is_type( 'variation' ) ) {
            $attributes = $product->get_attributes();
            $base_key   = preg_replace( '/^(attribute_|attribute_pa_|pa_)/', '', $key );

            $possible_keys = array_unique(
                array(
                    $key,
                    $base_key,
                    'pa_' . $base_key,
                    'attribute_' . $base_key,
                    'attribute_pa_' . $base_key,
                )
            );

            foreach ( $possible_keys as $possible_key ) {
                if ( isset( $attributes[ $possible_key ] ) && $attributes[ $possible_key ] !== '' ) {
                    $value = wcsb_attribute_value_to_name( $possible_key, $attributes[ $possible_key ] );
                    break;
                }

                $meta_value = get_post_meta( $product->get_id(), $possible_key, true );

                if ( $meta_value !== '' ) {
                    $value = wcsb_attribute_value_to_name( $possible_key, $meta_value );
                    break;
                }
            }
        }

        if ( $value === '' && method_exists( $product, 'get_attribute' ) ) {
            $base_key = preg_replace( '/^(attribute_|attribute_pa_|pa_)/', '', $key );

            $possible_attribute_keys = array_unique(
                array(
                    $key,
                    $base_key,
                    'pa_' . $base_key,
                )
            );

            foreach ( $possible_attribute_keys as $possible_key ) {
                $attribute_value = $product->get_attribute( $possible_key );

                if ( $attribute_value !== '' ) {
                    $value = $attribute_value;
                    break;
                }
            }
        }

        if ( $value !== '' ) {
            return wcsb_clean_text( $value );
        }
    }

    return '';
}

function wcsb_get_variation_aware_attribute( $product, $keys ) {
    $value = wcsb_get_attribute_value( $product, $keys );

    if ( $value !== '' ) {
        return $value;
    }

    $parent = wcsb_get_parent_product( $product );

    if ( $parent ) {
        return wcsb_get_attribute_value( $parent, $keys );
    }

    return '';
}

function wcsb_supabase_request( $method, $table, $payload = null, $query = '', $prefer = 'resolution=merge-duplicates,return=representation' ) {
    if ( ! wcsb_is_configured() ) {
        return array(
            'success' => false,
            'error'   => 'Supabase key is not configured or still contains the placeholder.',
            'code'    => null,
            'body'    => null,
            'payload' => $payload,
        );
    }

    $url = wcsb_supabase_endpoint( $table );

    if ( $query ) {
        $url .= '?' . ltrim( $query, '?' );
    }

    $args = array(
        'method'  => $method,
        'timeout' => 30,
        'headers' => array(
            'apikey'        => WCSB_SUPABASE_SERVICE_KEY,
            'Authorization' => 'Bearer ' . WCSB_SUPABASE_SERVICE_KEY,
            'Content-Type'  => 'application/json',
            'Prefer'        => $prefer,
        ),
    );

    if ( $payload !== null ) {
        $args['body'] = wp_json_encode( $payload );
    }

    $response = wp_remote_request( $url, $args );

    if ( is_wp_error( $response ) ) {
        return array(
            'success' => false,
            'error'   => $response->get_error_message(),
            'code'    => null,
            'body'    => null,
            'payload' => $payload,
        );
    }

    $code = wp_remote_retrieve_response_code( $response );
    $body = wp_remote_retrieve_body( $response );

    return array(
        'success' => $code >= 200 && $code < 300,
        'error'   => $code >= 200 && $code < 300 ? null : $body,
        'code'    => $code,
        'body'    => $body,
        'payload' => $payload,
    );
}

/**
 * Lookup cache so each batch does not repeatedly call Supabase for the same values.
 */
function wcsb_lookup_cache_key( $table, $value ) {
    return strtolower( $table . '|' . wcsb_normalize_code( $value ) );
}

function wcsb_find_lookup_id( $table, $value ) {
    static $cache = array();

    $value = wcsb_clean_text( $value );

    if ( $value === '' ) {
        $value = 'NA';
    }

    $code = wcsb_normalize_code( $value );
    $cache_key = wcsb_lookup_cache_key( $table, $value );

    if ( isset( $cache[ $cache_key ] ) ) {
        return $cache[ $cache_key ];
    }

    $query = 'or=('
        . 'code.eq.' . rawurlencode( $code )
        . ',name.eq.' . rawurlencode( $value )
        . ')'
        . '&select=id'
        . '&limit=1';

    $result = wcsb_supabase_request( 'GET', $table, null, $query );

    if ( $result['success'] ) {
        $rows = json_decode( $result['body'], true );

        if ( is_array( $rows ) && ! empty( $rows[0]['id'] ) ) {
            $cache[ $cache_key ] = $rows[0]['id'];
            return $cache[ $cache_key ];
        }
    }

    $insert = array(
        'code' => $code,
        'name' => $value,
    );

    $insert_result = wcsb_supabase_request( 'POST', $table, $insert, 'on_conflict=code' );

    if ( ! $insert_result['success'] ) {
        wcsb_log( 'Lookup insert failed for ' . $table . ': ' . $insert_result['error'] );
        return null;
    }

    $insert_rows = json_decode( $insert_result['body'], true );

    if ( is_array( $insert_rows ) && ! empty( $insert_rows[0]['id'] ) ) {
        $cache[ $cache_key ] = $insert_rows[0]['id'];
        return $cache[ $cache_key ];
    }

    $retry = wcsb_supabase_request(
        'GET',
        $table,
        null,
        'code=eq.' . rawurlencode( $code ) . '&select=id&limit=1'
    );

    if ( $retry['success'] ) {
        $retry_rows = json_decode( $retry['body'], true );

        if ( is_array( $retry_rows ) && ! empty( $retry_rows[0]['id'] ) ) {
            $cache[ $cache_key ] = $retry_rows[0]['id'];
            return $cache[ $cache_key ];
        }
    }

    return null;
}


/**
 * Inventory rows should be simple products or concrete variations only.
 *
 * Variable parent products are catalog containers. They often carry all possible
 * attribute options on the parent, which can create oversized "all options"
 * SKUs/attribute rows in Supabase. Those parent rows should not become inventory
 * products. Their child variations are synced instead.
 */
function wcsb_should_sync_as_inventory_row( $product ) {
    if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
        return false;
    }

    if ( $product->is_type( 'variable' ) ) {
        return false;
    }

    return true;
}

function wcsb_get_product_image_url( $product ) {
    if ( ! $product ) {
        return null;
    }

    $image_id = $product->get_image_id();

    if ( ! $image_id ) {
        $parent = wcsb_get_parent_product( $product );

        if ( $parent ) {
            $image_id = $parent->get_image_id();
        }
    }

    if ( ! $image_id ) {
        return null;
    }

    $url = wp_get_attachment_url( $image_id );

    return $url ?: null;
}

function wcsb_build_product_payload( $product ) {
    if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
        return null;
    }

    if ( ! wcsb_should_sync_as_inventory_row( $product ) ) {
        return null;
    }

    $sku = $product->get_sku();

    if ( ! $sku ) {
        $sku = get_post_meta( $product->get_id(), '_sku', true );
    }

    $sku = wcsb_clean_text( $sku );

    if ( $sku === '' ) {
        return null;
    }

    $woocommerce_product_id = $product->is_type( 'variation' )
        ? (int) $product->get_parent_id()
        : (int) $product->get_id();

    $woocommerce_variation_id = $product->is_type( 'variation' )
        ? (int) $product->get_id()
        : null;

    $brand_value = wcsb_get_variation_aware_attribute(
        $product,
        array( 'pa_brand', 'brand', 'attribute_pa_brand', 'attribute_brand' )
    );

    $product_type_value = wcsb_get_variation_aware_attribute(
        $product,
        array(
            'pa_style',
            'style',
            'pa_product_type',
            'product_type',
            'attribute_pa_style',
            'attribute_style',
            'attribute_pa_product_type'
        )
    );

    $color_value = wcsb_get_variation_aware_attribute(
        $product,
        array(
            'pa_color',
            'color',
            'pa_colors',
            'colors',
            'pa_colour',
            'colour',
            'attribute_pa_color',
            'attribute_color',
            'attribute_pa_colors'
        )
    );

    $size_value = wcsb_get_variation_aware_attribute(
        $product,
        array( 'pa_size', 'size', 'attribute_pa_size', 'attribute_size' )
    );

    $logo_value = wcsb_get_variation_aware_attribute(
        $product,
        array( 'pa_logo', 'logo', 'attribute_pa_logo', 'attribute_logo' )
    );

    $customer_value = wcsb_get_variation_aware_attribute(
        $product,
        array( 'pa_customer', 'customer', 'attribute_pa_customer', 'attribute_customer' )
    );

    $brand_id        = wcsb_find_lookup_id( 'brands', $brand_value ?: 'NA' );
    $product_type_id = wcsb_find_lookup_id( 'product_types', $product_type_value ?: 'NA' );
    $color_id        = wcsb_find_lookup_id( 'colors', $color_value ?: 'NA' );
    $size_id         = wcsb_find_lookup_id( 'sizes', $size_value ?: 'NA' );

    $logo_id = null;
    if ( $logo_value !== '' ) {
        $logo_id = wcsb_find_lookup_id( 'logos', $logo_value );
    }

    $customer_id = null;
    if ( $customer_value !== '' ) {
        $customer_id = wcsb_find_lookup_id( 'customers', $customer_value );
    }

    $stock_quantity = $product->get_stock_quantity();

    if ( $stock_quantity === null ) {
        $stock_quantity = 0;
    }

    $payload = array(
        'sku'                       => $sku,
        'name'                      => $product->get_name(),
        'quantity'                  => (int) $stock_quantity,
        'image_url'                 => wcsb_get_product_image_url( $product ),
        'is_finished'               => ( $customer_value !== '' || $logo_value !== '' ),
        'size'                      => $size_value ?: 'NA',

        'brand_id'                  => $brand_id,
        'product_type_id'           => $product_type_id,
        'color_id'                  => $color_id,
        'size_id'                   => $size_id,
        'logo_id'                   => $logo_id,
        'customer_id'               => $customer_id,

        'woocommerce_product_id'    => $woocommerce_product_id,
        'woocommerce_variation_id'  => $woocommerce_variation_id,
    );

    foreach ( array( 'image_url', 'logo_id', 'customer_id' ) as $optional_key ) {
        if ( ! isset( $payload[ $optional_key ] ) || $payload[ $optional_key ] === null || $payload[ $optional_key ] === '' ) {
            unset( $payload[ $optional_key ] );
        }
    }

    return $payload;
}

function wcsb_sync_product_to_supabase( $product ) {
    $payload = wcsb_build_product_payload( $product );

    if ( ! $payload || empty( $payload['sku'] ) ) {
        return array(
            'success' => false,
            'error'   => 'No valid SKU/payload for product, or product is a variable parent skipped by design.',
            'payload' => $payload,
        );
    }

    $result = wcsb_supabase_request( 'POST', 'products', $payload, 'on_conflict=sku' );

    if ( ! empty( $result['success'] ) ) {
        wcsb_link_synced_product_to_blank_master( $payload['sku'] );
    }

    return $result;
}


/**
 * After syncing a WooCommerce product row to public.products, ask Supabase to link
 * that Woo row to the blank_products master catalog. If the Woo product represents
 * a finished/customer/logo item, the RPC also creates/updates finished_products.
 */
function wcsb_link_synced_product_to_blank_master( $sku ) {
    $sku = wcsb_clean_text( $sku );

    if ( $sku === '' ) {
        return;
    }

    $result = wcsb_supabase_request(
        'POST',
        'rpc/wcsb_link_woo_product_to_blank_and_finished',
        array( 'p_sku' => $sku ),
        '',
        'return=representation'
    );

    if ( empty( $result['success'] ) ) {
        wcsb_log( 'Blank master link RPC failed for SKU ' . $sku . ': ' . ( $result['error'] ?? 'Unknown error' ) );
    }
}


/**
 * Lightweight save hooks.
 */
add_action( 'woocommerce_update_product', 'wcsb_sync_product_on_save', 30, 1 );
add_action( 'woocommerce_new_product', 'wcsb_sync_product_on_save', 30, 1 );
add_action( 'woocommerce_save_product_variation', 'wcsb_sync_variation_on_save', 30, 2 );

function wcsb_sync_product_on_save( $product_id ) {
    if ( defined( 'WCSB_DISABLE_SAVE_HOOK_SYNC' ) && WCSB_DISABLE_SAVE_HOOK_SYNC ) {
        return;
    }

    if ( ! function_exists( 'wc_get_product' ) ) {
        return;
    }

    $product = wc_get_product( $product_id );

    if ( ! $product ) {
        return;
    }

    if ( $product->is_type( 'variable' ) ) {
        // Do not sync the variable parent as an inventory row. Sync children only.
        foreach ( $product->get_children() as $variation_id ) {
            $variation = wc_get_product( $variation_id );

            if ( $variation ) {
                wcsb_sync_product_to_supabase( $variation );
            }
        }

        return;
    }

    wcsb_sync_product_to_supabase( $product );
}

function wcsb_sync_variation_on_save( $variation_id, $i = null ) {
    if ( defined( 'WCSB_DISABLE_SAVE_HOOK_SYNC' ) && WCSB_DISABLE_SAVE_HOOK_SYNC ) {
        return;
    }

    if ( ! function_exists( 'wc_get_product' ) ) {
        return;
    }

    $variation = wc_get_product( $variation_id );

    if ( $variation ) {
        wcsb_sync_product_to_supabase( $variation );
    }
}

/**
 * Admin UI.
 */
add_action( 'admin_menu', 'wcsb_admin_menu' );

function wcsb_admin_menu() {
    add_submenu_page(
        'woocommerce',
        'Supabase Sync',
        'Supabase Sync',
        'manage_woocommerce',
        'wcsb-supabase-sync',
        'wcsb_admin_page'
    );
}

function wcsb_admin_page() {
    if ( ! current_user_can( 'manage_woocommerce' ) ) {
        wp_die( 'Permission denied.' );
    }

    wcsb_update_batch_size_from_request();

    $batch_size = wcsb_get_batch_size();

    $batch_url = add_query_arg(
        array(
            'action'          => 'wcsb_sync_all_products',
            'page_num'        => 1,
            'wcsb_batch_size' => $batch_size,
        ),
        admin_url( 'admin-post.php' )
    );

    ?>
    <div class="wrap">
        <h1>WooCommerce → Supabase Product Sync</h1>
        <p>This syncs WooCommerce products and variations to Supabase.</p>
        <p><strong>Timeout fix:</strong> this version caches lookup IDs per batch and lets you control the batch size.</p>

        <form method="get" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>" style="margin: 16px 0;">
            <input type="hidden" name="page" value="wcsb-supabase-sync" />
            <label for="wcsb_batch_size"><strong>Batch size:</strong></label>
            <input type="number" id="wcsb_batch_size" name="wcsb_batch_size" min="1" max="100" value="<?php echo esc_attr( $batch_size ); ?>" />
            <button type="submit" class="button">Save Batch Size</button>
            <p class="description">Recommended: start with 1–3 if your server times out, then increase once stable.</p>
        </form>

        <p><a class="button button-primary" href="<?php echo esc_url( $batch_url ); ?>">Start Full Product Sync</a></p>

        <p><strong>After sync completes:</strong> run <code>select rebuild_product_catalog_from_products();</code> in Supabase.</p>
    </div>
    <?php
}

add_action( 'admin_post_wcsb_sync_all_products', 'wcsb_admin_sync_all_products' );

function wcsb_admin_sync_all_products() {
    if ( ! current_user_can( 'manage_woocommerce' ) ) {
        wp_die( 'Permission denied.' );
    }

    if ( ! function_exists( 'wc_get_products' ) ) {
        wp_die( 'WooCommerce not available.' );
    }

    @set_time_limit( 45 );

    $page_num = isset( $_GET['page_num'] ) ? max( 1, absint( $_GET['page_num'] ) ) : 1;

    $request_batch_size = isset( $_GET['wcsb_batch_size'] ) ? absint( $_GET['wcsb_batch_size'] ) : wcsb_get_batch_size();

    if ( $request_batch_size < 1 ) {
        $request_batch_size = 1;
    }

    if ( $request_batch_size > 100 ) {
        $request_batch_size = 100;
    }

    update_option( 'wcsb_batch_size', $request_batch_size );

    $limit = $request_batch_size;

    /**
     * Page only simple + variable parents.
     * Variations are processed inside each parent.
     */
    $products = wc_get_products(
        array(
            'type'    => array( 'simple', 'variable' ),
            'status'  => array( 'publish', 'private', 'draft' ),
            'limit'   => $limit,
            'page'    => $page_num,
            'return'  => 'objects',
            'orderby' => 'ID',
            'order'   => 'ASC',
        )
    );

    $processed = 0;
    $synced    = 0;
    $failed    = 0;
    $errors    = array();

    foreach ( $products as $product ) {
        if ( ! $product ) {
            continue;
        }

        $processed++;

        if ( $product->is_type( 'variable' ) ) {
            // Variable parents are containers only. Count as processed but do not sync as product rows.
            $synced++;
        } else {
            $result = wcsb_sync_product_to_supabase( $product );

            if ( ! empty( $result['success'] ) ) {
                $synced++;
            } else {
                $failed++;
                $errors[] = array(
                    'product_id' => $product->get_id(),
                    'sku'        => $product->get_sku(),
                    'error'      => isset( $result['error'] ) ? $result['error'] : 'Unknown error',
                    'payload'    => isset( $result['payload'] ) ? $result['payload'] : null,
                );
            }
        }

        if ( $product->is_type( 'variable' ) ) {
            foreach ( $product->get_children() as $variation_id ) {
                $variation = wc_get_product( $variation_id );

                if ( ! $variation ) {
                    continue;
                }

                $processed++;

                $variation_result = wcsb_sync_product_to_supabase( $variation );

                if ( ! empty( $variation_result['success'] ) ) {
                    $synced++;
                } else {
                    $failed++;
                    $errors[] = array(
                        'product_id' => $variation->get_id(),
                        'sku'        => $variation->get_sku(),
                        'error'      => isset( $variation_result['error'] ) ? $variation_result['error'] : 'Unknown error',
                        'payload'    => isset( $variation_result['payload'] ) ? $variation_result['payload'] : null,
                    );
                }
            }
        }
    }

    $has_more  = count( $products ) === $limit;
    $next_page = $page_num + 1;

    $next_url = add_query_arg(
        array(
            'action'          => 'wcsb_sync_all_products',
            'page_num'        => $next_page,
            'wcsb_batch_size' => $limit,
        ),
        admin_url( 'admin-post.php' )
    );

    $restart_url = add_query_arg(
        array(
            'action'          => 'wcsb_sync_all_products',
            'page_num'        => 1,
            'wcsb_batch_size' => $limit,
        ),
        admin_url( 'admin-post.php' )
    );

    $admin_url = add_query_arg(
        array(
            'page'            => 'wcsb-supabase-sync',
            'wcsb_batch_size' => $limit,
        ),
        admin_url( 'admin.php' )
    );

    $html  = '<h1>Supabase Product Sync Batch</h1>';
    $html .= '<p><strong>Page:</strong> ' . esc_html( $page_num ) . '</p>';
    $html .= '<p><strong>Batch size:</strong> ' . esc_html( $limit ) . ' parent/simple products</p>';
    $html .= '<ul>';
    $html .= '<li>Processed including variations: ' . esc_html( $processed ) . '</li>';
    $html .= '<li>Synced: ' . esc_html( $synced ) . '</li>';
    $html .= '<li>Failed: ' . esc_html( $failed ) . '</li>';
    $html .= '</ul>';

    if ( ! empty( $errors ) ) {
        $html .= '<h2>First Errors</h2><pre style="white-space: pre-wrap; max-height: 400px; overflow:auto;">' . esc_html( print_r( array_slice( $errors, 0, 10 ), true ) ) . '</pre>';
    }

    if ( $has_more ) {
        $html .= '<p><a class="button button-primary" href="' . esc_url( $next_url ) . '">Run Next Batch Page ' . esc_html( $next_page ) . '</a></p>';
        $html .= '<script>
            setTimeout(function() {
                window.location.href = ' . wp_json_encode( $next_url ) . ';
            }, 1200);
        </script>';
        $html .= '<p><em>Automatically continuing to next sync batch...</em></p>';
    } else {
        $html .= '<p><strong>All sync batches complete.</strong></p>';
        $html .= '<p>Next step: run <code>select rebuild_product_catalog_from_products();</code> in Supabase.</p>';
    }

    $html .= '<p><a class="button" href="' . esc_url( $restart_url ) . '">Restart From Page 1</a></p>';
    $html .= '<p><a href="' . esc_url( $admin_url ) . '">Back to Supabase Sync</a></p>';

    wp_die( $html );
}
