
import { supabase } from '../supabaseClient';

function escapeOrTerm(value) {
  return String(value || '').replace(/[%_,]/g, '');
}

export async function importSupplierCatalogRowsControlled({
  supplierName,
  sourceFileName,
  rows,
  updateBlankProducts = false,
  createMissingLookups = true,
  keepLatestOnly = true,
  allowedBrands = [],
  allowedStyles = [],
}) {
  const { data, error } = await supabase.rpc('sc_import_supplier_catalog_rows_controlled', {
    p_supplier_name: supplierName,
    p_source_file_name: sourceFileName || null,
    p_rows: rows || [],
    p_update_blank_products: Boolean(updateBlankProducts),
    p_create_missing_lookups: Boolean(createMissingLookups),
    p_keep_latest_only: Boolean(keepLatestOnly),
    p_allowed_brands: allowedBrands || [],
    p_allowed_styles: allowedStyles || [],
  });
  if (error) throw error;
  if (data && data.success === false) throw new Error(data.message || 'Supplier catalog import failed.');
  return data;
}

export async function clearSupplierCatalogImportedData({ supplierName = null, clearMode = 'all_imported' } = {}) {
  const { data, error } = await supabase.rpc('sc_clear_supplier_catalog_imported_data', {
    p_supplier_name: supplierName || null,
    p_clear_mode: clearMode || 'all_imported',
  });
  if (error) throw error;
  if (data && data.success === false) throw new Error(data.message || 'Supplier catalog clear failed.');
  return data;
}

export async function getSupplierCatalogReviewPaged({
  search = '', status = '', supplierName = '', brand = '', style = '',
  quoteOnly = false, substitutionOnly = false, candidatesOnly = false, unmatchedOnly = false,
  page = 1, pageSize = 100,
} = {}) {
  const from = Math.max(0, (Number(page || 1) - 1) * Number(pageSize || 100));
  const to = from + Number(pageSize || 100) - 1;
  let query = supabase.from('supplier_catalog_review').select('*', { count: 'exact' })
    .order('supplier_name', { ascending: true }).order('brand', { ascending: true }).order('style', { ascending: true }).range(from, to);
  const term = String(search || '').trim();
  if (term) {
    const escaped = escapeOrTerm(term);
    query = query.or([
      `supplier_name.ilike.%${escaped}%`, `brand.ilike.%${escaped}%`, `style.ilike.%${escaped}%`,
      `color.ilike.%${escaped}%`, `size.ilike.%${escaped}%`, `supplier_sku.ilike.%${escaped}%`,
      `upc.ilike.%${escaped}%`, `description.ilike.%${escaped}%`, `blank_sku_base.ilike.%${escaped}%`,
    ].join(','));
  }
  if (status) query = query.eq('review_status', status);
  if (supplierName) query = query.eq('supplier_name', supplierName);
  if (brand) query = query.ilike('brand', `%${escapeOrTerm(brand)}%`);
  if (style) query = query.ilike('style', `%${escapeOrTerm(style)}%`);
  if (quoteOnly) query = query.eq('use_in_quote_builder', true);
  if (substitutionOnly) query = query.eq('use_in_substitution_suggestions', true);
  if (candidatesOnly) query = query.eq('create_blank_candidate', true);
  if (unmatchedOnly) query = query.is('blank_product_id', null);
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data || [], count: count || 0, page: Number(page || 1), pageSize: Number(pageSize || 100) };
}

export async function getSupplierCatalogDistinctOptions() {
  const { data, error } = await supabase.rpc('sc_supplier_catalog_filter_options');
  if (error) throw error;
  return data || { suppliers: [], brands: [], styles: [] };
}

export async function getSupplierCatalogReviewStats() {
  const { data, error } = await supabase.rpc('sc_supplier_catalog_review_stats');
  if (error) throw error;
  return data || [];
}

export async function updateSupplierCatalogReviewItem({
  itemId, review_status, use_in_quote_builder = false, use_in_substitution_suggestions = false,
  create_blank_candidate = false, review_notes = '', updated_by = null,
}) {
  const { data, error } = await supabase.rpc('sc_update_supplier_catalog_review_item', {
    p_item_id: itemId,
    p_review_status: review_status || 'unreviewed',
    p_use_in_quote_builder: Boolean(use_in_quote_builder),
    p_use_in_substitution_suggestions: Boolean(use_in_substitution_suggestions),
    p_create_blank_candidate: Boolean(create_blank_candidate),
    p_review_notes: review_notes || null,
    p_updated_by: updated_by || null,
  });
  if (error) throw error;
  if (data && data.success === false) throw new Error(data.message || 'Supplier catalog review update failed.');
  return data;
}

export async function listSupplierCatalogFeeds() {
  const { data, error } = await supabase.from('supplier_catalog_feeds').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function createSupplierCatalogFeed(feed) {
  const { data, error } = await supabase.from('supplier_catalog_feeds').insert({
    supplier_name: feed.supplier_name, feed_name: feed.feed_name || null, feed_url: feed.feed_url,
    source_file_name: feed.source_file_name || null, is_active: feed.is_active !== false,
    update_blank_products: Boolean(feed.update_blank_products), create_missing_lookups: feed.create_missing_lookups !== false,
  }).select('*').single();
  if (error) throw error; return data;
}
export async function updateSupplierCatalogFeed(feedId, values) {
  const { data, error } = await supabase.from('supplier_catalog_feeds').update({
    supplier_name: values.supplier_name, feed_name: values.feed_name || null, feed_url: values.feed_url,
    source_file_name: values.source_file_name || null, is_active: values.is_active !== false,
    update_blank_products: Boolean(values.update_blank_products), create_missing_lookups: values.create_missing_lookups !== false,
    updated_at: new Date().toISOString(),
  }).eq('id', feedId).select('*').single();
  if (error) throw error; return data;
}
export async function deleteSupplierCatalogFeed(feedId) {
  const { error } = await supabase.from('supplier_catalog_feeds').delete().eq('id', feedId);
  if (error) throw error; return true;
}
export async function syncSupplierCatalogFeed(feedId) {
  const response = await fetch('/.netlify/functions/supplier-catalog-feed-sync', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feed_id: feedId }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) throw new Error(body?.message || `Supplier catalog feed sync failed: HTTP ${response.status}`);
  return body;
}
