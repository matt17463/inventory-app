import { supabase } from '../supabaseClient';

export async function getMappingRepairIssues({ search = '', includeResolved = false } = {}) {
  const { data, error } = await supabase.rpc('sc_mapping_repair_issues', {
    p_search: search,
    p_include_resolved: includeResolved,
  });
  if (error) throw error;
  return data || [];
}

export async function createMappingLookups(sourceSku) {
  const { data, error } = await supabase.rpc('sc_mapping_repair_create_lookups', {
    p_source_sku: sourceSku,
  });
  if (error) throw error;
  return data;
}

export async function createMissingBlankProduct(sourceSku) {
  const { data, error } = await supabase.rpc('sc_mapping_repair_create_blank_product', {
    p_source_sku: sourceSku,
  });
  if (error) throw error;
  return data;
}

export function mappingStatusLabel(issueType) {
  const labels = {
    missing_source_sku: 'Missing source SKU',
    missing_source_brand: 'Missing source brand',
    missing_source_style: 'Missing source style',
    missing_source_color: 'Missing source color',
    missing_source_size: 'Missing source size',
    missing_brand_lookup: 'Missing brand lookup',
    missing_style_lookup: 'Missing style lookup',
    missing_color_lookup: 'Missing color lookup',
    missing_size_lookup: 'Missing size lookup',
    missing_blank_product: 'Missing blank product',
    duplicate_blank_product: 'Duplicate blank product',
    matched: 'Matched',
  };
  return labels[issueType] || issueType || 'Unknown';
}
