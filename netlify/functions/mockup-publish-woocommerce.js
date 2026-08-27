import { createHash } from 'node:crypto';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { commaList, numericIdList, parseJsonBody, safePathSegment, wooCollection, wooRequest } from './_shared/mockupUtils.js';
import { signedStoredAssetUrl } from './_shared/mockupStorage.js';

const MAX_VARIATIONS = 500;
const WOO_BATCH_SIZE = 25;
const WOO_IMAGE_BATCH_SIZE = 1;

function listValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return commaList(value);
}

function normalized(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

function imageMapKey(color, logo) {
  return JSON.stringify([normalized(color), normalized(logo)]);
}

function canonicalSavedPairKey(value) {
  try {
    const parsed = JSON.parse(String(value || ''));
    if (Array.isArray(parsed) && parsed.length >= 2) return imageMapKey(parsed[0], parsed[1]);
  } catch { /* preserve an invalid legacy key so normal validation can report it */ }
  return String(value || '');
}

export function canonicalVariationImageMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const canonical = {};
  for (const [savedKey, outputId] of Object.entries(value)) {
    const key = canonicalSavedPairKey(savedKey);
    if (!key || !outputId) continue;
    // Prefer a key already saved in canonical form over an older UI key when
    // both normalize to the same Color/Logo combination.
    if (!canonical[key] || savedKey === key) canonical[key] = String(outputId);
  }
  return canonical;
}

export function canonicalExcludedVariationPairs(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(canonicalSavedPairKey).filter(Boolean))];
}

function findAttribute(discovered, slugs, names = []) {
  const wantedSlugs = slugs.map(normalized);
  const wantedNames = names.map(normalized);
  return discovered.find((row) => wantedSlugs.includes(normalized(row.slug)) || wantedNames.includes(normalized(row.name)));
}

async function allAttributeTerms(attributeId) {
  const rows = [];
  for (let page = 1; page <= 20; page += 1) {
    const next = wooCollection(
      await wooRequest(`products/attributes/${attributeId}/terms?per_page=100&page=${page}`),
      `attribute ${attributeId} terms`,
    );
    rows.push(...next);
    if (next.length < 100) break;
  }
  return rows;
}

async function validatedGlobalAttribute(attribute, options, label, position, variation) {
  if (!options.length) return null;
  if (!attribute?.id) throw new Error(`WooCommerce global attribute ${label} was not found. Create ${label} in Products > Attributes before exporting.`);
  const terms = await allAttributeTerms(attribute.id);
  const canonical = [];
  for (const requested of options) {
    const term = terms.find((row) => normalized(row.name) === normalized(requested) || normalized(row.slug) === normalized(requested));
    if (!term) throw new Error(`${label} option "${requested}" does not exist in WooCommerce. Add it under Products > Attributes > ${label} first.`);
    if (!canonical.some((name) => normalized(name) === normalized(term.name))) canonical.push(term.name);
  }
  return {
    definition: { id: attribute.id, position, visible: true, variation, options: canonical },
    reference: { id: attribute.id, name: attribute.name },
    options: canonical,
  };
}

function customLogoAttribute(options, position) {
  const canonical = options.filter((option, index, rows) => rows.findIndex((candidate) => normalized(candidate) === normalized(option)) === index);
  if (!canonical.length) return null;
  return {
    definition: { name: 'Logo Selection', position, visible: true, variation: true, options: canonical },
    reference: { name: 'Logo Selection' },
    options: canonical,
  };
}

async function productAttributes(config, discovered) {
  const brandValue = String(config.brand || '').trim();
  const styleValue = String(config.style || '').trim();
  if (!brandValue) throw new Error('Select a Brand before creating the WooCommerce product.');
  if (!styleValue) throw new Error('Select a Style before creating the WooCommerce product.');

  const brand = findAttribute(discovered, ['pa_brand'], ['brand']);
  const style = findAttribute(discovered, ['pa_style'], ['style', 'product style']);
  const color = findAttribute(discovered, ['pa_color'], ['color', 'colour']);
  const size = findAttribute(discovered, ['pa_size'], ['size']);

  const brandAttribute = await validatedGlobalAttribute(brand, [brandValue], 'Brand', 0, false);
  const styleAttribute = await validatedGlobalAttribute(style, [styleValue], 'Style', 1, false);
  const colorAttribute = await validatedGlobalAttribute(color, listValue(config.colors), 'Color', 2, config.type === 'variable');
  const sizeAttribute = await validatedGlobalAttribute(size, listValue(config.sizes), 'Size', 3, config.type === 'variable');
  const logoAttribute = config.type === 'variable' ? customLogoAttribute(listValue(config.logo_options), 4) : null;
  const ordered = [brandAttribute, styleAttribute, colorAttribute, sizeAttribute, logoAttribute].filter(Boolean);

  return {
    definitions: ordered.map((row) => row.definition),
    brand: brandAttribute,
    style: styleAttribute,
    color: colorAttribute,
    size: sizeAttribute,
    logo: logoAttribute,
  };
}

function variationAttribute(reference, option) {
  return reference.id ? { id: reference.id, option } : { name: reference.name, option };
}

function skuPart(value, fallback) {
  return safePathSegment(value, fallback).replace(/-/g, '').toUpperCase().slice(0, 16);
}

function variationSku(base, color, size, logo) {
  const readable = [color, size, logo].filter(Boolean).map((value) => skuPart(value, 'OPTION')).join('-');
  const digest = createHash('sha256').update(JSON.stringify([normalized(color), normalized(size), normalized(logo)])).digest('hex').slice(0, 10).toUpperCase();
  return `${base}-${readable || 'DEFAULT'}-${digest}`.slice(0, 100);
}

function variationSignature(attributes) {
  return attributes
    .map((row) => `${row.id ? `id:${row.id}` : `name:${normalized(row.name)}`}=${normalized(row.option)}`)
    .sort()
    .join('|');
}

function variationRows(parent, config, productId, imageIdByOutput) {
  const colors = parent.color?.options?.length ? parent.color.options : [null];
  const sizes = parent.size?.options?.length ? parent.size.options : [null];
  const logos = parent.logo?.options?.length ? parent.logo.options : [null];
  const rows = [];
  const outputMap = canonicalVariationImageMap(config.variation_image_map);
  const excludedPairs = new Set(canonicalExcludedVariationPairs(config.excluded_variation_pairs));
  const fallbackImageId = imageIdByOutput.values().next().value || null;
  const skuBase = skuPart(config.sku || `MS-${productId}`, `MS${productId}`);

  for (const color of colors) for (const size of sizes) for (const logo of logos) {
    if (excludedPairs.has(imageMapKey(color, logo))) continue;
    const attributes = [];
    if (color) attributes.push(variationAttribute(parent.color.reference, color));
    if (size) attributes.push(variationAttribute(parent.size.reference, size));
    if (logo) attributes.push(variationAttribute(parent.logo.reference, logo));
    const outputId = outputMap[imageMapKey(color, logo)] || '';
    const imageId = imageIdByOutput.get(outputId) || ((!color && !logo) ? fallbackImageId : null);
    if ((colors.length > 1 || logos.length > 1 || color || logo) && !imageId) {
      throw new Error(`Choose a variation mockup for ${color || 'all colors'} / ${logo || 'no logo option'}.`);
    }
    const row = {
      regular_price: String(config.regular_price || ''),
      status: 'publish',
      sku: variationSku(skuBase, color, size, logo),
      attributes,
      meta_data: [
        { key: '_sc_mockup_project_id', value: String(config.project_id || '') },
        { key: '_sc_logo_selection', value: logo || '' },
        { key: '_sc_blank_color', value: color || '' },
      ],
    };
    if (imageId) row.image = { id: imageId };
    rows.push(row);
  }
  if (!rows.length) throw new Error('Include at least one Color and Logo combination before exporting variations.');
  if (rows.length > MAX_VARIATIONS) throw new Error(`This export would create ${rows.length} variations. Reduce the combinations to ${MAX_VARIATIONS} or fewer.`);
  const skuCounts = new Map();
  const signatureCounts = new Map();
  rows.forEach((row) => {
    skuCounts.set(row.sku, (skuCounts.get(row.sku) || 0) + 1);
    const signature = variationSignature(row.attributes);
    signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1);
  });
  const duplicateSku = [...skuCounts].find(([, count]) => count > 1)?.[0];
  const duplicateSignature = [...signatureCounts].find(([, count]) => count > 1)?.[0];
  if (duplicateSku || duplicateSignature) throw new Error(`Variation preflight found a duplicate ${duplicateSku ? `SKU (${duplicateSku})` : `attribute combination (${duplicateSignature})`}. Remove duplicate Color, Size, or Logo choices and retry.`);
  return rows;
}

async function listExistingVariations(productId) {
  const rows = [];
  for (let page = 1; page <= 50; page += 1) {
    const next = wooCollection(
      await wooRequest(`products/${productId}/variations?per_page=100&page=${page}`),
      `product ${productId} variations`,
    );
    rows.push(...next);
    if (next.length < 100) break;
  }
  return rows;
}

async function syncVariations(productId, desired, onProgress = async () => {}) {
  const existing = await listExistingVariations(productId);
  const existingBySignature = new Map(existing.map((row) => [variationSignature(row.attributes || []), row]));
  const desiredSignatures = new Set(desired.map((row) => variationSignature(row.attributes)));
  const projectId = String(desired[0]?.meta_data?.find((row) => row.key === '_sc_mockup_project_id')?.value || '');
  const creates = [];
  const updates = [];
  desired.forEach((row) => {
    const match = existingBySignature.get(variationSignature(row.attributes));
    if (match) updates.push({ type: 'update', row: { ...row, id: match.id } });
    else creates.push({ type: 'create', row });
  });
  const staleProjectVariations = existing.filter((row) => {
    const belongsToProject = row.meta_data?.some((item) => item.key === '_sc_mockup_project_id' && String(item.value) === projectId);
    return belongsToProject && !desiredSignatures.has(variationSignature(row.attributes || []));
  });
  const deactivates = staleProjectVariations.map((row) => ({ type: 'deactivate', row: { id: row.id, status: 'private' } }));
  // Create missing combinations first. A previous partial export may already have
  // 100+ variations; updating those first can starve the missing sizes if a host
  // or function timeout interrupts a later batch.
  const operations = [...creates, ...updates, ...deactivates];
  let created = 0;
  let updated = 0;
  let deactivated = 0;
  for (let offset = 0; offset < operations.length; offset += WOO_BATCH_SIZE) {
    const batch = operations.slice(offset, offset + WOO_BATCH_SIZE);
    const create = batch.filter((item) => item.type === 'create').map((item) => item.row);
    const updateRows = batch.filter((item) => item.type === 'update');
    const deactivateRows = batch.filter((item) => item.type === 'deactivate');
    const update = [...updateRows, ...deactivateRows].map((item) => item.row);
    const result = await wooRequest(`products/${productId}/variations/batch`, { method: 'POST', body: { create, update } });
    const createResults = Array.isArray(result?.create) ? result.create : [];
    const updateResults = Array.isArray(result?.update) ? result.update : [];
    const failures = [...createResults, ...updateResults].filter((row) => row?.error || row?.code || !row?.id);
    if (failures.length) {
      const details = failures.slice(0, 5).map((row) => row?.error?.message || row?.message || row?.code || 'Unknown WooCommerce batch error').join(' | ');
      throw new Error(`WooCommerce rejected ${failures.length} variation operation${failures.length === 1 ? '' : 's'}: ${details}`);
    }
    if (createResults.length !== create.length || updateResults.length !== update.length) {
      throw new Error(`WooCommerce returned an incomplete variation batch response (${createResults.length}/${create.length} creates and ${updateResults.length}/${update.length} updates).`);
    }
    created += createResults.length;
    updated += updateRows.length;
    deactivated += deactivateRows.length;
    await onProgress({
      processed: Math.min(offset + batch.length, operations.length),
      total: operations.length,
      created,
      updated,
      deactivated,
    });
  }
  const reconciled = await listExistingVariations(productId);
  const activeBySignature = new Map();
  reconciled.filter((row) => row.status !== 'private').forEach((row) => {
    const signature = variationSignature(row.attributes || []);
    activeBySignature.set(signature, [...(activeBySignature.get(signature) || []), row]);
  });
  const missing = desired.filter((row) => !activeBySignature.has(variationSignature(row.attributes)));
  const duplicates = desired.filter((row) => (activeBySignature.get(variationSignature(row.attributes)) || []).length > 1);
  if (missing.length || duplicates.length) {
    throw new Error(`WooCommerce variation reconciliation failed: ${missing.length} required combination${missing.length === 1 ? '' : 's'} missing and ${duplicates.length} duplicated. The draft was preserved; retry the export to repair it.`);
  }
  const touchedExisting = desired.filter((row) => existingBySignature.has(variationSignature(row.attributes))).length + staleProjectVariations.length;
  return { created, updated, deactivated, untouched: Math.max(0, existing.length - touchedExisting) };
}

function imageRowsFor(outputs) {
  return outputs.map((output) => output.woo_media_id
    ? { id: output.woo_media_id, name: output.output_name, alt: output.caption_text || output.output_name }
    : { src: output.signed_url, name: `SC Mockup ${output.id} - ${output.output_name}`, alt: output.caption_text || output.output_name });
}

function mapWooImages(outputs, productImages) {
  const result = new Map();
  outputs.forEach((output) => {
    const existing = output.woo_media_id ? productImages.find((image) => Number(image.id) === Number(output.woo_media_id)) : null;
    const byName = productImages.find((image) => String(image.name || '').includes(output.id));
    const matched = existing || byName;
    if (matched?.id) result.set(output.id, Number(matched.id));
    else if (output.woo_media_id) result.set(output.id, Number(output.woo_media_id));
  });
  return result;
}

function projectMetaMatches(product, projectId) {
  return product?.meta_data?.some((item) => item.key === '_sc_mockup_project_id' && String(item.value) === String(projectId));
}

async function findExistingProjectProduct(projectId, sku = '') {
  const queries = [];
  if (String(sku || '').trim()) {
    queries.push(`products?sku=${encodeURIComponent(String(sku).trim())}&status=any&context=edit&per_page=100`);
  }
  for (let page = 1; page <= 50; page += 1) {
    queries.push(`products?status=any&context=edit&per_page=100&page=${page}&orderby=id&order=asc`);
  }
  for (const query of queries) {
    const products = wooCollection(await wooRequest(query), 'project products');
    const matched = products.find((product) => projectMetaMatches(product, projectId));
    if (matched) return matched;
    if (query.includes('&page=') && products.length < 100) break;
  }
  return null;
}

async function syncProductImages(supabase, product, outputs, onProgress = async () => {}) {
  let currentProduct = product;
  const imageIdByOutput = mapWooImages(outputs, product.images || []);
  const pending = outputs.filter((output) => !imageIdByOutput.has(output.id));
  const knownOutputIds = new Set(outputs.map((output) => String(output.id)));
  const knownMediaIds = new Set(outputs.map((output) => Number(output.woo_media_id || 0)).filter(Boolean));
  const preservedImages = (product.images || []).filter((image) => {
    if (knownMediaIds.has(Number(image.id))) return false;
    const name = String(image.name || '');
    if (/^SC Mockup\s/i.test(name)) return false;
    return ![...knownOutputIds].some((id) => name.includes(id));
  }).map((image) => ({ id: Number(image.id), name: image.name, alt: image.alt })).filter((image) => image.id);

  for (let offset = 0; offset < pending.length; offset += WOO_IMAGE_BATCH_SIZE) {
    const batch = pending.slice(offset, offset + WOO_IMAGE_BATCH_SIZE);
    const batchIds = new Set(batch.map((output) => output.id));
    const includedOutputs = outputs.filter((output) => imageIdByOutput.has(output.id) || batchIds.has(output.id));
    const images = [...includedOutputs.map((output) => {
      const mediaId = imageIdByOutput.get(output.id);
      return mediaId
        ? { id: mediaId, name: output.output_name, alt: output.caption_text || output.output_name }
        : imageRowsFor([output])[0];
    }), ...preservedImages];
    const beforeIds = new Set((currentProduct.images || []).map((image) => Number(image.id)).filter(Boolean));
    currentProduct = await wooRequest(`products/${product.id}`, { method: 'PUT', body: { images } });
    const returnedImages = currentProduct.images || [];
    includedOutputs.forEach((output) => {
      const byName = returnedImages.find((image) => String(image.name || '').includes(output.id));
      const newImages = returnedImages.filter((image) => !beforeIds.has(Number(image.id)) && !preservedImages.some((saved) => saved.id === Number(image.id)));
      const matched = byName || (batch.length === 1 && newImages.length === 1 ? newImages[0] : null);
      if (matched?.id) imageIdByOutput.set(output.id, Number(matched.id));
    });
    const unresolved = batch.filter((output) => !imageIdByOutput.has(output.id));
    if (unresolved.length) throw new Error(`WooCommerce did not return media IDs for ${unresolved.length} mockup image${unresolved.length === 1 ? '' : 's'}.`);
    await Promise.all(batch.map((output) => supabase
      .from('mockup_outputs')
      .update({ woo_media_id: imageIdByOutput.get(output.id) })
      .eq('id', output.id)));
    await onProgress({ processed: Math.min(offset + batch.length, pending.length), total: pending.length });
  }

  const orderedImages = [...outputs.map((output) => ({
    id: imageIdByOutput.get(output.id),
    name: output.output_name,
    alt: output.caption_text || output.output_name,
  })), ...preservedImages];
  currentProduct = await wooRequest(`products/${product.id}`, { method: 'PUT', body: { images: orderedImages } });
  return { product: currentProduct, imageIdByOutput };
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
    const config = { ...(body.config || {}), project_id: projectId };
    config.variation_image_map = canonicalVariationImageMap(config.variation_image_map);
    config.excluded_variation_pairs = canonicalExcludedVariationPairs(config.excluded_variation_pairs);
    if (!projectId) throw new Error('Missing mockup project ID.');

    let exportRow = null;
    const requestedExportId = String(body.export_id || '');
    if (requestedExportId) {
      const { data, error } = await auth.supabase
        .from('mockup_woo_exports')
        .select('*')
        .eq('id', requestedExportId)
        .eq('project_id', projectId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('The queued WooCommerce export could not be found for this project.');
      exportRow = data;
      exportId = data.id;
    }

    if (!String(config.name || '').trim()) throw new Error('Enter the WooCommerce product name.');

    const [{ data: project, error: projectError }, { data: outputs, error: outputsError }] = await Promise.all([
      auth.supabase.from('mockup_projects').select('*').eq('id', projectId).single(),
      auth.supabase.from('mockup_outputs').select('*').eq('project_id', projectId).eq('is_selected', true).order('woo_position'),
    ]);
    if (projectError) throw projectError;
    if (outputsError) throw outputsError;
    if (!outputs?.length) throw new Error('Select at least one mockup output for the store.');
    const staleCaptions = outputs.filter((output) => output.output_kind === 'captioned' && output.metadata?.caption_render_state === 'stale');
    if (staleCaptions.length) throw new Error(`Regenerate ${staleCaptions.length} selected captioned mockup${staleCaptions.length === 1 ? '' : 's'} before exporting. Caption settings changed after the image was rendered.`);

    const categoryIds = numericIdList(config.category_ids);
    if (!categoryIds.length) throw new Error('Select at least one WooCommerce product category.');
    if (!String(config.shipping_class || '').trim()) throw new Error('Select a WooCommerce shipping class.');
    const shippingValues = {
      weight: Number(config.weight || 0),
      length: Number(config.length || 0),
      width: Number(config.width || 0),
      height: Number(config.height || 0),
    };
    for (const [label, value] of Object.entries(shippingValues)) {
      if (!Number.isFinite(value) || value <= 0) throw new Error(`Enter a ${label} greater than zero.`);
    }
    const mainOutputId = String(config.main_product_image_output_id || '');
    const mainOutput = outputs.find((row) => row.id === mainOutputId);
    if (!mainOutput) throw new Error('Choose a selected mockup as the main product image.');
    const storeOutputs = [mainOutput, ...outputs.filter((row) => row.id !== mainOutput.id)];

    let existingId = Number(config.update_existing_product_id || project.woo_product_id || exportRow?.woo_product_id || 0) || null;
    let recoveredProduct = null;
    if (!existingId) {
      recoveredProduct = await findExistingProjectProduct(projectId, config.sku);
      existingId = Number(recoveredProduct?.id || 0) || null;
    }
    const operation = existingId ? (config.status === 'publish' ? 'update_published' : 'update_draft') : (config.status === 'publish' ? 'publish' : 'create_draft');
    if (exportRow) {
      const { error: exportError } = await auth.supabase.from('mockup_woo_exports').update({
        operation,
        status: 'processing',
        request_payload: config,
        response_payload: { stage: 'preparing_product' },
        error_message: null,
        completed_at: null,
      }).eq('id', exportId);
      if (exportError) throw exportError;
    } else {
      const { data, error: exportError } = await auth.supabase.from('mockup_woo_exports').insert({
        project_id: projectId,
        operation,
        status: 'processing',
        request_payload: config,
        response_payload: { stage: 'preparing_product' },
      }).select('*').single();
      if (exportError) throw exportError;
      exportRow = data;
      exportId = data.id;
    }

    for (const output of storeOutputs) {
      if (output.woo_media_id) continue;
      output.signed_url = await signedStoredAssetUrl(auth.supabase, output, 3600);
    }

    const discovered = wooCollection(await wooRequest('products/attributes?per_page=100'), 'product attributes');
    const parentAttributes = await productAttributes(config, discovered);
    const productPayload = {
      name: String(config.name).trim(),
      type: config.type === 'variable' ? 'variable' : 'simple',
      status: ['draft', 'pending', 'private', 'publish'].includes(config.status) ? config.status : 'draft',
      description: String(config.description || ''),
      short_description: String(config.short_description || ''),
      sku: String(config.sku || '').trim() || undefined,
      regular_price: config.type === 'simple' ? String(config.regular_price || '') : undefined,
      categories: categoryIds.map((id) => ({ id })),
      tags: numericIdList(config.tag_ids).map((id) => ({ id })),
      virtual: false,
      weight: String(shippingValues.weight),
      dimensions: {
        length: String(shippingValues.length),
        width: String(shippingValues.width),
        height: String(shippingValues.height),
      },
      shipping_class: String(config.shipping_class).trim(),
      attributes: parentAttributes.definitions,
      meta_data: [
        { key: '_sc_mockup_project_id', value: projectId },
        { key: '_sc_main_product_image_output_id', value: mainOutputId },
        { key: '_sc_brand', value: config.brand },
        { key: '_sc_style', value: config.style },
        { key: '_sc_logo_options', value: JSON.stringify(listValue(config.logo_options)) },
        { key: '_sc_variation_image_map', value: JSON.stringify(config.variation_image_map || {}) },
        { key: '_sc_excluded_variation_pairs', value: JSON.stringify(config.excluded_variation_pairs || []) },
        { key: '_sc_mockup_captions', value: JSON.stringify(storeOutputs.map((row) => ({ output_id: row.id, caption: row.caption_text, font: row.caption_font, size: row.caption_size, color: row.caption_color }))) },
      ],
    };
    Object.keys(productPayload).forEach((key) => productPayload[key] === undefined && delete productPayload[key]);

    let product = recoveredProduct
      ? await wooRequest(`products/${existingId}`, { method: 'PUT', body: productPayload })
      : await wooRequest(existingId ? `products/${existingId}` : 'products', { method: existingId ? 'PUT' : 'POST', body: productPayload });
    // Save the parent ID before starting variation batches. This makes a retry
    // resume the same product even if a later variation request is interrupted.
    await Promise.all([
      auth.supabase.from('mockup_woo_exports').update({
        woo_product_id: product.id,
        response_payload: { stage: 'product_ready', product_id: product.id },
      }).eq('id', exportId),
      auth.supabase.from('mockup_projects').update({
        woo_product_id: product.id,
        woo_product_url: product.permalink || null,
        woo_config: config,
      }).eq('id', projectId),
    ]);
    const imageResult = await syncProductImages(auth.supabase, product, storeOutputs, async (progress) => {
      await auth.supabase.from('mockup_woo_exports').update({
        response_payload: {
          stage: 'images',
          product_id: product.id,
          images_processed: progress.processed,
          images_total: progress.total,
        },
      }).eq('id', exportId);
    });
    product = imageResult.product;
    const imageIdByOutput = imageResult.imageIdByOutput;

    let variationResult = { created: 0, updated: 0, deactivated: 0, untouched: 0 };
    if (productPayload.type === 'variable' && config.create_variations !== false) {
      const desired = variationRows(parentAttributes, config, product.id, imageIdByOutput);
      if (desired.length) {
        variationResult = await syncVariations(product.id, desired, async (progress) => {
          await auth.supabase.from('mockup_woo_exports').update({
            response_payload: {
              stage: 'variations',
              product_id: product.id,
              variations_processed: progress.processed,
              variations_total: progress.total,
              variations_created: progress.created,
              variations_updated: progress.updated,
              variations_deactivated: progress.deactivated,
            },
          }).eq('id', exportId);
        });
      }
    }

    const responsePayload = {
      product_id: product.id,
      status: product.status,
      permalink: product.permalink,
      variations_created: variationResult.created,
      variations_updated: variationResult.updated,
      variations_deactivated: variationResult.deactivated || 0,
      existing_variations_untouched: variationResult.untouched,
    };
    await auth.supabase.from('mockup_woo_exports').update({ status: 'completed', woo_product_id: product.id, response_payload: responsePayload, completed_at: new Date().toISOString() }).eq('id', exportId);
    await auth.supabase.from('mockup_projects').update({ status: product.status === 'publish' ? 'published' : 'woo_draft', woo_product_id: product.id, woo_product_url: product.permalink || null, woo_config: config }).eq('id', projectId);
    return jsonResponse(200, { success: true, product: { id: product.id, status: product.status, permalink: product.permalink }, ...responsePayload }, event);
  } catch (error) {
    console.error('WooCommerce mockup export failed:', error);
    if (exportId) await auth.supabase.from('mockup_woo_exports').update({ status: 'failed', error_message: error.message, completed_at: new Date().toISOString() }).eq('id', exportId);
    return jsonResponse(500, { success: false, error: error.message || 'WooCommerce export failed.' }, event);
  }
}
