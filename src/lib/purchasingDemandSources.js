function numericDemandValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function purchasingDemandSourceQuantity(source) {
  return Math.max(
    numericDemandValue(source?.quantity_reserved),
    numericDemandValue(source?.reserved_quantity),
    numericDemandValue(source?.quantity)
  );
}

export function normalizePurchasingDemandSourceRow(row) {
  let sources = row?.demand_sources ?? row?.sources ?? [];

  if (typeof sources === 'string') {
    try {
      sources = JSON.parse(sources);
    } catch (_error) {
      sources = [];
    }
  }

  if (!Array.isArray(sources)) sources = [];

  const calculatedTotal = sources.reduce(
    (sum, source) => sum + purchasingDemandSourceQuantity(source),
    0
  );

  return {
    blank_product_id: row?.blank_product_id,
    demand_source_count: Math.max(
      Number(row?.demand_source_count ?? row?.source_count ?? 0) || 0,
      sources.length
    ),
    demand_total_quantity: Math.max(
      Number(row?.demand_total_quantity ?? row?.total_quantity ?? 0) || 0,
      calculatedTotal
    ),
    demand_order_numbers:
      row?.demand_order_numbers ?? row?.order_numbers ?? '',
    demand_pullsheet_numbers:
      row?.demand_pullsheet_numbers ?? row?.pullsheet_numbers ?? '',
    demand_sources: sources,
  };
}

export function representedPurchasingJobItemIds(sources) {
  return new Set(
    (sources || [])
      .map((source) => source?.job_item_id)
      .filter((value) => value !== null && value !== undefined)
      .map(String)
  );
}

export function unrepresentedPurchasingSources(sources, representedIds) {
  const ids = representedIds instanceof Set
    ? representedIds
    : representedPurchasingJobItemIds(representedIds);

  return (sources || []).filter((source) => (
    !source?.job_item_id
    || !ids.has(String(source.job_item_id))
  ));
}


export function purchasingIntegrityFallbackAdjustment(currentRow, fallbackRow, mode) {
  const fallbackAdjustment = mode === 'shortages'
    ? numericDemandValue(fallbackRow?.need_to_order)
    : numericDemandValue(fallbackRow?.recommended_order_quantity);

  if (!(fallbackAdjustment > 0)) return 0;
  if (!currentRow) return fallbackAdjustment;

  const fallbackSources = Array.isArray(fallbackRow?.demand_sources)
    ? fallbackRow.demand_sources
    : [];

  // If the DB could not give us line-level source identity, preserve the
  // database-calculated adjustment rather than guessing.
  if (!fallbackSources.length) return fallbackAdjustment;

  const representedIds = representedPurchasingJobItemIds(
    Array.isArray(currentRow?.demand_sources)
      ? currentRow.demand_sources
      : []
  );
  const unrepresentedSources = unrepresentedPurchasingSources(
    fallbackSources,
    representedIds
  );

  if (!unrepresentedSources.length) return 0;

  const additionalDemand = unrepresentedSources.reduce(
    (sum, source) => sum + purchasingDemandSourceQuantity(source),
    0
  );

  if (!(additionalDemand > 0)) return 0;

  const reserved = numericDemandValue(currentRow?.reserved_quantity);
  const onHand = Math.max(0, Number(currentRow?.quantity_on_hand || 0));
  const threshold = Math.max(0, Number(currentRow?.low_stock_threshold || 0));
  const currentOrderQuantity = mode === 'shortages'
    ? numericDemandValue(currentRow?.need_to_order)
    : numericDemandValue(currentRow?.recommended_order_quantity);

  const recomputedOrderQuantity = mode === 'shortages'
    ? Math.max(0, reserved + additionalDemand - onHand)
    : Math.max(0, reserved + additionalDemand + threshold - onHand);

  // Never add more than the database fallback itself calculated.
  return Math.min(
    fallbackAdjustment,
    Math.max(0, recomputedOrderQuantity - currentOrderQuantity)
  );
}
