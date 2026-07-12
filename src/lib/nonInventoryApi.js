
import { supabase } from '../supabaseClient';

export const NON_INVENTORY_RULE_TYPES = [
  { value: 'exact_sku', label: 'Exact SKU' },
  { value: 'sku_contains', label: 'SKU contains' },
  { value: 'sku_prefix', label: 'SKU starts with' },
  { value: 'sku_regex', label: 'SKU regex' },
  { value: 'woo_product_id', label: 'Woo product ID' },
  { value: 'woo_variation_id', label: 'Woo variation ID' },
  { value: 'product_name_contains', label: 'Product name contains' },
];

export async function listNonInventoryRules() {
  const { data, error } = await supabase
    .from('sc_non_inventory_product_rules')
    .select('*')
    .order('is_active', { ascending: false })
    .order('priority', { ascending: true })
    .order('id', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveNonInventoryRule(rule) {
  const { data, error } = await supabase.rpc('sc_upsert_non_inventory_product_rule', {
    p_rule_id: rule.id || null,
    p_rule_type: rule.rule_type || 'exact_sku',
    p_match_value: rule.match_value || '',
    p_label: rule.label || null,
    p_reason: rule.reason || 'No inventory tracking required for this WooCommerce item.',
    p_priority: Number(rule.priority || 100),
    p_is_active: rule.is_active !== false,
  });
  if (error) throw error;
  return data;
}

export async function setNonInventoryRuleActive(ruleId, isActive) {
  const { data, error } = await supabase.rpc('sc_set_non_inventory_rule_active', {
    p_rule_id: Number(ruleId),
    p_is_active: Boolean(isActive),
  });
  if (error) throw error;
  return data;
}

export async function findNonInventoryRuleForLine({ sku, wooProductId, wooVariationId, productName }) {
  const { data, error } = await supabase.rpc('sc_find_non_inventory_rule_for_line', {
    p_sku: sku || null,
    p_woo_product_id: wooProductId ? Number(wooProductId) : null,
    p_woo_variation_id: wooVariationId ? Number(wooVariationId) : null,
    p_product_name: productName || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

export async function markJobItemNonInventory({ jobItemId, reason, createFutureRule, ruleType, ruleMatchValue }) {
  const { data, error } = await supabase.rpc('sc_mark_job_item_non_inventory', {
    p_job_item_id: Number(jobItemId),
    p_reason: reason || 'No inventory tracking required for this WooCommerce item.',
    p_create_future_rule: Boolean(createFutureRule),
    p_rule_type: ruleType || 'exact_sku',
    p_rule_match_value: ruleMatchValue || null,
  });
  if (error) throw error;
  return data;
}

export async function applyNonInventoryRulesToJob(jobId) {
  const { data, error } = await supabase.rpc('sc_apply_non_inventory_rules_to_job', {
    p_job_id: Number(jobId),
  });
  if (error) throw error;
  return data || [];
}

export async function applyNonInventoryRulesToOpenJobs(limit = 500) {
  const { data, error } = await supabase.rpc('sc_apply_non_inventory_rules_to_open_jobs', {
    p_limit: Number(limit || 500),
  });
  if (error) throw error;
  return data || [];
}
