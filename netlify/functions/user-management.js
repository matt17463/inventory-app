import {authorizeEmployee,jsonResponse,createServiceClient,auditFunctionSecurity} from './_shared/security.js';
const roles=new Set(['admin','manager','operator','viewer']);
const clean=v=>String(v??'').trim();
const emailOk=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)&&e.length<=254;
const fail=(event,status,error)=>jsonResponse(status,{success:false,error},event);
async function listUsers(db){
 const {data:authUsers,error}=await db.auth.admin.listUsers({page:1,perPage:1000});
 if(error)throw error;
 const {data:records,error:re}=await db.from('sc_app_user_roles').select('user_id,role,is_active,notes');
 if(re)throw re;
 const byId=new Map((records||[]).map(x=>[x.user_id,x]));
 return (authUsers.users||[]).map(u=>({
  id:u.id,email:u.email||'',created_at:u.created_at,last_sign_in_at:u.last_sign_in_at,
  invited_at:u.invited_at,email_confirmed_at:u.email_confirmed_at,
  role:byId.get(u.id)?.role||null,is_active:byId.get(u.id)?.is_active===true,
  notes:byId.get(u.id)?.notes||''
 }));
}
export const handler=async event=>{
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return fail(event,405,'POST required.');
 const auth=await authorizeEmployee(event,{functionName:'user-management',allowedRoles:['admin']});
 if(!auth.ok)return fail(event,auth.statusCode,auth.message);
 let data;try{data=JSON.parse(event.body||'{}')}catch{return fail(event,400,'Invalid request body')}
 const db=createServiceClient();
 try{
  if(data.action==='list')return jsonResponse(200,{success:true,users:await listUsers(db)},event);
  if(data.action==='reset-history'){
   const {data:history,error}=await db.from('sc_function_security_audit')
    .select('created_at,user_id,outcome,metadata')
    .eq('function_name','user-management').eq('action','password_reset_requested')
    .order('created_at',{ascending:false}).limit(30);
   if(error)throw error;
   return jsonResponse(200,{success:true,history:(history||[]).map(row=>({
    created_at:row.created_at,actor_id:row.user_id,target_id:row.metadata?.target_user_id||null,outcome:row.outcome
   }))},event);
  }
  if(data.action==='reset-password'){
   const userId=clean(data.user_id);
   if(!/^[0-9a-f-]{36}$/i.test(userId))return fail(event,400,'Valid employee account required.');
   const {data:existing,error:lookupError}=await db.auth.admin.getUserById(userId);
   if(lookupError||!existing?.user?.email)return fail(event,404,'Employee account not found.');
   const redirect=clean(process.env.SC_APP_URL||'https://inventory.skilledcrafting.com').replace(/\/+$/,'')+'/reset-password';
   const {error:resetError}=await db.auth.resetPasswordForEmail(existing.user.email,{redirectTo:redirect});
   await auditFunctionSecurity({functionName:'user-management',action:'password_reset_requested',
    outcome:resetError?'failed':'sent',userId:auth.user.id,role:auth.role,event,metadata:{target_user_id:userId}});
   if(resetError){
    console.error('Admin password reset failed:',resetError);
    return fail(event,502,'Unable to send recovery email. Check Supabase email delivery and redirect settings.');
   }
   return jsonResponse(200,{success:true,message:'Password reset email requested. The employee can set a new password using the secure link.'},event);
  }
  if(data.action==='invite'){
   const email=clean(data.email).toLowerCase(),role=clean(data.role);
   if(!emailOk(email)||!roles.has(role))return fail(event,400,'Valid email and employee role required.');
   const redirect=clean(process.env.SC_APP_URL||'https://inventory.skilledcrafting.com').replace(/\/+$/,'')+'/reset-password';
   const {data:invited,error}=await db.auth.admin.inviteUserByEmail(email,{redirectTo:redirect});
   if(error)throw error;
   const {error:roleError}=await db.from('sc_app_user_roles').upsert({
    user_id:invited.user.id,role,is_active:true,notes:'Invited through Skilled Crafting administration.'
   },{onConflict:'user_id'});
   if(roleError)throw Error('Invitation sent, but role assignment failed. Assign role before allowing sign-in: '+roleError.message);
   return jsonResponse(200,{success:true,message:'Invitation sent and role assigned.'},event);
  }
  if(data.action==='update'){
   const userId=clean(data.user_id),role=clean(data.role),active=data.is_active===true;
   if(!/^[0-9a-f-]{36}$/i.test(userId)||!roles.has(role))return fail(event,400,'Invalid user or role.');
   if(userId===auth.user.id&&(!active||role!=='admin'))return fail(event,400,'You cannot deactivate or demote your own administrator account.');
   const {error}=await db.from('sc_app_user_roles').upsert({user_id:userId,role,is_active:active},{onConflict:'user_id'});
   if(error)throw error;
   return jsonResponse(200,{success:true,message:'Employee access updated.'},event);
  }
  return fail(event,400,'Unknown action.');
 }catch(e){console.error('user-management failed:',e);return fail(event,500,e.message||'User administration unavailable.')}
};
