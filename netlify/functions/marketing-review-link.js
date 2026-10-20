import crypto from "node:crypto";
import {authorizeEmployee,createServiceClient,jsonResponse} from "./_shared/security.js";
const hash = token => crypto.createHash("sha256").update(token).digest("hex");
const privateResponse = (status, payload, event) => { const result=jsonResponse(status,payload,event); return {...result,headers:{...result.headers,"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"}}; };
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function handler(event) {
 if(event.httpMethod==="OPTIONS") return privateResponse(204,{},event);
 if(!["GET","POST"].includes(event.httpMethod)) return privateResponse(405,{message:"Method not allowed"},event);
 try {
  if(event.httpMethod==="POST"){
    const auth=await authorizeEmployee(event,{functionName:"marketing-review-link",allowedRoles:["admin","manager"]});
    if(!auth.ok) return privateResponse(auth.statusCode,{message:auth.message},event);
    const body=JSON.parse(event.body||"{}");
    if(!uuid(String(body.document_id||""))) return privateResponse(400,{message:"Invalid document."},event);
    const {data:doc,error}=await auth.supabase.from("sc_growth_documents").select("id,status,template_id,content").eq("id",body.document_id).single();
    if(error||!doc||doc.status!=="approved") return privateResponse(409,{message:"Approve the document internally first."},event);
    const token=crypto.randomBytes(32).toString("base64url");
    const expires=new Date(Date.now()+7*86400000).toISOString();
    const {error:writeError}=await auth.supabase.from("sc_growth_document_reviews").insert({
      document_id:doc.id,token_hash:hash(token),expires_at:expires,created_by:auth.user.id
    });
    if(writeError) throw writeError;
    return privateResponse(200,{token,expires_at:expires},event);
  }
  const token=String(event.queryStringParameters?.token||"");
  if(token.length<35||token.length>100) return privateResponse(400,{message:"Invalid review link."},event);
  const db=createServiceClient();
  const {data:review,error}=await db.from("sc_growth_document_reviews")
   .select("id,document_id,expires_at,revoked_at,decision").eq("token_hash",hash(token)).maybeSingle();
  if(error||!review||review.revoked_at||review.decision||Date.parse(review.expires_at)<=Date.now())
   return privateResponse(404,{message:"Review link has expired or is unavailable."},event);
  const {data:doc,error:docError}=await db.from("sc_growth_documents").select("title,template_id,status,content").eq("id",review.document_id).single();
  if(docError||doc?.status!=="approved") return privateResponse(404,{message:"Document unavailable."},event);
  const source=doc.content||{};
  const branding=source.branding||{};
  const content={
    organization:String(source.organization||"").slice(0,200),
    description:String(source.description||"").slice(0,3000),
    branding:{profile:branding.profile||"",colors:Array.isArray(branding.colors)?branding.colors.slice(0,12):[],
      placements:Array.isArray(branding.placements)?branding.placements.slice(0,25):[]},
    style:String(source.style||"").slice(0,200),
    sizes:String(source.sizes||"").slice(0,400),
    productColors:String(source.productColors||"").slice(0,400)
  };
  return privateResponse(200,{title:doc.title,template_id:doc.template_id,content,
    expires_at:review.expires_at},event);
 }catch(error){return privateResponse(500,{message:"Review request failed."},event);}
}
