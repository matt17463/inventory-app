import crypto from "node:crypto";
import {createServiceClient,jsonResponse} from "./_shared/security.js";
export async function handler(event){
 if(event.httpMethod==="OPTIONS") return jsonResponse(204,{},event);
 if(event.httpMethod!=="POST") return jsonResponse(405,{message:"Method not allowed"},event);
 try{
  const body=JSON.parse(event.body||"{}");
  const token=String(body.token||"");
  if(token.length<35||token.length>100||!["approved","changes_requested"].includes(body.decision))
   return jsonResponse(400,{message:"Invalid review response."},event);
  const feedback=String(body.feedback||"").trim().slice(0,2000);
  if(body.decision==="changes_requested"&&!feedback) return jsonResponse(400,{message:"Describe the requested changes."},event);
  const db=createServiceClient();
  const tokenHash=crypto.createHash("sha256").update(token).digest("hex");
  const {data,error}=await db.from("sc_growth_document_reviews")
   .update({decision:body.decision,feedback,responded_at:new Date().toISOString()})
   .eq("token_hash",tokenHash).is("revoked_at",null).is("decision",null)
   .gt("expires_at",new Date().toISOString()).select("id").maybeSingle();
  if(error) throw error;
  if(!data) return jsonResponse(409,{message:"This link has expired or was already used."},event);
  return jsonResponse(200,{received:true},event);
 }catch(error){return jsonResponse(500,{message:"Could not record response."},event);}
}
