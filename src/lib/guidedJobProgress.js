// Read-only evidence classification for the owner-first guided Work Hub.
// All status changes remain in the authoritative Production Board, QC and inventory workflows.
export const GUIDED_STEPS = [
  { id:'order', title:'Confirm customer order', detail:'Source, customer requirements, invoicing and due date', link:'/client-orders' },
  { id:'artwork', title:'Approve artwork', detail:'Client proof, approved file and decoration instructions', link:'/artwork-requests' },
  { id:'stock', title:'Check blanks and stock', detail:'Blank pairing, reservations and supplier shortages', link:'/purchasing' },
  { id:'recipe', title:'Prepare production', detail:'Approved recipe, measured placement and printable QR form', link:'/production-travelers' },
  { id:'production', title:'Produce items', detail:'Decorate according to approved files and machine settings', link:'/production-board' },
  { id:'qc', title:'Quality check', detail:'Record finished product inspection and defects', link:'/qc-checklist' },
  { id:'delivery', title:'Pack and deliver', detail:'Pack by order, confirm pickup/shipping and close out', link:'/production-board' },
];
const terminal = new Set(['completed','production_complete']);
const cancelled = new Set(['cancelled','canceled']);
const producing = new Set(['in_production','qc','ready_to_ship','production_complete','completed']);
const qcStage = new Set(['ready_to_ship','production_complete','completed']);
function clean(v){return String(v||'').trim().toLowerCase();}
export function dueRisk(value, now=new Date()){
  if(!value)return {kind:'unscheduled',label:'No due date'};
  // Text "YYYY-MM-DD" is a shop-local due date, not a UTC midnight timestamp.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value+'T23:59:59') : new Date(value);
  if(Number.isNaN(date.getTime()))return {kind:'unscheduled',label:'Confirm due date'};
  const diff = date.getTime()-now.getTime();
  if(diff<0)return {kind:'late',label:'Past due'};
  if(diff<2*86400000)return {kind:'soon',label:'Due within 2 days'};
  return {kind:'normal',label:'Scheduled'};
}
export function jobIdentity(row){
  const id=Number(row?.job_id||row?.id);
  return Number.isSafeInteger(id)&&id>0?id:null;
}
function linkedCount(collection){return Array.isArray(collection)?collection.length:0;}
export function deriveGuidedProgress(row,evidence={}){
 const job=evidence.job||row||{};
 const items=evidence.items||[];
 const reservations=evidence.reservations||[];
 const travelers=evidence.travelers||[];
 const handoffs=evidence.handoffs||[];
 const qc=evidence.qc||[];
 const notes=evidence.notes||[];
 const status=clean(row?.saved_job_status||job.status||row?.board_column||'');
 const completed=terminal.has(status);
 const cancelledJob=cancelled.has(status);
 const isWoo=Boolean(job.woocommerce_order_id||row?.woocommerce_order_id);
 const manual=Boolean(job.manual_order_id||(!isWoo&&job.order_source==='manual_invoice'));
 const billConfirmed=isWoo
   ? ['paid','completed','processing'].includes(clean(job.woo_payment_status)) || job.payment_received===true
   : !manual || job.payment_received===true;
 const required=items.filter(i=>i.inventory_required!==false);
 const unpaired=required.filter(i=>!i.blank_product_id && clean(i.status)!=='completed'&&clean(i.status)!=='complete');
 const qcPassed=qc.some(q=>q.passed===true);
 const artworkLinked=handoffs.some(h=>Boolean(h.approved_file_url));
 const allTraveled=required.length>0&&required.every(i=>travelers.some(t=>Number(t.job_item_id)===Number(i.id)));
 const productionStarted=producing.has(status)||Boolean(job.production_started_at);
 const pastQc=qcStage.has(status);
 const actualCompletion=completed||Boolean(job.production_completed_at);
 const missing=evidence.unavailable||{};
 const steps=[];
 function add(id,state,title,detail,href){
   const base=GUIDED_STEPS.find(s=>s.id===id);
   steps.push({...base,state,title:title||base.title,reason:detail||base.detail,href:href||base.link});
 }
 const jobId=jobIdentity(job)||jobIdentity(row);
 const pull=jobId?'/pullsheets/'+jobId:'/pullsheets';
 const traveler=jobId?'/production-travelers?job='+jobId:'/production-travelers';
 add('order',!jobId?'review':manual&&!billConfirmed?'attention':'verified',null,
    manual&&!billConfirmed?'Manual invoice payment is not confirmed on the production job. Review QuickBooks/Client Orders before starting.':
    isWoo?'WooCommerce order linked. Confirm billing, variants and the customer deadline.':
    'Existing production job linked. Confirm requirements and agreed completion date.',
    manual?'/client-orders':pull);
 add('artwork',missing.handoffs?'unknown':artworkLinked?'linked':'review',null,
    missing.handoffs?'Artwork handoff evidence could not be read. Open approval tools.':
    artworkLinked?'An approved-file reference is linked; verify its exact version and customer approval before manufacturing.':
    'No approved artwork file was found linked to this job; confirm approval in the artwork workflow.',
    '/approval-automation');
 add('stock',missing.items||missing.reservations?'unknown':
    unpaired.length?'attention':!required.length?'not_applicable':'review',null,
    missing.items||missing.reservations?'Inventory detail is unavailable; open the Purchasing Report.':
    unpaired.length?unpaired.length+' line(s) have no paired blank product. Correct mapping before pulling stock.':
    !required.length?'No inventory-required blanks in the job.':'Blanks are paired; '+reservations.length+
    ' reservation record(s) exist. Review active shortages, bins and existing supplier orders in Purchasing.',
    unpaired.length?pull:'/purchasing');
 add('recipe',missing.travelers||missing.items?'unknown':allTraveled?'linked':!required.length?'not_applicable':'review',null,
    missing.travelers||missing.items?'Job traveler details unavailable. Open QR travelers.':
    !required.length?'No blank production lines require a garment traveler.':
    travelers.length+'/'+required.length+' inventory-required line(s) have saved QR travelers. Check approved recipes and placement measurements.',
    traveler);
 add('production',productionStarted?'linked':'review',null,
    productionStarted?'Production Board indicates work has started or progressed. Inspect actual open line items before completion.':
    'Start manufacturing from the Production Board once artwork and stock are confirmed.',
    '/production-board');
 add('qc',missing.qc?'unknown':qcPassed?'verified':'attention',null,
    missing.qc?'QC evidence could not be read. Check the QC page.':
    qcPassed?'A passing QC checklist is recorded. Verify quantities and photos for this fulfillment.':
    'No passing QC record linked to this job. Complete the official inspection before handoff.',
    '/qc-checklist');
 add('delivery',completed?'verified':'review',null,
    completed?'Job is marked completed on the authoritative Production Board. Verify customer receipt and financial closeout.':
    'Packing and delivery are not independently confirmed here. Check packing and update the Production Board after handoff.',
    '/production-board');
 if(cancelledJob)return {steps,priority:{title:'Order cancelled / on hold',reason:'Do not produce. Confirm cancellation and reservation release in the Production Board.',href:'/production-board',kind:'blocked'},
   notesCount:notes.length,indicators:{itemCount:items.length,unpaired:unpaired.length,travelers:travelers.length,activeReservations:reservations.length,qcPassed},isWoo,manual,completed,cancelled:true};
 const hardBlock=Array.isArray(row?.blocking_issues)?row.blocking_issues:[];
 const blockerMessage=hardBlock.map(x=>typeof x==='string'?x:x?.message||x?.reason).filter(Boolean).slice(0,4);
 let priority;
 if(manual&&!billConfirmed)priority={title:'Confirm invoice payment',reason:'The job has no confirmed payment flag. Check the actual QuickBooks invoice and Client Orders.',href:'/client-orders',kind:'blocked'};
 else if(blockerMessage.length)priority={title:'Resolve Production Board blockers',reason:blockerMessage.join(' · '),href:'/exception-center',kind:'blocked'};
 else if(unpaired.length)priority={title:'Pair '+unpaired.length+' blank line(s)',reason:'Product-to-blank mapping is missing; review the pull sheet before production.',href:pull,kind:'blocked'};
 else if(status==='qc'&&!qcPassed)priority={title:'Record official QC',reason:'The job is at QC without a passing inspection.',href:'/qc-checklist',kind:'action'};
 else if(status==='ready_to_ship')priority={title:'Prepare packing and handoff',reason:'Confirm QC, packing, customer pickup/shipping and closeout.',href:'/production-board',kind:'action'};
 else if(completed)priority={title:'Review job closeout',reason:'Production is marked completed. Check customer receipt, costing and reorders.',href:'/job-costing',kind:'done'};
 else if(!artworkLinked)priority={title:'Verify approved artwork',reason:'No linked approved artwork file was found. This may be an unlinked legacy project; review client proof and print-ready file.',href:'/approval-automation',kind:'action'};
 else if(!allTraveled&&required.length)priority={title:'Prepare recipe and QR traveler',reason:'Create approved production instructions for each item as applicable.',href:traveler,kind:'action'};
 else if(status==='needs_attention'||status==='on_hold')priority={title:'Resolve current hold',reason:'Review the Production Board and purchasing exceptions before advancing.',href:'/exception-center',kind:'blocked'};
 else if(status==='ready_to_produce')priority={title:'Start production',reason:'Review the pull sheet and verified materials before decorating.',href:pull,kind:'action'};
 else if(status==='in_production')priority={title:'Complete production lines',reason:'Finish the approved instructions, then record QC.',href:traveler,kind:'action'};
 else priority={title:'Review the job',reason:'Check the authoritative production status and confirm the next required step.',href:'/production-board',kind:'action'};
 return {steps,priority,notesCount:notes.length,indicators:{itemCount:items.length,unpaired:unpaired.length,
   travelers:travelers.length,activeReservations:reservations.length,qcPassed},isWoo,manual,completed,cancelled:false};
}
