import {timingSafeEqual} from 'node:crypto';
import {authorizeEmployee,jsonResponse,createServiceClient,getHeader} from './_shared/security.js';
const valid=new Set(['business','home']);
const respond=(event,code,body)=>jsonResponse(code,body,event);
function tokenValid(event){
 const a=Buffer.from(String(getHeader(event,'x-sc-nas-report-token')||''));
 const b=Buffer.from(String(process.env.SC_NAS_REPORT_TOKEN||''));
 return b.length>=32&&a.length===b.length&&timingSafeEqual(a,b);
}
export const handler=async event=>{
 if(event.httpMethod==='OPTIONS')return respond(event,204,{});
 if(event.httpMethod==='GET'){
  const auth=await authorizeEmployee(event,{functionName:'nas-backup-health',allowedRoles:['admin','manager']});
  if(!auth.ok)return respond(event,auth.statusCode,{success:false,error:auth.message});
  const {data,error}=await auth.supabase.from('sc_storage_backup_reports').select('*').order('site');
  if(error)return respond(event,500,{success:false,error:'Could not read backup status.'});
  return respond(event,200,{success:true,sites:data||[]});
 }
 if(event.httpMethod!=='POST')return respond(event,405,{success:false,error:'Method not supported.'});
 if(!tokenValid(event))return respond(event,403,{success:false,error:'Backup agent not authorized.'});
 let input;try{input=JSON.parse(event.body||'{}')}catch{return respond(event,400,{success:false,error:'Invalid JSON'})}
 if(!valid.has(input.site)||!['configured','running','success','failed'].includes(input.status))
  return respond(event,400,{success:false,error:'Invalid site or status.'});
 const n=x=>Number.isSafeInteger(Number(x))&&Number(x)>=0?Number(x):null;
 const count=n(input.object_count),bytes=n(input.bytes_stored);
 if(count===null||bytes===null)return respond(event,400,{success:false,error:'Invalid totals.'});
 const date=x=>x&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
 const db=createServiceClient();
 const report={site:input.site,status:input.status,object_count:count,bytes_stored:bytes,
  last_backup_at:date(input.last_backup_at),last_restore_test_at:date(input.last_restore_test_at),
  error_summary:String(input.error_summary||'').slice(0,400),agent_version:String(input.agent_version||'').slice(0,80),
  reported_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 const {error}=await db.from('sc_storage_backup_reports').upsert(report,{onConflict:'site'});
 if(error)return respond(event,500,{success:false,error:'Backup report could not be stored.'});
 return respond(event,200,{success:true});
};
