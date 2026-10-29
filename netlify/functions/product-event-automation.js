import {authorizeEmployee,jsonResponse} from './_shared/security.js';
import {wooRequest} from './_shared/mockupUtils.js';
import {createVerifiedTraveler} from './_shared/verifiedTraveler.js';
import {verifiedQuickBooksInvoice,qboEventRequest} from './_shared/qboPrint.js';
const id=x=>Number.isSafeInteger(Number(x))&&Number(x)>0?Number(x):null;
const fail=(code,message,event)=>jsonResponse(code,{success:false,message},event);
async function requireEvent(db,eventId){
 const {data,error}=await db.from('sc_pdc_events').select('*').eq('id',eventId).single();
 if(error||!data)throw Error('Event not found.');return data;
}
async function requireItems(db,eventId){
 const {data,error}=await db.from('sc_pdc_event_items').select('*').eq('event_id',eventId).limit(1000);
 if(error)throw Error(error.message);if(!data?.length)throw Error('No package items.');return data;
}
async function orderGates(db,eventId){
 const event=await requireEvent(db,eventId),items=await requireItems(db,eventId);
 if(!['approved','production','fulfilled'].includes(event.status))throw Error('Package requires recorded client approval.');
 if(items.some(x=>x.proof_status!=='approved'||!x.approved_artwork_revision||!x.material_recipe_id))
  throw Error('Every item needs an approved customer proof, artwork revision and machine recipe.');
 const ids=[...new Set(items.map(x=>x.material_recipe_id))];
 const {data,error}=await db.from('sc_material_recipes').select('id,status,version').in('id',ids);
 if(error||data?.length!==ids.length||data.some(x=>x.status!=='approved'))throw Error('One or more material recipes are not currently approved.');
 return {event,items};
}
async function storefront(db,body,event){
 const {data,error}=await db.from('sc_pdc_launches').select('*,sc_pdc_opportunities(status,material_recipe_id)').eq('id',body.launch_id).single();
 if(error||!data||data.channel!=='woocommerce'||!['ready','published'].includes(data.state))
  throw Error('Select a WooCommerce launch that passed the product validation gate.');
 const productId=id(body.woo_product_id);if(!productId)throw Error('An existing WooCommerce product ID must be linked.');
 const product=await wooRequest('products/'+productId);
 if(product.id!==productId)throw Error('WooCommerce product mismatch.');
 if(product.status==='publish')return {status:'already_published',product_id:productId,url:product.permalink};
 if(!['draft','pending','private'].includes(product.status))throw Error('Product status not supported for publishing.');
 if(!Array.isArray(product.categories)||!product.categories.length||!product.shipping_class_id)
  throw Error('Check product category and shipping class before publishing.');
 if(!Array.isArray(product.images)||!product.images.length)throw Error('Product imagery is required before publishing.');
 if(!body.commit)return {status:'preview',product_id:productId,previous_status:product.status};
 const updated=await wooRequest('products/'+productId,{method:'PUT',body:{status:'publish'}});
 if(updated.status!=='publish')throw Error('WooCommerce did not confirm publication.');
 const result=await db.from('sc_pdc_launches').update({state:'published',listing_reference:String(productId)}).eq('id',body.launch_id);
 if(result.error)throw Error('Product published in WooCommerce but internal status failed; reconcile product #'+productId);
 return {status:'published',product_id:productId,url:updated.permalink};
}
async function traveler(db,body,event){
 const {event:pkg}=await orderGates(db,body.event_id);
 const job=id(pkg.production_job_id||body.job_id);
 if(!job||pkg.production_job_id!==job)throw Error('Link the exact existing production job to this event before generating travelers.');
 const jobInfo=await db.from('jobs').select('id,status').eq('id',job).single();
 if(jobInfo.error||!jobInfo.data||['closed','completed','cancelled','delivered'].includes(String(jobInfo.data.status).toLowerCase()))
  throw Error('An open job is required.');
 const itemIds=Array.isArray(body.job_item_ids)?body.job_item_ids.map(id):[];
 if(!itemIds.length||itemIds.some(x=>!x)||new Set(itemIds).size!==itemIds.length)throw Error('Provide unique, positive job item IDs.');
 const version=String(body.recipe_version_id||'');
 const v=await db.from('sc_manufacturing_recipe_versions').select('id,status,verified_sample').eq('id',version).single();
 if(v.error||v.data?.status!=='approved')throw Error('An approved manufacturing recipe version is required.');
 const items=await db.from('job_items').select('id,job_id').eq('job_id',job).in('id',itemIds);
 if(items.error||items.data?.length!==itemIds.length)throw Error('One or more job lines do not belong to the event job.');
 const existing=await db.from('sc_job_traveler_lines').select('traveler_id,job_item_id,superseded_at').in('job_item_id',itemIds).is('superseded_at',null);
 if(existing.error)throw Error(existing.error.message);
 if(existing.data?.length)throw Error('One or more selected job lines already have an active traveler.');
 if(!body.commit)return {status:'preview',job_id:job,job_item_ids:itemIds,recipe_version_id:version};
 const travelerId=await createVerifiedTraveler(event,{jobId:job,itemIds,recipeVersionId:version});
 return {status:'created',traveler_id:travelerId,job_id:job};
}

async function createInvoice(db,body){
 const {event:pkg,items}=await orderGates(db,body.event_id);
 const customerId=id(body.qbo_customer_id);
 if(!customerId)throw Error('Select the exact existing QuickBooks customer ID; no customer is guessed.');
 if(!items.every(x=>Number(x.unit_price)>0))throw Error('Every package item must have a reviewed, nonzero unit price.');
 const mappings=body.qbo_item_ids||{};
 const lines=items.map(x=>{
  const itemId=id(mappings[x.id]);
  if(!itemId)throw Error('Map each package line to an existing QuickBooks service/product item.');
  return {Description:(x.label+' — event '+pkg.name).slice(0,4000),Amount:Number((Number(x.quantity)*Number(x.unit_price)).toFixed(2)),
   DetailType:'SalesItemLineDetail',SalesItemLineDetail:{ItemRef:{value:String(itemId)},Qty:x.quantity,UnitPrice:Number(x.unit_price)}};
 });
 const doc='SCE-'+pkg.id.replaceAll('-','').slice(0,16).toUpperCase();
 const query="select * from Invoice where DocNumber = '"+doc+"' maxresults 2";
 const found=await qboEventRequest(db,{path:'/query?query='+encodeURIComponent(query)+'&minorversion=75'});
 const matches=found.QueryResponse?.Invoice||[];
 if(matches.length>1)throw Error('Duplicate QuickBooks invoice numbers; review the account.');
 if(matches.length===1)return {status:'already_exists',invoice_id:matches[0].Id,invoice_number:doc,total:matches[0].TotalAmt};
 const amount=lines.reduce((n,x)=>n+x.Amount,0);
 if(!body.commit)return {status:'preview',invoice_number:doc,customer_id:customerId,lines:lines.length,subtotal:amount,
  notice:'QuickBooks sales tax must be calculated and verified using the configured QBO tax settings; preview is not an invoice.'};
 const payload={DocNumber:doc,CustomerRef:{value:String(customerId)},Line:lines,
  PrivateNote:('Skilled Crafting event package '+pkg.id+'; review taxes and payment terms before sending.').slice(0,4000)};
 if(pkg.event_date)payload.DueDate=pkg.event_date;
 const created=await qboEventRequest(db,{method:'POST',path:'/invoice?minorversion=75',body:payload});
 if(!created.Invoice?.Id)throw Error('QuickBooks did not return an invoice ID; check QBO before retrying.');
 return {status:'created_unsent',invoice_id:created.Invoice.Id,invoice_number:doc,total:created.Invoice.TotalAmt,
  notice:'Invoice saved but not emailed. Verify tax treatment, customer and line amounts in QuickBooks before sending.'};
}

async function sales(db,body){
 // Imports only from an exact, linked QuickBooks invoice; never guesses which customer/record matches.
 const {event:pkg}=await orderGates(db,body.event_id);
 const invoice=String(body.invoice_number||'').trim();
 if(!invoice||invoice.length>60)throw Error('Select the exact linked QuickBooks invoice number.');
 const order={reference:invoice,customerName:pkg.client_name,total:Number(body.expected_total),currency:'USD'};
 if(!Number.isFinite(order.total)||order.total<0)throw Error('Verified expected total is required.');
 const result=await verifiedQuickBooksInvoice(db,order);
 if(!result.financialVerified)throw Error('QuickBooks invoice did not reconcile: '+result.warnings.join('; '));
 return {status:'verified',qbo_invoice_id:result.qboInvoiceId,invoice_number:invoice,total:result.total,
  amount_paid:result.amountPaid,balance:result.balance};
}

async function importActualSales(db,body){
 const {event:pkg,items}=await orderGates(db,body.event_id);
 const op=String(body.opportunity_id||'');
 const eligible=items.filter(x=>x.opportunity_id===op);
 if(!eligible.length)throw Error('Link this saved product opportunity to event lines before importing actual sales.');
 const invoice=String(body.invoice_number||'').trim();
 const expectedTotal=Number(body.expected_total);
 if(!invoice||!Number.isFinite(expectedTotal)||expectedTotal<0)throw Error('The exact linked invoice number and expected total are required.');
 const reconciled=await verifiedQuickBooksInvoice(db,{reference:invoice,customerName:pkg.client_name,total:expectedTotal,currency:'USD'});
 if(!reconciled.financialVerified)throw Error('QuickBooks reconciliation failed: '+reconciled.warnings.join('; '));
 const sourceAmount=eligible.reduce((n,x)=>n+Number(x.quantity)*Number(x.unit_price),0);
 if(sourceAmount<0||sourceAmount>reconciled.total+.02)throw Error('Event line subtotal exceeds verified invoice.');
 const units=eligible.reduce((n,x)=>n+Number(x.quantity),0);
 const existing=await db.from('sc_pdc_sales_imports').select('id').eq('source','quickbooks')
  .eq('external_invoice_id',reconciled.qboInvoiceId).eq('opportunity_id',op).maybeSingle();
 if(existing.error)throw Error(existing.error.message);
 if(existing.data)return {status:'already_imported',id:existing.data.id,invoice_number:invoice};
 if(!body.commit)return {status:'preview',invoice_number:invoice,opportunity_id:op,units,
  gross_sales:sourceAmount,verified_invoice_total:reconciled.total,
  notice:'Only explicitly mapped package revenue will be imported, never the whole invoice twice.'};
 const invoiceDate=/^\d{4}-\d{2}-\d{2}$/.test(reconciled.date||'')?reconciled.date:new Date().toISOString().slice(0,10);
 const row={opportunity_id:op,event_id:pkg.id,external_invoice_id:reconciled.qboInvoiceId,
 invoice_number:invoice,invoice_date:invoiceDate,units,gross_sales:Number(sourceAmount.toFixed(2)),
 verified_invoice_total:reconciled.total,verified_invoice_balance:reconciled.balance,
 variable_cost:Number(eligible.reduce((n,x)=>n+Number(x.unit_cost)*Number(x.quantity),0).toFixed(2)),
 snapshot:{status:reconciled.status,invoice_total:reconciled.total,paid:reconciled.amountPaid,
   note:'Verified via read-only QBO invoice reconciliation and explicit event opportunity mapping.'}};
 const write=await db.from('sc_pdc_sales_imports').insert(row).select('id').single();
 if(write.error)throw Error('Import failed or already exists: '+write.error.message);
 return {status:'imported',id:write.data.id,invoice_number:invoice,units,gross_sales:row.gross_sales};
}

export async function handler(event){
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return fail(405,'Use POST',event);
 const auth=await authorizeEmployee(event,{functionName:'product-event-automation',allowedRoles:['admin','manager']});
 if(!auth.ok)return fail(auth.statusCode,auth.message,event);
 let body;try{body=JSON.parse(event.body||'{}');}catch{return fail(400,'Invalid JSON',event);}
 try{
  const action=String(body.action||'');
  if(action==='publish_existing_woo_product')return jsonResponse(200,{success:true,...await storefront(auth.supabase,body,event)},event);
  if(action==='create_verified_traveler')return jsonResponse(200,{success:true,...await traveler(auth.supabase,body,event)},event);
  if(action==='import_verified_qbo_sales')return jsonResponse(200,{success:true,...await importActualSales(auth.supabase,body)},event);
  if(action==='create_qbo_event_invoice')return jsonResponse(200,{success:true,...await createInvoice(auth.supabase,body)},event);
  if(action==='verify_qbo_event_invoice')return jsonResponse(200,{success:true,...await sales(auth.supabase,body)},event);
  return fail(400,'Unsupported action',event);
 }catch(e){return fail(422,e.message||'Automation failed',event);}
}
