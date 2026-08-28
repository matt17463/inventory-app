import { createHash } from 'node:crypto';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { extractPdfTextPages } from './_shared/pdfTextExtractor.js';
import { parseSupplierConfirmationPages, supplierMatchKey, supplierSizeCandidates } from './_shared/supplierConfirmationParser.js';
import { matchSupplierColor } from './_shared/supplierColorMatcher.js';
import { putOperationalObject } from './_shared/operationalStorage.js';
import { requireSupplierReceivingContract } from './_shared/supplierReceivingContract.js';

const FUNCTION_NAME = 'supplier-confirmation-parse';
const MAX_BYTES = 12 * 1024 * 1024;

function safeFileName(value) {
  return String(value || 'confirmation.pdf').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120);
}

function normalizedSupplier(value) {
  const key = supplierMatchKey(value);
  if (key.includes('sand') || key.includes('ssactivewear')) return 'ss_activewear';
  if (key.includes('momentec') || key.includes('augusta')) return 'momentec';
  return key;
}

function lookupMatches(line, lookups) {
  const matchOne = (rows, values) => rows.filter((row) => values.some((value) => (
    value && [row.name, row.code].some((candidate) => supplierMatchKey(candidate) === supplierMatchKey(value))
  )));
  const brand = line.brand ? matchOne(lookups.brands, [line.brand]) : [];
  const style = matchOne(lookups.productTypes, [line.style, line.description]);
  const color = matchSupplierColor(line.color, lookups.colors, lookups.colorPairingRules, lookups.importColorAliases, lookups.supplierKey);
  const size = matchOne(lookups.sizes, supplierSizeCandidates(line.size, line.audience));
  return {
    brand_id: brand.length === 1 ? String(brand[0].id) : '',
    product_type_id: style.length === 1 ? String(style[0].id) : '',
    color_id: color.color_id,
    color_match_method: color.color_match_method,
    size_id: size.length === 1 ? String(size[0].id) : '',
  };
}

function identityKey(ids = {}) {
  return ['brand_id', 'product_type_id', 'color_id', 'size_id']
    .map((field) => String(ids[field] || ''))
    .join('|');
}

async function mapWithConcurrency(values, concurrency, task) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

async function parseAndMatch(supabase, parsed) {
  const skus = parsed.lines.map((line) => line.supplier_sku).filter(Boolean);
  const [mappingResult, catalogResult, brandsResult, stylesResult, colorsResult, sizesResult, colorRulesResult, colorAliasesResult] = await Promise.all([
    supabase.from('sc_supplier_item_mappings').select('*').eq('supplier_key', parsed.supplier_key),
    skus.length ? supabase.from('supplier_catalog_review').select('*').in('supplier_sku', skus) : Promise.resolve({ data: [], error: null }),
    supabase.from('brands').select('id,name,code'),
    supabase.from('product_types').select('id,name,code'),
    supabase.from('sc_active_colors').select('*'),
    supabase.from('sizes').select('id,name,code'),
    supabase.rpc('sc_get_color_pairing_rules', { p_status: 'active' }),
    supabase.from('sc_import_color_aliases').select('*').eq('source_system', parsed.supplier_key),
  ]);
  // Color pairing is an enhancement over the canonical colors lookup. Older
  // installations without the RPC still receive exact color matching.
  const colorRulesUnavailable = colorRulesResult.error && /does not exist|not find|schema cache/i.test(colorRulesResult.error.message || '');
  const errors = [mappingResult, catalogResult, brandsResult, stylesResult, colorsResult, sizesResult, colorAliasesResult]
    .concat(colorRulesUnavailable ? [] : [colorRulesResult])
    .map((result) => result.error).filter(Boolean);
  if (errors.length) {
    const missingColorSql = errors.find((error) => /sc_import_color_aliases/i.test(error.message || ''));
    if (missingColorSql) throw new Error('Color lifecycle SQL is not installed. Run deployment/sql/26_COLOR_LIFECYCLE_AND_IMPORT_ALIASES.sql in Supabase, then retry.');
    const missingSql = errors.find((error) => /sc_supplier_item_mappings|does not exist/i.test(error.message || ''));
    if (missingSql) throw new Error('Supplier receiving SQL is not installed. Run deployment/sql/19_SUPPLIER_CONFIRMATION_RECEIVING.sql in Supabase, then retry.');
    throw errors[0];
  }

  const mappings = mappingResult.data || [];
  const catalog = catalogResult.data || [];
  const lookups = {
    brands: brandsResult.data || [], productTypes: stylesResult.data || [],
    colors: colorsResult.data || [], sizes: sizesResult.data || [],
    colorPairingRules: colorRulesUnavailable ? [] : (colorRulesResult.data || []),
    importColorAliases: colorAliasesResult.data || [], supplierKey: parsed.supplier_key,
  };
  const activeColorIds = new Set(lookups.colors.map((color) => String(color.id)));
  const canonicalColorBySource = new Map(lookups.colorPairingRules.map((rule) => [
    String(rule.source_color_id ?? rule.source_color_id_text ?? ''),
    String(rule.canonical_color_id ?? rule.canonical_color_id_text ?? ''),
  ]).filter(([sourceId, canonicalId]) => sourceId && canonicalId));

  const preparedLines = parsed.lines.map((line) => {
    const mapping = mappings.find((row) => supplierMatchKey(row.supplier_sku) === supplierMatchKey(line.supplier_sku));
    let blankId = mapping?.blank_product_id_text || '';
    let method = blankId ? 'saved_vendor_sku' : '';
    let catalogRow = null;
    if (!blankId) {
      catalogRow = catalog.find((row) => (
        supplierMatchKey(row.supplier_sku) === supplierMatchKey(line.supplier_sku)
        && normalizedSupplier(row.supplier_name) === parsed.supplier_key
        && row.blank_product_id
      ));
      if (catalogRow) {
        blankId = String(catalogRow.blank_product_id);
        method = 'supplier_catalog_sku';
      }
    }
    const suggested = lookupMatches({
      ...line,
      brand: line.brand || catalogRow?.brand || '',
      style: line.style || catalogRow?.style || '',
      color: line.color || catalogRow?.color || '',
      size: line.size || catalogRow?.size || '',
    }, lookups);
    return { line, blankId, method, suggested };
  });

  const mappedIds = [...new Set(preparedLines.map((entry) => entry.blankId).filter(Boolean))];
  const blankById = new Map();
  if (mappedIds.length) {
    const mappedResult = await supabase.from('blank_products')
      .select('id,sku_base,name,brand_id,product_type_id,color_id,size_id')
      .eq('sc_is_archived', false)
      .in('id', mappedIds);
    if (mappedResult.error) throw mappedResult.error;
    (mappedResult.data || []).forEach((blank) => blankById.set(String(blank.id), blank));
  }
  preparedLines.forEach((entry) => {
    if (entry.blankId && !blankById.has(String(entry.blankId))) {
      entry.method = `${entry.method || 'saved_vendor_sku'}_missing_blank_review`;
      entry.blankId = '';
    }
  });

  const identityEntries = [...new Map(preparedLines
    .filter((entry) => !entry.blankId && ['brand_id', 'product_type_id', 'color_id', 'size_id'].every((field) => entry.suggested[field]))
    .map((entry) => [identityKey(entry.suggested), entry.suggested])).entries()];
  const identityMatches = new Map();
  const candidateResults = await mapWithConcurrency(identityEntries, 8, async ([key, ids]) => {
    const result = await supabase.from('blank_products')
      .select('id,sku_base,name,brand_id,product_type_id,color_id,size_id')
      .eq('sc_is_archived', false)
      .eq('brand_id', ids.brand_id)
      .eq('product_type_id', ids.product_type_id)
      .eq('color_id', ids.color_id)
      .eq('size_id', ids.size_id)
      .limit(2);
    if (result.error) throw result.error;
    return [key, result.data || []];
  });
  candidateResults.forEach(([key, candidates]) => identityMatches.set(key, candidates));

  return preparedLines.map(({ line, blankId: initialBlankId, method: initialMethod, suggested }) => {
    let blankId = initialBlankId;
    let method = initialMethod;
    if (!blankId) {
      const candidates = identityMatches.get(identityKey(suggested)) || [];
      if (candidates.length === 1) {
        blankId = String(candidates[0].id);
        method = 'brand_style_color_size';
        blankById.set(blankId, candidates[0]);
      }
    }
    const blank = blankById.get(blankId);
    const blankColorId = String(blank?.color_id || '');
    const mappedBlankColorId = canonicalColorBySource.get(blankColorId) || blankColorId;
    const usableBlankColorId = activeColorIds.has(mappedBlankColorId) ? mappedBlankColorId : suggested.color_id;
    if (blank && usableBlankColorId !== blankColorId) {
      // The saved supplier SKU points to a blank that uses an archived/source
      // color. Keep its other attributes, but force resolution to the active
      // canonical-color blank before inventory is received.
      blankId = '';
      method = `${method || 'saved_vendor_sku'}_canonical_color_review`;
    }
    const ids = blank ? {
      brand_id: String(blank.brand_id || ''), product_type_id: String(blank.product_type_id || ''),
      color_id: usableBlankColorId, size_id: String(blank.size_id || ''),
    } : {
      brand_id: suggested.brand_id, product_type_id: suggested.product_type_id,
      color_id: suggested.color_id, size_id: suggested.size_id,
    };
    const matchedLookupCount = ['brand_id', 'product_type_id', 'color_id', 'size_id'].filter((field) => ids[field]).length;
    return {
      ...line,
      ...ids,
      blank_product_id: blankId,
      match_status: blankId ? 'matched' : (matchedLookupCount >= 3 ? 'review' : 'unmatched'),
      match_method: method || 'manual_review',
      color_match_method: blankId ? 'matched blank WooCommerce color' : suggested.color_match_method,
    };
  });
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, message: 'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName: FUNCTION_NAME, allowedRoles: ['admin', 'manager', 'operator'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, message: auth.message }, event);

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.file_base64) throw new Error('Choose an S&S Activewear or Momentec PDF first.');
    const bytes = Buffer.from(body.file_base64, 'base64');
    if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('The PDF must be between 1 byte and 12 MB.');
    if (bytes.subarray(0, 4).toString() !== '%PDF') throw new Error('The selected file is not a valid PDF.');
    // Validate every table and column used by the receiving workflow before
    // extracting or uploading the PDF. This prevents orphaned R2 documents
    // when a database migration is missing or PostgREST has stale metadata.
    await requireSupplierReceivingContract(auth.supabase);
    const parsed = parseSupplierConfirmationPages(await extractPdfTextPages(bytes));
    const hash = createHash('sha256').update(bytes).digest('hex');
    const objectPath = `operational/receiving/${parsed.supplier_key}/${safeFileName(parsed.order_number)}/${hash.slice(0, 16)}-${safeFileName(body.file_name)}`;
    const lines = await parseAndMatch(auth.supabase, parsed);
    const { data: existingImports, error: existingError } = await auth.supabase
      .from('sc_supplier_receiving_imports').select('id,status,received_units')
      .eq('supplier_key', parsed.supplier_key).eq('order_number', parsed.order_number).limit(2);
    if (existingError) throw existingError;
    if ((existingImports || []).length > 1) {
      throw new Error(`Supplier order ${parsed.order_number} has duplicate import records. Resolve them in Operations Integrity before importing this confirmation.`);
    }
    const existingImport = existingImports?.[0] || null;
    const previousByKey = new Map();
    if (existingImport?.id) {
      const prior = await auth.supabase.from('sc_supplier_receiving_lines').select('supplier_line_key,received_quantity').eq('import_id', existingImport.id);
      if (prior.error) throw prior.error;
      (prior.data || []).forEach((line) => previousByKey.set(line.supplier_line_key, Number(line.received_quantity || 0)));
    }
    // Upload only after parsing, matching, schema validation, and duplicate
    // checks have all succeeded. The hash-based key also makes a retry replace
    // the same R2 object instead of creating an orphaned copy.
    const stored = await putOperationalObject({ key: objectPath, bytes, contentType: 'application/pdf', makePreview: false });
    return jsonResponse(200, {
      success: true,
      confirmation: {
        ...parsed,
        document_storage_provider: stored.storage_provider,
        document_storage_bucket: stored.storage_bucket,
        document_path: stored.storage_path,
        document_size_bytes: stored.file_size_bytes,
        document_mime_type: 'application/pdf',
        document_sha256: hash,
        original_file_name: safeFileName(body.file_name),
        duplicate_order: Boolean(existingImport),
        existing_status: existingImport?.status || '',
        lines: lines.map((line) => {
          const received = previousByKey.get(line.supplier_line_key) || 0;
          return { ...line, previously_received: received, remaining_quantity: Math.max(0, line.ordered_quantity - received) };
        }),
      },
    }, event);
  } catch (error) {
    console.error('Supplier confirmation parse failed:', error);
    return jsonResponse(400, { success: false, message: error.message || 'Supplier confirmation could not be read.' }, event);
  }
}
