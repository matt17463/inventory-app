import { authorizeEmployee, jsonResponse, auditFunctionSecurity } from './_shared/security.js';

const EQUIPMENT = new Set(['mopa_fiber','xtool_s1','xtool_p2','xtool_omni','heat_press','sublimation_press']);
const OPERATIONS = new Set(['color_engrave','etch','score','cut','engrave','uv_flat','uv_texture','uv_relief','uv_varnish','heat_transfer','sublimation']);
const LASERS = new Set(['mopa_fiber','xtool_s1','xtool_p2']);
const DANGEROUS = /(?:^|\W)(?:pvc|polyvinyl chloride|vinyl|vinyl chloride|chlorinated plastic|unknown plastic|unidentified plastic)(?:$|\W)/i;
const clip=(v,n=250)=>String(v??'').trim().slice(0,n);
function bodyResponse(status, data, event) {return jsonResponse(status,data,event);}
function stripUngroundedNumbers(input){
  // This endpoint currently has no server-verified numerical manufacturer records.
  // Prevent model-generated power/speed/temperature numbers from reaching the UI as advice.
  if(typeof input==='number')return 'verify in manufacturer manual and coupon test';
  if(typeof input==='string' && /\d\s*(?:%|°|mm\/s|mm|cm\/s|kHz|MHz|ns|s|sec|seconds|watts?|W\b|F\b|C\b)/i.test(input))
    return 'verify exact numeric setting in manufacturer manual and coupon test';
  if(Array.isArray(input))return input.slice(0,24).map(stripUngroundedNumbers);
  if(input&&typeof input==='object')return Object.fromEntries(Object.entries(input).slice(0,50).map(([k,v])=>[k,stripUngroundedNumbers(v)]));
  return input;
}
function cleanSources(sources) {
  return (Array.isArray(sources)?sources:[]).slice(0,4).map(x=>({
    label: clip(x?.label,120), url:clip(x?.url,500),
    provenance:clip(x?.provenance,80), verified: x?.verified===true
  })).filter(x=>x.label);
}
export async function handler(event) {
  if(event.httpMethod==='OPTIONS')return bodyResponse(204,{},event);
  if(event.httpMethod!=='POST')return bodyResponse(405,{message:'Use POST'},event);
  const auth=await authorizeEmployee(event,{functionName:'material-settings-ai',allowedRoles:['admin','manager','operator']});
  if(!auth.ok)return bodyResponse(auth.statusCode,{message:auth.message},event);
  try {
    const body=JSON.parse(event.body||'{}');
    const machine=clip(body.machine_type,40), operation=clip(body.operation,40),
      material=clip(body.material_name,180), model=clip(body.machine_model,160),
      configuration=clip(body.machine_configuration,400), finish=clip(body.material_finish,160),
      brand=clip(body.material_brand,160), thickness=clip(body.thickness_mm,30),
      notes=clip(body.notes,1500);
    if(!EQUIPMENT.has(machine)||!OPERATIONS.has(operation)||material.length<2)return bodyResponse(400,{message:'Equipment, material and process are required.'},event);
    if(LASERS.has(machine)&&DANGEROUS.test(material+' '+notes+' '+finish))
      return bodyResponse(422,{blocked:true,message:'Do not laser PVC, vinyl chloride, or unidentified plastics. Check the manufacturer SDS and use a safe alternative.'},event);
    if(!model || !configuration)
      return bodyResponse(422,{message:'Enter the exact machine model/module and configuration (wattage or ink/press setup) before requesting settings.'},event);
    // Source-link truth cannot be confirmed from client-supplied flags. Treat all as unverified.
    const unverifiedLinks=cleanSources(body.sources).map(s=>({...s,verified:false}));
    const vetted=[];
    const key=process.env.OPENAI_API_KEY;

    if(body.mode==='research'){
      if(!key)return bodyResponse(503,{message:'Configure the server-only OPENAI_API_KEY for live manufacturer research.'},event);
      const request={machine_type:machine,machine_model:model,machine_configuration:configuration,
        operation,material_name:material,brand,finish,thickness,notes};
      const task='Find manufacturer or supplier operating recommendations for the EXACT machine module and EXACT identified material, not a generic material family. '+
        'Prefer xTool official support for S1/P2/Omni, the laser OEM/controller for MOPA, and heat-transfer/substrate makers for presses. '+
        'Document source URLs and critical conditions. If sources do not establish numerical values, say insufficient evidence. '+
        'Do not give a ready-to-run recipe when the exact variant is not confirmed. Never encourage laser processing PVC or unknown plastics. '+
        'Mention ventilation, PPE, fire precautions, substrate coatings and test coupons. '+
        'Return concise plain English with direct source links and indicate if a value is manufacturer or community-provided. Input: '+JSON.stringify(request);
      const response=await fetch('https://api.openai.com/v1/responses',{
        method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
        body:JSON.stringify({
          model:process.env.OPENAI_MATERIAL_RESEARCH_MODEL||'gpt-4.1',
          tools:[{type:'web_search',search_context_size:'medium'}],
          tool_choice:'required',
          input:task,max_output_tokens:1800
        }),signal:AbortSignal.timeout(95000)
      });
      if(!response.ok)return bodyResponse(502,{message:'Live manufacturer research is unavailable. Refer to saved approved recipes.'},event);
      const data=await response.json();
      const messages=(data.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]);
      const report=messages.map(x=>x.text||'').join('\n').slice(0,14000);
      const references=messages.flatMap(x=>x.annotations||[]).filter(a=>a.type==='url_citation'&&/^https:\/\//.test(a.url||''))
        .map(a=>({label:clip(a.title,160)||new URL(a.url).hostname,url:a.url,provenance:'live web research; confirm source applicability',verified:false}));
      const unique=[...new Map(references.map(a=>[a.url,a])).values()].slice(0,20);
      if(!report)return bodyResponse(502,{message:'Live research did not return a source-grounded result.'},event);
      await auditFunctionSecurity({functionName:'material-settings-ai',action:'research',outcome:'success',userId:auth.user.id,role:auth.role,event,metadata:{machine,operation}});
      return bodyResponse(200,{research:report,references:unique,review_required:true,confidence:'unverified',
        evidence_note:'Live web findings are suggestions, not verified manufacturer matches or production-approved settings. Compare cited manuals and test a coupon.'},event);
    }

    if(!key)return bodyResponse(503,{message:'AI suggestions are not configured. Existing verified recipes remain available.'},event);
    const requestContext={
      machine_type:machine,machine_model:model,machine_configuration:configuration,
      operation,material_name:material,material_brand:brand,material_finish:finish,thickness_mm:thickness,notes,known_reference_links:vetted,user_reference_links_unverified:unverifiedLinks
    };
    const system=[
      'You are a manufacturing prepress assistant for Skilled Crafting. Your answer is a cautious TEST PLAN, never a production guarantee.',
      'Return JSON only: {"summary":string,"candidate_settings":object,"test_steps":string[],"warnings":string[],"questions":string[],"evidence_note":string}.',
      'You cannot browse. Never fabricate manufacturer sources, settings, datasheets, observed outcomes, certification, or citations.',
      'Use precise numeric speed, power, temperature, frequency, pulse-width, depth or timing ONLY if those are explicitly supplied in known_reference_links or user-provided observed data. References are informational, not necessarily authoritative.',
      'If source settings are missing, candidate_settings should use descriptive ranges ("low", "medium") or "verify with manufacturer" rather than invented numbers. State which inputs to verify.',
      'For MOPA identify pulse frequency, duration, hatch strategy and wattage/lens dependency. For xTool diode and CO2 identify installed module and material limitations. For Omni texture distinguish design relief maps from actual passes in xTool Studio.',
      'For heat press and sublimation require specific carrier/substrate manufacturer recommendations before suggesting numeric time or heat.',
      'Warn against laser processing PVC, vinyl chloride, unknown/coated plastics; acknowledge fumes, fire safety, ventilation, eye safety and clamp/setup.',
      'Never suggest defeating interlocks, running unattended, unsafe coatings, or treating an AI output as verified.',
      'Close with instruction to print a small test coupon, inspect result, record material lot and physically approve.',
    ].join('\n');
    const response=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:process.env.OPENAI_MATERIAL_SETTINGS_MODEL||'gpt-4.1-mini',
        messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(requestContext)}],
        response_format:{type:'json_object'},max_completion_tokens:1300
      }),
      signal:AbortSignal.timeout(40000)
    });
    if(!response.ok)return bodyResponse(502,{message:'Settings AI is temporarily unavailable.'},event);
    const result=await response.json();
    const suggestion=JSON.parse(result?.choices?.[0]?.message?.content||'{}');
    if(!suggestion||typeof suggestion!=='object'||Array.isArray(suggestion))throw Error('Malformed model output');
    const output={
      summary:clip(suggestion.summary,1200),
      candidate_settings:suggestion.candidate_settings&&typeof suggestion.candidate_settings==='object'&&!Array.isArray(suggestion.candidate_settings)?stripUngroundedNumbers(suggestion.candidate_settings):{},
      test_steps:(Array.isArray(suggestion.test_steps)?suggestion.test_steps:[]).slice(0,9).map(x=>clip(x,400)),
      warnings:(Array.isArray(suggestion.warnings)?suggestion.warnings:[]).slice(0,8).map(x=>clip(x,400)),
      questions:(Array.isArray(suggestion.questions)?suggestion.questions:[]).slice(0,6).map(x=>clip(x,260)),
      evidence_note:'AI-generated test plan. No manufacturer website was queried; numeric settings require independently verified documentation. Not approved for production.',
      review_required:true,confidence:'unverified',sources:unverifiedLinks
    };
    await auditFunctionSecurity({functionName:'material-settings-ai',action:'suggest',outcome:'success',userId:auth.user.id,role:auth.role,event,metadata:{machine,operation}});
    return bodyResponse(200,output,event);
  } catch {
    return bodyResponse(500,{message:'Unable to prepare the settings test plan.'},event);
  }
}
