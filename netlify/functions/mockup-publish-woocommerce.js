import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { commaList, numericIdList, parseJsonBody, wooRequest } from './_shared/mockupUtils.js';

function attributesFor(config, discovered) {
  const colorOptions = commaList(config.colors);
  const sizeOptions = commaList(config.sizes);
  const attributes = [];
  const color = discovered.find((row) => row.slug === 'pa_color' || String(row.name).toLowerCase() === 'color');
  const size = discovered.find((row) => row.slug === 'pa_size' || String(row.name).toLowerCase() === 'size');
  if (colorOptions.length) attributes.push({ ...(color?.id ? { id: color.id } : { name: 'Color' }), position: 0, visible: true, variation: true, options: colorOptions });
  if (sizeOptions.length) attributes.push({ ...(size?.id ? { id: size.id } : { name: 'Size' }), position: 1, visible: true, variation: true, options: sizeOptions });
  return { attributes, color, size, colorOptions, sizeOptions };
}

function variationRows(parent, price) {
  const colors = parent.colorOptions.length ? parent.colorOptions : [null];
  const sizes = parent.sizeOptions.length ? parent.sizeOptions : [null];
  const rows = [];
  for (const color of colors) for (const size of sizes) {
    const attributes = [];
    if (color) attributes.push(parent.color?.id ? { id: parent.color.id, option: color } : { name: 'Color', option: color });
    if (size) attributes.push(parent.size?.id ? { id: parent.size.id, option: size } : { name: 'Size', option: size });
    rows.push({ regular_price: String(price || ''), status: 'publish', attributes });
  }
  if (rows.length > 100) throw new Error('This export would create more than 100 variations. Reduce the number of colors or sizes.');
  return rows;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, error: 'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'mockup-publish-woocommerce', allowedRoles: ['admin', 'manager'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);

  let exportId = '';
  try {
    const body = parseJsonBody(event);
    const projectId = String(body.project_id || '');
    const config = body.config || {};
    if (!projectId) throw new Error('Missing mockup project ID.');
    if (!String(config.name || '').trim()) throw new Error('Enter the WooCommerce product name.');

    const [{ data: project, error: projectError }, { data: outputs, error: outputsError }] = await Promise.all([
      auth.supabase.from('mockup_projects').select('*').eq('id', projectId).single(),
      auth.supabase.from('mockup_outputs').select('*').eq('project_id', projectId).eq('is_selected', true).order('woo_position'),
    ]);
    if (projectError) throw projectError;
    if (outputsError) throw outputsError;
    if (!outputs?.length) throw new Error('Select at least one mockup output for the store.');

    const existingId = Number(config.update_existing_product_id || project.woo_product_id || 0) || null;
    const operation = existingId ? (config.status === 'publish' ? 'update_published' : 'update_draft') : (config.status === 'publish' ? 'publish' : 'create_draft');
    const { data: exportRow, error: exportError } = await auth.supabase.from('mockup_woo_exports').insert({ project_id: projectId, operation, status: 'processing', request_payload: config }).select('*').single();
    if (exportError) throw exportError;
    exportId = exportRow.id;

    const imageRows = [];
    for (const output of outputs) {
      const { data: signed, error: signedError } = await auth.supabase.storage.from(output.storage_bucket).createSignedUrl(output.storage_path, 900);
      if (signedError) throw signedError;
      imageRows.push({ src: signed.signedUrl, name: output.output_name, alt: output.caption_text || output.output_name });
    }

    let discovered = [];
    if (config.type === 'variable') discovered = await wooRequest('products/attributes?per_page=100');
    const parentAttributes = attributesFor(config, discovered);
    const productPayload = {
      name: String(config.name).trim(),
      type: config.type === 'variable' ? 'variable' : 'simple',
      status: ['draft', 'pending', 'private', 'publish'].includes(config.status) ? config.status : 'draft',
      description: String(config.description || ''),
      short_description: String(config.short_description || ''),
      sku: String(config.sku || ''),
      regular_price: config.type === 'simple' ? String(config.regular_price || '') : undefined,
      categories: numericIdList(config.category_ids).map((id) => ({ id })),
      tags: numericIdList(config.tag_ids).map((id) => ({ id })),
      images: imageRows,
      attributes: parentAttributes.attributes,
      meta_data: [
        { key: '_sc_mockup_project_id', value: projectId },
        { key: '_sc_mockup_captions', value: JSON.stringify(outputs.map((row) => ({ output_id: row.id, caption: row.caption_text, font: row.caption_font, size: row.caption_size, color: row.caption_color }))) },
      ],
    };
    Object.keys(productPayload).forEach((key) => productPayload[key] === undefined && delete productPayload[key]);

    const product = await wooRequest(existingId ? `products/${existingId}` : 'products', { method: existingId ? 'PUT' : 'POST', body: productPayload });
    let variations = null;
    if (!existingId && productPayload.type === 'variable' && config.create_variations !== false) {
      const create = variationRows(parentAttributes, config.regular_price);
      if (create.length) variations = await wooRequest(`products/${product.id}/variations/batch`, { method: 'POST', body: { create } });
    }

    await auth.supabase.from('mockup_woo_exports').update({ status: 'completed', woo_product_id: product.id, response_payload: { product_id: product.id, status: product.status, permalink: product.permalink, variation_count: variations?.create?.length || 0 }, completed_at: new Date().toISOString() }).eq('id', exportId);
    await auth.supabase.from('mockup_projects').update({ status: product.status === 'publish' ? 'published' : 'woo_draft', woo_product_id: product.id, woo_product_url: product.permalink || null, woo_config: config }).eq('id', projectId);
    return jsonResponse(200, { success: true, product: { id: product.id, status: product.status, permalink: product.permalink }, variations_created: variations?.create?.length || 0 }, event);
  } catch (error) {
    console.error('WooCommerce mockup export failed:', error);
    if (exportId) await auth.supabase.from('mockup_woo_exports').update({ status: 'failed', error_message: error.message, completed_at: new Date().toISOString() }).eq('id', exportId);
    return jsonResponse(500, { success: false, error: error.message || 'WooCommerce export failed.' }, event);
  }
}
