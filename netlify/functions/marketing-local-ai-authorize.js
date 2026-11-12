import {authorizeEmployee,jsonResponse} from "./_shared/security.js";

const respond=(status,body,event)=>({
 ...jsonResponse(status,body,event),
 headers:{...jsonResponse(status,body,event).headers,"Cache-Control":"no-store, private"},
});

export async function handler(event){
 if(event.httpMethod==="OPTIONS")return respond(204,{},event);
 if(event.httpMethod!=="POST")return respond(405,{message:"Method not allowed"},event);
 const auth=await authorizeEmployee(event,{
  functionName:"marketing-local-ai-authorize",
  allowedRoles:["admin","manager","operator","marketing"],
 });
 if(!auth.ok)return respond(auth.statusCode,{message:auth.message},event);
 return respond(200,{authorized:true},event);
}
