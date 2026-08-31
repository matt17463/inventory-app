function clean(value) {
  return String(value ?? '').trim();
}

function normalized(value) {
  return clean(value)
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

function skuPiece(value, fallback = 'ITEM') {
  const piece = clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return piece || fallback;
}

function matrixKey(color, size) {
  return JSON.stringify([normalized(color), normalized(size)]);
}

async function allRows(supabase, table, columns, configure = (query) => query) {
  const rows = [];
  for (let offset = 0; offset < 10000; offset += 1000) {
    let query = supabase.from(table).select(columns).order('id', { ascending: true }).range(offset, offset + 999);
    query = configure(query);
    const result = await query;
    if (result.error) throw result.error;
    rows.push(...(result.data || []));
    if ((result.data || []).length < 1000) break;
  }
  return rows;
}

async function referenceCount(supabase, table, column, id) {
  const result = await supabase.from(table).select('id', { count: 'exact', head: true }).eq(column, id);
  if (result.error) throw result.error;
  return Number(result.count || 0);
}

async function rankedCandidate(supabase, candidates, referenceColumn) {
  const ranked = await Promise.all(candidates.map(async (row) => ({
    ...row,
    blank_usage: await referenceCount(supabase, 'blank_products', referenceColumn, row.id),
    product_usage: await referenceCount(supabase, 'products', referenceColumn, row.id),
  })));
  ranked.sort((a, b) => b.blank_usage - a.blank_usage || b.product_usage - a.product_usage || Number(a.id) - Number(b.id));
  return ranked[0];
}

async function ensureLookup(supabase, definition, value) {
  const requested = clean(value);
  if (!requested) throw new Error(`Enter a ${definition.label} before creating blank products.`);
  let rows = await allRows(
    supabase,
    definition.table,
    'id,name,code',
    definition.table === 'colors' ? (query) => query.eq('is_active', true) : undefined,
  );
  let matches = rows.filter((row) => [row.name, row.code].some((candidate) => normalized(candidate) === normalized(requested)));
  let created = false;

  if (!matches.length) {
    const payload = { name: requested, code: skuPiece(requested, definition.label.toUpperCase()) };
    if (definition.table === 'colors') payload.is_active = true;
    const inserted = await supabase.from(definition.table).insert(payload).select('id,name,code').single();
    if (inserted.error) {
      rows = await allRows(
        supabase,
        definition.table,
        'id,name,code',
        definition.table === 'colors' ? (query) => query.eq('is_active', true) : undefined,
      );
      matches = rows.filter((row) => [row.name, row.code].some((candidate) => normalized(candidate) === normalized(requested)));
      if (!matches.length) throw inserted.error;
    } else {
      matches = [inserted.data];
      rows.push(inserted.data);
      created = true;
    }
  }

  const selected = matches.length === 1
    ? matches[0]
    : await rankedCandidate(supabase, matches, definition.referenceColumn);
  return { ...selected, requested, created, duplicate_candidates: matches.map((row) => row.id), rows };
}

function lookupValue(rows, id) {
  return rows.find((row) => String(row.id) === String(id)) || null;
}

function sameSemanticIdentity(blank, context) {
  const brand = lookupValue(context.brand.rows, blank.brand_id);
  const style = lookupValue(context.style.rows, blank.product_type_id);
  const color = lookupValue(context.color.rows, blank.color_id);
  const size = lookupValue(context.size.rows, blank.size_id);
  return normalized(brand?.name || brand?.code) === normalized(context.brand.requested)
    && normalized(style?.name || style?.code) === normalized(context.style.requested)
    && normalized(color?.name || color?.code) === normalized(context.color.requested)
    && normalized(size?.name || size?.code) === normalized(context.size.requested);
}

async function createOrReuseBlank(supabase, context, options) {
  const generatedSku = [
    context.brand.code || context.brand.name,
    context.style.code || context.style.name,
    context.color.code || context.color.name,
    context.size.code || context.size.name,
  ].map((value) => skuPiece(value)).join('-');
  const generatedName = [context.brand.name, context.style.name, context.color.name, context.size.name].filter(Boolean).join(' ');
  const existingSku = await supabase.from('blank_products')
    .select('id,sku_base,name,brand_id,product_type_id,color_id,size_id,sc_is_archived')
    .ilike('sku_base', generatedSku)
    .or('sc_is_archived.is.null,sc_is_archived.eq.false')
    .limit(10);
  if (existingSku.error) throw existingSku.error;
  if ((existingSku.data || []).length) {
    const semantic = existingSku.data.filter((row) => sameSemanticIdentity(row, context));
    if (semantic.length === 1) return { blank: semantic[0], created: false, reused_by: 'semantic_sku' };
    throw new Error(`Blank SKU ${generatedSku} already belongs to a different or ambiguous blank product. Resolve that true SKU conflict in Product Integrity before retrying.`);
  }

  const payload = {
    source_system: 'mockup_studio', sku_base: generatedSku, name: generatedName,
    brand: context.brand.name, style: context.style.name, color: context.color.name, size: context.size.name,
    brand_id: context.brand.id, product_type_id: context.style.id, color_id: context.color.id, size_id: context.size.id,
    unit_cost: Number(options.unitCost || 0), low_stock_threshold: Number(options.lowStockThreshold || 0),
  };
  const created = await supabase.rpc('sc_create_blank_product_safe_v1', { p_payload: payload, p_actor: options.actorId });
  if (created.error) {
    if (/does not exist|schema cache|could not find/i.test(created.error.message || '')) {
      throw new Error('Automatic blank creation SQL is not installed. Run SQL 28, 40, 44, and 46 before exporting this Mockup Studio product.');
    }
    throw created.error;
  }
  if (created.data?.success !== true) {
    const candidateIds = (created.data?.preview?.candidates || [])
      .filter((row) => Number(row.confidence || 0) >= 95)
      .map((row) => row.blank_product_id_text).filter(Boolean);
    if (candidateIds.length === 1) {
      const found = await supabase.from('blank_products')
        .select('id,sku_base,name,brand_id,product_type_id,color_id,size_id,sc_is_archived')
        .eq('id', candidateIds[0]).maybeSingle();
      if (found.error) throw found.error;
      if (found.data && !found.data.sc_is_archived && sameSemanticIdentity(found.data, context)) {
        return { blank: found.data, created: false, reused_by: 'guarded_identity' };
      }
    }
    throw new Error(`Blank creation was blocked for ${context.color.requested} / ${context.size.requested} because more than one genuinely different record matched. Review that combination in Product Integrity.`);
  }
  const blank = created.data.blank;
  const annotated = await supabase.from('blank_products').update({
    sc_creation_source: 'mockup_studio_woocommerce_export',
    sc_cost_review_required: Boolean(options.costReviewRequired),
  }).eq('id', blank.id);
  if (annotated.error) throw annotated.error;
  return { blank, created: true, reused_by: null };
}

export async function prepareMockupBlankMatrix(supabase, config, parentAttributes, actorId) {
  const colors = parentAttributes.color?.options || [];
  const sizes = parentAttributes.size?.options || [];
  if (!colors.length || !sizes.length) throw new Error('Variable products require at least one Color and Size before their blank products can be prepared.');
  const unitCost = Number(config.blank_unit_cost ?? 0);
  const lowStockThreshold = Number(config.blank_low_stock_threshold ?? 0);
  if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error('Blank unit cost must be zero or greater.');
  if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) throw new Error('Blank low-stock threshold must be a whole number zero or greater.');

  const brand = await ensureLookup(supabase, { table: 'brands', label: 'brand', referenceColumn: 'brand_id' }, config.brand);
  const style = await ensureLookup(supabase, { table: 'product_types', label: 'style', referenceColumn: 'product_type_id' }, config.style);
  const colorLookups = [];
  for (const color of colors) colorLookups.push(await ensureLookup(supabase, { table: 'colors', label: 'color', referenceColumn: 'color_id' }, color));
  const sizeLookups = [];
  for (const size of sizes) sizeLookups.push(await ensureLookup(supabase, { table: 'sizes', label: 'size', referenceColumn: 'size_id' }, size));

  const existing = await supabase.from('blank_products')
    .select('id,sku_base,name,brand_id,product_type_id,color_id,size_id,sc_is_archived')
    .eq('brand_id', brand.id).eq('product_type_id', style.id)
    .in('color_id', colorLookups.map((row) => row.id)).in('size_id', sizeLookups.map((row) => row.id))
    .or('sc_is_archived.is.null,sc_is_archived.eq.false');
  if (existing.error) throw existing.error;

  const result = new Map();
  let createdCount = 0;
  let reusedCount = 0;
  const decisions = [];
  for (const color of colorLookups) for (const size of sizeLookups) {
    const matches = (existing.data || []).filter((row) => String(row.color_id) === String(color.id) && String(row.size_id) === String(size.id));
    let resolved;
    if (matches.length === 1) resolved = { blank: matches[0], created: false, reused_by: 'exact_identity' };
    else if (matches.length > 1) throw new Error(`${color.requested} / ${size.requested} has ${matches.length} active blank records. Resolve that true duplicate in Product Integrity before exporting.`);
    else resolved = await createOrReuseBlank(supabase, { brand, style, color, size }, {
      unitCost, lowStockThreshold,
      costReviewRequired: config.blank_cost_review_required === true || unitCost === 0,
      actorId,
    });
    result.set(matrixKey(color.requested, size.requested), resolved.blank.id);
    if (resolved.created) createdCount += 1; else reusedCount += 1;
    decisions.push({ color: color.requested, size: size.requested, blank_product_id: resolved.blank.id,
      outcome: resolved.created ? 'created' : 'reused', reused_by: resolved.reused_by,
      canonical_color_id: color.id, canonical_size_id: size.id });
  }
  return {
    map: result, created: createdCount, reused: reusedCount,
    lookups_created: [brand, style, ...colorLookups, ...sizeLookups].filter((row) => row.created).length,
    decisions,
  };
}

export const mockupBlankCatalogInternals = { normalized, skuPiece, matrixKey };
