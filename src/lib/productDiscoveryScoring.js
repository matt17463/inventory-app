// Shared, deterministic scoring and safe AI-lead normalization.
// AI scores are provisional signals only, not verified sales history or approved production.
export const DISCOVERY_FOCUSES=[
 ['all','All product families'],['weddings','Weddings & Events'],
 ['coaches','Coach Recognition & Sports'],['business','Business Branding'],
 ['gifts','Personalized Gifts']
];
export const DISCOVERY_MACHINE_IDS=[
 'xtool_s1','xtool_p2','xtool_omni','roland_bn2','mopa_fiber','sawgrass_sg500','heat_press','sublimation_press'
];
export const DISCOVERY_CATEGORIES=['Weddings & Events','Sports & Coaches','Business Branding','Personalized Gifts','Other'];
export const cleanLeadText=(v,n=250)=>String(v??'').split('').map(ch=>ch.charCodeAt(0)<32||ch.charCodeAt(0)===127?' ':ch).join('').trim().slice(0,n);
export const clamp100=(v)=>Math.round(Math.max(0,Math.min(100,Number.isFinite(Number(v))?Number(v):0)));
export const normalizeLeadKey=(name)=>cleanLeadText(name,180).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function evidenceUrl(raw){
 try{
  const v=new URL(String(raw||''));
  if(v.protocol!=='https:'||v.username||v.password||v.port||v.hash||v.hostname.length>180||v.href.length>990)return null;
  if(v.hostname==='localhost'||v.hostname.endsWith('.local')||v.hostname.endsWith('.internal')||
     /^\d+\.\d+\.\d+\.\d+$/.test(v.hostname)||v.hostname.startsWith('['))return null;
  return v.href;
 }catch{return null;}
}
export function sanitizeDiscoveryLead(raw){
 const name=cleanLeadText(raw?.name,180);
 if(name.length<3) return null;
 const category=DISCOVERY_CATEGORIES.includes(raw.category)?raw.category:'Other';
 const machines=[...new Set((Array.isArray(raw.equipment)?raw.equipment:[])
  .filter(id=>DISCOVERY_MACHINE_IDS.includes(id)))];
 if(!machines.length)return null;
 const sources=(Array.isArray(raw.sources)?raw.sources:[]).slice(0,8)
  .map(s=>({url:evidenceUrl(s.url),title:cleanLeadText(s.title,180),source_type:
   ['manufacturer','supplier','marketplace','public_community'].includes(s.source_type)?s.source_type:'other',
   summary:cleanLeadText(s.summary,450)}))
  .filter(s=>s.url&&s.title.length>=3);
 const links=[...new Map(sources.map(s=>[s.url,s])).values()];
 if(!links.length)return null; // Uncited model suggestions are not persisted.
 return {name,category,audience:cleanLeadText(raw.audience,220),
  description:cleanLeadText(raw.description,1800),equipment:machines,
  keywords:(Array.isArray(raw.keywords)?raw.keywords:[]).slice(0,10).map(x=>cleanLeadText(x,55)).filter(Boolean),
  differentiation:clamp100(raw.differentiation),demand_indicator:clamp100(raw.demand_indicator),
  sources:links,risks:cleanLeadText(raw.risks,600),
  supplier_notes:cleanLeadText(raw.supplier_notes,700)};
}
export function candidateScore(lead,{crmSegments=[],supplierItems=[],approvedRecipeTypes=[]}={}){
 const crm=crmSegments.filter(x=>x.count>0);
 const name=normalizeLeadKey(lead.name);
 const words=new Set([...name.split(' '),...lead.keywords.flatMap(x=>normalizeLeadKey(x).split(' '))]
  .filter(x=>x.length>=4));
 const audience=(lead.audience+' '+lead.category+' '+lead.name).toLowerCase();
 const relevantSegments=crm.filter(x=>{
  const segment=normalizeLeadKey(x.segment);
  return segment&&segment.split(' ').some(w=>w.length>=4&&audience.includes(w))||
    (lead.category==='Sports & Coaches'&&/team|school|soccer|sport|club|coach/.test(segment))||
    (lead.category==='Weddings & Events'&&/wedding|event|venue|planner/.test(segment))||
    (lead.category==='Business Branding'&&/business|company|corporate|nonprofit/.test(segment));
 });
 const matchedItems=supplierItems.filter(i=>{
   const nameTokens=normalizeLeadKey([i.brand,i.style,i.description].join(' ')).split(' ');
   const overlap=nameTokens.filter(w=>words.has(w)&&w.length>=4).length;
   return overlap>=2;
 }).slice(0,5);
 const manufacturerRefs=lead.sources.filter(s=>s.source_type==='manufacturer'||s.source_type==='supplier').length;
 const communityRefs=lead.sources.filter(s=>s.source_type==='public_community'||s.source_type==='marketplace').length;
 const customer_fit=clamp100(Math.min(78,22+Math.min(38,relevantSegments.length*12)+
   (crm.length>0&&relevantSegments.length>0?12:0)));
 const demand_score=clamp100(Math.min(72,15+.35*lead.demand_indicator+
   Math.min(15,communityRefs*6)+Math.min(8,lead.sources.length*2)));
 const machineSupported=lead.equipment.length>0;
 const recipeMatch=lead.equipment.some(x=>approvedRecipeTypes.includes(x));
 const production_fit=clamp100(machineSupported?Math.min(76,52+(recipeMatch?12:0)+Math.min(12,matchedItems.length*4)):0);
 const differentiation_score=clamp100(Math.min(76,20+.54*lead.differentiation));
 return {customer_fit,demand_score,production_fit,differentiation_score,
  evidence_level:lead.sources.length>=3&&manufacturerRefs>=1&&communityRefs>=1?'researched_provisional':'early_provisional',
  evidence_notes:{
   crm_segments_considered:crm.length,crm_matching_segments:relevantSegments.map(x=>({segment:x.segment,count:x.count})).slice(0,8),
   catalog_rows_considered:supplierItems.length,
   matched_supplier_items:matchedItems.map(i=>({supplier:i.supplier,sku:i.supplier_sku,brand:i.brand,style:i.style,
     unit_cost:i.unit_cost==null?null:Number(i.unit_cost)})),
   manufacturer_supplier_links:manufacturerRefs,
   market_community_links:communityRefs,
   approved_recipe_machine_match:recipeMatch,
   price_assumption:'No supplier price is inferred. Product cost_model remains empty until shop verification.'
  }
 };
}
export const discoveryScore=score=>Math.round(
 .3*score.customer_fit+.25*score.demand_score+.25*score.production_fit+.2*score.differentiation_score);
