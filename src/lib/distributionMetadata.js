// Pure metadata normalization shared by WooCommerce 4x6 labels and their tests.
const printable=value=>Array.from(String(value??'')).map(char=>{const code=char.codePointAt(0);return code<32||code===127?' ':char;}).join('').trim();
const cleanValue=value=>printable(value).slice(0,120);
const distributionAliases={
 student:'student name|student|child name|recipient name|player name|athlete name',
 teacher:'teacher name|teacher|homeroom teacher|homeroom',
 coach:'coach name|coach|head coach',
 playerNumber:'player number|jersey number|jersey #|number',
 grade:'grade|grade level|student grade|students grade|students grade level|student s grade|year',
 team:'team assignment|team name|team|class|classroom',
 appliedName:'name applied|name on back|personalized name|custom name|player name on back|name text',
 school:'school|school name',
};
export const canonicalDistributionMetaLabel=value=>printable(value).normalize('NFKC').toLowerCase()
 .replace(/[\u2018\u2019\u02bc]/g,"'").replace(/['’]s\b/g,'s')
 .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
export function deriveDistributionFields(source,overrides={}){
 const found={};
 for(const [field,aliases] of Object.entries(distributionAliases)){
  const keys=new Set(aliases.split('|').map(canonicalDistributionMetaLabel));
  const values=new Set();
  for(const line of source?.lines||[])for(const meta of line.metadata||[]){
   if(keys.has(canonicalDistributionMetaLabel(meta.label)))values.add(cleanValue(meta.value));
  }
  const unique=[...values].filter(Boolean);
  found[field]=cleanValue(overrides[field]||(unique.length===1?unique[0]:unique.length>1?'MULTIPLE - SEE PACKING LIST':''));
 }
 return found;
}

const preferredFields=['student','teacher','grade','coach','school','team','playerNumber','appliedName'];
const priorityExtras=['logo selection','logo','color','size'];
// Determine what the customer actually supplied on Woo's order lines.
// A saved label preset is a preference, not a reason to lose customer data.
export function distributionLabelRows(source,overrides={},design={}){
 const fields=deriveDistributionFields(source,overrides);
 const labels=design.labels||{};
 const enabled=new Set(design.visible||[]);
 const entries=[];
 const used=new Set();
 for(const id of preferredFields){
  const value=fields[id];
  if(!value)continue;
  const text=String(labels[id]||id).trim().toUpperCase();
  entries.push({label:text,value,field:id,configured:enabled.has(id)});
  used.add(id);
 }
 const known=new Set(Object.values(distributionAliases).flatMap(v=>v.split('|').map(canonicalDistributionMetaLabel)));
 const grouped=new Map();
 for(const line of source?.lines||[])for(const meta of line.metadata||[]){
  const key=canonicalDistributionMetaLabel(meta.label);
  const value=cleanValue(meta.value);
  if(!key||!value||key.startsWith('_')||known.has(key)||/(internal|cost|margin|secret|password|token)/.test(key))continue;
  if(!grouped.has(key))grouped.set(key,{label:cleanValue(meta.label).replace(/[:\s]+$/g,''),values:new Set()});
  grouped.get(key).values.add(value);
 }
 const extras=[...grouped.entries()].map(([key,record])=>({label:record.label.toUpperCase(),value:record.values.size===1?[...record.values][0]:'MULTIPLE - SEE PACKING LIST',field:key}));
 extras.sort((a,b)=>{
  const pa=priorityExtras.indexOf(a.field),pb=priorityExtras.indexOf(b.field);
  return (pa<0?99:pa)-(pb<0?99:pb);
 });
 return {rows:[...entries,...extras],totalAvailable:entries.length+extras.length};
}
