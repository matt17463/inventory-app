// The -background filename is deliberately retained in addition to the
// netlify.toml setting. Netlify fully supports this convention and it prevents
// a long WooCommerce variation export from ever falling back to a synchronous
// request when site configuration is merged or redeployed.
export { handler } from './mockup-publish-woocommerce.js';
