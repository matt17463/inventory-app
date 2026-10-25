import {authorizeEmployee,jsonResponse} from "./_shared/security.js";
import {parseProspectResponse,prospectResponseFormat} from "./_shared/marketingProspectResponse.js";
const clean=(s,n)=>String(s||"").trim().slice(0,n);
function validPublicWebsite(raw){
 try{const u=new URL(raw);if(u.protocol!=="https:"&&u.protocol!=="http:")return false;
  if(u.username||u.password||!u.hostname.includes("."))return false;
  const h=u.hostname.toLowerCase();return !["localhost","example.com","example.org","example.net"].includes(h)&&!/(^|\.)(local|internal|test)$/.test(h)&&!/(^|\.)(127\.0\.0\.1|0\.0\.0\.0)$/.test(h);
 }catch{return false;}
}
export async function handler(event){
 if(event.httpMethod==="OPTIONS")return jsonResponse(204,{},event);
 if(event.httpMethod!=="POST")return jsonResponse(405,{message:"Method not allowed"},event);
 const auth=await authorizeEmployee(event,{functionName:"marketing-prospect-research",allowedRoles:["admin","manager","marketing"]});
 if(!auth.ok)return jsonResponse(auth.statusCode,{message:auth.message},event);
 const key=process.env.OPENAI_API_KEY;
 if(!key)return jsonResponse(503,{message:"Server research integration is not configured."},event);
 try{
  const body=JSON.parse(event.body||"{}");const industry=clean(body.industry,100),region=clean(body.region,120),query=clean(body.query,200);
  if(!industry||!region)return jsonResponse(400,{message:"Industry and region are required."},event);
  const response=await fetch("https://api.openai.com/v1/responses",{
   method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
   body:JSON.stringify({model:process.env.OPENAI_MARKETING_RESEARCH_MODEL||"gpt-4.1-mini",
    tools:[{type:"web_search"}],tool_choice:"required",max_output_tokens:2600,
    text:{format:prospectResponseFormat},
    instructions:"Research publicly listed organizations for a custom apparel business. Use web search and cite each organization's own official public website URL. Never invent organizations, email addresses, decision-makers, phone numbers, private details, or an intent to purchase. Do not return an organization unless search evidence supports its existence and location. Return only a JSON object with a prospects array of at most 8 items. Each item must have string fields name, website, location, reason. If nothing is verifiable, return an empty prospects array. Do not include markdown fences or extra text.",
    input:"Find potential organizations in "+region+" for category "+industry+". Criteria: "+query}),
   signal:AbortSignal.timeout(60000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
   console.warn("Marketing prospect research provider error",{http_status:response.status,provider_code:data.error?.code||null});
   return jsonResponse(502,{message:"Research provider unavailable. Please retry or contact an administrator."},event);
  }
  const result=parseProspectResponse(data);
  if(!result.ok){
   console.warn("Marketing prospect research: invalid structured output",{
    code:result.code,response_status:data.status||"unknown",incomplete_reason:data.incomplete_details?.reason||null,
    output_types:(data.output||[]).map(x=>x.type).slice(0,12)
   });
   return jsonResponse(502,{message:"Research returned an incomplete or unstructured result. Please retry. If the problem continues, contact an administrator.",code:result.code},event);
  }
  const prospects=result.rows.slice(0,8).filter(p=>p&&validPublicWebsite(p.website)&&clean(p.name,150)&&clean(p.reason,500)).map(p=>({name:clean(p.name,150),website:String(p.website),location:clean(p.location,120),reason:clean(p.reason,500)}));
  return {...jsonResponse(200,{prospects,requires_review:true},event),headers:{"Cache-Control":"no-store, private","Content-Type":"application/json"}};
 }catch{return jsonResponse(500,{message:"Prospect research failed. Try again later."},event);}
}
