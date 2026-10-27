import {supabase} from '../supabaseClient';
const failMessage=(e)=>[e?.message,e?.hint].filter(Boolean).join(' — ')||'Unknown database error';
function successOrUnavailable(key,result,unavailable){
 if(result.error){unavailable[key]=failMessage(result.error);return [];}
 return result.data||[];
}
export async function loadGuidedJobEvidence(jobId){
 const numeric=Number(jobId);
 if(!Number.isSafeInteger(numeric)||numeric<=0)throw Error('Select a valid production job.');
 const [jobResult,itemsResult,reservationsResult,travelersResult,qcResult,handoffsResult,notesResult,fulfillmentResult,artworkLinksResult,photosResult,packingResult,pickupResult,revisionChecksResult,deliveryResult,customerMessagesResult,stepReviewResult]=await Promise.all([
   supabase.from('jobs').select('id,customer_name,job_name,order_source,status,due_date,woocommerce_order_id,manual_order_id,woo_order_number,woo_payment_status,payment_received,source_invoice_number,production_started_at,production_completed_at,production_priority,notes').eq('id',numeric).single(),
   supabase.from('job_items').select('id,job_id,quantity,status,blank_product_id,inventory_required,order_sku,sku,ordered_product_name,item_name,selected_color,selected_size,pairing_warning').eq('job_id',numeric).order('id').limit(500),
   supabase.from('inventory_reservations').select('id,job_id,job_item_id,quantity,quantity_reserved,status,blank_product_id').eq('job_id',numeric).limit(500),
   supabase.from('sc_job_travelers').select('id,job_id,job_item_id,recipe_version_id,created_at,superseded_at').eq('job_id',numeric).is('superseded_at',null).limit(500),
   supabase.from('phase5_qc_checklists').select('id,job_id,passed,qc_completed_at,created_at').eq('job_id',numeric).order('created_at',{ascending:false}).limit(60),
   supabase.from('sc_approval_production_handoffs').select('id,source_system,artwork_title,approved_file_url,automation_status,production_job_id,created_at').eq('production_job_id',String(numeric)).limit(60),
   supabase.from('sc_job_work_handoffs').select('id,job_id,kind,note,created_by,created_at').eq('job_id',numeric).order('created_at',{ascending:false}).limit(50),
   supabase.from('sc_job_fulfillment_checks').select('id,job_id,kind,details,package_count,carrier_reference,created_at').eq('job_id',numeric).order('created_at',{ascending:false}).limit(100),
   supabase.from('sc_job_artwork_links').select('id,job_id,handoff_id,handoff:sc_approval_production_handoffs(id,artwork_title,approved_file_url,automation_status)').eq('job_id',numeric).limit(100),
   supabase.from('sc_production_photos').select('id,job_id,photo_type,caption,created_at').eq('job_id',String(numeric)).order('created_at',{ascending:false}).limit(100),
   supabase.from('sc_job_packing_line_events').select('id,job_id,job_item_id,packed_quantity,packaging_note,recorded_by,created_at').eq('job_id',numeric).order('created_at',{ascending:false}).limit(700),
   supabase.from('sc_job_pickup_acknowledgments').select('id,job_id,recipient_name,relationship,package_count,signed_method,signed_at').eq('job_id',numeric).limit(1),
   supabase.from('sc_job_artwork_revision_checks').select('id,job_id,handoff_id,revision_label,approval_reference,production_filename,review_note,reviewed_at').eq('job_id',numeric).order('reviewed_at',{ascending:false}).limit(100),
   supabase.from('sc_job_delivery_confirmations').select('id,job_id,proof_type,proof_reference,note,verified_by,created_at').eq('job_id',numeric).order('created_at',{ascending:false}).limit(60),
   supabase.from('sc_job_customer_messages').select('id,job_id,event_type,state,recipient_email,subject,message_body,source_draft_id,recorded_by,created_at').eq('job_id',numeric).order('created_at',{ascending:false}).limit(100),
   supabase.rpc('sc_get_workhub_step_reviews',{p_job_id:numeric}),
 ]);
 if(jobResult.error)throw Error('Could not read this production job: '+failMessage(jobResult.error));
 const unavailable={};
 const items=successOrUnavailable('items',itemsResult,unavailable);
 if(items.length===500)unavailable.items='More than 500 line items; review complete order in Production Board.';
 const reservations=successOrUnavailable('reservations',reservationsResult,unavailable);
 if(reservations.length===500)unavailable.reservations='More than 500 reservations; see Purchasing.';
 const travelers=successOrUnavailable('travelers',travelersResult,unavailable);
 if(travelers.length===500)unavailable.travelers='More than 500 traveler records; see traveler page.';
 const travelerIds=travelers.map(t=>t.id);
 const travelerLinesResult=travelerIds.length?await supabase.from('sc_job_traveler_lines')
   .select('traveler_id,job_item_id,superseded_at').in('traveler_id',travelerIds).is('superseded_at',null).limit(2000):{data:[],error:null};
 const travelerLines=successOrUnavailable('travelerLines',travelerLinesResult,unavailable);
 if(travelerLines.length===2000)unavailable.travelerLines='Traveler line coverage exceeded review limit.';
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
 const packing=successOrUnavailable('packing',packingResult,unavailable);
 const pickup=successOrUnavailable('pickup',pickupResult,unavailable);
 const revisionChecks=successOrUnavailable('revisionChecks',revisionChecksResult,unavailable);
 if(packing.length===700)unavailable.packing='Packing event history truncated; review individual job line counts.';
 if(revisionChecks.length===100)unavailable.revisionChecks='Artwork version review history truncated.';
 const deliveryConfirmations=successOrUnavailable('deliveryConfirmations',deliveryResult,unavailable);
 const customerMessages=successOrUnavailable('customerMessages',customerMessagesResult,unavailable);
 const stepReviews=successOrUnavailable('stepReviews',stepReviewResult,unavailable);
 if(deliveryConfirmations.length===60)unavailable.deliveryConfirmations='Only the latest 60 delivery confirmations were read.';
 if(customerMessages.length===100)unavailable.customerMessages='Only the latest 100 customer communications were read.';
 return {job:jobResult.data,items,reservations,travelers,travelerLines,qc,handoffs,notes,fulfillment,artworkLinks,photos,packing,pickup,revisionChecks,deliveryConfirmations,customerMessages,stepReviews,unavailable};
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

export async function setGuidedJobStepReview({jobId,stepId,state,reason}){
 const numeric=Number(jobId);
 if(!Number.isSafeInteger(numeric)||numeric<1)throw Error('A valid production job is required.');
 const valid=['review','in_progress','blocked','not_applicable'];
 if(!valid.includes(state))throw Error('Unsupported review state.');
 if(state==='not_applicable'&&!['artwork','stock','recipe'].includes(stepId))throw Error('This step cannot be marked not applicable.');
 if(String(reason||'').trim().length<8)throw Error('Explain why this review state is appropriate (at least 8 characters).');
 const {error}=await supabase.rpc('sc_set_workhub_step_review',{p_job_id:numeric,p_step_id:stepId,p_state:state,p_reason:reason.trim()});
 if(error)throw Error(failMessage(error));
}
