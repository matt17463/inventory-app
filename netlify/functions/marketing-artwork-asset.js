import crypto from "node:crypto";
import sharp from "sharp";
import {GetObjectCommand,PutObjectCommand} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import {authorizeEmployee,jsonResponse} from "./_shared/security.js";
import {r2Client,r2BucketName} from "./_shared/mockupStorage.js";
import {operationalStorageProvider} from "./_shared/operationalStorage.js";
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||""));
const mimeExt={"image/png":"png","image/jpeg":"jpg","image/webp":"webp"};
const response=(status,payload,event)=>{const r=jsonResponse(status,payload,event);return {...r,headers:{...r.headers,"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer"}}};
export async function handler(event){
 if(event.httpMethod==="OPTIONS")return response(204,{},event);
 if(!["GET","POST"].includes(event.httpMethod))return response(405,{message:"Method not allowed"},event);
 const auth=await authorizeEmployee(event,{functionName:"marketing-artwork-asset",allowedRoles:["admin","manager","operator","marketing"]});
 if(!auth.ok)return response(auth.statusCode,{message:auth.message},event);
 try{
  operationalStorageProvider();
  const body=event.httpMethod==="POST"?JSON.parse(event.body||"{}"):event.queryStringParameters||{};
  const accountId=String(body.account_id||"");
  if(!uuid(accountId))return response(400,{message:"Select a valid CRM organization."},event);
  const {data:account,error}=await auth.supabase.from("sc_growth_accounts").select("id").eq("id",accountId).maybeSingle();
  if(error||!account)return response(404,{message:"CRM organization not found."},event);
  if(event.httpMethod==="GET"){
   const key=String(body.key||"");
   if(!/^marketing\/artwork\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(key)||!key.startsWith("marketing/artwork/"+accountId+"/"))
    return response(400,{message:"Invalid artwork reference."},event);
   const url=await getSignedUrl(r2Client(),new GetObjectCommand({Bucket:r2BucketName(),Key:key}),{expiresIn:300});
   return response(200,{url,expires_in:300},event);
  }
  const mime=String(body.mime_type||"");
  if(!mimeExt[mime]||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.base64||""))
   return response(400,{message:"A PNG, JPEG or WebP upload is required."},event);
  const bytes=Buffer.from(body.base64,"base64");
  if(!bytes.length||bytes.length>2_500_000)return response(413,{message:"Logo image must be under 2.5 MB."},event);
  const details=await sharp(bytes,{limitInputPixels:25_000_000}).metadata();
  if(!["png","jpeg","webp"].includes(details.format)||details.pages>1)
   return response(400,{message:"Only single-frame raster images are accepted."},event);
  const ext=mimeExt[mime];
  if(({png:"png",jpeg:"jpg",webp:"webp"})[details.format]!==ext)return response(400,{message:"Image type does not match file content."},event);
  const key="marketing/artwork/"+accountId+"/"+crypto.randomUUID()+"."+ext;
  await r2Client().send(new PutObjectCommand({Bucket:r2BucketName(),Key:key,Body:bytes,ContentType:mime,CacheControl:"private, no-store"}));
  return response(200,{asset:{storage_provider:"r2",key,mime_type:mime,size:bytes.length,sha256:crypto.createHash("sha256").update(bytes).digest("hex"),created_at:new Date().toISOString()}},event);
 }catch(e){return response(500,{message:"Private artwork storage unavailable. Confirm the R2 configuration."},event);}
}
