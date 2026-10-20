import { authorizeEmployee, jsonResponse } from "./_shared/security.js";

const SUPPLIERS=[
 {id:"SanMar",match:/sanmar/i,source:"Account-authorized feed"},
 {id:"S&S Activewear",match:/s&s|ssactivewear|s and s/i,source:"Account-authorized feed"},
 {id:"JPPlus",match:/jpplus|johnson plastics/i,source:"Approved public catalog or export"},
 {id:"USCutter",match:/uscutter/i,source:"Approved public catalog or export"},
];
export async function handler(event) {
 if(event.httpMethod==="OPTIONS")return jsonResponse(204,{},event);
 if(event.httpMethod!=="GET")return jsonResponse(405,{message:"Method not allowed"},event);
 const auth=await authorizeEmployee(event,{functionName:"marketing-supplier-feed-status",allowedRoles:["admin","manager","operator","marketing"]});
 if(!auth.ok)return jsonResponse(auth.statusCode,{message:auth.message},event);
 try{
  const {data,error}=await auth.supabase.from("supplier_catalog_feeds")
   .select("supplier_name,feed_name,is_active,last_sync_at,last_sync_status,last_row_count")
   .limit(100);
  if(error)throw error;
  const feeds=SUPPLIERS.map(item=>{
   const rows=(data||[]).filter(row=>item.match.test(row.supplier_name||""));
   return {supplier:item.id,source:item.source,configured:rows.some(row=>row.is_active),
    last_sync_at:rows.filter(row=>row.last_sync_at).sort((a,b)=>String(b.last_sync_at).localeCompare(String(a.last_sync_at)))[0]?.last_sync_at||null,
    status:rows.find(row=>row.is_active)?.last_sync_status||"not_configured",
    row_count:rows.reduce((sum,row)=>sum+(Number(row.last_row_count)||0),0)};
  });
  return {...jsonResponse(200,{feeds,pricing_live:false,note:"A successful catalog import does not verify wholesale account prices or live stock."},event),headers:{"Cache-Control":"no-store, private","Content-Type":"application/json"}};
 }catch{return jsonResponse(500,{message:"Could not read supplier feed configuration."},event);}
}
