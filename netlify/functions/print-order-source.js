// Read-only, authenticated source-of-truth lookup for internal Print Center.
// Never creates, modifies, sends, or settles a WooCommerce/QuickBooks invoice.
import {authorizeEmployee,jsonResponse} from './_shared/security.js';
import {normalizeWooPrintSource,normalizeManualPrintSource} from '../../src/lib/printModel.js';
import {verifiedQuickBooksInvoice} from './_shared/qboPrint.js';

const clean=value=>String(value??'').trim();
const wooBase=()=>clean(process.env.WOO_SITE_URL||process.env.WOOCOMMERCE_SITE_URL||
  process.env.WP_SITE_URL||process.env.WORDPRESS_SITE_URL||'https://skilledcrafting.com').replace(/\/+$/,'');
const readJson=async response=>{
  const text=await response.text();
  try{return JSON.parse(text);}catch{return null;}
};
function wooEndpoint(id){
  const base=new URL(wooBase());
  if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)
    throw Error('WooCommerce HTTPS site configuration is invalid.');
  return new URL('/wp-json/wc/v3/orders/'+id,base).toString();
}
async function loadWooSource(orderId){
  const key=clean(process.env.WC_CONSUMER_KEY||process.env.WOOCOMMERCE_CONSUMER_KEY);
  const secret=clean(process.env.WC_CONSUMER_SECRET||process.env.WOOCOMMERCE_CONSUMER_SECRET);
  if(!key||!secret)throw Error('WooCommerce read-only invoice lookup is not configured.');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(wooEndpoint(orderId),{
      headers:{Authorization:'Basic '+Buffer.from(key+':'+secret).toString('base64'),Accept:'application/json'},
      redirect:'error',signal:controller.signal,
    });
    if(!response.ok)throw Error('WooCommerce order read failed (HTTP '+response.status+').');
    const order=await readJson(response);
    if(!order||Number(order.id)!==orderId)throw Error('WooCommerce order identity did not match.');
    return normalizeWooPrintSource(order);
  }finally{clearTimeout(timeout);}
}
async function loadManualSource(supabase,manualId){
  const [h,l]=await Promise.all([
    supabase.from('sc_manual_invoice_order_totals').select('*').eq('id',manualId).maybeSingle(),
    supabase.from('sc_manual_invoice_order_items_detail').select('*').eq('manual_order_id',manualId)
      .order('line_number').limit(1000),
  ]);
  if(h.error||l.error)throw Error('Manual invoice source could not be read.');
  if(!h.data)throw Error('Manual invoice record was not found.');
  if((l.data||[]).length>=1000)throw Error('Manual order exceeds safe print lookup limit.');
  return normalizeManualPrintSource(h.data,l.data||[]);
}
export const handler=async event=>{
  if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
  if(event.httpMethod!=='POST')return jsonResponse(405,{success:false,error:'Use authenticated POST.'},event);
  const auth=await authorizeEmployee(event,{functionName:'print-order-source',allowedRoles:['admin','manager']});
  if(!auth.ok)return jsonResponse(auth.statusCode,{success:false,error:auth.message},event);
  try{
    const body=JSON.parse(event.body||'{}');
    const jobId=Number(body.jobId);
    if(!Number.isSafeInteger(jobId)||jobId<1)return jsonResponse(400,{success:false,error:'Valid production job ID required.'},event);
    const {data:job,error}=await auth.supabase.from('jobs')
      .select('id,customer_name,job_name,due_date,status,woocommerce_order_id,manual_order_id,source_invoice_number,woo_order_number')
      .eq('id',jobId).maybeSingle();
    if(error||!job)return jsonResponse(404,{success:false,error:'Production job not found.'},event);
    const wooId=Number(job.woocommerce_order_id);
    const manualId=Number(job.manual_order_id);
    if(Number.isSafeInteger(wooId)&&wooId>0&&Number.isSafeInteger(manualId)&&manualId>0)
      return jsonResponse(409,{success:false,error:'Job has ambiguous Woo and manual billing links. Resolve before printing.'},event);
    let source;
    if(Number.isSafeInteger(wooId)&&wooId>0)source=await loadWooSource(wooId);
    else if(Number.isSafeInteger(manualId)&&manualId>0){
      const manual=await loadManualSource(auth.supabase,manualId);
      try{source=await verifiedQuickBooksInvoice(auth.supabase,manual);}
      catch(qboError){
        // No live verification => keep the manual financial source DRAFT.
        source={...manual,warnings:[...manual.warnings,'QuickBooks verification unavailable: '+qboError.message]};
      }
    }
    else return jsonResponse(409,{success:false,error:'Link an authoritative WooCommerce or manual invoice record to this job first.'},event);
    return jsonResponse(200,{success:true,job,source},event);
  }catch(error){
    const msg=error?.name==='AbortError'?'WooCommerce request timed out.':error?.message||'Print source unavailable.';
    console.warn('print-order-source read failure:',msg);
    return jsonResponse(502,{success:false,error:msg},event);
  }
};
