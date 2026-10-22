import {authorizeEmployee,jsonResponse} from './_shared/security.js';
import {validateSteps,validateReview,uuidPattern,certificationCurrent} from './_shared/trainingRecords.js';
import {TRAINING_VERSION,trainingTutorials} from '../../src/application-guide/trainingData.js';

const endpoint='training-certifications';
const privileged=new Set(['admin','manager']);
const knownTutorials=new Map(trainingTutorials.map(t=>[t.id,t]));
const fail=(event,status,error)=>jsonResponse(status,{success:false,error},event);
async function tableRows(db,table,fields,max=1000){
 const {data,error}=await db.from(table).select(fields).limit(max);
 if(error)throw Error('Training storage is unavailable ('+table+').');
 return data||[];
}
const parse=event=>{
 const raw=String(event.body||'');
 if(raw.length>12000)throw Error('Training request too large.');
 const value=JSON.parse(raw||'{}');
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected object.');
 return value;
};

export const handler=async event=>{
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(!['GET','POST'].includes(event.httpMethod))return fail(event,405,'Use GET or POST.');
 const access=await authorizeEmployee(event,{functionName:endpoint,allowedRoles:[]});
 if(!access.ok)return fail(event,access.statusCode,access.message);
 const {supabase:db,user,role}=access;
 const manager=privileged.has(role);
 try{
  if(event.httpMethod==='GET'){
   const view=new URLSearchParams(event.queryStringParameters||{}).get('view')||'mine';
   if(!['mine','team','qa'].includes(view))return fail(event,400,'Invalid view.');
   if(view==='qa'&&!manager)return fail(event,403,'Manager required for audit triage.');
   if(view==='team'&&!manager)return fail(event,403,'Manager required for team records.');
   if(view==='qa'){
    const reviews=await tableRows(db,'sc_documentation_qa_reviews','target_type,target_id,review_state,evidence_reference,reviewer_note,updated_at',1000);
    return jsonResponse(200,{success:true,view,reviews},event);
   }
   const query=db.from('sc_training_progress')
    .select('user_id,tutorial_id,curriculum_version,completed_steps,completed,updated_at')
    .limit(1000);
   const progressResult=await (view==='mine'?query.eq('user_id',user.id):query);
   if(progressResult.error)throw Error('Training progress migration is not available.');
   const certQuery=db.from('sc_training_certifications')
    .select('user_id,tutorial_id,curriculum_version,signed_off_by,signed_off_at,manager_note')
    .limit(1000);
   const certResult=await (view==='mine'?certQuery.eq('user_id',user.id):certQuery);
   if(certResult.error)throw Error('Manager certification migration is not available.');
   const progress=progressResult.data||[],certifications=certResult.data||[];
   const certs=new Map(certifications.map(x=>[x.user_id+':'+x.tutorial_id,x]));
   return jsonResponse(200,{success:true,view,version:TRAINING_VERSION,records:progress.map(p=>({
    ...p,certification:certificationCurrent(p,certs.get(p.user_id+':'+p.tutorial_id),TRAINING_VERSION)
      ?certs.get(p.user_id+':'+p.tutorial_id):null,
   })),totalLimit:1000},event);
  }
  const input=parse(event),action=String(input.action||'');
  if(action==='progress'){
   const tutorial=knownTutorials.get(String(input.tutorialId||''));
   if(!tutorial)return fail(event,400,'Unknown training tutorial.');
   const completedSteps=validateSteps(input.completedSteps,tutorial.steps?.length||0);
   const completed=Boolean(input.completed)&&completedSteps.length===tutorial.steps.length;
   if(Boolean(input.completed)&&!completed)return fail(event,400,'Complete all tutorial steps before marking complete.');
   const row={user_id:user.id,tutorial_id:tutorial.id,curriculum_version:TRAINING_VERSION,
    completed_steps:completedSteps,completed,updated_at:new Date().toISOString()};
   const {error}=await db.from('sc_training_progress').upsert(row,{onConflict:'user_id,tutorial_id'});
   if(error)throw Error('Unable to save central training progress.');
   return jsonResponse(200,{success:true,record:row},event);
  }
  if(action==='certify'){
   if(!manager)return fail(event,403,'Manager approval required.');
   const employeeId=String(input.employeeId||'');
   const tutorial=knownTutorials.get(String(input.tutorialId||''));
   if(!uuidPattern.test(employeeId)||!tutorial)return fail(event,400,'Select an employee and known training tutorial.');
   if(String(input.note||'').length>1000)return fail(event,400,'Manager note too long.');
   const {data:roleRow,error:roleError}=await db.from('sc_app_user_roles')
    .select('is_active').eq('user_id',employeeId).maybeSingle();
   if(roleError||!roleRow?.is_active)return fail(event,400,'Employee account is not active.');
   const {data:progress,error:prError}=await db.from('sc_training_progress')
    .select('completed,curriculum_version,completed_steps,updated_at')
    .eq('user_id',employeeId).eq('tutorial_id',tutorial.id).maybeSingle();
   if(prError||!progress?.completed||progress.curriculum_version!==TRAINING_VERSION||
      validateSteps(progress.completed_steps,tutorial.steps.length).length!==tutorial.steps.length)
    return fail(event,409,'Employee has not completed the current training steps.');
   const row={user_id:employeeId,tutorial_id:tutorial.id,curriculum_version:TRAINING_VERSION,
    signed_off_by:user.id,signed_off_at:new Date().toISOString(),manager_note:String(input.note||'').trim()};
   const {error}=await db.from('sc_training_certifications').upsert(row,{onConflict:'user_id,tutorial_id'});
   if(error)throw Error('Manager signoff failed.');
   return jsonResponse(200,{success:true,certificate:row},event);
  }
  if(action==='qa'){
   if(!manager)return fail(event,403,'Manager required for audit notes.');
   const row=validateReview(input);
   const {error}=await db.from('sc_documentation_qa_reviews').upsert({
    ...row,reviewed_by:user.id,updated_at:new Date().toISOString()
   },{onConflict:'target_type,target_id'});
   if(error)throw Error('Unable to save audit triage.');
   return jsonResponse(200,{success:true,reviewState:row.review_state,
    note:'Triage does not update source audit verification status.'},event);
  }
  return fail(event,400,'Unsupported training action.');
 }catch(error){
  if(error instanceof SyntaxError||/Invalid|Unrecognized|too long|Expected|Complete/.test(error.message))
   return fail(event,400,error.message);
  console.error('Training certifications failed:',error?.message||'Unknown error');
  return fail(event,503,'Training records are unavailable; no completion was claimed.' );
 }
};
