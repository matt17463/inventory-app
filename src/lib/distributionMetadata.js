// Pure metadata normalization shared by WooCommerce 4x6 labels and their tests.
const printable=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
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
