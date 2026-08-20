import { createHash } from 'node:crypto';
import { getDocument, GlobalWorkerOptions } from './_vendor/pdfjs/pdf.mjs';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { parseSupplierConfirmationPages, supplierMatchKey, supplierSizeCandidates } from './_shared/supplierConfirmationParser.js';

const FUNCTION_NAME = 'supplier-confirmation-parse';
const BUCKET = 'sc-receiving-documents';
const MAX_BYTES = 12 * 1024 * 1024;

GlobalWorkerOptions.workerSrc = new URL('./_vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;

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
  const color = matchOne(lookups.colors, [line.color]);
  const size = matchOne(lookups.sizes, supplierSizeCandidates(line.size, line.audience));
  return {
    brand_id: brand.length === 1 ? String(brand[0].id) : '',
    product_type_id: style.length === 1 ? String(style[0].id) : '',
    color_id: color.length === 1 ? String(color[0].id) : '',
    size_id: size.length === 1 ? String(size[0].id) : '',
  };
}

async function pdfPages(bytes) {
  const pdf = await getDocument({ data: new Uint8Array(bytes) }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push({
      pageNumber,
      cells: content.items.filter((item) => item.str).map((item) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
      })),
    });
  }
  return pages;
}

async function parseAndMatch(supabase, parsed) {
  const skus = parsed.lines.map((line) => line.supplier_sku).filter(Boolean);
  const [mappingResult, catalogResult, blankResult, brandsResult, stylesResult, colorsResult, sizesResult] = await Promise.all([
    supabase.from('sc_supplier_item_mappings').select('*').eq('supplier_key', parsed.supplier_key),
    skus.length ? supabase.from('supplier_catalog_review').select('*').in('supplier_sku', skus) : Promise.resolve({ data: [], error: null }),
    supabase.from('blank_products').select('id,sku_base,name,brand_id,product_type_id,color_id,size_id').limit(5000),
    supabase.from('brands').select('id,name,code'),
    supabase.from('product_types').select('id,name,code'),
    supabase.from('colors').select('id,name,code'),
    supabase.from('sizes').select('id,name,code'),
  ]);
  const errors = [mappingResult, catalogResult, blankResult, brandsResult, stylesResult, colorsResult, sizesResult].map((result) => result.error).filter(Boolean);
  if (errors.length) {
    const missingSql = errors.find((error) => /sc_supplier_item_mappings|does not exist/i.test(error.message || ''));
    if (missingSql) throw new Error('Supplier receiving SQL is not installed. Run deployment/sql/19_SUPPLIER_CONFIRMATION_RECEIVING.sql in Supabase, then retry.');
    throw errors[0];
  }

  const mappings = mappingResult.data || [];
  const catalog = catalogResult.data || [];
  const blanks = blankResult.data || [];
  const blankById = new Map(blanks.map((blank) => [String(blank.id), blank]));
  const lookups = {
    brands: brandsResult.data || [], productTypes: stylesResult.data || [],
    colors: colorsResult.data || [], sizes: sizesResult.data || [],
  };

  return parsed.lines.map((line) => {
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
    if (!blankId && Object.values(suggested).every(Boolean)) {
      const candidates = blanks.filter((blank) => (
        String(blank.brand_id) === suggested.brand_id
        && String(blank.product_type_id) === suggested.product_type_id
        && String(blank.color_id) === suggested.color_id
        && String(blank.size_id) === suggested.size_id
      ));
      if (candidates.length === 1) {
        blankId = String(candidates[0].id);
        method = 'brand_style_color_size';
      }
    }
    const blank = blankById.get(blankId);
    const ids = blank ? {
      brand_id: String(blank.brand_id || ''), product_type_id: String(blank.product_type_id || ''),
      color_id: String(blank.color_id || ''), size_id: String(blank.size_id || ''),
    } : suggested;
    return {
      ...line,
      ...ids,
      blank_product_id: blankId,
      match_status: blankId ? 'matched' : (Object.values(ids).filter(Boolean).length >= 3 ? 'review' : 'unmatched'),
      match_method: method || 'manual_review',
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
    const parsed = parseSupplierConfirmationPages(await pdfPages(bytes));
    const hash = createHash('sha256').update(bytes).digest('hex');
    const objectPath = `${parsed.supplier_key}/${safeFileName(parsed.order_number)}/${hash.slice(0, 16)}-${safeFileName(body.file_name)}`;
    const upload = await auth.supabase.storage.from(BUCKET).upload(objectPath, bytes, {
      contentType: 'application/pdf', upsert: true,
    });
    if (upload.error) {
      if (/bucket not found/i.test(upload.error.message || '')) throw new Error('Supplier receiving storage is not installed. Run deployment/sql/19_SUPPLIER_CONFIRMATION_RECEIVING.sql in Supabase, then retry.');
      throw upload.error;
    }
    const lines = await parseAndMatch(auth.supabase, parsed);
    const { data: existingImport, error: existingError } = await auth.supabase
      .from('sc_supplier_receiving_imports').select('id,status,received_units').eq('supplier_key', parsed.supplier_key).eq('order_number', parsed.order_number).maybeSingle();
    if (existingError) throw existingError;
    const previousByKey = new Map();
    if (existingImport?.id) {
      const prior = await auth.supabase.from('sc_supplier_receiving_lines').select('supplier_line_key,received_quantity').eq('import_id', existingImport.id);
      if (prior.error) throw prior.error;
      (prior.data || []).forEach((line) => previousByKey.set(line.supplier_line_key, Number(line.received_quantity || 0)));
    }
    return jsonResponse(200, {
      success: true,
      confirmation: {
        ...parsed,
        document_path: objectPath,
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
