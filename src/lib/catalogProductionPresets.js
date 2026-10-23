// Placement starter values are EDITABLE suggestions, not verified machine/garment settings.
// Sources: https://uploaddtf.com/pages/dtf-transfer-placement-guide
// https://gpisupplies.com/blogs/support-articles/dtf-transfer-size-chart-placement-guide
// https://dtfpapercompany.com/dtf-design-placement-size/
// https://assets.stahls.com/stahls/content/pdf/education/Heat_Printing_Placement_Tips.pdf
// https://blog.transferexpress.com/heat-transfer-placement-and-position-guide/
export const PLACEMENT_SOURCES = [
  {name:'UploadDTF transfer placement guide',url:'https://uploaddtf.com/pages/dtf-transfer-placement-guide'},
  {name:'GPI Supplies DTF placement guide',url:'https://gpisupplies.com/blogs/support-articles/dtf-transfer-size-chart-placement-guide'},
  {name:'DTF Paper Company design placement guide',url:'https://dtfpapercompany.com/dtf-design-placement-size/'},
  {name:'Stahls / Hotronix garment placement reference',url:'https://assets.stahls.com/stahls/content/pdf/education/Heat_Printing_Placement_Tips.pdf'},
  {name:'Transfer Express hoodie and left chest placement',url:'https://blog.transferexpress.com/heat-transfer-placement-and-position-guide/'},
];
const garmentTypes=['tee','hoodie','sweatshirt','polo'];
const groups=['Adult','Youth'];
const placements=['full_front','left_chest','full_back'];
function suggestion(garment,sizeGroup,zone){
  const youth=sizeGroup==='Youth';
  if(zone==='left_chest') return {
    width:youth?3:3.5, height:youth?3:3.5,
    top:youth?2.25:3, landmark:'Bottom of front collar seam',
    instructions:"Wearer's LEFT chest. Locate horizontally over the left pectoral area; measure from center fold on the actual blank. Do not infer a left/right numeric sign from the diagram.",
  };
  if(zone==='full_back') return {
    width:youth?8:11, height:youth?8:12, top:garment==='hoodie'?(youth?4.5:5.5):(youth?2.5:3.5),
    landmark:'Bottom of back collar seam',
    instructions:'Center between side seams; hoodie backs start lower to clear the lowered hood (Transfer Express suggests roughly 5–6 inches for adult hoodies). Verify actual hood coverage, names/numbers, and logo aspect ratio.',
  };
  return {
    width:youth?8:(garment==='hoodie'?10:11),
    height:youth?8:(garment==='hoodie'?10:11),
    top:youth?2.5:(garment==='hoodie'?3.5:3.25),
    landmark:'Bottom of front collar seam',
    instructions:'Center on garment fold. For hoodies avoid the pocket/zipper; adjust for artwork shape and brand/size. Measure a real sample.',
  };
}
export const DTF_STARTER_PRESETS=garmentTypes.flatMap(garment=>groups.flatMap(sizeGroup=>
 placements.map(zone=>{
  const s=suggestion(garment,sizeGroup,zone);
  const readable=zone.replaceAll('_',' ');
  const name=`Starter · DTF · ${garment} · ${sizeGroup} · ${readable}`;
  return {
    key:`dtf:${garment}:${sizeGroup.toLowerCase()}:${zone}`,name,garment_type:garment,
    decoration_method:'DTF',size_group:sizeGroup,placement_name:zone,
    placements:[{
      placement_name:zone, size_group:sizeGroup,
      print_width_inches:s.width,print_height_inches:s.height,
      top_offset_inches:s.top,center_offset_inches:0,
      reference_landmark:s.landmark,
      instructions:s.instructions,
    }],
    process_steps:[
      {label:'Verify job and blank',instruction:'Match customer, order, SKU, size, color, and approved garment.'},
      {label:'Check approved artwork',instruction:'Verify exact customer file, placement, size, orientation and client proof.'},
      {label:'Confirm pressing specification',instruction:'Select the actual transfer and fabric manufacturer instructions; NEVER assume temperature, dwell, pressure or peel.'},
      {label:'Apply and check',instruction:'Use approved equipment/safety procedures and verify adhesion, image quality and placement.'},
      {label:'QC and packing',instruction:'Complete official QC; label and pack by customer/order instructions.'},
    ],
    packaging:{method:'Fold or pack per order',labeling:'Identify size and order',customer_notes:'Verify personalization and group distribution.'},
    production_notes:'UNVERIFIED STARTER GUIDANCE. Placement is a starting point, not a calibrated production instruction. No heat-press settings preapproved. Sources: '+PLACEMENT_SOURCES.map(x=>x.url).join(' ; '),
    verified_sample:false,status:'draft',
  };
})));
export function classifyCatalogFamily(name){
 const text=String(name||'').toLowerCase();
 let garment='other';
 if(/hoodie|hooded|pullover|zip[- ]?hood/.test(text))garment='hoodie';
 else if(/sweatshirt|crewneck|crew neck/.test(text))garment='sweatshirt';
 else if(/polo/.test(text))garment='polo';
 else if(/t[- ]?shirt|\btee\b|short[- ]?sleeve/.test(text))garment='tee';
 else if(/jersey/.test(text))garment='jersey';
 else if(/mug|tumbler|cup/.test(text))garment='drinkware';
 else if(/hat|cap|beanie/.test(text))garment='headwear';
 else if(/patch/.test(text))garment='patch';
 const method=/\bdtf\b/.test(text)?'DTF':/sublimat/.test(text)?'Sublimation':/embroid/.test(text)?'Embroidery':/laser/.test(text)?'Laser':/\buv\b/.test(text)?'Omni UV':'Needs review';
 return {garment,method,confidence:'review_required'};
}
export function readinessStatus(family,assignment,versions=[]){
 if(assignment?.disposition==='fulfillment_only')return 'Fulfillment only';
 if(!assignment||assignment.disposition==='review')return 'Needs assignment';
 if(!assignment.recipe_id)return 'Needs assignment';
 const approved=versions.some(x=>x.recipe_id===assignment.recipe_id&&x.status==='approved');
 return approved?'Approved recipe linked':'Awaiting physical approval';
}
