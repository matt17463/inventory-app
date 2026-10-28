/**
 * Evidence-backed starting cards for the Roland BN2-30.
 * These are NOT installed ICC profiles or production-approved recipes.
 * Physical print, cut, wash/adhesion checks and exact ink/profile confirmation are mandatory.
 */
const roland = 'https://downloadcenter.rolanddg.com/contents/manuals/BN2-20_USE_EN/lsa1763603688292.html';
const profileHelp = 'https://downloadcenter.rolanddg.com/contents/manuals/VW6_USE_English/sun1663827157578.html';
const cutHelp = 'https://downloadcenter.rolanddg.com/contents/manuals/BN2-20_MOV_EN/';
const common = [
  'Check the loaded roll width, total roll weight (maximum 12 kg/26.46 lb), roll diameter (maximum 165 mm) and pinch roller placement.',
  'Run a nozzle check, media feed calibration and print/cut alignment for this material; do not transfer calibrations between materials or laminate states.',
  'Choose a confirmed profile for the exact BN2-30 ink configuration in VersaWorks. Use High Quality for a first color/detail comparison, not an invented pass count.',
  'Print an ink-limit/color test. Start with the BN2-30 supported print heater 35°C and dryer 35°C; never enter a higher unsupported setpoint. Reduce heat if buckling and extend dry time if ink remains tacky.',
  'Use the built-in test cut on the actual media before production. Blade extension, force, cut speed and offset are determined by the cut test, not copied blindly from other models.'
];
export const BN2_LIMITS = Object.freeze({maxWidthIn:30,maxPrintWidthIn:28.97,maxRollKg:12,maxRollDiameterMm:165,printHeaterC:[30,35],dryerC:[30,38]});
const entry=(id,name,brand,sku,widthIn,category,finish,description,profile,cut,post,press,notes,sources,thicknessMm=null)=>({
  id,name,brand,sku,widthIn,category,finish,description,profile,cut,post,press,
  notes:[...common,...notes],sources,thicknessMm,status:'Unverified starting recipe'
});
export const BN2_MEDIA = [
entry('substance-pm3755','Substance ICON PM-3755','Substance','PM-3755',30,'Adhesive vinyl','Gloss · 3.75 mil',
  'Polymeric printable pressure-sensitive vinyl with FLO air-release adhesive. Good for flat decals, stickers, signs and murals.',
  'Check Substance ICC library and Roland DG Connect for an exact BN2-30 / installed ink profile; a BN2-20 profile is not automatically interchangeable.',
  'Kiss cut with a material-specific blade/force test; test again after any overlaminate. Laminate, then use crop marks to align a contour cut when removing the film.',
  'Wait 24–48 hours for solvent-ink outgassing before laminating (Substance guidance). Check adhesive strength on the actual substrate.',
  null,
  ['Prefer flat applications; do not promise conformability for vehicle wrap recesses.'],
  [{label:'Substance PM-3755 product',url:'https://substance.com/products/icon-pm-3755'},{label:'Substance ICC profile finder',url:'https://substance.com/pages/icc-profiles'},{label:'Substance lamination FAQ',url:'https://substance.com/pages/faq'}],0.095
),
entry('siser-colorprint-pu','Siser ColorPrint PU','Siser','ColorPrint PU',20,'Printable HTV','Matte / gloss · 80 μm',
  'Eco-solvent printable polyurethane heat-transfer film for shirts, performancewear and bags.',
  'Select an exact Siser/Roland-compatible eco-solvent profile for BN2-30; use a matching PU/printable-HTV template only as a proofing baseline.',
  'Siser suggests a 45° blade and ~65 gf on its generic cutter guidance; BN2-30 force must be established by its own kiss-cut test. Weed and mask with Siser TTD Easy or High Tack.',
  'Heavy ink coverage: Siser North America recommends 1 hour drying before cutting. Its 45°C heater/dryer recommendation exceeds BN2-30 supported settings; use supported 35/35°C starting point and check drying.',
  {temperatureF:295,seconds:'15–20',pressure:'Medium',peel:'Hot',mask:'TTD Easy or TTD High Tack',notes:'Siser North America lists 295°F (146°C); other Siser international documents list 155°C. Use product/region lot-specific sheet and test.'},
  ['Prepress garment 2–3 seconds, press under cover sheet, peel mask hot. Wait 24 hours before first wash.','Avoid dyed/sublimated fabric unless separately tested for dye migration.'],
  [{label:'Siser North America digital media instructions',url:'https://www.siserna.com/files/digital-media-instructions.pdf'},{label:'Siser ColorPrint PU product',url:'https://www.siser.com/digital-printing/colorprint-pu/'}],0.08
),
entry('roland-heatsoft-htmp','Roland HeatSoft PREMIUM ESM-HTMP','Roland DGA','ESM-HTMP-75-20',20,'Printable HTV','Matte · 3.5 mil',
  'Printable polyurethane HTV for cotton, polyester, poly/cotton and stretch apparel. Actual roll width is approximately 19.66 in.',
  'First choice: exact Roland HeatSoft PREMIUM media/profile on BN2-30 in VersaWorks; check inkset and profile version.',
  'Kiss-cut polyester-lined material using the BN2 built-in test; weed and use Roland HeatSoft PLUS PGM-PTM2 medium-tack mask.',
  'Allow ink to dry before masking and transferring; use a physical rub/transfer test to confirm dry time.',
  {temperatureF:250,seconds:'10–15',pressure:'Medium',peel:'Hot',mask:'Roland HeatSoft PLUS PGM-PTM2',notes:'A difficult substrate may require altered dwell/temperature, up to 305°F with 5–7 seconds per Roland application guide; validate first.'},
  ['Use medium pressure on flatbed press; validate fabric and transfer compatibility before a production run.','Do not confuse ESM-HTMP PREMIUM with other Roland HeatSoft PLUS or SATIN films.'],
  [{label:'Roland HeatSoft PREMIUM product',url:'https://dgastore.rolanddga.com/printing/heatsoft-premium-heat-transfer-matl-20in-x-75ft-esm--htmp--75--20'},{label:'Roland HTMP + PTM2 application instructions',url:'https://dgastore.rolanddga.com/product/attachment/ESM-HTMP-75-20/HTMP_PTM2_Application%20Instructions.pdf'}],0.089
),
entry('greenstar-db10','Greenstar DB-10','Greenstar / USCutter','DB10',null,'Banner','Matte · 10 oz',
  'Single-sided frontlit 10 oz eco-solvent printable banner for indoor/outdoor short-term event signage.',
  'Select verified BN2 banner profile; if unavailable, proof the closest compatible matte-banner template with ink-limiting and feed checks.',
  'Print-only is preferred. Trim banners manually, then hem/grommet as required; a banner is not a sticker kiss-cut material.',
  'Verify complete drying before handling or stacking. Keep output supported to avoid ink marks; use stable room conditions.',
  null,
  ['IMPORTANT: DB10 roll length/width varies. A 30 in × 50 yd 10 oz roll may exceed the BN2-30 12 kg load limit once core weight is included. Weigh the full roll.','Never feed a heavy roll by forcing the take-up system or pinch rollers.'],
  [{label:'Greenstar digital banner product guide',url:'https://uscutter.com/content/PDFs/Greenstar-Digital-Banner-Product-Guide-041323.pdf'}]
),
entry('greenstar-db13','Greenstar DB-13','Greenstar / USCutter','DB13',null,'Banner','Matte or gloss · 13 oz',
  'Single-sided 13 oz eco-solvent printable banner for storefront, event and trade-show signage.',
  'Use appropriate verified BN2 banner profile for the exact DB13 finish. Test saturation and feed on a short sample first.',
  'Print-only; finish with hand trimming, hems and grommets. Do not select decal kiss-cut workflow.',
  'Allow full dry time before folding, hemming or stacking; verify scratch resistance on the finished print.',
  null,
  ['CRITICAL: 30 in × 50 yd 13 oz rolls exceed the BN2-30 12 kg roll-weight limit even before core/packaging; do not load full roll. Use a verified smaller roll or approved cut sheets.','Confirm exact width, length and mass of your DB13 roll; supplier also markets 20 in × 10 yd packs.'],
  [{label:'USCutter DB13 BN/BN2 product',url:'https://uscutter.com/greenstar-db13-printable-banner-material-13oz-single-sided-digital-banner-20-x-10-yd/'},{label:'Greenstar digital banner product guide',url:'https://uscutter.com/content/PDFs/Greenstar-Digital-Banner-Product-Guide-041323.pdf'}]
),
entry('orajet-3551','ORAJET 3551','ORAFOL','3551',20,'Adhesive vinyl','High-performance polymeric PVC · 2.75 mil',
  'Polymeric self-adhesive eco-solvent-printable film for longer-term, flatter signage and graphic applications; exact adhesive/finish varies by variant.',
  'Check ORAFOL ICC download for the exact BN2-30 and ECO-SOL MAX ink type; proof glossy/matte correct variant.',
  'Kiss cut after a test. Register crop marks and recalibrate alignment if laminating before contour cutting.',
  'ORAFOL Americas: allow at least 24 hours (48–72 preferred) at about 70°F before cutting to the ink or laminating. Check ORAGUARD 215 for flat graphics, or 290/293/297GF variants for the appropriate applications.',
  null,
  ['3551 polymeric film is not interchangeable with 3165 intermediate PVC; use distinct media/profiles. ORAFOL Americas standard widths start at 30 in, so confirm your 20 in roll was supplied as a professionally slit roll with original identification.','Confirm whether the roll is white/clear and matte/gloss before relying on the profile.'],
  [{label:'ORAFOL ORAJET 3551 technical product',url:'https://www.orafol.com/en/europe/products/orajet-3551'},{label:'ORAFOL Americas 3551 datasheet',url:'https://update.orafol.com/products/americas/en/technical-data-sheet/orajet-3551-id2772-technical-data-sheet-americas-en.pdf'}],0.07
),
entry('orajet-3165','ORAJET 3165','ORAFOL','3165',20,'Adhesive vinyl','White · gloss/matte · 4 mil',
  'Intermediate blended-PVC printable film with grey permanent adhesive, for flat stickers and medium-term signage.',
  'Find an ORAFOL ICC matching the BN2-30 and ink set, with exact gloss/matte variant; otherwise proof a calibrated compatible vinyl preset.',
  'Use BN2 test kiss cut; after optional lamination redo cut force test and print/cut registration. Not intended for vehicle wraps.',
  'Allow eco-solvent printing to outgas sufficiently before lamination; compatible laminates include ORAGUARD 210 or 215, plus 250AS/255AS for rated floor applications.',
  null,
  ['Do not market ORAJET 3165 as a vehicle-wrap film.','For floor decals use a specified anti-slip laminate and validate local requirements.'],
  [{label:'ORAFOL 3165 datasheet (May 2026)',url:'https://www.orafol.com/products/americas/en/technical-data-sheet/orajet-3165-id2945-technical-data-sheet-americas-en.pdf'},{label:'ORAFOL ORAJET 3165 product',url:'https://www.orafol.com/en/americas/products/orajet-3165'}],0.102
),
entry('siser-s-print','Siser S-Print','Siser','S-Print',20,'Printable HTV','Matte · 85 μm',
  'Low-temperature eco-solvent-printable PU heat transfer with soft hand; useful for lighter performance fabrics.',
  'Check Siser matching BN2-30 ICC print profile; start proofing with the correct printable-PU setting.',
  'Manufacturer generic cut guidance: 45° blade / 60 gf; do a BN2-specific test kiss cut. Weed, then apply suitable heat-resistant transfer mask.',
  'Verify ink is dry before masking, weeding or transfer; no machine-specific eco-solvent drying duration verified.',
  {temperatureF:'248°F (120°C) at ≤160 g/m²; 302°F (150°C) at >160 g/m²',seconds:'5 for light / 10 for heavier',pressure:'Medium (2.5–3.5 bar)',peel:'Hot',mask:'Manufacturer-compatible transfer tape',notes:'Choose press temperature by garment fabric weight; trial with actual garment.'},
  ['Prepress 2–3 seconds, then transfer at manufacturer weight-dependent time/temperature; wait 24 hours before first wash.','Avoid dye-sublimated or specially treated fabrics without dye-migration testing.'],
  [{label:'Siser S-Print official specification',url:'https://www.siser.com/digital-printing/s-print/'}],0.085
)
];
export const BN2_GLOBAL_SOURCES = [
  {label:'Roland BN2-30 machine specifications / weight and media limits',url:roland},
  {label:'Roland VersaWorks media downloads',url:profileHelp},
  {label:'Roland BN2 setup/cut/registration video guides',url:cutHelp}
];
export function toBn2Draft(m){
  if(!m||!BN2_MEDIA.some(x=>x.id===m.id))throw new Error('Unknown BN2 material');
  const first=m.sources[0];
  return {
    id:null,machine_type:'roland_bn2',machine_model:'Roland VersaSTUDIO BN2-30',
    machine_configuration:'',operation:m.category==='Banner'?'print_only':'print_cut',
    material_name:m.name,material_brand:m.brand,material_sku:m.sku,material_finish:m.finish,
    thickness_mm:m.thicknessMm??'',source_type:m.brand==='Greenstar / USCutter'?'supplier':'manufacturer',
    source_url:first.url,safety_notes: 'NOT PRODUCTION APPROVED. Verify exact inkset, media finish, roll weight and cut/test results. Vinyl/PVC must NEVER be processed by a laser. '+m.notes.filter(x=>/CRITICAL|IMPORTANT|NOT|exceed|heater/i.test(x)).join(' '),
    material_notes:[m.description,'Profile: '+m.profile,'Cut: '+m.cut,'Post-print: '+m.post,...m.notes,'Manufacturer/supplier references:',...m.sources.map(s=>s.label+': '+s.url)].join('\n'),
    settings:JSON.stringify({
      starting_only:true,
      print_heater_c:35,dryer_c:35,
      profile_selection:'Exact confirmed BN2-30 / inkset ICC required; do not use other printer profiles unverified',
      printing_mode:'High Quality first proof; use verified profile modes for production',
      feed_calibration:'measure for each media and laminate condition',
      cut_force_gf:'',
      cut_speed_mm_s:'',
      print_and_cut:m.category!=='Banner',
      press:m.press||null,
      heat_press_temperature_f:m.press?.temperatureF||'',
      heat_press_time_s:m.press?.seconds||'',
      heat_press_pressure:m.press?.pressure||'',
      heat_press_peel:m.press?.peel||'',
      manufacturer_cut_guidance:m.cut,
      post_print_handling:m.post
    },null,2)
  };
}
