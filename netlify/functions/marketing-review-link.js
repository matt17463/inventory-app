import crypto from "node:crypto";
import {GetObjectCommand} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import {r2Client,r2BucketName} from "./_shared/mockupStorage.js";
import {authorizeEmployee,createServiceClient,jsonResponse} from "./_shared/security.js";
const hash = token => crypto.createHash("sha256").update(token).digest("hex");
const privateResponse = (status, payload, event) => { const result=jsonResponse(status,payload,event); return {...result,headers:{...result.headers,"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"}}; };
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const cut=(value,limit=300)=>String(value??"").slice(0,limit);
async function signedReviewAsset(asset, accountId) {
 if(asset?.storage_provider!=="r2"||typeof asset.key!=="string")return null;
 if(!asset.key.startsWith("marketing/artwork/"+accountId+"/") ||
   !/^marketing\/artwork\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(asset.key))return null;
 return getSignedUrl(r2Client(),new GetObjectCommand({Bucket:r2BucketName(),Key:asset.key}),{expiresIn:900});
}
function publicProductRows(value) {
 return (Array.isArray(value)?value:[]).slice(0,25).filter(x=>x&&typeof x==="object").map(p=>({
  name:cut(p.name,160),sku:cut(p.sku,100),sizes:cut(p.sizes,240),colors:cut(p.colors,240),
  retailPrice:Number.isFinite(Number(p.retailPrice)) && Number(p.retailPrice)>=0?Number(p.retailPrice):null,
  quantity:Number.isInteger(Number(p.quantity))&&Number(p.quantity)>0?Number(p.quantity):null
 }));
}

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
  const {data:doc,error:docError}=await db.from("sc_growth_documents").select("title,template_id,status,content,account_id").eq("id",review.document_id).single();
  if(docError||doc?.status!=="approved") return privateResponse(404,{message:"Document unavailable."},event);
  const source=doc.content||{};
  const branding=source.branding||{};
  const content={
    organization:cut(source.organization,200),
    description:cut(source.description,3000),
    aiText:cut(source.aiText,12000),
    branding:{profile:cut(branding.profile,100),colors:Array.isArray(branding.colors)?branding.colors.filter(x=>/^#[0-9a-f]{6}$/i.test(x)).slice(0,12):[],
      placements:Array.isArray(branding.placements)?branding.placements.map(x=>cut(x,100)).slice(0,25):[]},
    style:cut(source.style,200),
    sizes:cut(source.sizes,400),
    productColors:cut(source.productColors,400),
    sku:cut(source.sku,120),
    placement:cut(source.placement,300),
    terms:cut(source.terms,1500),
    cta:cut(source.cta,800),
    retailPrice:Number.isFinite(Number(source.retailPrice))&&source.retailPrice!==""&&source.retailPrice!=null&&Number(source.retailPrice)>=0?Number(source.retailPrice):null,
    quantity:Number.isInteger(Number(source.quantity))&&Number(source.quantity)>0?Number(source.quantity):null,
    productRows:publicProductRows(source.productRows),
    productSwatches:(Array.isArray(source.productSwatches)?source.productSwatches:[]).slice(0,30)
      .filter(x=>x&&/^#[0-9a-f]{6}$/i.test(x.hex)).map(x=>({name:cut(x.name,120),hex:x.hex}))
  };
  content.logo_url=await signedReviewAsset(source.marketing_artwork,doc.account_id);
  content.product_image_url=await signedReviewAsset(source.marketing_product_image,doc.account_id);
  content.product_image_urls=(await Promise.all((Array.isArray(source.marketing_product_images)?source.marketing_product_images:[])
    .slice(0,25).map(asset=>signedReviewAsset(asset,doc.account_id)))).filter(Boolean);
  content.logo_option_urls=(await Promise.all((Array.isArray(source.marketing_logo_options)?source.marketing_logo_options:[])
    .slice(0,6).map(asset=>signedReviewAsset(asset,doc.account_id)))).filter(Boolean);
  return privateResponse(200,{title:doc.title,template_id:doc.template_id,content,
    expires_at:review.expires_at},event);
 }catch(error){return privateResponse(500,{message:"Review request failed."},event);}
}
