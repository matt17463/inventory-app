import {createHash,randomBytes} from 'node:crypto';
import {authorizeEmployee,createServiceClient,jsonResponse} from './_shared/security.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const uuid=s=>/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(String(s||''));
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return jsonResponse(405,{success:false,error:'Method not allowed'},event);
 let body;try{body=JSON.parse(event.body||'{}');}catch{body={};}
 const action=String(body.action||'');
 try {
  if(action==='view'){
   const token=String(body.token||'');
   if(!/^[a-f0-9]{64}$/.test(token))return jsonResponse(404,{success:false,error:'Coordinator invitation unavailable'},event);
   const sb=createServiceClient();
   const {data:inv,error:ie}=await sb.from('sc_team_coordinator_access').select('campaign_id,expires_at,revoked_at')
    .eq('token_hash',sha(token)).maybeSingle();
   if(ie)throw ie;
   if(!inv||inv.revoked_at||new Date(inv.expires_at)<new Date())return jsonResponse(404,{success:false,error:'Coordinator invitation expired or revoked'},event);
   const {data:campaign,error:ce}=await sb.from('sc_team_store_workflows').select('workflow_name,customer_name,season_label,order_channel,stage,store_close_date,fulfillment_method,wp_store_url,last_reconciled_at,fundraiser_model').eq('id',inv.campaign_id).single();
   if(ce)throw ce;
   if(campaign.order_channel==='woocommerce'){
    const {data:lines,error:le}=await sb.from('sc_team_store_order_lines')
      .select('woo_order_id,payment_confirmed,net_eligible_sales,fundraiser_estimated,quantity,refunded_quantity,refund_requires_review')
      .eq('campaign_id',inv.campaign_id).limit(5000);
    if(le)throw le;
    const paid=lines.filter(l=>l.payment_confirmed&&!l.refund_requires_review);
    const total=paid.reduce((v,l)=>v+Number(l.net_eligible_sales||0),0);
    const estimate=paid.reduce((v,l)=>v+Number(l.fundraiser_estimated||0),0);
    const quantity=paid.reduce((v,l)=>v+Math.max(0,Number(l.quantity||0)-Number(l.refunded_quantity||0)),0);
    return jsonResponse(200,{success:true,campaign,
      summary:{paid_orders:new Set(paid.map(l=>l.woo_order_id)).size,units:quantity,net_eligible_sales:Number(total.toFixed(2)),fundraiser_estimated:Number(estimate.toFixed(2)),refund_lines_to_review:lines.filter(l=>l.refund_requires_review).length},
      notice:'Sales estimates are from the last owner-initiated Woo reconciliation, exclude ambiguous refunds and are not a final payout statement.'},event);
   }
   const {data:req,error:re}=await sb.from('sc_client_order_requests')
    .select('id,payment_received_at,generated_job_id').eq('campaign_id',inv.campaign_id).limit(3000);
   if(re)throw re;
   return jsonResponse(200,{success:true,campaign,
    summary:{requests:req.length,paid_requests:req.filter(x=>x.payment_received_at).length,
      jobs_started:req.filter(x=>x.generated_job_id).length},
    notice:'Order requests are reviewed and invoiced individually through QuickBooks; there is no WooCommerce checkout or automatic fundraising payout for this campaign.'},event);
  }
  const auth=await authorizeEmployee(event,{functionName:'team-store-coordinator',allowedRoles:['admin','manager']});
  if(!auth.ok)return jsonResponse(auth.statusCode,{success:false,error:auth.message},event);
  if(!uuid(body.campaign_id))throw Error('Choose a campaign.');
  const sb=auth.supabase;
  const {data:c,error:ce}=await sb.from('sc_team_store_workflows').select('id').eq('id',body.campaign_id).single();
  if(ce||!c)throw Error('Campaign not found.');
  if(!['issue','revoke'].includes(action))throw Error('Unsupported coordinator access action.');
  const revoked=await sb.from('sc_team_coordinator_access').update({revoked_at:new Date().toISOString()})
   .eq('campaign_id',c.id).is('revoked_at',null);
  if(revoked.error)throw revoked.error;
  if(action==='revoke')return jsonResponse(200,{success:true,revoked:true},event);
  const token=randomBytes(32).toString('hex');
  const expires=new Date(Date.now()+90*24*3600*1000).toISOString();
  const inserted=await sb.from('sc_team_coordinator_access').insert({campaign_id:c.id,token_hash:sha(token),created_by:auth.user.id,expires_at:expires});
  if(inserted.error)throw inserted.error;
  return jsonResponse(200,{success:true,token,expires_at:expires,notice:'Copy and send this private invitation now. Rotating access invalidated previous invitation links.'},event);
 } catch(e){
  console.error('Coordinator request failed:',action,String(e.message).slice(0,180));
  return jsonResponse(400,{success:false,error:action==='view'?'Coordinator dashboard unavailable':e.message},event);
 }
}
