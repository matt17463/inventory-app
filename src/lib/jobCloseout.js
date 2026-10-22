// Conservative closeout decisions; billing and status stay in authoritative systems.
const CANCELLED=new Set(['cancelled','canceled','void','voided','removed']);
const DONE=new Set(['complete','completed','production_complete']);
const text=v=>String(v||'').trim().toLowerCase();
const newest=(a,b)=>new Date(b.created_at||b.qc_completed_at||0)-new Date(a.created_at||a.qc_completed_at||0);
export function latestPackingByItem(events=[]){
 const map=new Map();
 for(const r of [...events].sort(newest)){const id=Number(r.job_item_id);if(!map.has(id))map.set(id,r);}
 return map;
}
export function closeoutReadiness(e={}){
 const job=e.job||{},missing=e.unavailable||{};
 const items=(e.items||[]).filter(i=>!CANCELLED.has(text(i.status)));
 const qc=[...(e.qc||[])].sort((a,b)=>new Date(b.qc_completed_at||b.created_at||0)-new Date(a.qc_completed_at||a.created_at||0))[0];
 const qcPassed=qc?.passed===true&&!missing.qc;
 const counts=latestPackingByItem(e.packing);
 const itemRows=items.map(i=>({id:Number(i.id),sku:i.order_sku||i.sku||'',label:i.ordered_product_name||i.item_name||i.name||'Item',
  color:i.selected_color||i.color||'',size:i.selected_size||i.size||'',required:Number(i.quantity||0),
  packed:counts.has(Number(i.id))?Number(counts.get(Number(i.id)).packed_quantity):null,
  note:counts.get(Number(i.id))?.packaging_note||''}));
 const packingComplete=itemRows.length>0&&!missing.items&&!missing.packing&&itemRows.every(x=>Number.isSafeInteger(x.required)&&x.required>=0&&x.packed===x.required);
 const cancelled=CANCELLED.has(text(job.status||job.production_status));
 const woo=Boolean(job.woocommerce_order_id),manual=Boolean(job.manual_order_id||job.order_source==='manual_invoice');
 const pay=text(job.woo_payment_status);
 const paymentVerified=woo?(pay==='paid'||job.payment_received===true):manual?job.payment_received===true:null;
 const records=e.fulfillment||[];
 const hasPickup=(e.pickup||[]).length>0;
 const shipped=records.some(r=>r.kind==='shipped'&&String(r.carrier_reference||'').trim());
 const dispatchWithoutTracking=records.some(r=>r.kind==='shipped')&&!shipped;
 const confirmation=[...(e.deliveryConfirmations||[])].sort(newest)[0]||null;
 const channel=hasPickup?'pickup':shipped||dispatchWithoutTracking?'shipping':'unselected';
 const blockers=[];
 if(cancelled)blockers.push('Job cancelled. Do not release packages.');
 if(!items.length||missing.items)blockers.push('Active job items are missing or unreadable.');
 if(!qcPassed)blockers.push('The latest official QC must pass.');
 if(!packingComplete)blockers.push('Every active line needs its exact verified packing count.');
 if(missing.fulfillment||missing.pickup)blockers.push('Fulfillment evidence could not be read.');
 if(paymentVerified===false)blockers.push(woo?'WooCommerce payment not verified.':'QuickBooks/manual payment not verified.');
 if(paymentVerified===null)blockers.push('Billing source unknown: verify payment before release.');
 let label='Not ready',kind='blocked';
 if(!blockers.length){
  if(confirmation){label='Delivery confirmation documented';kind='delivered';}
  else if(hasPickup){label='Customer pickup signed';kind='collected';}
  else if(shipped){label='Shipped — awaiting delivery proof';kind='dispatched';}
  else if(dispatchWithoutTracking){label='Shipment recorded — carrier reference needed';kind='review';}
  else{label='Ready for pickup or shipping';kind='ready';}
 }
 return {jobId:Number(job.id),channel,itemRows,qcPassed,packingComplete,paymentVerified,hasPickup,shipped,
  dispatchWithoutTracking,confirmation,blockers,label,kind,readyForRelease:!blockers.length,
  isClosed:DONE.has(text(job.status||job.production_status)),isWoo:woo,isManual:manual};
}
export function closeoutMessage({kind,job,channel,reference}){
 const company='Skilled Crafting',customer=String(job.customer_name||'Customer').trim().slice(0,120);
 const order=String(job.woo_order_number||job.woocommerce_order_id||job.source_invoice_number||job.id||'');
 const starter='Hello,\n\n';
 const ending='\n\nThank you,\nSkilled Crafting';
 const cases={
 ready_for_pickup:{subject:company+' - Your order is ready for pickup',
  body:starter+customer+"'s order "+order+' has completed production and is ready for pickup.\n\nPlease contact us to confirm the pickup time and location before traveling.'+ending},
 shipped:{subject:company+' - Your order has shipped',
  body:starter+customer+"'s order "+order+' has been handed to the carrier.\n\nCarrier / tracking reference: '+String(reference||'[VERIFY TRACKING REFERENCE]')+ending},
 pickup_complete:{subject:company+' - Thank you for collecting your order',
  body:starter+'Thank you for collecting '+customer+"'s order "+order+'. Please inspect your items and contact us with any concerns.'+ending},
 delivery_followup:{subject:company+' - Checking on your order',
  body:starter+'We are following up on '+customer+"'s order "+order+'. Please let us know whether the items arrived as expected.'+ending},
 };
 if(!cases[kind])throw Error('Choose an approved notification type.');
 if(kind==='shipped'&&channel!=='shipping')throw Error('Shipped notification needs recorded dispatch.');
 return cases[kind];
}
