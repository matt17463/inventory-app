import { supplierMatchKey } from './supplierConfirmationParser.js';

export function text(value) { return String(value ?? '').trim(); }
export function id(value) { return text(value); }

export async function allColorRows(supabase) {
  const result = await supabase.from('colors').select('*').limit(10000);
  if (result.error) throw result.error;
  return result.data || [];
}

function ruleId(rule, prefix) {
  return id(rule?.[`${prefix}_color_id`] ?? rule?.[`${prefix}_color_id_text`]);
}

function colorTerm(color, terms) {
  const directId = id(color.woo_term_id);
  if (directId) return terms.find((term) => id(term.id) === directId) || null;
  const keys = [color.woo_term_slug, color.slug, color.name, color.code].map(supplierMatchKey).filter(Boolean);
  return terms.find((term) => keys.includes(supplierMatchKey(term.slug)) || keys.includes(supplierMatchKey(term.name))) || null;
}

export async function lifecyclePreview(supabase, { requireWooScan = true } = {}) {
  const [colors, usageResult, rulesResult, scanResult] = await Promise.all([
    allColorRows(supabase),
    supabase.rpc('sc_color_lifecycle_usage_counts'),
    supabase.rpc('sc_get_color_pairing_rules', { p_status: 'active' }),
    supabase.from('sc_color_lifecycle_jobs').select('*').eq('action', 'scan').eq('status', 'completed').order('completed_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const result of [usageResult, rulesResult, scanResult]) if (result.error) throw result.error;
  const scan = scanResult.data || null;
  const snapshotResult = scan
    ? await supabase.from('sc_color_woo_term_snapshot').select('*').eq('scan_id', scan.id).order('term_name')
    : { data: [], error: null };
  if (snapshotResult.error) throw snapshotResult.error;
  const terms = (snapshotResult.data || []).map((row) => ({
    id: row.term_id, name: row.term_name, slug: row.term_slug, count: Number(row.product_count || 0), attribute_id: row.attribute_id,
  }));
  const usageById = new Map((usageResult.data || []).map((row) => [id(row.color_id_text), row]));
  const rules = rulesResult.data || [];
  const canonicalIds = new Set(rules.map((rule) => ruleId(rule, 'canonical')).filter(Boolean));
  const sourceIds = new Set(rules.map((rule) => ruleId(rule, 'source')).filter(Boolean));
  const mappedTermIds = new Set();
  const hasWooScan = Boolean(scan);

  const rows = colors.map((color) => {
    const colorId = id(color.id);
    const term = colorTerm(color, terms);
    if (term) mappedTermIds.add(id(term.id));
    const usage = usageById.get(colorId) || {};
    const productCount = Number(usage.product_count || 0);
    const blankCount = Number(usage.blank_count || 0);
    const usageCount = productCount + blankCount;
    const canonical = canonicalIds.has(colorId);
    const source = sourceIds.has(colorId);
    const wooCount = Number(term?.count || 0);
    const eligible = hasWooScan && color.is_active !== false && usageCount === 0 && wooCount === 0 && !canonical;
    return {
      key: `color:${colorId}`, color_id: colorId, color_name: color.name, color_code: color.code,
      is_active: color.is_active !== false, product_count: productCount, blank_count: blankCount, usage_count: usageCount,
      active_pairing_source: source, active_pairing_canonical: canonical,
      woo_term_id: term?.id || null, woo_term_name: term?.name || null, woo_product_count: wooCount,
      eligible, reason: !hasWooScan && requireWooScan ? 'Run WooCommerce scan before cleanup'
        : eligible ? (source ? 'Unused source alias; pairing rule will be retained' : 'Unused color')
          : canonical ? 'Protected canonical pairing color'
            : usageCount ? 'Used by inventory/products'
              : wooCount ? 'Used by WooCommerce products' : 'Already archived',
    };
  });

  for (const term of terms) {
    if (mappedTermIds.has(id(term.id))) continue;
    const eligible = Number(term.count || 0) === 0;
    rows.push({
      key: `woo:${term.id}`, color_id: null, color_name: term.name, color_code: term.slug,
      is_active: true, product_count: 0, blank_count: 0, usage_count: 0,
      active_pairing_source: false, active_pairing_canonical: false,
      woo_term_id: term.id, woo_term_name: term.name, woo_product_count: Number(term.count || 0),
      eligible, reason: eligible ? 'Unused WooCommerce-only term' : 'Used by WooCommerce products',
    });
  }
  return {
    scan_required: !hasWooScan,
    scan_id: scan?.id || null,
    scanned_at: scan?.completed_at || null,
    attribute_id: terms[0]?.attribute_id || Number(scan?.result?.attribute_id || 0) || null,
    rows: rows.sort((a, b) => a.color_name.localeCompare(b.color_name)),
  };
}
