// On-demand, employee-authenticated product research. No invented citations or settings.
// This uses the same server-only OpenAI key pattern as material-settings-ai.
import {authorizeEmployee,jsonResponse,auditFunctionSecurity} from './_shared/security.js';
import {aiFailure} from './_shared/aiDiagnostics.js';
const safe=(value,n)=>String(value??'').trim().slice(0,n);
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return jsonResponse(405,{message:'Use POST'},event);
 const auth=await authorizeEmployee(event,{functionName:'product-opportunity-research',allowedRoles:['admin','manager','marketing','operator']});
 if(!auth.ok)return jsonResponse(auth.statusCode,{message:auth.message},event);
 try{
  const raw=JSON.parse(event.body||'{}');
  const name=safe(raw.name,180),category=safe(raw.category,100),audience=safe(raw.audience,250);
  const equipment=Array.isArray(raw.equipment)?raw.equipment.map(x=>safe(x,35)).slice(0,10):[];
  if(name.length<3)return jsonResponse(400,{message:'Enter a specific product name before researching.'},event);
  if(!process.env.OPENAI_API_KEY)return jsonResponse(503,{message:'Server-side OPENAI_API_KEY is not configured. Add manufacturer/community sources manually.'},event);
  const prompt=[
   'Research a possible customized-product offering for Skilled Crafting, a small fabrication/printing business.',
   'Find recent primary supplier/manufacturer pages and independently available public community evidence for demand, blanks, durability, compatibility and competitive pricing.',
   'Explain practical sales channels for sports coaches/teams, weddings/events and business accounts if relevant.',
   'Record explicit direct links to relevant sources. Distinguish what is supported by sources, what is anecdotal, and what needs testing.',
   'Do NOT fabricate supplier prices, community quotes, numeric machine settings, manufacturer guarantees or predicted sales.',
   'For UV printing on food/drinkware, flag food-contact, drinking rim, coating, adhesion and wash safety.',
   'For lasers, never recommend processing PVC or unknown plastics; flag fire, fumes and ventilation. Golf balls require specific fixture qualification.',
   'Provide 3–6 useful, testable product directions; give steps to validate with a physical blank and unit-cost data.',
   'Return readable plain English under 1500 words, not JSON.',
   JSON.stringify({product:name,category,audience,equipment})
  ].join('\n');
  const response=await fetch('https://api.openai.com/v1/responses',{
   method:'POST',headers:{'Authorization':'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:process.env.OPENAI_PRODUCT_RESEARCH_MODEL||'gpt-4.1',
    tools:[{type:'web_search',search_context_size:'medium'}],tool_choice:'required',
    input:prompt,max_output_tokens:1750}),signal:AbortSignal.timeout(24000)
  });
  if(!response.ok)return jsonResponse(502,{message:await aiFailure(response,'Product research')},event);
  const data=await response.json();
  const blocks=(data.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]);
  const report=blocks.map(x=>x.text||'').join('\n').slice(0,15000);
  if(!report)return jsonResponse(502,{message:'Research returned no source-supported answer.'},event);
  const refs=blocks.flatMap(x=>x.annotations||[]).filter(x=>x.type==='url_citation'&&/^https:\/\//.test(x.url||'')).map(x=>
   ({label:safe(x.title,150)||new URL(x.url).hostname,url:x.url,verified:false}));
  const references=[...new Map(refs.map(x=>[x.url,x])).values()].slice(0,16);
  await auditFunctionSecurity({functionName:'product-opportunity-research',action:'web-research',outcome:'success',userId:auth.user.id,role:auth.role,event,metadata:{product:name.slice(0,60)}});
  return jsonResponse(200,{research:report,references,review_required:true,confidence:'unverified',
   evidence_note:'Search results are research leads, not validated supplier availability, market demand, or approved manufacturing settings.'},event);
 }catch{return jsonResponse(500,{message:'Unable to conduct product research. Try a narrower item.'},event);}
}
