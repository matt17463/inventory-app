import {timingSafeEqual} from 'node:crypto';
import {authorizeEmployee,jsonResponse,createServiceClient,getHeader} from './_shared/security.js';
import {backupReportPatch} from './_shared/nasBackupReport.js';
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
 let report;
 try{report=backupReportPatch(input)}catch(error){return respond(event,400,{success:false,error:error.message})}
 const db=createServiceClient();
 const {error}=await db.from('sc_storage_backup_reports').upsert(report,{onConflict:'site'});
 if(error)return respond(event,500,{success:false,error:'Backup report could not be stored.'});
 return respond(event,200,{success:true});
};
