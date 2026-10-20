import { authorizeEmployee, jsonResponse } from "./_shared/security.js";
export async function handler(event) {
 if(event.httpMethod==="OPTIONS") return jsonResponse(204,{},event);
 if(event.httpMethod!=="GET") return jsonResponse(405,{message:"Method not allowed"},event);
 const auth=await authorizeEmployee(event,{functionName:"marketing-catalog-search",allowedRoles:["admin","manager","operator","marketing"]});
 if(!auth.ok) return jsonResponse(auth.statusCode,{message:auth.message},event);
 try {
   const raw=String(event.queryStringParameters?.q||"").trim().slice(0,80);
   if(raw.length<2) return jsonResponse(200,{products:[],note:"Enter at least two characters."},event);
   const search=raw.replace(/[%,()]/g,"");
   const query=auth.supabase.from("supplier_catalog_review")
     .select("supplier_name,supplier_sku,brand,style,color,size,description,review_status")
     .or(["supplier_sku.ilike.%"+search+"%","brand.ilike.%"+search+"%","style.ilike.%"+search+"%","description.ilike.%"+search+"%"].join(","))
     .limit(40);
   const {data,error}=await query;
   if(error) throw error;
   return jsonResponse(200,{products:(data||[]).map(row=>({
     ...row,price_verified:false,availability_verified:false,
     source:"existing-imported-supplier-catalog"
   }))},event);
 } catch(error) {
   return jsonResponse(500,{message:"Supplier catalog search unavailable. Check catalog permissions and source configuration."},event);
 }
}
