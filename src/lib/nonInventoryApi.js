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

function buildSupabaseErrorMessage(error, fallback = 'Supabase request failed.') {
  if (!error) return fallback;
  const parts = [error.message, error.details, error.hint, error.code].filter(Boolean);
  return parts.length ? parts.join(' | ') : fallback;
}

function normalizeRuleRow(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id == null ? null : Number(row.id),
    priority: row.priority == null ? 100 : Number(row.priority),
    is_active: row.is_active !== false,
    include_on_purchasing_report: row.include_on_purchasing_report !== false,
  };
}

function normalizeRulePayload(rule = {}) {
  const ruleType = rule.rule_type || 'exact_sku';
  const matchValue = String(rule.match_value || '').trim();
  const label = String(rule.label || '').trim();
  const reason = String(rule.reason || '').trim() || 'No inventory tracking required for this WooCommerce item.';
  const priorityValue = Number(rule.priority);

  if (!matchValue) {
    throw new Error('Enter a match value before saving the rule.');
  }

  if ((ruleType === 'woo_product_id' || ruleType === 'woo_variation_id') && !/^\d+$/.test(matchValue)) {
    throw new Error(`${ruleType === 'woo_product_id' ? 'Woo product ID' : 'Woo variation ID'} rules require a numeric WooCommerce ID.`);
  }

  return {
    p_rule_id_text: rule.id ? String(rule.id) : null,
    p_rule_type: ruleType,
    p_match_value: matchValue,
    p_label: label || null,
    p_reason: reason,
    p_priority: Number.isFinite(priorityValue) ? priorityValue : 100,
    p_is_active: rule.is_active !== false,
    p_include_on_purchasing_report: rule.include_on_purchasing_report !== false,
  };
}

export async function listNonInventoryRules() {
  const { data, error } = await supabase.rpc('sc_list_non_inventory_product_rules_v3');
  if (error) {
    throw new Error(buildSupabaseErrorMessage(error, 'Could not load non-inventory rules. Run 07_NON_INVENTORY_PURCHASING_TOGGLE.sql in Supabase.'));
  }
  return (data || []).map(normalizeRuleRow).filter(Boolean);
}

export async function saveNonInventoryRule(rule) {
  const payload = normalizeRulePayload(rule);
  const { data, error } = await supabase.rpc('sc_save_non_inventory_product_rule_v3', payload);
  if (error) {
    throw new Error(buildSupabaseErrorMessage(
      error,
      'Could not save the non-inventory rule. Run 07_NON_INVENTORY_PURCHASING_TOGGLE.sql in Supabase.'
    ));
  }
  const row = Array.isArray(data) ? data[0] : data;
  return normalizeRuleRow(row);
}

export async function setNonInventoryRuleActive(ruleId, isActive) {
  const { data, error } = await supabase.rpc('sc_set_non_inventory_rule_active_v2', {
    p_rule_id_text: String(ruleId),
    p_is_active: Boolean(isActive),
  });
  if (error) {
    throw new Error(buildSupabaseErrorMessage(error, 'Could not update non-inventory rule.'));
  }
  const row = Array.isArray(data) ? data[0] : data;
  return normalizeRuleRow(row);
}

export async function findNonInventoryRuleForLine({ sku, wooProductId, wooVariationId, productName }) {
  const { data, error } = await supabase.rpc('sc_find_non_inventory_rule_for_line', {
    p_sku: sku || null,
    p_woo_product_id: wooProductId ? Number(wooProductId) : null,
    p_woo_variation_id: wooVariationId ? Number(wooVariationId) : null,
    p_product_name: productName || null,
  });
  if (error) throw new Error(buildSupabaseErrorMessage(error, 'Could not check non-inventory rules.'));
  return Array.isArray(data) ? data[0] || null : data || null;
}

export async function markJobItemNonInventory({
  jobItemId,
  reason,
  createFutureRule,
  ruleType,
  ruleMatchValue,
  includeOnPurchasingReport = true,
}) {
  const { data, error } = await supabase.rpc('sc_mark_job_item_non_inventory_v2', {
    p_job_item_id: Number(jobItemId),
    p_reason: reason || 'No inventory tracking required for this WooCommerce item.',
    p_create_future_rule: Boolean(createFutureRule),
    p_rule_type: ruleType || 'exact_sku',
    p_rule_match_value: ruleMatchValue || null,
    p_include_on_purchasing_report: includeOnPurchasingReport !== false,
  });
  if (error) {
    throw new Error(buildSupabaseErrorMessage(
      error,
      'Could not mark the pull sheet line as non-inventory. Run 07_NON_INVENTORY_PURCHASING_TOGGLE.sql in Supabase.'
    ));
  }
  return data;
}

export async function setJobItemPurchasingReportInclusion({
  jobItemId,
  includeOnPurchasingReport,
}) {
  const { data, error } = await supabase
    .from('job_items')
    .update({
      include_on_purchasing_report: includeOnPurchasingReport !== false,
    })
    .eq('id', Number(jobItemId))
    .select('id, include_on_purchasing_report')
    .single();

  if (error) {
    throw new Error(buildSupabaseErrorMessage(
      error,
      'Could not update purchasing-report inclusion. Run 07_NON_INVENTORY_PURCHASING_TOGGLE.sql in Supabase.'
    ));
  }

  return data;
}

export async function applyNonInventoryRulesToJob(jobId) {
  const { data, error } = await supabase.rpc('sc_apply_non_inventory_rules_to_job_v2', {
    p_job_id: Number(jobId),
  });
  if (error) throw new Error(buildSupabaseErrorMessage(error, 'Could not apply rules to this pull sheet.'));
  return data || [];
}

export async function applyNonInventoryRulesToOpenJobs(limit = 500) {
  const { data, error } = await supabase.rpc('sc_apply_non_inventory_rules_to_open_jobs_v2', {
    p_limit: Number(limit || 500),
  });
  if (error) throw new Error(buildSupabaseErrorMessage(error, 'Could not apply rules to open pull sheets.'));
  return data || [];
}
