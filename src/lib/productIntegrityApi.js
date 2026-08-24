import { supabase } from '../supabaseClient';

export async function getProductIntegritySummary() {
  const { data, error } = await supabase.rpc('sc_product_integrity_summary_v1');
  if (error) throw error;
  return data || [];
}

export async function getProductIntegrityIssues({ issueType = 'all', search = '', limit = 500 } = {}) {
  const { data, error } = await supabase.rpc('sc_product_integrity_issues_v1', {
    p_issue_type: issueType || 'all',
    p_search: String(search || '').trim(),
    p_limit: Math.min(Math.max(Number(limit || 500), 1), 2000),
  });
  if (error) throw error;
  return data || [];
}

export function productIntegrityLabel(value) {
  const labels = {
    duplicate_identity: 'Duplicate brand/style/color/size',
    duplicate_sku: 'Duplicate normalized SKU',
    duplicate_barcode: 'Duplicate barcode / UPC',
    incomplete_identity: 'Incomplete product identity',
    duplicate_lookup_brand: 'Duplicate brand lookup',
    duplicate_lookup_style: 'Duplicate style lookup',
    duplicate_lookup_color: 'Duplicate color lookup',
    duplicate_lookup_size: 'Duplicate size lookup',
    archived_color_in_use: 'Archived color still in use',
  };
  return labels[value] || String(value || 'Unknown issue').replace(/_/g, ' ');
}
