// Canonical graphic selections from Woo order line item metadata.
// Never infer a graphic identity from the readable label or SKU.
const normalize=s=>String(s??'').trim();
const guid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalize(s));
const entries=x=>Array.isArray(x?.meta_data)?x.meta_data:[];
const fromMeta=(line,keys)=>{for(const key of keys){const match=entries(line).find(m=>normalize(m.key).toLowerCase()===key.toLowerCase());if(match&&match.value!=null)return normalize(match.value)}return ''};
export function parseWooGraphicSelection(line){
 const id=fromMeta(line,['_sc_graphic_family_id','sc_graphic_family_id']);
 const label=fromMeta(line,['_sc_graphic_label','Graphic design','Graphic','Design']);
 return {status:guid(id)?'mapped':id?'invalid-id':label?'legacy-unmapped':'none',familyId:guid(id)?id:null,label,rawFamilyId:id||null};
}
export function wooGraphicCartMetadata({familyId,label}){
 if(!guid(familyId))throw Error('Invalid graphic family ID');
 return [{key:'_sc_graphic_family_id',value:familyId},{key:'_sc_graphic_label',value:normalize(label)}];
}
