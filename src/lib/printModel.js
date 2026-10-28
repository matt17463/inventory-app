// Shared print-source normalization. Financial totals must originate from the billing system,
// never from Production Board quantities or inventory pricing.
export const DEFAULT_PRINT_PREFS = Object.freeze({
  invoiceFont: 10, invoiceHeading: 18, labelFont: 13,
  showSku: true, showPersonalization: true, showCustomerPhone: false,
  labelShowItems: true, labelShowOrder: true, labelShowQR: false,
  productionPacket: false, packageCount: 1,
  businessName:'Skilled Crafting',businessWebsite:'skilledcrafting.com',businessPhone:'',businessAddress:'',labelQuestions:'',
  customerInvoiceFields:['invoiceDate','businessAddress','businessWebsite','businessPhone','billingAddress','shippingAddress','paymentMethod','orderStatus','customerPhone','sku','personalization','orderNotes'],
  shopInvoiceFields:['invoiceDate','businessAddress','businessWebsite','businessPhone','billingAddress','shippingAddress','paymentMethod','orderStatus','customerPhone','sku','personalization','orderNotes','productionInfo'],
});
const str = v => String(v ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<')
  .replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'").trim();
const finite = v => v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : null;
const qty = v => {const n=finite(v); return n!==null && Number.isSafeInteger(n) && n>=0?n:0;};
const amount = v => finite(v);
function nameFromAddress(address={}){
  return [address.first_name,address.last_name].map(str).filter(Boolean).join(' ')||str(address.company);
}
function formatAddress(a={}){
  return [a.address_1,a.address_2,[a.city,a.state,a.postcode].map(str).filter(Boolean).join(', '),a.country]
    .map(str).filter(Boolean).join('\n');
}
function safeMeta(metainfo=[]){
  return (Array.isArray(metainfo)?metainfo:[]).filter(v=>{
    const key=str(v.display_key||v.key);
    return key && !key.startsWith('_') && !/(internal|cost|margin|password|secret|token)/i.test(key);
  }).map(v=>({label:str(v.display_key||v.key),value:str(v.display_value??v.value)}))
    .filter(v=>v.value).slice(0,25);
}
export function normalizeWooPrintSource(order){
  if(!order||!Number.isSafeInteger(Number(order.id)))throw Error('WooCommerce order not available.');
  const lines=(Array.isArray(order.line_items)?order.line_items:[]).map(line=>({
    id:line.id, name:str(line.name),sku:str(line.sku),quantity:qty(line.quantity),
    unitPrice:qty(line.quantity)>0&&amount(line.total)!=null?Number(line.total)/qty(line.quantity):null,
    total:amount(line.total),subtotal:amount(line.subtotal),
    metadata:safeMeta(line.meta_data),thumbnailUrl:str(line.image?.src||line.image?.url||''),thumbnailData:str(line.thumbnailData||''),
  }));
  const shippedTo=order.shipping||{};
  return {
    source:'woocommerce',sourceId:String(order.id),reference:str(order.number||order.id),
    date:str(order.date_created),customerName:nameFromAddress(order.billing)||nameFromAddress(shippedTo)||'Customer',
    customerEmail:str(order.billing?.email),customerPhone:str(order.billing?.phone),
    billingAddress:formatAddress(order.billing||{}),paymentMethod:str(order.payment_method_title||order.payment_method),
    shipName:nameFromAddress(shippedTo)||nameFromAddress(order.billing)||'',
    shipAddress:formatAddress(Object.values(shippedTo).some(Boolean)?shippedTo:order.billing),
    currency:str(order.currency)||'USD',status:str(order.status),
    paid:Boolean(order.date_paid),financialVerified:true,
    subtotal:amount(order.subtotal)??(lines.every(x=>x.subtotal!=null)?lines.reduce((s,x)=>s+x.subtotal,0):null),
    discount:amount(order.discount_total),shipping:amount(order.shipping_total),
    tax:amount(order.total_tax),total:amount(order.total),
    lines,customerNote:str(order.customer_note),warnings:[],
  };
}
export function normalizeManualPrintSource(order,items){
  if(!order?.id)throw Error('Manual invoice order was not found.');
  const lines=(Array.isArray(items)?items:[]).map((line,i)=>({
    id:line.id||line.manual_order_item_id||i+1,
    name:str(line.item_name||line.product_name||line.mapped_item_name||line.name||'Item'),
    sku:str(line.sku_base||line.sku||line.order_sku),quantity:qty(line.quantity),
    unitPrice:amount(line.price_per_item??line.unit_price),
    total:amount(line.line_total??line.total_price)??(
      amount(line.price_per_item??line.unit_price)===null?null:qty(line.quantity)*Number(line.price_per_item??line.unit_price)),
    thumbnailUrl:'',thumbnailData:'',metadata: [
      ['Color',line.color||line.mapped_color],['Size',line.size||line.mapped_size],
      ['Name on back',line.name_on_back],['Number',line.jersey_number],
    ].filter(([,v])=>str(v)).map(([label,value])=>({label,value:str(value)})),
  }));
  const subtotal=lines.every(x=>x.total!==null)?lines.reduce((s,x)=>s+x.total,0):null;
  return {
    source:'quickbooks_manual',sourceId:String(order.id),reference:str(order.invoice_number||order.external_invoice_number)||'UNLINKED',
    date:str(order.created_at),customerName:str(order.customer_name||order.organization)||'Customer',
    customerEmail:str(order.customer_email),customerPhone:str(order.customer_phone),
    shipName:str(order.customer_name||order.organization),shipAddress:str(order.shipping_address||order.delivery_address),
    billingAddress:str(order.billing_address||order.customer_address||''),paymentMethod:str(order.payment_method||''),
    currency:'USD',status:str(order.status||'manual invoice'),
    paid:order.payment_received===true,financialVerified:false,
    subtotal,discount:amount(order.discount_amount),shipping:amount(order.shipping_amount),
    tax:amount(order.sales_tax_amount??order.tax_amount??order.calculated_tax),
    total:amount(order.total_payment_amount??order.calculated_total),
    lines,customerNote:str(order.customer_notes),
    warnings:['Financial amounts and payment have NOT been reconciled against QuickBooks. Print copies are DRAFT until source invoice and balances are verified.'],
  };
}
export const INVOICE_FIELDS=[['invoiceDate','Invoice date'],['businessAddress','Business address'],['businessWebsite','Business website'],['businessPhone','Business phone'],['billingAddress','Billing address'],['shippingAddress','Shipping address'],['paymentMethod','Payment method'],['orderStatus','Order / payment status'],['customerPhone','Customer phone'],['sku','Product SKUs'],['personalization','Item personalization'],['orderNotes','Customer order notes'],['productionInfo','Internal production notes / QR']];
const normalizeInvoiceFields=(input,fallback)=>Array.isArray(input)?[...new Set(input.filter(v=>INVOICE_FIELDS.some(([key])=>key===v)))]:[...fallback];
export function normalizePrintPrefs(v={}){
  const clamp=(value,fallback,min,max)=>{
    const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
  };
  const defaults=DEFAULT_PRINT_PREFS;
  return {
    ...defaults, invoiceFont:clamp(v.invoiceFont,defaults.invoiceFont,7,15),
    invoiceHeading:clamp(v.invoiceHeading,defaults.invoiceHeading,13,28),
    labelFont:clamp(v.labelFont,defaults.labelFont,9,22),
    packageCount:Math.round(clamp(v.packageCount,1,1,100)),
    showSku:v.showSku!==false,showPersonalization:v.showPersonalization!==false,
    showCustomerPhone:v.showCustomerPhone===true,labelShowItems:v.labelShowItems!==false,
    labelShowOrder:v.labelShowOrder!==false,labelShowQR:v.labelShowQR===true,
    productionPacket:v.productionPacket===true,
    businessName:str(v.businessName||defaults.businessName).slice(0,100),
    businessWebsite:str(v.businessWebsite||defaults.businessWebsite).slice(0,120),
    businessPhone:str(v.businessPhone||'').slice(0,65),
    businessAddress:str(v.businessAddress||'').slice(0,260),
    labelQuestions:str(v.labelQuestions||'').slice(0,160),
    customerInvoiceFields:normalizeInvoiceFields(v.customerInvoiceFields,defaults.customerInvoiceFields),
    shopInvoiceFields:normalizeInvoiceFields(v.shopInvoiceFields,defaults.shopInvoiceFields),
  };
}
export function printWarnings(source,job={},travelers=[]){
  const warnings=[...(source?.warnings||[])];
  if(!source?.lines?.length)warnings.push('Billing-source order lines unavailable; do not print a customer invoice.');
  if(source?.total===null||!Number.isFinite(source?.total))warnings.push('Authoritative invoice total unavailable.');
  if(source?.source==='quickbooks_manual'&&!source?.financialVerified)warnings.push('QuickBooks invoice reconciliation required.');
  if((job.status||'').toLowerCase()==='cancelled')warnings.push('Job is cancelled.');
  if(!travelers.length)warnings.push('No approved QR production travelers linked; production packet cannot be treated as approved instructions.');
  return [...new Set(warnings)];
}
export function canPrintCustomerCopy(source){
  return Boolean(source?.financialVerified && source.lines?.length && Number.isFinite(source.total));
}
export function money(value,currency='USD'){
  if(value===null||value===undefined||!Number.isFinite(Number(value)))return 'UNVERIFIED';
  try{return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(Number(value));}
  catch{return '$'+Number(value).toFixed(2);}
}
