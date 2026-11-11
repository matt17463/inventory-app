import crypto from "node:crypto";
import {GetObjectCommand} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import {r2Client,r2BucketName,signedStoredAssetUrl} from "./_shared/mockupStorage.js";
import {authorizeEmployee,createServiceClient,jsonResponse} from "./_shared/security.js";
import { marketingDocumentMissing } from "../../src/lib/marketingDocumentContent.js";
import { technicalGuideFields } from "../../src/lib/marketingTechnicalGuide.js";
import { marketingDocumentBlueprint } from "../../src/lib/marketingDocumentBlueprints.js";
const hash = token => crypto.createHash("sha256").update(token).digest("hex");
const privateResponse = (status, payload, event) => { const result=jsonResponse(status,payload,event); return {...result,headers:{...result.headers,"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"}}; };
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const cut=(value,limit=300)=>String(value??"").slice(0,limit);
const reviewDirectories = new Map([["mockup_outputs", "outputs"], ["mockup_artwork_assets", "artwork"], ["mockup_blank_assets", "blanks"]]);

export async function signedSharedReviewAsset(db, reference, customerId, sign = signedStoredAssetUrl) {
 if (!customerId || !reviewDirectories.has(reference?.source) || !uuid(reference.asset_id)) return null;
 const { data: asset, error } = await db.from(reference.source).select("*").eq("id", reference.asset_id).maybeSingle();
 if (error || !asset?.project_id || !uuid(asset.project_id)) return null;
 if (reference.source === "mockup_outputs" && !["internal_approved", "customer_approved"].includes(asset.approval_status)) return null;
 const { data: project, error: projectError } = await db.from("mockup_projects").select("customer_id_text")
   .eq("id", asset.project_id).maybeSingle();
 if (projectError || !project || String(project.customer_id_text) !== String(customerId)) return null;
 const [owner, projectId, directory] = String(asset.storage_path || "").split("/");
 if (!uuid(owner) || projectId !== asset.project_id || directory !== reviewDirectories.get(reference.source)) return null;
 try {
   return await sign(db, asset, 900) || null;
 } catch {
   return null;
 }
}

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
    const missing=marketingDocumentMissing({...doc.content,template:doc.template_id});
    if(missing.length)return privateResponse(409,{message:"This approved draft lacks required client-facing details. Create and approve a complete new draft.",missing},event);
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
  if (source.contentVersion === 2 && marketingDocumentMissing({...source, template:doc.template_id}).length)
    return privateResponse(409,{message:"This document needs an updated approval."},event);
  const {data:account,error:accountError}=await db.from("sc_growth_accounts").select("customer_id").eq("id",doc.account_id).single();
  if(accountError) return privateResponse(404,{message:"Document unavailable."},event);
  const resolveAsset=asset=>asset?.source ? signedSharedReviewAsset(db,asset,account?.customer_id) : signedReviewAsset(asset,doc.account_id);
  const branding=source.branding||{};
  const technical=technicalGuideFields[doc.template_id];
  const content={
    organization:cut(source.organization,200),
    description:cut(source.description,3000),
    aiText:source.contentVersion === 2 ? "" : cut(source.aiText,12000),
    sections:(marketingDocumentBlueprint(doc.template_id)?.sections || [])
      .map(heading=>({heading,value:cut(source.sectionContent?.[heading],3000)}))
      .filter(section=>section.value.trim()),
    branding:{profile:cut(branding.profile,100),colors:Array.isArray(branding.colors)?branding.colors.filter(x=>/^#[0-9a-f]{6}$/i.test(x)).slice(0,12):[],
      placements:Array.isArray(branding.placements)?branding.placements.map(x=>cut(x,100)).slice(0,25):[]},
    technical:technical && Array.isArray(source.technicalRows) ? {
      heading:technical.heading, columns:technical.columns,
      rows:source.technicalRows.slice(0,25).filter(row=>Array.isArray(row) && row.length===technical.columns.length)
        .map(row=>row.map(cell=>cut(cell,180))),
      revision:cut(source.technicalRevision,200),
    } : null,
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
  content.logo_url=await resolveAsset(source.marketing_artwork);
  content.product_image_url=await resolveAsset(source.marketing_product_image);
  const labels=Array.isArray(source.technicalImageLabels)?source.technicalImageLabels:[];
  const productLabels=[];
  for (const row of (Array.isArray(source.productRows)?source.productRows:[])) {
    for (const view of (Array.isArray(row.gallery)?row.gallery:[])) {
      if (Number.isInteger(view.index) && view.index>=0 && view.index<100)
        productLabels[view.index]=[cut(row.name,100),cut(view.color,60)].filter(Boolean).join(" · ");
    }
  }
  async function resolveGallery(value, limit, captions) {
    const images=[];
    for (const [index,asset] of (Array.isArray(value)?value:[]).slice(0,limit).entries()) {
      const url=await resolveAsset(asset);
      if (url) images.push({url,label:cut(captions[index],160),index});
    }
    return images;
  }
  content.product_images=await resolveGallery(source.marketing_product_images,100,
    doc.template_id==="product-placement-guide"?labels:productLabels);
  content.product_image_urls=content.product_images.map(image=>image.url);
  content.logo_options=await resolveGallery(source.marketing_logo_options,6,doc.template_id==="brand-guide"?labels:[]);
  content.logo_option_urls=content.logo_options.map(image=>image.url);
  return privateResponse(200,{title:doc.title,template_id:doc.template_id,content,
    expires_at:review.expires_at},event);
 }catch(error){return privateResponse(500,{message:"Review request failed."},event);}
}
