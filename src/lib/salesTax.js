export const SALES_TAX_RATE = 0.092;
export const SALES_TAX_PERCENT = 9.2;

export function calculateSalesTax(amount) {
  const taxableAmount = Number(amount || 0);
  if (!Number.isFinite(taxableAmount) || taxableAmount <= 0) return 0;
  return Number((taxableAmount * SALES_TAX_RATE).toFixed(2));
}

export function totalWithSalesTax(subtotal, shipping = 0) {
  const base = Number(subtotal || 0);
  const shippingAmount = Number(shipping || 0);
  const tax = calculateSalesTax(base);
  return {
    subtotal: Number(base.toFixed(2)),
    shipping: Number(shippingAmount.toFixed(2)),
    tax,
    total: Number((base + shippingAmount + tax).toFixed(2)),
  };
}
