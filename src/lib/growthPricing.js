export const growthStages = [
  "identified",
  "contacted",
  "qualified",
  "demo",
  "proposal",
  "negotiation",
  "won",
  "launching",
  "live",
  "nurture",
  "lost",
];
export const growthModels = {
  retail: "Standard retail",
  wholesale_keep_difference: "Wholesale → retail: client keeps the difference",
  revenue_share: "Fixed share of net sales",
  profit_share: "Fixed share of contribution profit",
};
export const defaultGrowthPricing = {
  model: "retail",
  share_percent: 0,
  target_margin_percent: 40,
};
const money = (v) => Math.sign(Number(v))*Math.round((Math.abs(Number(v)) + Number.EPSILON) * 100) / 100;
export function calculateGrowthPricing(config, lines) {
  const model = config.model || "retail",
    share = Number(config.share_percent ?? 0),
    target = Number(config.target_margin_percent ?? 40);
  if (
    !growthModels[model] ||
    !Number.isFinite(share) ||
    share < 0 ||
    share > 100 ||
    !Number.isFinite(target) ||
    target < 0 ||
    target >= 100
  )
    throw Error("Choose valid pricing percentages.");
  if (!Array.isArray(lines) || !lines.length || lines.length > 100)
    throw Error("Add 1–100 pricing lines.");
  const result = lines.map((line) => {
    const q = Number(line.quantity);
    if (
      !line.description?.trim() ||
      !Number.isInteger(q) ||
      q < 1 ||
      q > 1000000
    )
      throw Error("Each line needs a description and positive whole quantity.");
    for (const k of [
      "unit_cost",
      "decoration_cost",
      "labor_cost",
      "other_cost",
      "setup_fee",
      "retail_price",
      "wholesale_price",
    ])
      if (
        !Number.isFinite(Number(line[k] ?? 0)) ||
        Number(line[k] ?? 0) < 0 ||
        Number(line[k] ?? 0) > 10000000
      )
        throw Error("Prices and costs must be positive amounts.");
    const cost = money(
      q *
        ["unit_cost", "decoration_cost", "labor_cost", "other_cost"].reduce(
          (s, k) => s + Number(line[k] ?? 0),
          0,
        ) +
        Number(line.setup_fee || 0),
    );
    const revenue = money(q * money(line.retail_price || 0)),
      wholesale = money(line.wholesale_price || 0);
    if (
      model === "wholesale_keep_difference" &&
      wholesale > Number(line.retail_price || 0)
    )
      throw Error("Wholesale cannot exceed retail.");
    const partner_share =
      model === "wholesale_keep_difference"
        ? money(q * (money(line.retail_price || 0) - wholesale))
        : model === "revenue_share"
          ? money((revenue * share) / 100)
          : model === "profit_share"
            ? money((Math.max(0, revenue - cost) * share) / 100)
            : 0;
    return {
      ...line,
      quantity: q,
      cost,
      revenue,
      partner_share,
      business_profit: money(revenue - cost - partner_share),
    };
  });
  const totals = result.reduce(
    (t, l) => ({
      ...t,
      units: t.units + l.quantity,
      revenue: money(t.revenue + l.revenue),
      cost: money(t.cost + l.cost),
      partner_share: money(t.partner_share + l.partner_share),
      business_profit: money(t.business_profit + l.business_profit),
    }),
    { units: 0, revenue: 0, cost: 0, partner_share: 0, business_profit: 0 },
  );
  const retained = money(totals.revenue - totals.partner_share);
  const margin = retained
    ? money((totals.business_profit / retained) * 100)
    : 0;
  return {
    ...totals,
    retained_revenue: retained,
    lines: result,
    business_margin_percent: margin,
    below_target: !retained || margin < target || totals.business_profit < 0,
  };
}
export function suggestedGrowthRetail(unitCost, config) {
  const cost = Number(unitCost),
    target = Number(config.target_margin_percent ?? 40) / 100,
    share = Number(config.share_percent ?? 0) / 100;
  const factor =
    config.model === "profit_share"
      ? 1 + target / ((1 - share) * (1 - target))
      : null;
  const denominator =
    config.model === "revenue_share" ? (1 - target) * (1 - share) : 1 - target;
  if (
    !Number.isFinite(cost) ||
    cost < 0 ||
    !Number.isFinite(denominator) ||
    denominator <= 0 ||
    (config.model === "profit_share" && !Number.isFinite(factor))
  )
    return null;
  return (
    Math.ceil((factor === null ? cost / denominator : cost * factor) * 100) /
    100
  );
}
export const escapeGrowthHtml = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function growthCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((v) => {
          let s = String(v ?? "");
          if (/^\s*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
export function safeGrowthUrl(value) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
export function parseGrowthCsv(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  const source = String(text).replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("The CSV contains an unclosed quote.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  const header = (rows.shift() || []).map((v) => v.trim().toLowerCase());
  if (!header.includes("organization"))
    throw Error("Include an organization column.");
  if (new Set(header).size !== header.length)
    throw Error("CSV column names must be unique.");
  if (!rows.length || rows.length > 200)
    throw Error("Import 1–200 organizations at a time.");
  return rows.map((r, i) => {
    if (r.length !== header.length)
      throw Error("CSV row " + (i + 2) + " has a different number of columns.");
    const item = Object.fromEntries(
      header.map((h, j) => [h, (r[j] || "").trim()]),
    );
    if (!item.organization)
      throw Error("CSV row " + (i + 2) + " needs an organization.");
    if (
      item.segment &&
      !["school", "nonprofit", "team", "club", "business", "other"].includes(
        item.segment,
      )
    )
      throw Error("CSV row " + (i + 2) + " has an unknown client type.");
    if (item.website && !safeGrowthUrl(item.website))
      throw Error(
        "CSV row " + (i + 2) + " needs a full http or https website URL.",
      );
    return item;
  });
}

/** Use the operational pricing rule as the source of suggested marketing line prices.
 * Supplier cost remains a separate input; never persist a discounted or hypothetical cost.
 */
export function applyGrowthPricingRule(line, rule) {
  if (!rule || rule.active === false) throw Error("Select an active pricing rule.");
  const quantity = Number(line.quantity);
  const unitCost = Number(line.unit_cost || 0);
  const decoration = Number(rule.decoration_cost || 0);
  const setup = Number(rule.setup_fee || 0);
  const multiplier = Number(rule.markup_multiplier);
  const base = Number(rule.base_price || 0);
  const labor = Number(line.labor_cost || 0);
  const other = Number(line.other_cost || 0);
  if (![quantity, unitCost, decoration, setup, multiplier, base, labor, other].every(Number.isFinite) ||
      !Number.isInteger(quantity) || quantity < 1 ||
      [unitCost, decoration, setup, base, labor, other].some((v) => v < 0) || multiplier <= 0) {
    throw Error("Invalid product cost or pricing rule.");
  }
  const calculated = base > 0 ? base :
    Math.ceil((unitCost + decoration + labor + other + setup / quantity) * multiplier * 100) / 100;
  return {
    ...line,
    decoration_cost: decoration,
    setup_fee: setup,
    retail_price: Number(calculated.toFixed(2)),
    pricing_rule_id: rule.id,
    pricing_rule_name: rule.rule_name || "",
  };
}
