import {createHash} from 'node:crypto';

export const MIGRATION_VERSION=1;
export const logoAttribute=a=>/(^|[^a-z])(logo|graphic|design|artwork)([^a-z]|$)/i.test([a.name,a.slug].join(' '));
export const normalizeChoice=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
const uuid=v=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(v||''));
export function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
 return value;
}
export const fingerprint=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
export function applyMappingTemplate(target,source){
 return Object.fromEntries(Object.entries(target).map(([choice,current])=>{
  const shared=source[choice];
  return [choice,shared?{...current,family_id:shared.family_id||'',artwork_asset_id:shared.artwork_asset_id||'',variant_id:shared.variant_id||'',recipe_version_id:shared.recipe_version_id||'',label:shared.label||current.label,output_by_image:{}}:{...current}];
 }));
}
export function physicalKey(attributes){
 return JSON.stringify(attributes.filter(a=>!logoAttribute(a)).map(a=>[String(a.id||a.slug||a.name).toLowerCase(),normalizeChoice(a.option??a.value)]).sort((a,b)=>a[0].localeCompare(b[0])));
}
const commerceKeys=['regular_price','sale_price','date_on_sale_from','date_on_sale_to','tax_status','tax_class','manage_stock','stock_quantity','stock_status','backorders','weight','dimensions','shipping_class_id','virtual','downloadable','sold_individually'];
export function buildMigrationPlan({product,variations,complete=true,mappings={},canonical={},snapshotHash=null}){
 const blockers=[],groups=new Map(),source={product,variations:[...variations].sort((a,b)=>a.id-b.id)};
 const id=Number(product?.id);
 if(!Number.isSafeInteger(id)||id<1||product.type!=='variable')throw Error('An exact variable Woo parent is required.');
 if(!complete)blockers.push('Variation pagination is incomplete.');
 const logos=(product.attributes||[]).filter(logoAttribute);
 if(logos.length!==1||!logos[0]?.variation)blockers.push('Exactly one active logo variation attribute must be reviewed.');
 const choices=(logos[0]?.options||[]).map(normalizeChoice);
 if(!choices.length||new Set(choices).size!==choices.length)blockers.push('Logo choices are missing or ambiguous after normalization.');
 if(!variations.length||new Set(variations.map(v=>v.id)).size!==variations.length)blockers.push('Variation IDs are missing or duplicated.');
 for(const v of source.variations){
  if(!Number.isSafeInteger(v.id)||v.parent_id&&Number(v.parent_id)!==id)blockers.push('Variation belongs to another parent or has an invalid ID.');
  const attrs=v.attributes||[],ls=attrs.filter(logoAttribute),physical=attrs.filter(a=>!logoAttribute(a));
  const logo=normalizeChoice(ls[0]?.option);
  if(ls.length!==1||!choices.includes(logo))blockers.push(`Variation ${v.id}: missing, unknown or ambiguous logo.`);
  if(!physical.length||physical.some(a=>!normalizeChoice(a.option)))blockers.push(`Variation ${v.id}: wildcard physical attributes require individual review.`);
  if(v.manage_stock===true)blockers.push(`Variation ${v.id}: independent logo stock cannot be collapsed into one physical stock pool automatically.`);
  const key=physicalKey(attrs),g=groups.get(key)||{key,physical_attributes:physical,variations:[]};g.variations.push(v);groups.set(key,g);
 }
 const options=[],crosswalk=[],operations=[];
 for(const choice of choices){
  const m=mappings[choice];
  if(!m||![m.family_id,m.variant_id,m.artwork_asset_id,m.recipe_version_id].every(uuid)||!String(m.label||'').trim())blockers.push(`Logo ${choice}: select exact canonical family, artwork variant and approved recipe.`);
  if(Number(m?.fee||0)!==0)blockers.push(`Logo ${choice}: price parity requires zero migration surcharge.`);
  options.push({id:m?.family_id||'',label:String(m?.label||'').trim(),variant_id:m?.variant_id||'',artwork_asset_id:m?.artwork_asset_id||'',recipe_version_id:m?.recipe_version_id||'',fee:0,variation_ids:[],images:{}});
 }
 if(new Set(options.map(o=>o.id).filter(Boolean)).size!==options.filter(o=>o.id).length)blockers.push('Mutually exclusive legacy choices must map to distinct canonical graphic families.');
 for(const g of groups.values()){
  const signatures=new Set(g.variations.map(v=>JSON.stringify(commerceKeys.map(k=>v[k]??null))));
  if(signatures.size!==1)blockers.push(`Physical group ${g.key}: price, stock, tax, shipping or sale settings differ.`);
  const terms=g.variations.map(v=>normalizeChoice(v.attributes.find(logoAttribute)?.option));
  if(new Set(terms).size!==terms.length)blockers.push(`Physical group ${g.key}: duplicate logo/physical combination.`);
  const selected=Number(canonical[g.key]);
  const winner=g.variations.find(v=>v.id===selected);
  if(!winner)blockers.push(`Physical group ${g.key}: explicitly select the retained physical variation ID.`);
  for(const v of g.variations){
   const logo=normalizeChoice(v.attributes.find(logoAttribute)?.option),m=mappings[logo],option=options[choices.indexOf(logo)];
   const output=m?.output_by_image?.[String(v.image?.id||0)];
   if(!v.image?.id||!v.image?.src||!uuid(output))blockers.push(`Variation ${v.id}: link its existing image to an exact approved mockup output.`);
   if(option&&winner){option.variation_ids.push(winner.id);option.images[winner.id]={...v.image,output_id:output||null};}
   crosswalk.push({legacy_variation_id:v.id,physical_variation_id:winner?.id||null,legacy_logo:logo,family_id:m?.family_id||null,sku:v.sku||'',image_id:v.image?.id||null});
  }
  operations.push({physical_key:g.key,canonical_id:winner?.id||null,physical_attributes:g.physical_attributes,archive_ids:g.variations.filter(v=>v.id!==winner?.id).map(v=>v.id)});
 }
 const plan={version:MIGRATION_VERSION,parent_id:id,source_hash:snapshotHash||fingerprint(source),baseline:source,options,crosswalk,operations,blockers:[...new Set(blockers)],counts:{before:variations.length,after:groups.size,retained:groups.size,archived:variations.length-groups.size,deleted:0},operation:'reversible_logo_consolidation'};
 return {...plan,plan_hash:fingerprint(plan),ready:plan.blockers.length===0};
}

// All reads must succeed. A preflight pass, family name, filename or legacy image
// is never sufficient to establish customer consent or a tested process.
export async function reviewMigrationEvidence(db,plan){
 const blockers=[],evidence=[];
 async function read(table,query){const {data,error}=await query(db.from(table));if(error)throw Error(`Unable to verify ${table}; migration held.`);return data;}
 for(const option of plan.options){
  if(![option.id,option.variant_id,option.artwork_asset_id,option.recipe_version_id].every(uuid)){blockers.push('Canonical artwork mapping is incomplete.');continue;}
  const [family,variant,recipe,art,rules,binding,revisions]=await Promise.all([
   read('sc_client_graphic_families',q=>q.select('*').eq('id',option.id).maybeSingle()),
   read('sc_client_graphic_variants',q=>q.select('*').eq('id',option.variant_id).maybeSingle()),
   read('sc_manufacturing_recipe_versions',q=>q.select('*').eq('id',option.recipe_version_id).maybeSingle()),
   read('mockup_artwork_assets',q=>q.select('*').eq('id',option.artwork_asset_id).maybeSingle()),
   read('sc_client_graphic_rules',q=>q.select('*').eq('family_id',option.id).eq('variant_id',option.variant_id).eq('enabled',true)),
   read('sc_client_graphic_product_bindings',q=>q.select('*').eq('woo_product_id',plan.parent_id).eq('graphic_family_id',option.id).maybeSingle()),
   read('sc_artwork_object_revisions',q=>q.select('*').eq('artwork_asset_id',option.artwork_asset_id))
  ]);
  if(family?.state!=='approved'||!['selectable','fixed'].includes(family?.storefront_visibility))blockers.push(`${option.label}: family must be approved and customer-visible.`);
  if(variant?.family_id!==option.id||variant?.state!=='approved'||variant?.artwork_asset_id!==option.artwork_asset_id)blockers.push(`${option.label}: exact artwork variant is not approved.`);
  if(recipe?.status!=='approved'||!recipe?.verified_sample||!recipe?.approved_by)blockers.push(`${option.label}: approved physically verified production recipe missing.`);
  if(!art?.exact_artwork_locked||!['passed','approved','ready'].includes(art?.preflight_status))blockers.push(`${option.label}: locked passed artwork missing.`);
  if(!binding?.allowed||!binding?.verified_at||!['selectable','fixed'].includes(binding?.mode))blockers.push(`${option.label}: manager-verified product binding missing.`);
  if(!rules?.length)blockers.push(`${option.label}: active manufacturing rule missing.`);
  if(!(revisions||[]).some(r=>new Date(r.asset_updated_at).getTime()===new Date(art?.updated_at).getTime()&&r.storage_path===art.storage_path&&r.storage_bucket===art.storage_bucket&&r.storage_provider===art.storage_provider))blockers.push(`${option.label}: current artwork checksum registration missing.`);
  const proofs=[];
  for(const outputId of [...new Set(Object.values(option.images).map(i=>i.output_id))]){
   if(!uuid(outputId)){blockers.push(`${option.label}: exact image/output association missing.`);continue;}
   const output=await read('mockup_outputs',q=>q.select('*').eq('id',outputId).maybeSingle());
   const placement=output?.placement_id?await read('mockup_placements',q=>q.select('*').eq('id',output.placement_id).maybeSingle()):null;
   const project=output?.project_id?await read('mockup_projects',q=>q.select('id,woo_product_id').eq('id',output.project_id).maybeSingle()):null;
   const [native,external]=await Promise.all([
    read('mockup_reviews',q=>q.select('*').eq('output_id',outputId).order('created_at',{ascending:false}).limit(1)),
    read('sc_external_mockup_approvals',q=>q.select('*').eq('output_id',outputId).order('recorded_at',{ascending:false}).limit(1))
   ]);
   const n=native?.[0],e=external?.[0],decision=e&&(!n||new Date(e.recorded_at)>new Date(n.created_at))?{decision:e.decision,time:e.recorded_at,id:e.id}:n?.review_token_id?{decision:n.decision,time:n.created_at,id:n.id}:null;
   if(!output?.is_selected||!['internal_approved','customer_approved'].includes(output?.approval_status)||placement?.artwork_asset_id!==option.artwork_asset_id
    ||project?.woo_product_id!==plan.parent_id||placement?.project_id!==output?.project_id)blockers.push(`${option.label}: selected output does not match this product and reviewed artwork.`);
   if(decision?.decision!=='approved'||new Date(decision.time)<new Date(Math.max(...[art?.updated_at,placement?.updated_at,output?.updated_at].map(v=>new Date(v||0).getTime()))))blockers.push(`${option.label}: current genuine customer approval missing.`);
   proofs.push({output,placement,decision});
  }
  evidence.push({family,variant,recipe,art,rules,binding,revisions,proofs});
 }
 return {ready:blockers.length===0,blockers:[...new Set(blockers)],evidence_hash:fingerprint(evidence)};
}
