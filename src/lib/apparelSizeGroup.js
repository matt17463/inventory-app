// Deterministic apparel size codes; unknown and ambiguous catalog labels stay unresolved.
const adult=new Set(['XS','S','M','L','XL','2XL','3XL','4XL','5XL','XXL','XXXL','AS','AM','AL','AXL','A2XL','A3XL','A4XL']);
const youth=new Set(['YXS','YS','YM','YL','YXL','YXXL','Y2XL']);
export function apparelSizeGroup(size){
 const code=String(size??'').trim().toUpperCase().replace(/\\s+/g,'');
 if(adult.has(code))return 'adult';
 if(youth.has(code))return 'youth';
 if(code==='ADULT')return 'adult';
 if(code==='YOUTH')return 'youth';
 return '';
}
