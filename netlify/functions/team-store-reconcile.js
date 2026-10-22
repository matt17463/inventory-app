import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { wooCollection, wooRequest } from './_shared/mockupUtils.js';
import { reconcileWooOrderLines } from './_shared/teamStoreCommerce.js';

function readBody(event){try{return JSON.parse(event.body||'{}');}catch{return {};}}
function uuid(v){return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(v||''));}
export async function handler(event){
  if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
  if(event.httpMethod!=='POST')return jsonResponse(405,{success:false,error:'POST required'},event);
  const auth=await authorizeEmployee(event,{functionName:'team-store-reconcile',allowedRoles:['admin','manager']});
  if(!auth.ok)return jsonResponse(auth.statusCode,{success:false,error:auth.message},event);
  const body=readBody(event),page=Number(body.page||1);
  if(!uuid(body.campaign_id)||!Number.isInteger(page)||page<1||page>40)
    return jsonResponse(400,{success:false,error:'Choose a campaign and a scan page between 1 and 40.'},event);
  const sb=auth.supabase;
  try {
    const {data:campaign,error:ce}=await sb.from('sc_team_store_workflows').select('*').eq('id',body.campaign_id).single();
    if(ce)throw ce;
    if(!campaign.published_at)throw Error('Only previously published campaigns can reconcile live WooCommerce orders.');
    const {data:products,error:pe}=await sb.from('sc_team_store_products')
      .select('woo_product_id').eq('campaign_id',campaign.id);
    if(pe)throw pe;
    if(!products.length)throw Error('Campaign has no assigned WooCommerce products.');
    const after=new Date(new Date(campaign.published_at).getTime()-24*60*60*1000).toISOString().slice(0,19);
    const path='orders?per_page=50&page='+page+'&orderby=date&order=desc&after='+encodeURIComponent(after);
    const orders=wooCollection(await wooRequest(path),'WooCommerce orders');
    let orderMatches=0,changedLines=0,refundReview=0,unpaid=0;
    for(const order of orders){
      if(!(order.line_items||[]).some(line=>products.some(p=>Number(p.woo_product_id)===Number(line.product_id))))continue;
      let refundDetails=[];
      if(Array.isArray(order.refunds)&&order.refunds.length){
        refundDetails=wooCollection(await wooRequest('orders/'+Number(order.id)+'/refunds?per_page=100'),'Woo refunds');
        if(refundDetails.length<order.refunds.length)throw Error('Refund history is incomplete for Woo order #'+order.id+'; reconciliation stopped.');
      }
      const rows=reconcileWooOrderLines(order,refundDetails,products,campaign);
      if(!rows.length)continue;
      const {error:upsertError}=await sb.from('sc_team_store_order_lines')
        .upsert(rows,{onConflict:'campaign_id,woo_order_id,woo_line_item_id'});
      if(upsertError)throw upsertError;
      orderMatches++;changedLines+=rows.length;
      refundReview+=rows.filter(x=>x.refund_requires_review).length;
      unpaid+=rows.filter(x=>!x.payment_confirmed).length;
    }
    const more=orders.length===50;
    if(!more){
      const {error:se}=await sb.from('sc_team_store_workflows').update({last_reconciled_at:new Date().toISOString()}).eq('id',campaign.id);
      if(se)throw se;
    }
    return jsonResponse(200,{success:true,page,has_more:more,next_page:more&&page<40?page+1:null,
      capped:more&&page>=40,orders_checked:orders.length,matched_orders:orderMatches,
      matched_lines:changedLines,refund_lines_to_review:refundReview,unpaid_lines:unpaid,
      fully_scanned:!more,
      message:more?'More WooCommerce orders remain; continue scanning to reconcile the full period.':
        'Completed this scan of the campaign period. Unpaid and ambiguous refund lines do not accrue eligible revenue.'},event);
  }catch(e){
    console.error('team-store-reconcile failed:',e.message);
    return jsonResponse(503,{success:false,error:'WooCommerce reconciliation stopped: '+(e.message||'unknown')},event);
  }
}
