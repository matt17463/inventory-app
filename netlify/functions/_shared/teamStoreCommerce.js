// Dedicated campaign Woo products allow attribution by product_id without modifying checkout.
// No external URLs are accepted from shoppers; storefront links originate from verified Woo REST responses.
export function verifiedWooProduct(product, wooSiteUrl) {
  const id = Number(product?.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid WooCommerce product ID.');
  if (product?.status !== 'publish' || !['simple','variable'].includes(product?.type)) {
    throw new Error('The WooCommerce item must be a published simple or variable product.');
  }
  if (['hidden','search'].includes(product?.catalog_visibility)) {
    throw new Error('The WooCommerce product is not visible in the storefront.');
  }
  const base = new URL(wooSiteUrl);
  const target = new URL(product?.permalink || '');
  if (base.protocol !== 'https:' || target.protocol !== 'https:' || target.origin !== base.origin) {
    throw new Error('WooCommerce product checkout link must use the configured HTTPS shop origin.');
  }
  const price = product?.price === '' || product?.price == null ? null : Number(product.price);
  return {
    woo_product_id:id,
    product_name:String(product.name||'Woo product').replace(/<[^>]*>/g,'').slice(0,240),
    product_permalink:target.toString(),
    image_url: (()=>{try{const img = new URL(product?.images?.[0]?.src||'');return img.protocol==='https:'?img.toString():null;}catch{return null;}})(),
    display_price:Number.isFinite(price) && price >= 0 ? Number(price.toFixed(2)) : null,
    currency:'USD',
  };
}
const toMoney = (v) => { const n=Number(v);return Number.isFinite(n)?n:0; };
const positive = (v) => Math.max(0,toMoney(v));
const roundMoney = (v) => Math.round((v+Number.EPSILON)*100)/100;
const notPaid = new Set(['pending','on-hold','cancelled','failed','refunded','trash','checkout-draft']);
export function refundedItemId(refundLine) {
  const metadata=Array.isArray(refundLine?.meta_data)?refundLine.meta_data:[];
  const original=refundLine?.refunded_item_id ?? metadata.find(m=>m.key==='_refunded_item_id')?.value;
  const id=Number(original);
  return Number.isSafeInteger(id)&&id>0?id:null;
}
export function reconcileWooOrderLines(order,refunds,products,campaign) {
  const allowed=new Set(products.map(p=>Number(p.woo_product_id)));
  const status=String(order?.status||'').toLowerCase();
  const isPaid=Boolean(order?.date_paid) && !notPaid.has(status);
  const lineItems=Array.isArray(order?.line_items)?order.line_items:[];
  const matched=lineItems.filter(i=>allowed.has(Number(i.product_id)));
  if(!matched.length)return [];
  const refundTotals=new Map(),refundQty=new Map();
  let unallocated=false;
  for(const refund of refunds || []) {
    const lines=Array.isArray(refund.line_items)?refund.line_items:[];
    let allocated=0;
    for(const line of lines) {
      const original=refundedItemId(line);
      if(!original) {unallocated=true;continue;}
      const value=Math.abs(toMoney(line.total));
      const quantity=Math.abs(toMoney(line.quantity));
      allocated+=value;
      refundTotals.set(original,(refundTotals.get(original)||0)+value);
      refundQty.set(original,(refundQty.get(original)||0)+quantity);
    }
    if(positive(refund.amount)>allocated+0.02) unallocated=true;
  }
  if((order?.refunds?.length||0)>0 && !(refunds||[]).length)unallocated=true;
  const formula=campaign?.fundraiser_model;
  const amount=positive(campaign?.fundraiser_flat_amount);
  const percent=Math.max(0,Math.min(100,toMoney(campaign?.fundraiser_percent)));
  return matched.map(item=>{
    const id=Number(item.id), qty=Math.max(0,Math.floor(toMoney(item.quantity)));
    const refundValue=refundTotals.get(id)||0, quantityRefunded=Math.min(qty,Math.floor(refundQty.get(id)||0));
    const net=roundMoney(Math.max(0,positive(item.total)-refundValue));
    const ambiguous=unallocated || (refundValue>0 && (refundQty.get(id)||0)===0);
    const saleEligible=isPaid&&!ambiguous;
    const eligible=saleEligible?net:0;
    let fundraiser=0;
    if(saleEligible){
      if(formula==='fixed_per_eligible_item')fundraiser=roundMoney(Math.max(0,qty-quantityRefunded)*amount);
      if(formula==='percent_of_eligible_sales')fundraiser=roundMoney(eligible*percent/100);
    }
    return {
      campaign_id:campaign.id,
      woo_order_id:Number(order.id),
      woo_line_item_id:id,woo_product_id:Number(item.product_id),
      order_placed_at:order.date_created_gmt?order.date_created_gmt+'Z':null,
      woo_order_status:status,payment_confirmed:isPaid,
      quantity:qty,refunded_quantity:quantityRefunded,
      net_eligible_sales:eligible,fundraiser_estimated:fundraiser,
      refund_requires_review:ambiguous,
      synced_at:new Date().toISOString(),
    };
  });
}
