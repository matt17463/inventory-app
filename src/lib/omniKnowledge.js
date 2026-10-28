// xTool O1 Omni Dual-UV knowledge base. These are source-linked starter guides,
// NEVER production-approved material settings. xTool Studio remains print controller.
export const OMNI_DEVICE = {
 id:'xtool_omni', name:'xTool O1 Omni Dual-UV', edition:'Dual UV (not UV + DT fabric)',
 manufacturer:'xTool', status:'Awaiting physical setup and material qualification',
 specs:'CMYKWV + rigid white, flexible white, fluorescent red/yellow',
 sources:[
  {label:'Official O1 user manual and setup',url:'https://support.xtool.com/article/3084'},
  {label:'Material and edition compatibility',url:'https://support.xtool.com/article/3666'},
  {label:'Operating and maintenance controls',url:'https://support.xtool.com/article/3081'},
  {label:'Primer and adhesion guide',url:'https://support.xtool.com/article/3704'},
  {label:'OR1 supported object dimensions',url:'https://support.xtool.com/article/3188'},
  {label:'Maintenance training',url:'https://support.xtool.com/academy/course?id=335'},
 ]
};
export const OMNI_SETUP = [
 ['workspace','Prepare a stable, level workstation and manufacturer-compliant ventilation; review ink and UV safety before starting.'],
 ['inventory','Check the shipped Dual-UV model against the official package list; photograph damage or missing components.'],
 ['unpack','Remove shipping brackets and transport packaging exactly as described by the official setup wizard.'],
 ['waste','Install waste ink cartridge and UV moisturizing liquid cartridge in the documented slots.'],
 ['filter','Fit the air filter and approved exhaust accessories with clearance around the machine.'],
 ['inks','Verify cartridge identities and install all Dual-UV inks using the official cartridge procedure.'],
 ['software','Install the current xTool Studio release, connect the printer, confirm firmware and model.'],
 ['initialize','Run the official initial ink-fill, device initialization, scan alignment and calibration wizard in order.'],
 ['nozzles','Run nozzle checks for both UV printheads and troubleshoot incomplete test patterns.'],
 ['firstprint','Complete the manufacturer flat rock-coaster tutorial with a sacrificial sample.'],
 ['qualify','Physically test each selected material, record lot/primer/settings and request manager approval.'],
];
export const OMNI_MAINTENANCE = [
 {id:'nozzle',title:'Nozzle test / device health',cadence:'Before production',intervalDays:null,
  instructions:'Inspect the nozzle check for each UV head, read xTool Studio Device Health and correct alerts using guided service. Do not repeatedly deep-clean without diagnosis.',source:'https://support.xtool.com/article/3081'},
 {id:'lamp',title:'UV lamp surface',cadence:'Daily reminder / manufacturer interval',intervalDays:1,
  instructions:'Follow the Device Health prompt and official lamp-cleaning video; use required gloves and recommended lint-free tools. Official guide also describes weekly cleaning, so follow the actual software reminder.',source:'https://support.xtool.com/article/3540'},
 {id:'optical',title:'Optical path and CIS module',cadence:'Weekly',intervalDays:7,
  instructions:'Use the official optical-path/CIS cleaning tutorial with approved materials. Clean only accessible components as directed; check scans and height readings afterward.',source:'https://support.xtool.com/academy/lesson/3539?courseId=335'},
 {id:'platform',title:'Printing platform and jig area',cadence:'Weekly inspection',intervalDays:7,
  instructions:'Remove debris and ink residue following the official platform cleaning procedure; check mats and fixtures for wear.',source:'https://support.xtool.com/academy/course?id=335'},
 {id:'rail',title:'Guide rails',cadence:'Monthly',intervalDays:30,
  instructions:'Clean and lubricate only the specified rails with manufacturer-recommended oil and the current xTool training instructions.',source:'https://support.xtool.com/academy/lesson/3713?courseId=335'},
 {id:'consumables',title:'Ink pad, scraper, absorber foam and filter',cadence:'When Device Health indicates',intervalDays:null,
  instructions:'Inspect recorded life counters; replace when prompted. Mark components replaced in xTool Studio only after physical replacement.',source:'https://support.xtool.com/article/3081'},
 {id:'idle',title:'Idle / storage moisturizing',cadence:'Before extended idle periods',intervalDays:null,
  instructions:'Review the official moisturizing instructions and confirm automatic protection is operational. Do not simply unplug the device during extended inactivity.',source:'https://support.xtool.com/article/3084'},
];
export const OMNI_PROBLEMS = [
 {id:'connect',title:'Printer not detected or Wi-Fi unstable',keywords:'connection usb wifi',checks:['Verify xTool Studio is current and the correct model is selected.','Test an approved USB connection before investigating Wi-Fi.','Check firmware and official connection troubleshooting; do not expose printer controls over public internet.'],source:'https://support.xtool.com/article/3081'},
 {id:'nozzles',title:'Banding, faded color or missing nozzle lines',keywords:'streak print head white ink',checks:['Run each head nozzle-check pattern.','Review ink level, shop environment and Device Health alerts.','Use the manufacturer cleaning flow; document before/after test patterns.'],source:'https://support.xtool.com/article/3081'},
 {id:'adhesion',title:'Print scratches or peels from metal, glass or acrylic',keywords:'primer scratches flakes coating',checks:['Confirm the exact substrate and finish, including plated or coated blanks.','Degrease, use matching primer, extend it slightly beyond artwork and dry completely.','Let the printed item rest at least 30 minutes before testing; compare tape and abrasion results.'],source:'https://support.xtool.com/article/3704'},
 {id:'scan',title:'Scan or height alignment is inaccurate',keywords:'positioning registration focus',checks:['Verify fixture stability and safe maximum workpiece height.','Clean optical path/CIS using the official procedure.','Repeat scan and alignment under the xTool Studio workflow; do not casually redo full machine calibration.'],source:'https://support.xtool.com/academy/lesson/3539?courseId=335'},
 {id:'rotary',title:'Rotary workpiece slips or cannot be clamped',keywords:'or1 spherical golfball tumblers',checks:['Verify object type, size, weight and whether it is rotationally symmetric.','Check correct attachment and supported tail-module positioning.','Standard golf balls are below the OR1 47 mm minimum spherical diameter; do not force the chuck.'],source:'https://support.xtool.com/article/3188'},
 {id:'haze',title:'Primer haze, beading or edge lifting',keywords:'white cloudy ink adhesion',checks:['Check contamination, primer quantity and drying time.','Confirm primer matches the surface instead of assuming all metals or coatings are equal.','Retest on inexpensive sacrificial blanks before selling.'],source:'https://support.xtool.com/article/3704'},
];
const guide = (...steps)=>steps;
export const OMNI_PRODUCTS = [
 {id:'brass-coin',name:'Brass challenge coin',category:'Coins',material:'Brass / finished metal',status:'qualification',accessory:'Measured flat coin jig',operation:'uv_flat',primer:'Metal primer; plated and lacquered finishes require separate qualification',ink:'Rigid white + CMYK; optional varnish',source:'https://support.xtool.com/article/3704',
 steps:guide('Identify alloy, plating/lacquer and blank thickness; label the test lot.','Degrease and apply metal primer in the supplier-approved manner; let dry.','Seat sample coins in a nonreflective, level fixture and verify head clearance.','Scan and position artwork; select the manufacturer-compatible metal workflow.','Trial white underbase and CMYK with different artwork details; optionally compare varnish.','Rest at least 30 minutes; test tape, scratch and handling resistance before approving.')},
 {id:'stainless-coin',name:'Stainless steel challenge coin',category:'Coins',material:'Stainless steel',status:'qualification',accessory:'Measured flat coin jig',operation:'uv_flat',primer:'Metal primer, subject to existing surface treatment',ink:'Rigid white + CMYK',source:'https://support.xtool.com/article/3704',
 steps:guide('Verify stainless alloy and whether the surface is bare, polished or coated.','Clean oils; prime the test print area uniformly.','Fixture at a known height and perform a fresh scan.','Choose a metal-compatible workflow and use white underbase for opaque colors.','Print color/fine-line sample and let rest for at least 30 minutes.','Photograph tape/rub results, document ink configuration and approve the exact blank only.')},
 {id:'leather-patch',name:'Leather hat patch',category:'Patches',material:'Leather',status:'qualification',accessory:'Flat patch template',operation:'uv_flat',primer:'Typically none on uncoated leather; test finish',ink:'Flexible white + CMYK',source:'https://support.xtool.com/article/3666',
 steps:guide('Record leather thickness, finish and intended cap attachment method.','Clean and hold the leather blank flat; check fixture clearance.','Select Dual-UV leather-compatible workflow and flexible white.','Scan, align to cutting/sewing margin and print a sample.','Compare flat versus textured effects using a separate test sample.','Flex/bend, rub and heat-exposure test before making saleable patches.')},
 {id:'synthetic-patch',name:'Synthetic leather / TPU hat patch',category:'Patches',material:'PU, TPU or other flexible blank',status:'experimental',accessory:'Flat patch fixture',operation:'uv_flat',primer:'Coating-specific; test with exact supplier SKU',ink:'Flexible white + CMYK when supported',source:'https://support.xtool.com/article/3666',
 steps:guide('Confirm actual polymer formulation and coating, not just a generic vinyl name.','Check material supplier guidance for UV compatibility; do not assume HTV works.','Secure blank flat and confirm height.','Select a compatible flexible print mode, print minimal sample.','Flex and test ink adhesion before trying texture effects.','Validate sew-on/adhesive/heat application separately and record results.')},
 {id:'glassware',name:'Glass tumblers and cups',category:'Drinkware',material:'Glass / crystal',status:'qualification',accessory:'OR1 for supported roundware; UV DTF for complex shapes',operation:'uv_flat',primer:'Glass & ceramic primer',ink:'White + CMYK',source:'https://support.xtool.com/article/2779',
 steps:guide('Check geometry and OR1 dimensions; avoid food-contact areas and drinking rims.','Clean outside surface and apply thin glass primer; allow to dry.','Mount with manufacturer OR1 configuration and verify collision clearance.','Calibrate/scan rotary position, artwork size and seam offset.','Start with opaque white base, color and a small test print.','Rest at least 30 minutes, test wash durability; no dishwasher-safe claim without validation.')},
 {id:'slate',name:'Slate / rock coasters',category:'Home & gifts',material:'Dark slate / stone',status:'manufacturer-baseline',accessory:'Mini baseplate and adhesive mat',operation:'uv_flat',primer:'None typically on clean porous slate; test sealed finishes',ink:'White + Color; official tutorial baseline: 2 white layers + 1 color layer',source:'https://support.xtool.com/article/3736',
 steps:guide('Choose clean, dry stone with acceptable flatness and secure it to the mini adhesive mat.','Connect O1, select UV Flatbed and Square Rock Coaster material.','Scan the platform and align the image to the coaster.','Set Flat, White + Color, 2 white ink layers and 1 color layer as the official dark-rock tutorial illustrates.','Process and print a sacrificial coaster; inspect dark-region coverage.','Test adhesion and durability on the specific supplier lot before production approval.')},
 {id:'golfball',name:'Standard golf ball',category:'Golf',material:'Coated dimpled polymer',status:'not-supported-or1',accessory:'No validated standard OR1 fixture for regulation balls',operation:'uv_flat',primer:'Exact coating compatibility unknown',ink:'To be determined after fixture proof',source:'https://support.xtool.com/article/3188',
 steps:guide('STOP: Standard golf balls are about 42.7 mm; the OR1 spherical specification requires 47–101.6 mm.','Do not force the OR1 attachment or represent direct golf-ball printing as supported.','Evaluate an independently validated compatible fixture/process or external specialty service.','Verify printhead clearance, object retention and the coating with sacrificial samples.','Test dimple coverage, abrasion and real-world handling; never presume tournament or dishwasher safety.','Approve only after documented real-world testing and manufacturer-consistent setup.')},
 {id:'acrylic',name:'Acrylic awards / plaques',category:'Awards',material:'Acrylic sheet',status:'manufacturer-baseline',accessory:'Flatbed adhesive mat',operation:'uv_texture',primer:'Acrylic primer',ink:'White + CMYK; optional raised texture',source:'https://support.xtool.com/article/3738',
 steps:guide('Peel protective film and remove dust and static.','Apply acrylic primer as prescribed and let dry.','Seat on correct baseplate; scan and position artwork.','Try xTool Texture tutorial as a baseline; its sample uses 0.6 mm thickness and smoothness 1.','Process a test first; compare flat/texture effect and color.','Rest at least 30 minutes and test abrasion/edge adhesion before selling.')},
 {id:'ornament',name:'Ceramic ornaments / tiles',category:'Gifts',material:'Glazed ceramic',status:'qualification',accessory:'Flatbed fixture or supported OR1 shape',operation:'uv_flat',primer:'Glass & ceramic primer on glazed ceramic',ink:'White + CMYK',source:'https://support.xtool.com/article/3666',
 steps:guide('Verify whether the blank is flat, glazed and safe to fixture.','Clean and prime glazed areas, avoiding direct food contact.','Seat and scan, keeping hanging holes and edges clear.','Print a tiny sample with white underbase.','Rest at least 30 minutes, then test handling and coating adhesion.','Record repeatable fixture dimensions and settings.')},
 {id:'uvdtf',name:'UV DTF promotional decals',category:'Transfers',material:'xTool-compatible UV DTF A/B film',status:'qualification',accessory:'LM1 laminator; RF1 optional for rolls',operation:'uv_flat',primer:'Not applicable to transfer film; clean destination surface',ink:'Dedicated UV DTF workflow',source:'https://support.xtool.com/article/3666',
 steps:guide('Use only compatible UV DTF film matching the xTool process.','Prepare and size approved graphic; select UV DTF workflow in Studio.','Print A film and use matching B film/lamination instructions.','Trim transfer and apply to compatible cleaned object.','Test edges and small text on a scrap item.','Do not claim general wash/dishwasher durability without proof.')},
];
// Attributed owner reports, not official settings or independently verified fixes.
// Source links are public and included so operators can assess model/version context.
export const OMNI_OWNER_TIPS = [
 {id:'setup-review',title:'Firmware and calibration can be a setup obstacle',model:'O1 Omni (reviewer machine; verify edition)',reported:'A reviewer described Wi-Fi connection problems, firmware update trouble and repeated camera calibration attempts. Check firmware early and preserve calibration screenshots for support.',url:'https://www.makerhacks.com/xtool-o1-omni-review/'},
 {id:'false-ink',title:'Ink cartridge recognition problems',model:'O1 Omni (reported by owners)',reported:'Owners have reported low/empty cartridge warnings despite remaining ink. Verify seating and software diagnostics; escalate persistent errors instead of bypassing printer protections.',url:'https://www.reddit.com/r/xToolOfficial/comments/1wwd0c8/o1_omni_problem/'},
 {id:'head2-residue',title:'Residual ink near the second UV capping station',model:'Dual UV',reported:'One Dual UV owner reported visible ink in the UV2 cleaning area; an xTool support account said a small amount can be normal and recommended watching for recurring leakage. Follow the official cleaning process.',url:'https://www.reddit.com/r/xToolOfficial/comments/1x2ygra/o1_omni_help/'},
 {id:'idle-clean',title:'Frequent manual cleaning and fluid consumption',model:'O1 Omni (community discussion)',reported:'An owner reported channel dropout after idle time and concerns about moisturizing fluid use. Avoid making extra cleaning cycles routine without diagnostic evidence and consult the manufacturer for persistent issues.',url:'https://www.reddit.com/r/xToolOfficial/comments/1xdck4z/omni_1_needs_printhead_cleaning_once_or_more_a_day/'},
 {id:'patch-warp',title:'Thin or flexible patches warping during a print',model:'O1 Omni (owner discussion)',reported:'A patch-printing owner described warping and unwanted ink transfer. Check fixture flatness, safe clearance and nozzle/ink-pad contamination; do not copy unverified workarounds.',url:'https://www.reddit.com/r/xToolOfficial/comments/1ws1r5j/xtool_omni_o1_dual_uv_printer_problems/'},
];
export function searchOmniProducts(query='',category='all') {
 const needle=String(query).trim().toLowerCase();
 return OMNI_PRODUCTS.filter(p=>(category==='all'||p.category===category)&&
 [p.name,p.category,p.material,p.primer,p.ink,p.accessory,p.status,'xTool O1 Omni Dual-UV'].join(' ').toLowerCase().includes(needle));
}
export function daysUntilDue(lastCompletedAt,intervalDays,now=new Date()) {
 if (!intervalDays) return null;
 if (!lastCompletedAt) return -1;
 const day=86400000;
 return Math.ceil((new Date(lastCompletedAt).getTime()+intervalDays*day-now.getTime())/day);
}
