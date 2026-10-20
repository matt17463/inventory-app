import crypto from "node:crypto";
import {authorizeEmployee,createServiceClient,jsonResponse} from "./_shared/security.js";
const hash = token => crypto.createHash("sha256").update(token).digest("hex");
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function handler(event) {
 if(event.httpMethod==="OPTIONS") return jsonResponse(204,{},event);
 if(!["GET","POST"].includes(event.httpMethod)) return jsonResponse(405,{message:"Method not allowed"},event);
 try {
  if(event.httpMethod==="POST"){
    const auth=await authorizeEmployee(event,{functionName:"marketing-review-link",allowedRoles:["admin","manager"]});
    if(!auth.ok) return jsonResponse(auth.statusCode,{message:auth.message},event);
    const body=JSON.parse(event.body||"{}");
    if(!uuid(String(body.document_id||""))) return jsonResponse(400,{message:"Invalid document."},event);
    const {data:doc,error}=await auth.supabase.from("sc_growth_documents").select("id,status,template_id,content").eq("id",body.document_id).single();
    if(error||!doc||doc.status!=="approved") return jsonResponse(409,{message:"Approve the document internally first."},event);
    const token=crypto.randomBytes(32).toString("base64url");
    const expires=new Date(Date.now()+7*86400000).toISOString();
    const {error:writeError}=await auth.supabase.from("sc_growth_document_reviews").insert({
      document_id:doc.id,token_hash:hash(token),expires_at:expires,created_by:auth.user.id
    });
    if(writeError) throw writeError;
    return jsonResponse(200,{token,expires_at:expires},event);
  }
  const token=String(event.queryStringParameters?.token||"");
  if(token.length<35||token.length>100) return jsonResponse(400,{message:"Invalid review link."},event);
  const db=createServiceClient();
  const {data:review,error}=await db.from("sc_growth_document_reviews")
   .select("id,document_id,expires_at,revoked_at,decision").eq("token_hash",hash(token)).maybeSingle();
  if(error||!review||review.revoked_at||review.decision||Date.parse(review.expires_at)<=Date.now())
   return jsonResponse(404,{message:"Review link has expired or is unavailable."},event);
  const {data:doc,error:docError}=await db.from("sc_growth_documents").select("title,template_id,status,content").eq("id",review.document_id).single();
  if(docError||doc?.status!=="approved") return jsonResponse(404,{message:"Document unavailable."},event);
  const {offer, ...content}=doc.content||{};
  return jsonResponse(200,{title:doc.title,template_id:doc.template_id,
    content:{...content,offer:offer?{supplier_name:offer.supplier_name,sku:offer.sku,availability_verified:false}:null},
    expires_at:review.expires_at},event);
 }catch(error){return jsonResponse(500,{message:"Review request failed."},event);}
}
