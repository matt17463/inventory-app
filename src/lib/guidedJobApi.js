import {supabase} from '../supabaseClient';
const failMessage=(e)=>[e?.message,e?.hint].filter(Boolean).join(' — ')||'Unknown database error';
function successOrUnavailable(key,result,unavailable){
 if(result.error){unavailable[key]=failMessage(result.error);return [];}
 return result.data||[];
}
export async function loadGuidedJobEvidence(jobId){
 const numeric=Number(jobId);
 if(!Number.isSafeInteger(numeric)||numeric<=0)throw Error('Select a valid production job.');
 const [jobResult,itemsResult,reservationsResult,travelersResult,qcResult,handoffsResult,notesResult,fulfillmentResult,artworkLinksResult,photosResult]=await Promise.all([
   supabase.from('jobs').select('id,customer_name,job_name,order_source,status,due_date,woocommerce_order_id,manual_order_id,woo_order_number,woo_payment_status,payment_received,source_invoice_number,production_started_at,production_completed_at,production_priority,notes').eq('id',numeric).single(),
   supabase.from('job_items').select('id,job_id,quantity,status,blank_product_id,inventory_required,order_sku,sku,ordered_product_name,item_name,selected_color,selected_size,pairing_warning').eq('job_id',numeric).order('id').limit(500),
   supabase.from('inventory_reservations').select('id,job_id,job_item_id,quantity,quantity_reserved,status,blank_product_id').eq('job_id',numeric).limit(500),
   supabase.from('sc_job_travelers').select('id,job_id,job_item_id,recipe_version_id,created_at').eq('job_id',numeric).limit(500),
   supabase.from('phase5_qc_checklists').select('id,job_id,passed,qc_completed_at,created_at').eq('job_id',numeric).order('created_at',{ascending:false}).limit(60),
   supabase.from('sc_approval_production_handoffs').select('id,source_system,artwork_title,approved_file_url,automation_status,production_job_id,created_at').eq('production_job_id',String(numeric)).limit(60),
   supabase.from('sc_job_work_handoffs').select('id,job_id,kind,note,created_by,created_at').eq('job_id',numeric).order('created_at',{ascending:false}).limit(50),
   supabase.from('sc_job_fulfillment_checks').select('id,job_id,kind,details,package_count,carrier_reference,created_at').eq('job_id',numeric).order('created_at',{ascending:false}).limit(100),
   supabase.from('sc_job_artwork_links').select('id,job_id,handoff_id,handoff:sc_approval_production_handoffs(id,artwork_title,approved_file_url,automation_status)').eq('job_id',numeric).limit(100),
   supabase.from('sc_production_photos').select('id,job_id,photo_type,caption,created_at').eq('job_id',String(numeric)).order('created_at',{ascending:false}).limit(100),
 ]);
 if(jobResult.error)throw Error('Could not read this production job: '+failMessage(jobResult.error));
 const unavailable={};
 const items=successOrUnavailable('items',itemsResult,unavailable);
 if(items.length===500)unavailable.items='More than 500 line items; review complete order in Production Board.';
 const reservations=successOrUnavailable('reservations',reservationsResult,unavailable);
 if(reservations.length===500)unavailable.reservations='More than 500 reservations; see Purchasing.';
 const travelers=successOrUnavailable('travelers',travelersResult,unavailable);
 if(travelers.length===500)unavailable.travelers='More than 500 traveler records; see traveler page.';
 const qc=successOrUnavailable('qc',qcResult,unavailable);
 if(qc.length===60)unavailable.qc='Only most recent 60 inspections were checked.';
 const handoffs=successOrUnavailable('handoffs',handoffsResult,unavailable);
 if(handoffs.length===60)unavailable.handoffs='Only first 60 artwork handoffs were checked.';
 const notes=successOrUnavailable('notes',notesResult,unavailable);
 const fulfillment=successOrUnavailable('fulfillment',fulfillmentResult,unavailable);
 const artworkLinks=successOrUnavailable('artworkLinks',artworkLinksResult,unavailable);
 const photos=successOrUnavailable('photos',photosResult,unavailable);
 if(fulfillment.length===100)unavailable.fulfillment='Fulfillment history truncated; review job details.';
 if(artworkLinks.length===100)unavailable.artworkLinks='Artwork link history truncated; review approvals.';
 return {job:jobResult.data,items,reservations,travelers,qc,handoffs,notes,fulfillment,artworkLinks,photos,unavailable};
}
export async function addGuidedJobNote({jobId,kind,note}){
 const id=Number(jobId),text=String(note||'').trim();
 if(!Number.isSafeInteger(id)||id<=0)throw Error('Select a valid job.');
 if(!['next_action','customer_update','production_note','blocker'].includes(kind))throw Error('Unsupported note type.');
 if(text.length<2||text.length>2000)throw Error('Note length must be between 2 and 2,000 characters.');
 const {data,error:authError}=await supabase.auth.getUser();
 if(authError||!data?.user)throw Error('Sign in to record a handoff note.');
 const {error}=await supabase.from('sc_job_work_handoffs').insert({
   job_id:id,kind,note:text,created_by:data.user.id,
 });
 if(error)throw Error(failMessage(error));
}
