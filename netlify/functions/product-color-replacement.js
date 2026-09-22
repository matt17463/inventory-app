import { createHash, randomUUID } from 'node:crypto';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { parseJsonBody, wooCollection, wooRequest } from './_shared/mockupUtils.js';
import {
  cleanObjectName,
  deleteStoredReference,
  presignedR2Put,
  r2BucketName,
  r2Configured,
  signedStoredAssetUrl,
} from './_shared/mockupStorage.js';

const FUNCTION_NAME = 'product-color-replacement';
const WOO_BATCH_SIZE = 25;
const MAX_SEARCH_RESULTS = 50;
const MAX_VARIATION_PAGES = 20;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const COLOR_IMAGE_META_KEY = '_sc_catalog_color_images';

function text(value) {
  return String(value ?? '').trim();
}

function normalized(value) {
  return text(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function chunks(rows, size = 100) {
  const result = [];
  for (let offset = 0; offset < rows.length; offset += size) result.push(rows.slice(offset, offset + size));
  return result;
}

function isActiveStatus(status) {
  return !/(?:complete|completed|cancel|cancelled|canceled|void|deleted|closed|private|trash)/i.test(text(status));
}

function isColorAttribute(attribute, colorAttributeId = null) {
  if (!attribute) return false;
  if (colorAttributeId && Number(attribute.id) === Number(colorAttributeId)) return true;
  const slug = normalized(attribute.slug);
  const name = normalized(attribute.name);
  return slug === 'pa color' || slug === 'color' || name === 'color' || name === 'colour';
}

function isLogoAttribute(attribute) {
  if (!attribute) return false;
  const name = normalized(attribute.name || attribute.slug);
  return name === 'logo' || name === 'logo selection' || name === 'graphic' || name === 'graphic selection';
}

function replaceColorAttribute(attributes, colorAttributeId, fromColor, toColor) {
  const from = normalized(fromColor);
  let changed = false;
  const next = (attributes || []).map((attribute) => {
    if (!isColorAttribute(attribute, colorAttributeId)) return attribute;
    if (normalized(attribute.option) !== from) return attribute;
    changed = true;
    return { ...attribute, option: toColor };
  });
  return { attributes: next, changed };
}

function variationSignature(attributes, colorAttributeId, replaceFrom = '', replaceTo = '') {
  const from = normalized(replaceFrom);
  return (attributes || [])
    .map((attribute) => {
      const key = attribute.id ? `id:${Number(attribute.id)}` : `name:${normalized(attribute.name)}`;
      let option = normalized(attribute.option);
      if (isColorAttribute(attribute, colorAttributeId) && from && option === from) option = normalized(replaceTo);
      return `${key}=${option}`;
    })
    .sort()
    .join('|');
}

function variationLogo(variation) {
  const attribute = (variation?.attributes || []).find(isLogoAttribute);
  if (attribute?.option) return text(attribute.option);
  const metadata = (variation?.meta_data || []).find((row) => row.key === '_sc_logo_selection');
  return text(metadata?.value);
}

function imageSlotKey(color, logo) {
  return createHash('sha256')
    .update(JSON.stringify([normalized(color), normalized(logo || '__default__')]))
    .digest('hex')
    .slice(0, 16);
}

function metaWithBlank(metaData, blankProductId, colorName) {
  const rows = Array.isArray(metaData) ? metaData.map((row) => ({ ...row })) : [];
  function upsert(key, value) {
    const index = rows.findIndex((row) => row.key === key);
    const replacement = index >= 0 ? { ...rows[index], value } : { key, value };
    if (index >= 0) rows[index] = replacement;
    else rows.push(replacement);
  }
  upsert('_sc_blank_product_id', blankProductId);
  upsert('_sc_blank_color', colorName);
  return rows;
}

function blankIdentityKey(row, targetColorId) {
  return [
    text(row?.brand_id),
    text(row?.product_type_id),
    text(targetColorId),
    text(row?.size_id),
  ].join('|');
}

function blankLabel(row) {
  return [
    row?.sku_base || row?.name,
    row?.brands?.name || row?.brands?.code,
    row?.product_types?.name || row?.product_types?.code,
    row?.colors?.name || row?.colors?.code,
    row?.sizes?.name || row?.sizes?.code,
  ].filter(Boolean).join(' · ');
}

function replacementToken(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function skuToken(value) {
  return text(value).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28) || 'COLOR';
}

function deriveAddedSku(templateSku, templateColor, newColor, signature) {
  const original = text(templateSku);
  const oldToken = skuToken(templateColor);
  const newToken = skuToken(newColor);
  const hash = createHash('sha256').update(signature).digest('hex').slice(0, 8).toUpperCase();

  let candidate = original;
  if (candidate && oldToken && candidate.toUpperCase().includes(oldToken)) {
    candidate = candidate.replace(new RegExp(oldToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), newToken);
  } else if (candidate) {
    candidate = `${candidate}-${newToken}`;
  } else {
    candidate = `SC-${newToken}`;
  }

  candidate = candidate.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  if (candidate.length > 90) candidate = candidate.slice(0, 90).replace(/-+$/g, '');
  return `${candidate}-${hash}`.slice(0, 100);
}

function copyVariationSettings(template) {
  const row = {
    status: template.status === 'private' ? 'publish' : (template.status || 'publish'),
    regular_price: text(template.regular_price),
    sale_price: text(template.sale_price),
    virtual: Boolean(template.virtual),
    downloadable: Boolean(template.downloadable),
    tax_class: template.tax_class || '',
    weight: text(template.weight),
    dimensions: template.dimensions || undefined,
    shipping_class: template.shipping_class || '',
    menu_order: Number(template.menu_order || 0),
  };
  Object.keys(row).forEach((key) => {
    if (row[key] === undefined || row[key] === '') delete row[key];
  });
  return row;
}

function parseColorImageMap(product) {
  const entries = (product?.meta_data || []).filter((row) => row.key === COLOR_IMAGE_META_KEY);
  const value = entries.length ? entries[entries.length - 1]?.value : null;
  if (!value) return {};
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function colorImageMetaRow(product, map) {
  const existing = (product?.meta_data || []).filter((row) => row.key === COLOR_IMAGE_META_KEY).pop();
  return {
    ...(existing?.id ? { id: existing.id } : {}),
    key: COLOR_IMAGE_META_KEY,
    value: JSON.stringify(map),
  };
}

async function listAttributeTerms(attributeId) {
  const rows = [];
  for (let page = 1; page <= 20; page += 1) {
    const next = wooCollection(
      await wooRequest(`products/attributes/${attributeId}/terms?per_page=100&page=${page}&hide_empty=false`),
      'color attribute terms',
    );
    rows.push(...next);
    if (next.length < 100) break;
  }
  return rows;
}

async function colorAttributeDefinition() {
  const attributes = wooCollection(
    await wooRequest('products/attributes?per_page=100'),
    'product attributes',
  );
  const color = attributes.find((row) => isColorAttribute(row));
  if (!color?.id) throw new Error('WooCommerce global Color attribute was not found.');
  const terms = await listAttributeTerms(color.id);
  return { attribute: color, terms };
}

async function listVariations(productId) {
  const rows = [];
  for (let page = 1; page <= MAX_VARIATION_PAGES; page += 1) {
    const next = wooCollection(
      await wooRequest(`products/${productId}/variations?per_page=100&page=${page}`),
      `variations for product ${productId}`,
    );
    rows.push(...next);
    if (next.length < 100) break;
  }
  if (rows.length >= MAX_VARIATION_PAGES * 100) {
    throw new Error(`Product ${productId} has too many variations for the guarded color manager.`);
  }
  return rows;
}

async function productSearch(search) {
  const query = text(search);
  if (!query) return [];
  const directId = /^\d+$/.test(query) ? Number(query) : null;
  let rows = [];
  if (directId) {
    try {
      const product = await wooRequest(`products/${directId}?context=edit`);
      if (product?.id) rows = [product];
    } catch {
      // Numeric SKUs can fall through to the normal search.
    }
  }
  if (!rows.length) {
    rows = wooCollection(
      await wooRequest(`products?search=${encodeURIComponent(query)}&status=any&context=edit&per_page=${MAX_SEARCH_RESULTS}`),
      'WooCommerce products',
    );
  }
  return rows.filter((row) => row?.id).map((row) => ({
    id: Number(row.id),
    name: row.name || `Product ${row.id}`,
    sku: row.sku || '',
    status: row.status || '',
    type: row.type || '',
    permalink: row.permalink || '',
  }));
}

async function inspectProduct(productId) {
  const product = await wooRequest(`products/${Number(productId)}?context=edit`);
  if (!product?.id) throw new Error('WooCommerce product was not found.');
  if (product.type !== 'variable') throw new Error('The Product Color Manager supports variable WooCommerce products only.');

  const { attribute, terms } = await colorAttributeDefinition();
  const parentColor = (product.attributes || []).find((row) => isColorAttribute(row, attribute.id));
  if (!parentColor) throw new Error('The selected product does not use the global WooCommerce Color attribute.');

  const variations = await listVariations(product.id);
  const variationColors = [...new Set(
    variations.flatMap((variation) => (
      (variation.attributes || [])
        .filter((row) => isColorAttribute(row, attribute.id))
        .map((row) => text(row.option))
    )).filter(Boolean),
  )];

  const logos = [...new Set(variations.map(variationLogo).filter(Boolean))];

  return {
    product: {
      id: Number(product.id),
      name: product.name || `Product ${product.id}`,
      sku: product.sku || '',
      status: product.status || '',
      type: product.type || '',
      permalink: product.permalink || '',
      date_modified_gmt: product.date_modified_gmt || product.date_modified || '',
    },
    color_attribute: { id: Number(attribute.id), name: attribute.name, slug: attribute.slug },
    parent_color_options: parentColor.options || [],
    variation_colors: variationColors,
    variation_logos: logos,
    woo_color_terms: terms.map((row) => ({ id: Number(row.id), name: row.name, slug: row.slug })),
    variation_count: variations.length,
  };
}

async function internalColorId(supabase, colorName) {
  const { data, error } = await supabase.from('colors').select('id,name,code').limit(2000);
  if (error) throw error;
  const wanted = normalized(colorName);
  const matches = (data || []).filter((row) => (
    normalized(row.name) === wanted || normalized(row.code) === wanted
  ));
  return matches.length === 1 ? { id: matches[0].id, matches } : { id: null, matches };
}

async function localProductRows(supabase, variationIds) {
  const rows = [];
  for (const batch of chunks(variationIds, 100)) {
    const { data, error } = await supabase
      .from('products')
      .select('id,sku,name,woocommerce_product_id,woocommerce_variation_id,blank_product_id,color_id')
      .in('woocommerce_variation_id', batch);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

async function blankRowsByIds(supabase, ids) {
  if (!ids.length) return [];
  const rows = [];
  for (const batch of chunks(ids, 100)) {
    const { data, error } = await supabase
      .from('blank_products')
      .select(`
        id,sku_base,name,brand_id,product_type_id,color_id,size_id,sc_is_archived,
        brands:brand_id(name,code),
        product_types:product_type_id(name,code),
        colors:color_id(name,code),
        sizes:size_id(name,code)
      `)
      .in('id', batch);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

async function targetBlankRows(supabase, targetColorId) {
  const { data, error } = await supabase
    .from('blank_products')
    .select(`
      id,sku_base,name,brand_id,product_type_id,color_id,size_id,sc_is_archived,
      brands:brand_id(name,code),
      product_types:product_type_id(name,code),
      colors:color_id(name,code),
      sizes:size_id(name,code)
    `)
    .eq('color_id', targetColorId)
    .eq('sc_is_archived', false)
    .limit(5000);
  if (error) throw error;
  return data || [];
}

function buildBlankPlanIndex(localRows, currentBlanks, targetBlanks, targetColorId) {
  const currentBlankMap = new Map(currentBlanks.map((row) => [String(row.id), row]));
  const targetIndex = new Map();
  for (const blank of targetBlanks) {
    const key = blankIdentityKey(blank, targetColorId);
    targetIndex.set(key, [...(targetIndex.get(key) || []), blank]);
  }
  const localByVariation = new Map();
  for (const row of localRows) {
    const key = String(row.woocommerce_variation_id || '');
    if (!key) continue;
    localByVariation.set(key, [...(localByVariation.get(key) || []), row]);
  }
  return { currentBlankMap, targetIndex, localByVariation };
}

function resolveTargetBlank(variationId, indexes, targetColorId, targetColorName) {
  const local = indexes.localByVariation.get(String(variationId)) || [];
  const distinctBlankIds = [...new Set(local.map((row) => row.blank_product_id).filter(Boolean).map(String))];
  if (!local.length) return { status: 'blocked', issue: 'No synced Supabase product row exists for the template Woo variation.', local };
  if (distinctBlankIds.length === 0) return { status: 'blocked', issue: 'The template Woo variation has no current blank mapping.', local };
  if (distinctBlankIds.length > 1) return { status: 'blocked', issue: `Synced product rows disagree on the current blank (${distinctBlankIds.length} different blanks).`, local };

  const currentBlank = indexes.currentBlankMap.get(distinctBlankIds[0]) || null;
  if (!currentBlank) return { status: 'blocked', issue: 'The current mapped blank record could not be loaded.', local };
  if (!targetColorId) return { status: 'blocked', issue: `Internal color "${targetColorName}" is unavailable.`, local, currentBlank };

  const candidates = indexes.targetIndex.get(blankIdentityKey(currentBlank, targetColorId)) || [];
  if (candidates.length === 0) {
    return {
      status: 'blocked',
      issue: `No active ${targetColorName} blank exists for ${blankLabel(currentBlank)}.`,
      local,
      currentBlank,
    };
  }
  if (candidates.length > 1) {
    return {
      status: 'blocked',
      issue: `${candidates.length} candidate ${targetColorName} blanks match this blank family and size.`,
      local,
      currentBlank,
    };
  }
  return { status: 'ready', issue: '', local, currentBlank, targetBlank: candidates[0] };
}

async function openPullSheetLines(supabase, variationIds) {
  const itemRows = [];
  for (const batch of chunks(variationIds, 100)) {
    const { data, error } = await supabase
      .from('job_items')
      .select('id,job_id,status,quantity,blank_product_id,woocommerce_variation_id,order_sku,sku,pairing_source,pairing_warning,selected_bin_id')
      .in('woocommerce_variation_id', batch);
    if (error) throw error;
    itemRows.push(...(data || []));
  }
  const jobIds = [...new Set(itemRows.map((row) => row.job_id).filter(Boolean))];
  if (!jobIds.length) return [];
  const jobs = [];
  for (const batch of chunks(jobIds, 100)) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id,status,woocommerce_order_id')
      .in('id', batch);
    if (error) throw error;
    jobs.push(...(data || []));
  }
  const jobMap = new Map(jobs.map((row) => [String(row.id), row]));
  return itemRows
    .filter((row) => {
      const job = jobMap.get(String(row.job_id));
      return job && isActiveStatus(job.status) && isActiveStatus(row.status);
    })
    .map((row) => ({ ...row, woocommerce_order_id: jobMap.get(String(row.job_id))?.woocommerce_order_id || null }));
}

async function buildReplacePreview(supabase, productId, oldColorInput, newColorInput) {
  const product = await wooRequest(`products/${Number(productId)}?context=edit`);
  if (!product?.id) throw new Error('WooCommerce product was not found.');
  if (product.type !== 'variable') throw new Error('Color replacement supports variable WooCommerce products only.');

  const { attribute: colorAttribute, terms } = await colorAttributeDefinition();
  const oldTerm = terms.find((row) => normalized(row.name) === normalized(oldColorInput) || normalized(row.slug) === normalized(oldColorInput));
  const newTerm = terms.find((row) => normalized(row.name) === normalized(newColorInput) || normalized(row.slug) === normalized(newColorInput));
  if (!oldTerm) throw new Error(`WooCommerce Color term "${oldColorInput}" was not found.`);
  if (!newTerm) throw new Error(`WooCommerce Color term "${newColorInput}" was not found.`);
  if (Number(oldTerm.id) === Number(newTerm.id)) throw new Error('Choose two different WooCommerce colors.');

  const parentColor = (product.attributes || []).find((row) => isColorAttribute(row, colorAttribute.id));
  if (!parentColor || !(parentColor.options || []).some((value) => normalized(value) === normalized(oldTerm.name))) {
    throw new Error(`This product does not currently advertise "${oldTerm.name}" as a Color option.`);
  }

  const variations = await listVariations(product.id);
  const affected = variations.filter((variation) => (
    (variation.attributes || []).some((row) => isColorAttribute(row, colorAttribute.id) && normalized(row.option) === normalized(oldTerm.name))
  ));
  if (!affected.length) throw new Error(`No variations currently use "${oldTerm.name}".`);

  const blockers = [];
  const affectedIds = new Set(affected.map((row) => Number(row.id)));
  const plannedSignatureOwners = new Map();
  for (const variation of variations) {
    const signature = variationSignature(
      variation.attributes || [],
      colorAttribute.id,
      affectedIds.has(Number(variation.id)) ? oldTerm.name : '',
      affectedIds.has(Number(variation.id)) ? newTerm.name : '',
    );
    plannedSignatureOwners.set(signature, [...(plannedSignatureOwners.get(signature) || []), Number(variation.id)]);
  }
  const collisions = [...plannedSignatureOwners.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([signature, ids]) => ({ signature, variation_ids: ids }));
  if (collisions.length) blockers.push(`${collisions.length} duplicate variation combination(s) would exist after replacement.`);

  const variationIds = affected.map((row) => Number(row.id));
  const localRows = await localProductRows(supabase, variationIds);
  const currentBlankIds = [...new Set(localRows.map((row) => row.blank_product_id).filter(Boolean).map(String))];
  const currentBlanks = await blankRowsByIds(supabase, currentBlankIds);
  const colorLookup = await internalColorId(supabase, newTerm.name);
  if (!colorLookup.id) {
    blockers.push(colorLookup.matches.length > 1
      ? `Internal color "${newTerm.name}" is ambiguous (${colorLookup.matches.length} records).`
      : `Internal color "${newTerm.name}" does not exist in Supabase colors.`);
  }
  const targetBlanks = colorLookup.id ? await targetBlankRows(supabase, colorLookup.id) : [];
  const indexes = buildBlankPlanIndex(localRows, currentBlanks, targetBlanks, colorLookup.id);

  const rows = affected.map((variation) => {
    const resolution = resolveTargetBlank(variation.id, indexes, colorLookup.id, newTerm.name);
    const changed = replaceColorAttribute(variation.attributes || [], colorAttribute.id, oldTerm.name, newTerm.name);
    let status = resolution.status;
    let issue = resolution.issue;
    if (!changed.changed) {
      status = 'blocked';
      issue = 'The variation Color attribute could not be rewritten.';
    }
    if (status === 'blocked') blockers.push(`Variation ${variation.id}: ${issue}`);
    return {
      variation_id: Number(variation.id),
      sku: text(variation.sku),
      image_id: Number(variation.image?.id || 0) || null,
      old_color: oldTerm.name,
      new_color: newTerm.name,
      current_blank_product_id: resolution.currentBlank?.id || null,
      current_blank_sku: resolution.currentBlank?.sku_base || null,
      target_blank_product_id: resolution.targetBlank?.id || null,
      target_blank_sku: resolution.targetBlank?.sku_base || null,
      preview_status: status,
      issue,
      attributes_after: changed.attributes,
      meta_after: resolution.targetBlank ? metaWithBlank(variation.meta_data || [], resolution.targetBlank.id, newTerm.name) : variation.meta_data || [],
    };
  });

  const openLines = await openPullSheetLines(supabase, variationIds);
  const planByVariation = new Map(rows.map((row) => [String(row.variation_id), row]));
  const openLineRows = openLines.map((line) => {
    const plan = planByVariation.get(String(line.woocommerce_variation_id));
    return {
      job_id: line.job_id,
      job_item_id: line.id,
      order_id: line.woocommerce_order_id,
      variation_id: line.woocommerce_variation_id,
      order_sku: line.order_sku || line.sku || '',
      quantity: Number(line.quantity || 0),
      target_blank_product_id: plan?.target_blank_product_id || null,
      target_blank_sku: plan?.target_blank_sku || null,
    };
  });

  const uniqueBlockers = [...new Set(blockers)];
  const tokenPayload = {
    mode: 'replace',
    product_id: Number(product.id),
    product_modified: product.date_modified_gmt || product.date_modified || '',
    old_color_term_id: Number(oldTerm.id),
    new_color_term_id: Number(newTerm.id),
    rows: rows.map((row) => ({
      variation_id: row.variation_id,
      current_blank_product_id: row.current_blank_product_id,
      target_blank_product_id: row.target_blank_product_id,
      sku: row.sku,
    })).sort((a, b) => a.variation_id - b.variation_id),
  };

  return {
    mode: 'replace',
    product: { id: Number(product.id), name: product.name || `Product ${product.id}`, sku: product.sku || '' },
    color_attribute: { id: Number(colorAttribute.id), name: colorAttribute.name },
    old_color: { id: Number(oldTerm.id), name: oldTerm.name },
    new_color: { id: Number(newTerm.id), name: newTerm.name, internal_color_id: colorLookup.id },
    total_variations: variations.length,
    affected_variations: rows.length,
    preserved_image_assignments: rows.filter((row) => row.image_id).length,
    open_pull_sheet_lines: openLineRows,
    collisions,
    blockers: uniqueBlockers,
    warnings: [
      'Variation IDs, SKUs, prices, sizes, logo selections, and existing variation image IDs are preserved.',
      ...(openLineRows.length ? [`${openLineRows.length} active pull-sheet line(s) reference affected variations.`] : []),
    ],
    can_apply: uniqueBlockers.length === 0 && rows.every((row) => row.preview_status === 'ready'),
    confirmation_token: replacementToken(tokenPayload),
    rows,
  };
}

async function buildAddPreview(supabase, productId, templateColorInput, newColorInput) {
  const product = await wooRequest(`products/${Number(productId)}?context=edit`);
  if (!product?.id) throw new Error('WooCommerce product was not found.');
  if (product.type !== 'variable') throw new Error('Adding a color supports variable WooCommerce products only.');

  const { attribute: colorAttribute, terms } = await colorAttributeDefinition();
  const templateTerm = terms.find((row) => normalized(row.name) === normalized(templateColorInput) || normalized(row.slug) === normalized(templateColorInput));
  const newTerm = terms.find((row) => normalized(row.name) === normalized(newColorInput) || normalized(row.slug) === normalized(newColorInput));
  if (!templateTerm) throw new Error(`Template WooCommerce Color term "${templateColorInput}" was not found.`);
  if (!newTerm) throw new Error(`Replacement WooCommerce Color term "${newColorInput}" was not found.`);
  if (Number(templateTerm.id) === Number(newTerm.id)) throw new Error('The new color must differ from the template color.');

  const variations = await listVariations(product.id);
  const templateVariations = variations.filter((variation) => (
    isActiveStatus(variation.status)
    && (variation.attributes || []).some((row) => isColorAttribute(row, colorAttribute.id) && normalized(row.option) === normalized(templateTerm.name))
  ));
  if (!templateVariations.length) throw new Error(`No active variations use the template color "${templateTerm.name}".`);

  const existingBySignature = new Map(
    variations.filter((row) => isActiveStatus(row.status)).map((row) => [
      variationSignature(row.attributes || [], colorAttribute.id),
      row,
    ]),
  );
  const existingSkus = new Set(variations.map((row) => text(row.sku)).filter(Boolean).map((value) => value.toUpperCase()));

  const variationIds = templateVariations.map((row) => Number(row.id));
  const localRows = await localProductRows(supabase, variationIds);
  const currentBlankIds = [...new Set(localRows.map((row) => row.blank_product_id).filter(Boolean).map(String))];
  const currentBlanks = await blankRowsByIds(supabase, currentBlankIds);

  const blockers = [];
  const colorLookup = await internalColorId(supabase, newTerm.name);
  if (!colorLookup.id) {
    blockers.push(colorLookup.matches.length > 1
      ? `Internal color "${newTerm.name}" is ambiguous (${colorLookup.matches.length} records).`
      : `Internal color "${newTerm.name}" does not exist in Supabase colors.`);
  }
  const targetBlanks = colorLookup.id ? await targetBlankRows(supabase, colorLookup.id) : [];
  const indexes = buildBlankPlanIndex(localRows, currentBlanks, targetBlanks, colorLookup.id);

  const plannedSkus = new Set();
  const rows = [];
  let alreadyExists = 0;

  for (const template of templateVariations) {
    const changed = replaceColorAttribute(template.attributes || [], colorAttribute.id, templateTerm.name, newTerm.name);
    const targetSignature = variationSignature(changed.attributes, colorAttribute.id);
    const existingTarget = existingBySignature.get(targetSignature);
    const logo = variationLogo(template);
    const slotKey = imageSlotKey(newTerm.name, logo);
    const resolution = resolveTargetBlank(template.id, indexes, colorLookup.id, newTerm.name);

    let status = resolution.status;
    let issue = resolution.issue;
    if (!changed.changed) {
      status = 'blocked';
      issue = 'The template variation Color attribute could not be rewritten.';
    }

    if (existingTarget) {
      alreadyExists += 1;
      if (status === 'blocked') blockers.push(`Existing target variation ${existingTarget.id}: ${issue}`);
      rows.push({
        template_variation_id: Number(template.id),
        existing_variation_id: Number(existingTarget.id),
        action: 'reconcile_existing',
        logo,
        image_slot_key: slotKey,
        template_sku: text(template.sku),
        sku: text(existingTarget.sku),
        target_blank_product_id: resolution.targetBlank?.id || null,
        target_blank_sku: resolution.targetBlank?.sku_base || null,
        template_blank_sku: resolution.currentBlank?.sku_base || null,
        attributes_after: existingTarget.attributes || changed.attributes,
        meta_after: resolution.targetBlank
          ? metaWithBlank(existingTarget.meta_data || [], resolution.targetBlank.id, newTerm.name)
          : (existingTarget.meta_data || []),
        preview_status: status === 'ready' ? 'ready_existing' : status,
        issue,
      });
      continue;
    }

    let sku = deriveAddedSku(text(template.sku), templateTerm.name, newTerm.name, targetSignature);
    if (existingSkus.has(sku.toUpperCase()) || plannedSkus.has(sku.toUpperCase())) {
      const hash = createHash('sha256').update(`${targetSignature}|${template.id}`).digest('hex').slice(0, 10).toUpperCase();
      sku = `${sku.slice(0, 88).replace(/-+$/g, '')}-${hash}`.slice(0, 100);
    }
    if (existingSkus.has(sku.toUpperCase()) || plannedSkus.has(sku.toUpperCase())) {
      status = 'blocked';
      issue = `A unique SKU could not be generated from template variation ${template.id}.`;
    }
    plannedSkus.add(sku.toUpperCase());

    if (status === 'blocked') blockers.push(`Template variation ${template.id}: ${issue}`);

    rows.push({
      template_variation_id: Number(template.id),
      existing_variation_id: null,
      action: 'create',
      logo,
      image_slot_key: slotKey,
      template_sku: text(template.sku),
      sku,
      target_blank_product_id: resolution.targetBlank?.id || null,
      target_blank_sku: resolution.targetBlank?.sku_base || null,
      template_blank_sku: resolution.currentBlank?.sku_base || null,
      attributes_after: changed.attributes,
      meta_after: resolution.targetBlank ? metaWithBlank(template.meta_data || [], resolution.targetBlank.id, newTerm.name) : template.meta_data || [],
      settings: copyVariationSettings(template),
      preview_status: status,
      issue,
    });
  }

  const createRows = rows.filter((row) => row.action === 'create');
  const imageMap = parseColorImageMap(product);
  const productImageIds = new Set((product.images || []).map((row) => Number(row.id)).filter(Boolean));
  const imageSlots = [...new Map(createRows.map((row) => {
    const key = row.image_slot_key;
    const saved = Number(imageMap[key] || 0);
    return [key, {
      key,
      logo: row.logo,
      label: row.logo || 'Default / no logo',
      existing_image_id: saved && productImageIds.has(saved) ? saved : null,
    }];
  })).values()];

  const reconcileRows = rows.filter((row) => row.action === 'reconcile_existing');

  const uniqueBlockers = [...new Set(blockers)];
  const tokenPayload = {
    mode: 'add',
    product_id: Number(product.id),
    product_modified: product.date_modified_gmt || product.date_modified || '',
    template_color_term_id: Number(templateTerm.id),
    new_color_term_id: Number(newTerm.id),
    rows: createRows.map((row) => ({
      template_variation_id: row.template_variation_id,
      target_blank_product_id: row.target_blank_product_id,
      sku: row.sku,
      image_slot_key: row.image_slot_key,
    })).sort((a, b) => a.template_variation_id - b.template_variation_id),
  };

  return {
    mode: 'add',
    product: { id: Number(product.id), name: product.name || `Product ${product.id}`, sku: product.sku || '' },
    color_attribute: { id: Number(colorAttribute.id), name: colorAttribute.name },
    template_color: { id: Number(templateTerm.id), name: templateTerm.name },
    new_color: { id: Number(newTerm.id), name: newTerm.name, internal_color_id: colorLookup.id },
    total_variations: variations.length,
    template_variations: templateVariations.length,
    variations_to_create: createRows.length,
    already_existing_combinations: alreadyExists,
    image_slots: imageSlots,
    blockers: uniqueBlockers,
    warnings: [
      'The new color copies the template color’s active Size × Logo combination matrix.',
      'One uploaded image is required per Logo combination; every size for that logo reuses the same image.',
      'Template prices and variation-level shipping/tax settings are copied. Inventory quantities are not copied.',
      'New variations receive new Woo variation IDs and durable variation/SKU → blank mappings.',
      ...(reconcileRows.length ? [`${reconcileRows.length} existing ${newTerm.name} combination(s) will have their blank metadata/mappings verified or repaired.`] : []),
    ],
    can_apply: uniqueBlockers.length === 0
      && rows.length > 0
      && rows.every((row) => ['ready', 'ready_existing'].includes(row.preview_status)),
    confirmation_token: replacementToken(tokenPayload),
    rows,
  };
}

function parentAttributesWithColor(product, colorAttributeId, oldColor, newColor, { keepOld }) {
  const oldNorm = normalized(oldColor);
  const newNorm = normalized(newColor);
  return (product.attributes || []).map((attribute) => {
    if (!isColorAttribute(attribute, colorAttributeId)) return attribute;
    const original = Array.isArray(attribute.options) ? attribute.options : [];
    const next = [];
    let insertedNew = false;
    for (const option of original) {
      const norm = normalized(option);
      if (norm === oldNorm) {
        if (keepOld && !next.some((value) => normalized(value) === oldNorm)) next.push(option);
        if (!insertedNew && !next.some((value) => normalized(value) === newNorm)) {
          next.push(newColor);
          insertedNew = true;
        }
      } else if (norm === newNorm) {
        if (!next.some((value) => normalized(value) === newNorm)) next.push(newColor);
        insertedNew = true;
      } else {
        next.push(option);
      }
    }
    if (!insertedNew && !next.some((value) => normalized(value) === newNorm)) next.push(newColor);
    return { ...attribute, options: next };
  });
}

function parentAttributesAddColor(product, colorAttributeId, newColor) {
  return (product.attributes || []).map((attribute) => {
    if (!isColorAttribute(attribute, colorAttributeId)) return attribute;
    const options = Array.isArray(attribute.options) ? [...attribute.options] : [];
    if (!options.some((value) => normalized(value) === normalized(newColor))) options.push(newColor);
    return { ...attribute, options };
  });
}

async function rememberMapping(supabase, { variationId, sku, blankProductId, notes }, actorId, source = 'catalog_color_manager') {
  const variationResult = await supabase.rpc('sc_set_product_blank_mapping_v1', {
    p_source_kind: 'woocommerce_variation',
    p_source_key: String(variationId),
    p_blank_product_id: blankProductId,
    p_mapping_source: source,
    p_notes: notes,
    p_propagate_unpaired: true,
    p_actor_id: actorId,
  });
  if (variationResult.error) throw variationResult.error;

  if (sku && !/^MANUAL-\d+-LINE-\d+$/i.test(sku)) {
    const skuResult = await supabase.rpc('sc_set_product_blank_mapping_v1', {
      p_source_kind: 'woocommerce_sku',
      p_source_key: sku,
      p_blank_product_id: blankProductId,
      p_mapping_source: source,
      p_notes: notes,
      p_propagate_unpaired: true,
      p_actor_id: actorId,
    });
    if (skuResult.error) throw skuResult.error;
  }
}

async function prepareImageUpload(auth, body) {
  if (!r2Configured()) throw new Error('R2 storage is required for Product Color Manager image uploads.');
  const productId = Number(body.product_id);
  if (!Number.isInteger(productId) || productId <= 0) throw new Error('A valid WooCommerce product ID is required.');
  const size = Number(body.file_size || 0);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_BYTES) throw new Error('Variation image must be between 1 byte and 50 MB.');
  const contentType = text(body.content_type).toLowerCase();
  if (!/^image\/(png|jpeg|webp)$/.test(contentType)) throw new Error('Variation images must be PNG, JPEG, or WebP.');
  const filename = cleanObjectName(body.filename || 'variation-image');
  const key = `${auth.user.id}/catalog-color/${productId}/${randomUUID()}-${filename}`;
  return {
    upload_url: await presignedR2Put({ key, contentType }),
    reference: {
      provider: 'r2',
      bucket: r2BucketName(),
      path: key,
      mime_type: contentType,
      filename,
      product_id: productId,
    },
  };
}

function validateUploadReference(auth, productId, reference) {
  if (!reference || reference.provider !== 'r2' || reference.bucket !== r2BucketName()) {
    throw new Error('Invalid Product Color Manager image upload reference.');
  }
  const prefix = `${auth.user.id}/catalog-color/${productId}/`;
  if (!text(reference.path).startsWith(prefix)) throw new Error('The variation image upload does not belong to this employee/product.');
  if (!/^image\/(png|jpeg|webp)$/.test(text(reference.mime_type).toLowerCase())) throw new Error('Invalid uploaded image type.');
  return reference;
}

async function cancelImageUploads(auth, body) {
  const productId = Number(body.product_id);
  const refs = Array.isArray(body.references) ? body.references : [];
  let deleted = 0;
  for (const ref of refs) {
    const valid = validateUploadReference(auth, productId, ref);
    await deleteStoredReference(auth.supabase, {
      provider: valid.provider,
      bucket: valid.bucket,
      path: valid.path,
    });
    deleted += 1;
  }
  return { success: true, deleted };
}

async function importColorImages(auth, product, preview, uploadedImages) {
  let currentProduct = product;
  const savedMap = parseColorImageMap(product);
  const slotImages = new Map();

  for (const slot of preview.image_slots || []) {
    if (slot.existing_image_id) {
      slotImages.set(slot.key, Number(slot.existing_image_id));
      continue;
    }

    const upload = (uploadedImages || []).find((row) => row.slot_key === slot.key);
    if (!upload?.reference) throw new Error(`Upload an image for ${slot.label} before applying the new color.`);
    const ref = validateUploadReference(auth, product.id, upload.reference);
    const signedUrl = await signedStoredAssetUrl(auth.supabase, {
      storage_provider: ref.provider,
      storage_bucket: ref.bucket,
      storage_path: ref.path,
      mime_type: ref.mime_type,
    }, 3600);

    const beforeIds = new Set((currentProduct.images || []).map((row) => Number(row.id)).filter(Boolean));
    const imageName = `SC ${preview.new_color.name} - ${slot.label} - ${slot.key}`;
    const images = [
      ...(currentProduct.images || []).map((row) => ({ id: Number(row.id), name: row.name, alt: row.alt })).filter((row) => row.id),
      { src: signedUrl, name: imageName, alt: `${preview.product.name} - ${preview.new_color.name} - ${slot.label}` },
    ];
    currentProduct = await wooRequest(`products/${product.id}`, { method: 'PUT', body: { images } });
    const candidates = (currentProduct.images || []).filter((row) => !beforeIds.has(Number(row.id)));
    const matched = candidates.find((row) => String(row.name || '').includes(slot.key)) || (candidates.length === 1 ? candidates[0] : null);
    if (!matched?.id) throw new Error(`WooCommerce did not return a media ID for ${slot.label}.`);

    const imageId = Number(matched.id);
    slotImages.set(slot.key, imageId);
    savedMap[slot.key] = imageId;

    // Persist each Color + Logo -> Woo image ID immediately. If a later image
    // or variation batch fails, re-preview can reuse images already imported.
    currentProduct = await wooRequest(`products/${product.id}`, {
      method: 'PUT',
      body: { meta_data: [colorImageMetaRow(currentProduct, savedMap)] },
    });

    await deleteStoredReference(auth.supabase, { provider: ref.provider, bucket: ref.bucket, path: ref.path }).catch((error) => {
      console.warn('Temporary Product Color Manager upload cleanup failed:', error.message);
    });
  }

  return { product: currentProduct, slotImages, savedMap };
}

async function applyReplacement(auth, body) {
  const productId = Number(body.product_id);
  const preview = await buildReplacePreview(auth.supabase, productId, body.old_color, body.new_color);
  if (!preview.can_apply) throw new Error(`Replacement is blocked: ${preview.blockers.slice(0, 6).join(' | ')}`);
  if (!body.confirmation_token || body.confirmation_token !== preview.confirmation_token) {
    throw new Error('The product changed after preview. Preview the replacement again before applying it.');
  }

  const product = await wooRequest(`products/${productId}?context=edit`);
  await wooRequest(`products/${productId}`, {
    method: 'PUT',
    body: {
      attributes: parentAttributesWithColor(
        product,
        preview.color_attribute.id,
        preview.old_color.name,
        preview.new_color.name,
        { keepOld: true },
      ),
    },
  });

  let updated = 0;
  const warnings = [];
  const planByVariation = new Map(preview.rows.map((row) => [String(row.variation_id), row]));

  for (let offset = 0; offset < preview.rows.length; offset += WOO_BATCH_SIZE) {
    const batch = preview.rows.slice(offset, offset + WOO_BATCH_SIZE);
    for (const row of batch) {
      await rememberMapping(auth.supabase, {
        variationId: row.variation_id,
        sku: row.sku,
        blankProductId: row.target_blank_product_id,
        notes: `Product color replacement on ${preview.product.name}: ${row.old_color} -> ${row.new_color}`,
      }, auth.user.id);
    }

    const result = await wooRequest(`products/${productId}/variations/batch`, {
      method: 'POST',
      body: {
        update: batch.map((row) => ({
          id: row.variation_id,
          attributes: row.attributes_after,
          meta_data: row.meta_after,
        })),
      },
    });
    const returned = Array.isArray(result?.update) ? result.update : [];
    const failures = returned.filter((row) => row?.error || row?.code || !row?.id);
    if (failures.length || returned.length !== batch.length) {
      const detail = failures.slice(0, 5).map((row) => row?.error?.message || row?.message || row?.code || 'unknown').join(' | ');
      throw new Error(`WooCommerce replacement stopped after ${updated} completed variation(s). Re-preview to resume. ${detail}`);
    }

    for (const returnedRow of returned) {
      const plan = planByVariation.get(String(returnedRow.id));
      if (!plan) continue;
      const localUpdate = await auth.supabase
        .from('products')
        .update({ color_id: preview.new_color.internal_color_id, blank_product_id: plan.target_blank_product_id })
        .eq('woocommerce_variation_id', plan.variation_id);
      if (localUpdate.error) warnings.push(`Run WooCommerce Sync for variation ${plan.variation_id}: ${localUpdate.error.message}`);
      updated += 1;
    }
  }

  const finalProduct = await wooRequest(`products/${productId}?context=edit`);
  await wooRequest(`products/${productId}`, {
    method: 'PUT',
    body: {
      attributes: parentAttributesWithColor(
        finalProduct,
        preview.color_attribute.id,
        preview.old_color.name,
        preview.new_color.name,
        { keepOld: false },
      ),
    },
  }).catch((error) => warnings.push(`Old parent Color option was not removed automatically: ${error.message}`));

  let repairedOpenLines = 0;
  const repairedJobs = new Set();
  if (body.repair_open_pull_sheets !== false) {
    for (const line of preview.open_pull_sheet_lines) {
      const plan = planByVariation.get(String(line.variation_id));
      const repair = await auth.supabase.rpc('sc_purchasing_fix_pairing_v1', {
        p_job_item_id: Number(line.job_item_id),
        p_new_blank_product_id: plan?.target_blank_product_id,
        p_reason: `Woo product ${productId} color replacement: ${preview.old_color.name} -> ${preview.new_color.name}`,
        p_remember_mapping: true,
      });
      if (repair.error) {
        warnings.push(`Open pull-sheet line ${line.job_item_id} still needs pairing review: ${repair.error.message}`);
        continue;
      }
      repairedOpenLines += 1;
      repairedJobs.add(Number(line.job_id));
    }
    for (const jobId of repairedJobs) {
      const integrity = await auth.supabase.rpc('sc_repair_pullsheet_purchasing_integrity_v1', {
        p_job_id: jobId,
        p_blank_product_id: null,
      });
      if (integrity.error) warnings.push(`Pull sheet ${jobId} needs integrity review: ${integrity.error.message}`);
    }
  }

  return {
    success: true,
    mode: 'replace',
    product_id: productId,
    variations_updated: updated,
    image_assignments_preserved: preview.preserved_image_assignments,
    open_pull_sheet_lines_repaired: repairedOpenLines,
    warnings,
  };
}

async function applyAddColor(auth, body) {
  const productId = Number(body.product_id);
  const preview = await buildAddPreview(auth.supabase, productId, body.template_color, body.new_color);
  if (!preview.can_apply) throw new Error(`Add-color operation is blocked: ${preview.blockers.slice(0, 6).join(' | ')}`);
  if (!body.confirmation_token || body.confirmation_token !== preview.confirmation_token) {
    throw new Error('The product changed after preview. Preview the new color again before applying it.');
  }

  let product = await wooRequest(`products/${productId}?context=edit`);
  product = await wooRequest(`products/${productId}`, {
    method: 'PUT',
    body: { attributes: parentAttributesAddColor(product, preview.color_attribute.id, preview.new_color.name) },
  });

  const imported = await importColorImages(auth, product, preview, body.uploaded_images || []);
  product = imported.product;

  const createRows = preview.rows.filter((row) => row.action === 'create');
  const reconcileRows = preview.rows.filter((row) => row.action === 'reconcile_existing');
  let created = 0;
  let reconciledExisting = 0;
  const warnings = [];
  const createdMappings = [];

  // A retry may find variations that Woo created during an earlier partial run
  // before a mapping write failed. Reconcile those existing combinations first
  // so retrying repairs metadata/mappings instead of silently skipping them.
  for (let offset = 0; offset < reconcileRows.length; offset += WOO_BATCH_SIZE) {
    const batch = reconcileRows.slice(offset, offset + WOO_BATCH_SIZE);
    const result = await wooRequest(`products/${productId}/variations/batch`, {
      method: 'POST',
      body: {
        update: batch.map((row) => ({
          id: row.existing_variation_id,
          meta_data: row.meta_after,
        })),
      },
    });
    const returned = Array.isArray(result?.update) ? result.update : [];
    const failures = returned.filter((row) => row?.error || row?.code || !row?.id);
    if (failures.length || returned.length !== batch.length) {
      const detail = failures.slice(0, 5).map((row) => row?.error?.message || row?.message || row?.code || 'unknown').join(' | ');
      throw new Error(`Existing new-color variation reconciliation failed. Re-preview and retry. ${detail}`);
    }

    for (let index = 0; index < returned.length; index += 1) {
      const actual = returned[index];
      const plan = batch[index];
      await rememberMapping(auth.supabase, {
        variationId: Number(actual.id),
        sku: text(actual.sku || plan.sku),
        blankProductId: plan.target_blank_product_id,
        notes: `Verified ${preview.new_color.name} on ${preview.product.name} using ${preview.template_color.name} as the variation template.`,
      }, auth.user.id, 'catalog_color_add');
      reconciledExisting += 1;
    }
  }

  for (let offset = 0; offset < createRows.length; offset += WOO_BATCH_SIZE) {
    const batch = createRows.slice(offset, offset + WOO_BATCH_SIZE);
    const create = batch.map((row) => ({
      ...row.settings,
      sku: row.sku,
      attributes: row.attributes_after,
      image: { id: imported.slotImages.get(row.image_slot_key) },
      meta_data: row.meta_after,
    }));

    const result = await wooRequest(`products/${productId}/variations/batch`, {
      method: 'POST',
      body: { create },
    });
    const returned = Array.isArray(result?.create) ? result.create : [];
    const failures = returned.filter((row) => row?.error || row?.code || !row?.id);
    if (failures.length || returned.length !== create.length) {
      const detail = failures.slice(0, 5).map((row) => row?.error?.message || row?.message || row?.code || 'unknown').join(' | ');
      throw new Error(
        `WooCommerce new-color creation stopped after ${created} created variation(s). `
        + `Re-preview the product to safely resume only the missing combinations. ${detail}`,
      );
    }

    for (let index = 0; index < returned.length; index += 1) {
      const actual = returned[index];
      const plan = batch[index];
      await rememberMapping(auth.supabase, {
        variationId: Number(actual.id),
        sku: text(actual.sku || plan.sku),
        blankProductId: plan.target_blank_product_id,
        notes: `Added ${preview.new_color.name} to ${preview.product.name} using ${preview.template_color.name} as the variation template.`,
      }, auth.user.id, 'catalog_color_add');
      createdMappings.push({
        variation_id: Number(actual.id),
        sku: text(actual.sku || plan.sku),
        blank_product_id: plan.target_blank_product_id,
      });
      created += 1;
    }
  }

  const reconciled = await listVariations(productId);
  const activeSignatures = new Set(
    reconciled.filter((row) => isActiveStatus(row.status)).map((row) => variationSignature(row.attributes || [], preview.color_attribute.id)),
  );
  const missing = createRows.filter((row) => !activeSignatures.has(variationSignature(row.attributes_after, preview.color_attribute.id)));
  if (missing.length) warnings.push(`${missing.length} expected new variation combination(s) were not found during final verification.`);

  return {
    success: true,
    mode: 'add',
    product_id: productId,
    product_name: preview.product.name,
    template_color: preview.template_color.name,
    new_color: preview.new_color.name,
    variations_created: created,
    existing_combinations_reconciled: reconciledExisting,
    images_uploaded: preview.image_slots.filter((slot) => !slot.existing_image_id).length,
    image_slots: preview.image_slots.length,
    mappings_saved: createdMappings.length,
    run_woo_sync: true,
    warnings,
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, message: 'Use POST.' }, event);

  const auth = await authorizeEmployee(event, {
    functionName: FUNCTION_NAME,
    allowedRoles: ['admin', 'manager'],
  });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, message: auth.message }, event);

  try {
    const body = parseJsonBody(event);
    const action = text(body.action);

    if (action === 'search') return jsonResponse(200, { success: true, products: await productSearch(body.search) }, event);
    if (action === 'inspect') return jsonResponse(200, { success: true, ...(await inspectProduct(body.product_id)) }, event);
    if (action === 'preview_replace') {
      return jsonResponse(200, { success: true, preview: await buildReplacePreview(auth.supabase, body.product_id, body.old_color, body.new_color) }, event);
    }
    if (action === 'apply_replace') return jsonResponse(200, await applyReplacement(auth, body), event);
    if (action === 'preview_add') {
      return jsonResponse(200, { success: true, preview: await buildAddPreview(auth.supabase, body.product_id, body.template_color, body.new_color) }, event);
    }
    if (action === 'prepare_image_upload') return jsonResponse(200, { success: true, ...(await prepareImageUpload(auth, body)) }, event);
    if (action === 'cancel_image_uploads') return jsonResponse(200, await cancelImageUploads(auth, body), event);
    if (action === 'apply_add') return jsonResponse(200, await applyAddColor(auth, body), event);

    return jsonResponse(400, { success: false, message: 'Unknown Product Color Manager action.' }, event);
  } catch (error) {
    console.error('Product Color Manager failed:', error);
    return jsonResponse(400, { success: false, message: error?.message || 'Product Color Manager failed.' }, event);
  }
}
