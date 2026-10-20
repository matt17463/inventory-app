import {authorizeEmployee,jsonResponse} from "./_shared/security.js";
const trim=(v,n)=>String(v||"").trim().slice(0,n);
function safeOrganizationUrl(raw){
 try{const u=new URL(raw);if(!["https:","http:"].includes(u.protocol)||u.username||u.password)return null;
  if(!u.hostname.includes(".")||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname))return null;
  return u;
 }catch{return null;}
}
function sameSite(url,site){
 const u=safeOrganizationUrl(url);if(!u)return false;
 const host=u.hostname.replace(/^www\./,"").toLowerCase(),expected=site.hostname.replace(/^www\./,"").toLowerCase();
 return host===expected||host.endsWith("."+expected);
}
export async function handler(event){
 if(event.httpMethod==="OPTIONS")return jsonResponse(204,{},event);
 if(event.httpMethod!=="POST")return jsonResponse(405,{message:"Method not allowed"},event);
 const auth=await authorizeEmployee(event,{functionName:"marketing-public-contacts",allowedRoles:["admin","manager","marketing"]});
 if(!auth.ok)return jsonResponse(auth.statusCode,{message:auth.message},event);
 if(!process.env.OPENAI_API_KEY)return jsonResponse(503,{message:"AI research is not configured."},event);
 try{
  const body=JSON.parse(event.body||"{}"),organization=trim(body.organization,140),site=safeOrganizationUrl(body.website);
  if(!organization||!site)return jsonResponse(400,{message:"An organization and valid public website are required."},event);
  const response=await fetch("https://api.openai.com/v1/responses",{
   method:"POST",headers:{"Authorization":"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json"},
   body:JSON.stringify({model:process.env.OPENAI_MARKETING_RESEARCH_MODEL||"gpt-4.1-mini",
    tools:[{type:"web_search"}],max_output_tokens:1400,
    instructions:"Search the organization's official public website ONLY for a clearly published generic business contact channel or a named professional representative. Never guess names, roles or email patterns and never return personal/home/mobile contact information. Source URLs must be on that official site's domain. If none is found, return []. Return JSON array only, maximum 6 objects: name, job_title, email, source_url, notes. Blank name allowed for a generic department contact, but email must be genuinely visible on the official source. Every record must have an official source_url. Do not claim any outreach permission.",
    input:"Organization: "+organization+". Official website: "+site.origin+". Identify publicly listed business-only contact channels relevant to branded clothing or team merchandise."}),
   signal:AbortSignal.timeout(60000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return jsonResponse(502,{message:"Contact research provider unavailable."},event);
  const raw=(data.output||[]).filter(x=>x.type==="message").flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n").trim();
  let rows;try{rows=JSON.parse(raw);}catch{return jsonResponse(502,{message:"The research result needs manual verification; it could not be structured."},event);}
  const contacts=(Array.isArray(rows)?rows:[]).slice(0,6).filter(x=>x&&sameSite(x.source_url,site)).map(x=>({
   name:trim(x.name,120),job_title:trim(x.job_title,150),email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email||"")?trim(x.email,150):"",
   source_url:String(x.source_url),notes:trim(x.notes,300),verified:false,contact_permission:"unknown"
  })).filter(x=>x.name||x.job_title||x.email);
  const r=jsonResponse(200,{contacts,requires_manual_source_verification:true},event);
  return {...r,headers:{...r.headers,"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer"}};
 }catch{return jsonResponse(500,{message:"Public contact research failed."},event);}
}
