import { createHash } from 'node:crypto';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { parseJsonBody, wooCollection, wooRequest } from './_shared/mockupUtils.js';

const FUNCTION_NAME = 'product-color-replacement';
const WOO_BATCH_SIZE = 25;
const MAX_SEARCH_RESULTS = 50;
const MAX_VARIATION_PAGES = 20;

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
  return !/(?:complete|completed|cancel|cancelled|canceled|void|deleted|closed)/i.test(text(status));
}

function isColorAttribute(attribute, colorAttributeId = null) {
  if (!attribute) return false;
  if (colorAttributeId && Number(attribute.id) === Number(colorAttributeId)) return true;
  const slug = normalized(attribute.slug);
  const name = normalized(attribute.name);
  return slug === 'pa color' || slug === 'color' || name === 'color' || name === 'colour';
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

function metaWithBlank(metaData, blankProductId) {
  const rows = Array.isArray(metaData) ? metaData.map((row) => ({ ...row })) : [];
  const index = rows.findIndex((row) => row.key === '_sc_blank_product_id');
  const replacement = index >= 0
    ? { ...rows[index], value: blankProductId }
    : { key: '_sc_blank_product_id', value: blankProductId };
  if (index >= 0) rows[index] = replacement;
  else rows.push(replacement);
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
    throw new Error(`Product ${productId} has too many variations for the guarded replacement tool.`);
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
      // A numeric SKU may not be a product ID, so normal search still runs below.
    }
  }
  if (!rows.length) {
    rows = wooCollection(
      await wooRequest(`products?search=${encodeURIComponent(query)}&status=any&context=edit&per_page=${MAX_SEARCH_RESULTS}`),
      'WooCommerce products',
    );
  }
  return rows
    .filter((row) => row?.id)
    .map((row) => ({
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
  if (product.type !== 'variable') throw new Error('Color replacement currently supports variable WooCommerce products only.');

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
  if (matches.length === 1) return { id: matches[0].id, matches };
  return { id: null, matches };
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
    .map((row) => {
      const job = jobMap.get(String(row.job_id));
      return {
        ...row,
        job_status: job?.status || '',
        woocommerce_order_id: job?.woocommerce_order_id || null,
      };
    });
}

async function buildPreview(supabase, productId, oldColorInput, newColorInput) {
  const product = await wooRequest(`products/${Number(productId)}?context=edit`);
  if (!product?.id) throw new Error('WooCommerce product was not found.');
  if (product.type !== 'variable') throw new Error('Color replacement currently supports variable WooCommerce products only.');

  const { attribute: colorAttribute, terms } = await colorAttributeDefinition();
  const oldTerm = terms.find((row) => (
    normalized(row.name) === normalized(oldColorInput) || normalized(row.slug) === normalized(oldColorInput)
  ));
  const newTerm = terms.find((row) => (
    normalized(row.name) === normalized(newColorInput) || normalized(row.slug) === normalized(newColorInput)
  ));
  if (!oldTerm) throw new Error(`WooCommerce Color term "${oldColorInput}" was not found.`);
  if (!newTerm) throw new Error(`WooCommerce Color term "${newColorInput}" was not found.`);
  if (Number(oldTerm.id) === Number(newTerm.id) || normalized(oldTerm.name) === normalized(newTerm.name)) {
    throw new Error('Choose two different WooCommerce colors.');
  }

  const parentColor = (product.attributes || []).find((row) => isColorAttribute(row, colorAttribute.id));
  if (!parentColor) throw new Error('The selected product does not use the global WooCommerce Color attribute.');
  if (!(parentColor.options || []).some((value) => normalized(value) === normalized(oldTerm.name))) {
    throw new Error(`This product does not currently advertise "${oldTerm.name}" as a Color option.`);
  }

  const variations = await listVariations(product.id);
  const affected = variations.filter((variation) => (
    (variation.attributes || []).some((row) => (
      isColorAttribute(row, colorAttribute.id) && normalized(row.option) === normalized(oldTerm.name)
    ))
  ));
  if (!affected.length) throw new Error(`No variations currently use "${oldTerm.name}".`);

  const blockers = [];
  const warnings = [];

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
  const currentBlankMap = new Map(currentBlanks.map((row) => [String(row.id), row]));

  const colorLookup = await internalColorId(supabase, newTerm.name);
  if (!colorLookup.id) {
    blockers.push(colorLookup.matches.length > 1
      ? `Internal color "${newTerm.name}" is ambiguous (${colorLookup.matches.length} records).`
      : `Internal color "${newTerm.name}" does not exist in Supabase colors.`);
  }
  const newInternalColorId = colorLookup.id;
  const targetBlanks = newInternalColorId ? await targetBlankRows(supabase, newInternalColorId) : [];
  const targetIndex = new Map();
  for (const blank of targetBlanks) {
    const key = blankIdentityKey(blank, newInternalColorId);
    targetIndex.set(key, [...(targetIndex.get(key) || []), blank]);
  }

  const localByVariation = new Map();
  for (const row of localRows) {
    const key = String(row.woocommerce_variation_id || '');
    if (!key) continue;
    localByVariation.set(key, [...(localByVariation.get(key) || []), row]);
  }

  const planRows = [];
  for (const variation of affected) {
    const local = localByVariation.get(String(variation.id)) || [];
    const distinctBlankIds = [...new Set(local.map((row) => row.blank_product_id).filter(Boolean).map(String))];
    let currentBlank = null;
    let targetBlank = null;
    let status = 'ready';
    let issue = '';

    if (!local.length) {
      status = 'blocked';
      issue = 'No synced Supabase product row exists for this Woo variation.';
    } else if (distinctBlankIds.length === 0) {
      status = 'blocked';
      issue = 'This Woo variation has no current blank mapping.';
    } else if (distinctBlankIds.length > 1) {
      status = 'blocked';
      issue = `Synced product rows disagree on the current blank (${distinctBlankIds.length} different blanks).`;
    } else {
      currentBlank = currentBlankMap.get(distinctBlankIds[0]) || null;
      if (!currentBlank) {
        status = 'blocked';
        issue = 'The current mapped blank record could not be loaded.';
      } else if (!newInternalColorId) {
        status = 'blocked';
        issue = `Internal color "${newTerm.name}" is unavailable.`;
      } else {
        const candidates = targetIndex.get(blankIdentityKey(currentBlank, newInternalColorId)) || [];
        if (candidates.length === 0) {
          status = 'blocked';
          issue = `No active ${newTerm.name} blank exists for ${blankLabel(currentBlank)}.`;
        } else if (candidates.length > 1) {
          status = 'blocked';
          issue = `${candidates.length} candidate ${newTerm.name} blanks match this blank family and size.`;
        } else {
          targetBlank = candidates[0];
        }
      }
    }

    const changed = replaceColorAttribute(variation.attributes || [], colorAttribute.id, oldTerm.name, newTerm.name);
    if (!changed.changed) {
      status = 'blocked';
      issue = 'The variation Color attribute could not be rewritten.';
    }
    if (status === 'blocked') blockers.push(`Variation ${variation.id}: ${issue}`);

    planRows.push({
      variation_id: Number(variation.id),
      sku: text(variation.sku),
      status: variation.status || '',
      image_id: Number(variation.image?.id || 0) || null,
      old_color: oldTerm.name,
      new_color: newTerm.name,
      current_blank_product_id: currentBlank?.id || null,
      current_blank_sku: currentBlank?.sku_base || null,
      current_blank_label: currentBlank ? blankLabel(currentBlank) : null,
      target_blank_product_id: targetBlank?.id || null,
      target_blank_sku: targetBlank?.sku_base || null,
      target_blank_label: targetBlank ? blankLabel(targetBlank) : null,
      local_product_rows: local.length,
      preview_status: status,
      issue,
      attributes_after: changed.attributes,
      meta_after: targetBlank ? metaWithBlank(variation.meta_data || [], targetBlank.id) : variation.meta_data || [],
    });
  }

  const openLines = await openPullSheetLines(supabase, variationIds);
  const planByVariation = new Map(planRows.map((row) => [String(row.variation_id), row]));
  const openLineRows = openLines.map((line) => {
    const plan = planByVariation.get(String(line.woocommerce_variation_id));
    return {
      job_id: line.job_id,
      job_item_id: line.id,
      order_id: line.woocommerce_order_id,
      variation_id: line.woocommerce_variation_id,
      order_sku: line.order_sku || line.sku || '',
      quantity: Number(line.quantity || 0),
      current_blank_product_id: line.blank_product_id || null,
      target_blank_product_id: plan?.target_blank_product_id || null,
      target_blank_sku: plan?.target_blank_sku || null,
      pairing_source: line.pairing_source || '',
      selected_bin_id: line.selected_bin_id || null,
    };
  });

  const uniqueBlockers = [...new Set(blockers)];
  warnings.push('Variation IDs, SKUs, prices, sizes, logo selections, and existing variation image IDs are preserved.');
  if (openLineRows.length) warnings.push(`${openLineRows.length} active pull-sheet line(s) reference affected variations.`);
  if (collisions.length) warnings.push('Resolve duplicate target combinations before applying.');

  const tokenPayload = {
    product_id: Number(product.id),
    product_modified: product.date_modified_gmt || product.date_modified || '',
    old_color_term_id: Number(oldTerm.id),
    new_color_term_id: Number(newTerm.id),
    rows: planRows.map((row) => ({
      variation_id: row.variation_id,
      current_blank_product_id: row.current_blank_product_id,
      target_blank_product_id: row.target_blank_product_id,
      sku: row.sku,
    })).sort((a, b) => a.variation_id - b.variation_id),
  };

  return {
    product: {
      id: Number(product.id),
      name: product.name || `Product ${product.id}`,
      sku: product.sku || '',
      status: product.status || '',
      date_modified_gmt: product.date_modified_gmt || product.date_modified || '',
    },
    color_attribute: { id: Number(colorAttribute.id), name: colorAttribute.name, slug: colorAttribute.slug },
    old_color: { id: Number(oldTerm.id), name: oldTerm.name, slug: oldTerm.slug },
    new_color: { id: Number(newTerm.id), name: newTerm.name, slug: newTerm.slug, internal_color_id: newInternalColorId },
    total_variations: variations.length,
    affected_variations: planRows.length,
    preserved_image_assignments: planRows.filter((row) => row.image_id).length,
    open_pull_sheet_lines: openLineRows,
    collisions,
    blockers: uniqueBlockers,
    warnings,
    can_apply: uniqueBlockers.length === 0 && planRows.every((row) => row.preview_status === 'ready'),
    confirmation_token: replacementToken(tokenPayload),
    rows: planRows,
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

async function rememberMapping(supabase, row, actorId, productName) {
  const reason = `Product color replacement on ${productName}: ${row.old_color} -> ${row.new_color}`;
  const variationResult = await supabase.rpc('sc_set_product_blank_mapping_v1', {
    p_source_kind: 'woocommerce_variation',
    p_source_key: String(row.variation_id),
    p_blank_product_id: row.target_blank_product_id,
    p_mapping_source: 'catalog_color_replacement',
    p_notes: reason,
    p_propagate_unpaired: true,
    p_actor_id: actorId,
  });
  if (variationResult.error) throw variationResult.error;

  if (row.sku && !/^MANUAL-\d+-LINE-\d+$/i.test(row.sku)) {
    const skuResult = await supabase.rpc('sc_set_product_blank_mapping_v1', {
      p_source_kind: 'woocommerce_sku',
      p_source_key: row.sku,
      p_blank_product_id: row.target_blank_product_id,
      p_mapping_source: 'catalog_color_replacement',
      p_notes: reason,
      p_propagate_unpaired: true,
      p_actor_id: actorId,
    });
    if (skuResult.error) throw skuResult.error;
  }
}

async function applyReplacement(auth, body) {
  const productId = Number(body.product_id);
  const preview = await buildPreview(auth.supabase, productId, body.old_color, body.new_color);
  if (!preview.can_apply) {
    throw new Error(`Replacement is blocked: ${preview.blockers.slice(0, 6).join(' | ')}`);
  }
  if (!body.confirmation_token || body.confirmation_token !== preview.confirmation_token) {
    throw new Error('The product changed after preview. Preview the replacement again before applying it.');
  }

  const product = await wooRequest(`products/${productId}?context=edit`);
  const phaseOneAttributes = parentAttributesWithColor(
    product,
    preview.color_attribute.id,
    preview.old_color.name,
    preview.new_color.name,
    { keepOld: true },
  );

  // Phase 1 adds the replacement Color to the parent while retaining the old
  // option. This makes the operation safe to resume after a Woo/API interruption.
  await wooRequest(`products/${productId}`, {
    method: 'PUT',
    body: { attributes: phaseOneAttributes },
  });

  let updated = 0;
  const warnings = [];
  const planByVariation = new Map(preview.rows.map((row) => [String(row.variation_id), row]));

  for (let offset = 0; offset < preview.rows.length; offset += WOO_BATCH_SIZE) {
    const batch = preview.rows.slice(offset, offset + WOO_BATCH_SIZE);

    // Save durable blank mappings BEFORE changing the Woo variation. If a later
    // Woo batch fails, the remaining old-color variation is still discoverable
    // on the next preview, while no already-updated Woo variation can be left
    // mapped to its former physical blank.
    for (const row of batch) {
      await rememberMapping(auth.supabase, row, auth.user.id, preview.product.name);
    }

    const update = batch.map((row) => ({
      id: row.variation_id,
      attributes: row.attributes_after,
      meta_data: row.meta_after,
      // Deliberately omit image and sku. Woo keeps the existing variation image
      // and SKU attached to the same variation ID.
    }));

    const result = await wooRequest(`products/${productId}/variations/batch`, {
      method: 'POST',
      body: { update },
    });
    const returned = Array.isArray(result?.update) ? result.update : [];
    const failures = returned.filter((row) => row?.error || row?.code || !row?.id);
    if (failures.length || returned.length !== update.length) {
      const detail = failures.slice(0, 5).map((row) => row?.error?.message || row?.message || row?.code || 'unknown').join(' | ');
      throw new Error(
        `WooCommerce color replacement stopped after ${updated} completed variation(s). `
        + 'Preview this product again; the operation is resumable and will show the remaining old-color variations. '
        + (detail || `Expected ${update.length} updates but received ${returned.length}.`),
      );
    }

    for (const returnedRow of returned) {
      const plan = planByVariation.get(String(returnedRow.id));
      if (!plan) continue;
      const localUpdate = await auth.supabase
        .from('products')
        .update({
          color_id: preview.new_color.internal_color_id,
          blank_product_id: plan.target_blank_product_id,
        })
        .eq('woocommerce_variation_id', plan.variation_id);
      if (localUpdate.error) {
        warnings.push(
          `Woo variation ${plan.variation_id} was updated and its durable blank mapping was saved, `
          + `but the local product color field could not be refreshed (${localUpdate.error.message}). Run WooCommerce Sync.`
        );
      }
      updated += 1;
    }
  }

  const reconciled = await listVariations(productId);
  const reconciledMap = new Map(reconciled.map((row) => [String(row.id), row]));
  const failedVerification = preview.rows.filter((plan) => {
    const variation = reconciledMap.get(String(plan.variation_id));
    if (!variation) return true;
    return !(variation.attributes || []).some((attribute) => (
      isColorAttribute(attribute, preview.color_attribute.id)
      && normalized(attribute.option) === normalized(preview.new_color.name)
    ));
  });
  if (failedVerification.length) {
    throw new Error(
      `WooCommerce verification failed for ${failedVerification.length} variation(s). `
      + 'Do not recreate variations manually; preview the product again so the tool can show the remaining state.',
    );
  }

  try {
    const finalProduct = await wooRequest(`products/${productId}?context=edit`);
    const finalAttributes = parentAttributesWithColor(
      finalProduct,
      preview.color_attribute.id,
      preview.old_color.name,
      preview.new_color.name,
      { keepOld: false },
    );
    await wooRequest(`products/${productId}`, {
      method: 'PUT',
      body: { attributes: finalAttributes },
    });
  } catch (error) {
    warnings.push(
      `All planned variations were updated, but the old parent Color option could not be removed automatically: ${error.message}`
    );
  }

  let repairedOpenLines = 0;
  const repairedJobs = new Set();
  if (body.repair_open_pull_sheets !== false && preview.open_pull_sheet_lines.length) {
    for (const line of preview.open_pull_sheet_lines) {
      const plan = planByVariation.get(String(line.variation_id));
      if (!plan?.target_blank_product_id) continue;
      const repair = await auth.supabase.rpc('sc_purchasing_fix_pairing_v1', {
        p_job_item_id: Number(line.job_item_id),
        p_new_blank_product_id: plan.target_blank_product_id,
        p_reason: `Woo product ${productId} color replacement: ${preview.old_color.name} -> ${preview.new_color.name}`,
        p_remember_mapping: true,
      });
      if (repair.error) {
        warnings.push(
          `Open pull-sheet line ${line.job_item_id} still needs pairing review: ${repair.error.message}`
        );
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
      if (integrity.error) {
        warnings.push(`Pull sheet ${jobId} needs Purchasing integrity review: ${integrity.error.message}`);
      }
    }
  }

  try {
    const audit = await auth.supabase.from('sc_core_mutation_audit').insert({
      action: 'replace_product_color',
      entity_type: 'woocommerce_product',
      entity_id_text: String(productId),
      actor_user_id: auth.user.id,
      before_snapshot: {
        color: preview.old_color.name,
        variation_ids: preview.rows.map((row) => row.variation_id),
      },
      after_snapshot: {
        color: preview.new_color.name,
        variation_ids: preview.rows.map((row) => row.variation_id),
        repaired_open_pull_sheet_lines: repairedOpenLines,
      },
      reason: text(body.reason) || `Catalog color replacement: ${preview.old_color.name} -> ${preview.new_color.name}`,
    });
    if (audit.error) warnings.push(`Audit row could not be saved: ${audit.error.message}`);
  } catch (error) {
    warnings.push(`Audit row could not be saved: ${error.message}`);
  }

  return {
    success: true,
    product_id: productId,
    product_name: preview.product.name,
    old_color: preview.old_color.name,
    new_color: preview.new_color.name,
    variations_updated: updated,
    variation_ids_preserved: updated,
    image_assignments_preserved: preview.preserved_image_assignments,
    skus_preserved: preview.rows.filter((row) => row.sku).length,
    mappings_updated: updated,
    open_pull_sheet_lines_repaired: repairedOpenLines,
    jobs_reconciled: repairedJobs.size,
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

    if (action === 'search') {
      return jsonResponse(200, { success: true, products: await productSearch(body.search) }, event);
    }
    if (action === 'inspect') {
      return jsonResponse(200, { success: true, ...(await inspectProduct(body.product_id)) }, event);
    }
    if (action === 'preview') {
      const preview = await buildPreview(auth.supabase, body.product_id, body.old_color, body.new_color);
      return jsonResponse(200, { success: true, preview }, event);
    }
    if (action === 'apply') {
      return jsonResponse(200, await applyReplacement(auth, body), event);
    }

    return jsonResponse(400, { success: false, message: 'Unknown product color replacement action.' }, event);
  } catch (error) {
    console.error('Product color replacement failed:', error);
    return jsonResponse(400, {
      success: false,
      message: error?.message || 'Product color replacement failed.',
    }, event);
  }
}
