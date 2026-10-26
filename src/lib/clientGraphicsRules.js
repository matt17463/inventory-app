// Pure selection engine. No database writes, and never guesses on conflicting/missing rules.
const norm = value => String(value ?? '').trim().toLowerCase();
const FIELDS = ['garment_type','garment_style','garment_color','color_group','size_group','placement_name','process'];
export function resolveGraphicVariant({familyId, variants=[], rules=[], context={}, at=new Date()}={}) {
 if (!familyId) return {status:'missing-family'};
 const time = new Date(at).getTime();
 const approved = new Map(variants.filter(v=>String(v.family_id)===String(familyId) && v.state==='approved' && v.artwork_asset_id).map(v=>[String(v.id),v]));
 const eligible = rules.filter(rule => {
  if (String(rule.family_id)!==String(familyId) || rule.enabled!==true || !approved.has(String(rule.variant_id))) return false;
  if (rule.effective_from && time < new Date(rule.effective_from).getTime()) return false;
  if (rule.effective_until && time >= new Date(rule.effective_until).getTime()) return false;
  return FIELDS.every(field => !norm(rule[field]) || norm(rule[field])===norm(context[field]));
 }).map(rule=>({rule,variant:approved.get(String(rule.variant_id)),specificity:FIELDS.filter(field=>norm(rule[field])).length}));
 eligible.sort((a,b)=>Number(b.rule.priority)-Number(a.rule.priority) || b.specificity-a.specificity);
 if (!eligible.length) return {status:'unresolved',reason:'No approved matching artwork variant'};
 const top=eligible[0], tied=eligible.filter(x=>Number(x.rule.priority)===Number(top.rule.priority) && x.specificity===top.specificity);
 if (new Set(tied.map(x=>String(x.variant.id))).size>1) return {status:'conflict',reason:'Multiple equally ranked graphic variants',ruleIds:tied.map(x=>x.rule.id)};
 return {status:'resolved',variantId:top.variant.id,artworkAssetId:top.variant.artwork_asset_id,ruleId:top.rule.id,variantVersion:top.variant.version,dimensions:{width_inches:top.variant.width_inches,height_inches:top.variant.height_inches},process:top.variant.process};
}
