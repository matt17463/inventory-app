import {authorizeEmployee,jsonResponse} from './_shared/security.js';
import {ingestManual,storeUploadedManual} from './_shared/knowledgeManuals.js';

const respond=(code,body,event)=>({...jsonResponse(code,body,event),headers:{...jsonResponse(code,body,event).headers,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return respond(204,{},event);
 if(!['GET','POST'].includes(event.httpMethod))return respond(405,{error:'Method not allowed'},event);
 const auth=await authorizeEmployee(event,{functionName:'knowledge-manual-admin',allowedRoles:['admin','manager']});
 if(!auth.ok)return respond(auth.statusCode,{error:auth.message},event);
 const db=auth.supabase;
 if(event.httpMethod==='GET'){
   const res=await db.from('sc_knowledge_sources').select('id,title,source_key,status,page_count,error_message,indexed_at,updated_at').order('updated_at',{ascending:false}).limit(100);
   return respond(res.error?500:200,res.error?{error:'Could not list manuals'}:{sources:res.data||[]},event);
 }
 try{
   const body=JSON.parse(event.body||'{}');
   const encoded=String(body.pdf_base64||'');
   if(encoded.length>5_700_000||!encoded||!/^[A-Za-z0-9+/=]+$/.test(encoded))return respond(400,{error:'PDF must be base64-encoded, under 4 MB.'},event);
   const buffer=Buffer.from(encoded,'base64');
   if(buffer.length>4*1024*1024)return respond(413,{error:'Upload PDFs up to 4 MB in this interface. Larger manuals can be synced into R2 knowledge/manuals by the scheduled indexer.'},event);
   const filename=String(body.file_name||'manual.pdf').slice(0,150);
   const key=await storeUploadedManual(buffer,filename);
   const result=await ingestManual(db,key,{title:String(body.title||filename).slice(0,240),category:'machine manual'});
   return respond(200,{ok:true,...result},event);
 }catch(error){console.error('manual index failed',error?.message);return respond(500,{error:'Could not index this manual. Try again or check index status.'},event);}
}