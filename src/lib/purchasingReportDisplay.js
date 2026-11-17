// Presentation-only helpers. Keep inventory availability and purchasing quantities
// authoritative to the inventoryApi / database; never discard active demand here.
export function purchasingSourceOrderLabel(source) {
  const label = String(source?.order_label || '').trim();
  if (label && !/^order not recorded$/i.test(label)) return label;
  const invoice = String(source?.invoice_number || '').trim();
  if (invoice) return `Invoice ${invoice}`;
  const jobName = String(source?.job_name || '').trim();
  if (/^manual invoice\b/i.test(jobName)) return jobName;
  const raw = source?.order_number || source?.woocommerce_order_id || source?.order_id;
  if (raw) return `Order #${raw}`;
  if (/^order\s*#/i.test(jobName)) return jobName;
  return 'Order reference unavailable';
}

export function purchasingSourcePairingState(row, source) {
  if (!source?.job_item_id) return 'unavailable';
  if (String(source?.pairing_warning || '').trim()) return 'needs_review';
  const displayedId = String(row?.blank_product_id || '').trim().toLowerCase();
  const sourceId = String(source?.current_blank_product_id || '').trim().toLowerCase();
  if (!displayedId || !sourceId) return 'unverified';
  return displayedId === sourceId ? 'paired' : 'needs_review';
}

export function purchasingReservedShortage(row) {
  return Math.max(
    Number(row?.reserved_quantity || 0) - Number(row?.quantity_on_hand || 0),
    0
  );
}
