import {authorizeEmployee,jsonResponse} from "./_shared/security.js";
const privateResponse=(code,data,event)=>{const r=jsonResponse(code,data,event);return {...r,headers:{...r.headers,"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer"}};};
export async function handler(event){
 if(event.httpMethod==="OPTIONS") return privateResponse(204,{},event);
 if(!["GET","POST"].includes(event.httpMethod)) return privateResponse(405,{message:"Method not allowed"},event);
 const auth=await authorizeEmployee(event,{functionName:"marketing-review-admin",allowedRoles:["admin","manager"]});
 if(!auth.ok) return privateResponse(auth.statusCode,{message:auth.message},event);
 try{
  if(event.httpMethod==="GET"){
   const documentId=String(event.queryStringParameters?.document_id||"");
   if(!/^[0-9a-f-]{36}$/i.test(documentId)) return privateResponse(400,{message:"Document ID required."},event);
   const {data,error}=await auth.supabase.from("sc_growth_document_reviews")
    .select("id,created_at,expires_at,revoked_at,decision,feedback,responded_at")
    .eq("document_id",documentId).order("created_at",{ascending:false}).limit(30);
   if(error)throw error;
   return privateResponse(200,{reviews:data||[]},event);
  }
  const body=JSON.parse(event.body||"{}");
  if(!/^[0-9a-f-]{36}$/i.test(String(body.review_id||"")))return privateResponse(400,{message:"Review ID required."},event);
  const {data,error}=await auth.supabase.from("sc_growth_document_reviews")
   .update({revoked_at:new Date().toISOString()}).eq("id",body.review_id)
   .is("revoked_at",null).is("decision",null).select("id").maybeSingle();
  if(error)throw error;
  return privateResponse(data?200:409,{revoked:Boolean(data)},event);
 }catch(e){return privateResponse(500,{message:"Could not access review history."},event);}
}
