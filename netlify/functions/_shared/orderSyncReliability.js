export function terminalProductionStatus(value) {
  return new Set(['complete','completed','closed','cancelled','canceled','refunded','failed','void','voided','deleted','shipped','delivered'])
    .has(String(value || '').trim().toLowerCase().replace(/^wc-/, ''));
}

export function existingLineUpdate(payload, existing) {
  if (terminalProductionStatus(existing.status)) return null;
  const update = { ...payload };
  for (const key of ['job_id','quantity','status']) delete update[key];
  // An existing pairing can reflect a shop-floor override. Replaying the order
  // refreshes its description without silently changing what is being made.
  if (existing.blank_product_id) {
    for (const key of ['blank_product_id','finished_product_id','pairing_source','pairing_warning']) delete update[key];
  }
  return update;
}

export function mayPromoteToReserved(status) {
  return ['new','queued','pending','awaiting_items','waiting_on_items'].includes(String(status || '').trim().toLowerCase());
}
