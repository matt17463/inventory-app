// Secure outbound-poll printing. PDFs remain in a private Storage bucket.
// A successful CUPS lp request means "spooled", never "physically printed".
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {authorizeEmployee,jsonResponse,getHeader} from './_shared/security.js';
import {createServerSupabaseClient as createClient} from './_shared/serverSupabase.js';

const BUCKET='sc-private-print-pdfs';
const kinds={
 invoice_pair:'letter',customer_invoice:'letter',shop_invoice:'letter',
 packing_labels:'thermal',production_packet:'letter',
};
const clean=x=>String(x??'').trim();
function service(){
 const url=clean(process.env.SUPABASE_URL),key=clean(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY);
 if(!url||!key)throw Error('Print queue database not configured.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function agentAllowed(event){
 const a=Buffer.from(getHeader(event,'x-sc-print-agent-token'));
 const b=Buffer.from(clean(process.env.SC_PRINT_AGENT_TOKEN));
 return b.length>=32&&a.length===b.length&&timingSafeEqual(a,b);
}
const goodId=x=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(clean(x));
async function enqueue(event,db,actor,body){
 if(process.env.SC_PRINT_DISPATCH_ENABLED!=='true'||clean(process.env.SC_PRINT_AGENT_TOKEN).length<32)
  return jsonResponse(503,{success:false,error:'Direct printing is disabled until the Epson CUPS queue and Pi print agent are verified.'},event);
 const jobId=Number(body.jobId),kind=clean(body.documentKind),key=clean(body.idempotencyKey);
 if(!Number.isSafeInteger(jobId)||jobId<1||!kinds[kind]||!goodId(key))
  return jsonResponse(400,{success:false,error:'Invalid job/document/idempotency key.'},event);
 const {data:job,error:jobError}=await db.from('jobs').select('id').eq('id',jobId).maybeSingle();
 if(jobError||!job)return jsonResponse(404,{success:false,error:'Job not found.'},event);
 const existing=await db.from('sc_print_dispatch_jobs').select('id,status').eq('idempotency_key',key).maybeSingle();
 if(existing.data)return jsonResponse(200,{success:true,id:existing.data.id,status:existing.data.status,idempotent:true},event);
 const raw=clean(body.pdfBase64);
 if(raw.length>9500000||raw.length<200||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))
  return jsonResponse(400,{success:false,error:'Invalid or oversized PDF payload.'},event);
 const pdf=Buffer.from(raw,'base64');
 if(pdf.length>7000000||pdf.subarray(0,5).toString('ascii')!=='%PDF-')
  return jsonResponse(400,{success:false,error:'Expected a PDF document under 7 MB.'},event);
 const path=randomUUID()+'.pdf';
 const result=await db.storage.from(BUCKET).upload(path,pdf,{contentType:'application/pdf',upsert:false,cacheControl:'0'});
 if(result.error)throw Error('Private print storage is unavailable: '+result.error.message);
 const {data,error}=await db.from('sc_print_dispatch_jobs').insert({
  job_id:jobId,document_kind:kind,queue_name:kinds[kind],storage_path:path,
  idempotency_key:key,requested_by:actor.id,
 }).select('id,status,queue_name').single();
 if(error){
  await db.storage.from(BUCKET).remove([path]);
  if(error.code==='23505')return jsonResponse(409,{success:false,error:'Duplicate print request; refresh queue status.'},event);
  throw Error('Could not queue print document.');
 }
 return jsonResponse(200,{success:true,id:data.id,status:data.status,queue_name:data.queue_name},event);
}
async function lease(event,db,body){
 const queues=Array.isArray(body.queues)?body.queues.filter(x=>['letter','thermal'].includes(x)):[];
 if(!queues.length)return jsonResponse(400,{success:false,error:'No permitted CUPS queue configured.'},event);
 const {data,error}=await db.from('sc_print_dispatch_jobs')
  .select('id,job_id,document_kind,queue_name,storage_path')
  .eq('status','queued').in('queue_name',queues).order('created_at').limit(5);
 if(error)throw Error('Print queue lookup failed.');
 for(const row of data||[]){
  const leaseId=randomUUID();
  const {data:locked,error:lockError}=await db.from('sc_print_dispatch_jobs')
   .update({status:'leased',lease_id:leaseId,leased_at:new Date().toISOString(),attempts:1})
   .eq('id',row.id).eq('status','queued')
   .select('id').maybeSingle();
  if(lockError||!locked)continue;
  const file=await db.storage.from(BUCKET).download(row.storage_path);
  if(file.error){
   await db.from('sc_print_dispatch_jobs').update({status:'failed',error_text:'Stored PDF cannot be loaded.'}).eq('id',row.id).eq('lease_id',leaseId);
   continue;
  }
  const binary=Buffer.from(await file.data.arrayBuffer());
  if(binary.length>7000000||binary.subarray(0,5).toString('ascii')!=='%PDF-'){
   await db.from('sc_print_dispatch_jobs').update({status:'failed',error_text:'Stored data is not a supported PDF.'}).eq('id',row.id).eq('lease_id',leaseId);
   continue;
  }
  return jsonResponse(200,{success:true,job:{
   id:row.id,lease_id:leaseId,queue_name:row.queue_name,document_kind:row.document_kind,
   pdf_base64:binary.toString('base64')
  }},event);
 }
 return jsonResponse(200,{success:true,job:null},event);
}
async function ack(event,db,body){
 if(!goodId(body.id)||!goodId(body.leaseId))return jsonResponse(400,{success:false,error:'Invalid print job receipt.'},event);
 const ok=body.spooled===true;
 const {data,error}=await db.from('sc_print_dispatch_jobs').update({
  status:ok?'spooled':'failed',cups_job_reference:ok?clean(body.cupsJobReference).slice(0,160):null,
  error_text:ok?null:clean(body.error).slice(0,500)||'Print agent failed.',
  completed_at:new Date().toISOString()
 }).eq('id',body.id).eq('lease_id',body.leaseId).eq('status','leased').select('id').maybeSingle();
 if(error||!data)return jsonResponse(409,{success:false,error:'Print lease no longer active.'},event);
 return jsonResponse(200,{success:true,status:ok?'spooled':'failed'},event);
}
export const handler=async event=>{
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return jsonResponse(405,{success:false,error:'POST required.'},event);
 let body;
 try{body=JSON.parse(event.body||'{}');}catch{return jsonResponse(400,{success:false,error:'Invalid request JSON.'},event);}
 const action=clean(body.action);
 try{
  if(['lease','ack'].includes(action)){
   if(!agentAllowed(event))return jsonResponse(403,{success:false,error:'Print agent authentication failed.'},event);
   const db=service();
   return action==='lease'?await lease(event,db,body):await ack(event,db,body);
  }
  const auth=await authorizeEmployee(event,{functionName:'print-dispatch',allowedRoles:['admin','manager']});
  if(!auth.ok)return jsonResponse(auth.statusCode,{success:false,error:auth.message},event);
  if(action==='enqueue')return await enqueue(event,auth.supabase,auth.user,body);
  if(action==='status'){
   const jobId=Number(body.jobId);
   if(!Number.isSafeInteger(jobId)||jobId<1)return jsonResponse(400,{success:false,error:'Job ID required.'},event);
   const {data,error}=await auth.supabase.from('sc_print_dispatch_jobs')
    .select('id,document_kind,queue_name,status,cups_job_reference,error_text,created_at,completed_at')
    .eq('job_id',jobId).order('created_at',{ascending:false}).limit(40);
   if(error)throw Error('Print queue history not available.');
   return jsonResponse(200,{success:true,jobs:data||[]},event);
  }
  return jsonResponse(400,{success:false,error:'Unknown printing action.'},event);
 }catch(e){console.warn('print-dispatch error:',e.message);
  return jsonResponse(502,{success:false,error:e.message||'Print queue unavailable.'},event);}
};
