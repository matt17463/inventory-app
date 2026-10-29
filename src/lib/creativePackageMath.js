/** All amounts in dollars at the UI boundary, calculations are integer cents. */
export function nonnegative(value,max=100000) {
  const n=Number(value);
  return Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;
}
export function computeDraftPackage(items=[],setup=0,additionalCharge=0) {
  const lines=Array.isArray(items)?items:[];
  const quantity = value => Math.trunc(nonnegative(value,100000));
  const cents = value => Math.round(nonnegative(value)*100);
  const costs=lines.reduce((n,item)=>n+quantity(item.qty)*cents(item.cost),cents(setup));
  const sales=lines.reduce((n,item)=>n+quantity(item.qty)*cents(item.price),cents(additionalCharge));
  return {
    cost:costs/100,
    revenue:sales/100,
    contribution:(sales-costs)/100,
    contributionMargin:sales>0?Math.round((sales-costs)/sales*1000)/10:null,
    disclaimer:'Draft costs only: excludes sales tax, actual shipping, payment fees and any labor, spoilage, setup or machine charges not separately entered.'
  };
}
