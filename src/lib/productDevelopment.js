// Product & Event Center: pure, testable calculations and starter catalogs.
// Catalog examples are research candidates, not market-validated products or machine settings.
export const STAGES=['idea','researching','sample','validated','live','retired'];
export const EVENT_TYPES=['wedding','coach_recognition','sports_banquet','graduation','corporate','anniversary','other'];
export const EQUIPMENT=[
 ['xtool_s1','xTool S1'],['xtool_p2','xTool P2'],['xtool_omni','xTool Omni Dual UV'],
 ['roland_bn2','Roland BN2-30'],['mopa_fiber','OMTech 60W MOPA'],
 ['sawgrass_sg500','Sawgrass SG500'],['heat_press','Heat press'],['sublimation_press','Sublimation press']
];
export const STARTER_PRODUCTS=[
 ['Hat patches — laser-engraved','Sports & Coaches','xtool_s1,xtool_p2','Hat patches, teams, coaches and businesses'],
 ['Hat patches — textured UV','Sports & Coaches','xtool_omni','Raised UV patches; test substrate flexibility and adhesion'],
 ['Coach recognition plaque','Sports & Coaches','xtool_p2,xtool_omni','Layered acrylic/wood award'],
 ['Coach gift tumbler','Sports & Coaches','mopa_fiber,xtool_p2','Engraved coated drinkware; validate exact blank'],
 ['Tournament challenge coins','Sports & Coaches','mopa_fiber,xtool_omni','Metal award coin with matched finish'],
 ['Wedding welcome sign','Weddings & Events','xtool_p2,roland_bn2','Personalized entrance sign'],
 ['Wedding seating chart','Weddings & Events','roland_bn2,xtool_p2','Guest list/layout and proof workflow'],
 ['Wedding acrylic table numbers','Weddings & Events','xtool_p2,xtool_omni','Numbered acrylic/wood table markers'],
 ['Wedding guest favors','Weddings & Events','xtool_p2,xtool_s1','Batch-personalized tags, keychains and ornaments'],
 ['Wedding glassware','Weddings & Events','xtool_p2','Rotary engraving on exact verified glass blank'],
 ['Wedding party keepsake box','Weddings & Events','xtool_s1,xtool_p2','Engraved box or ring box'],
 ['Sublimation photo slate','Weddings & Events','sawgrass_sg500,sublimation_press','Coated sublimation blank'],
 ['Business decal bundles','Business Branding','roland_bn2','Decal/sign kits made from verified media'],
 ['Business signs','Business Branding','roland_bn2,xtool_p2','Indoor signage and wayfinding'],
 ['Metal business nameplates','Business Branding','mopa_fiber,xtool_omni','Engrave or UV-print identified metal'],
 ['Golf event gift set','Weddings & Events','xtool_omni,mopa_fiber','Verify golf-ball fixture compatibility before including balls']
].map(([name,category,equipment,notes])=>({name,category,equipment:equipment.split(','),notes}));
export const PACKAGE_TEMPLATES=[
 {id:'wedding-essential',name:'Wedding — Essential',event_type:'wedding',items:[['Welcome sign',1],['Table number',10],['Guestbook sign',1],['Cards & gifts sign',1]]},
 {id:'wedding-signature',name:'Wedding — Signature',event_type:'wedding',items:[['Welcome sign',1],['Seating chart',1],['Table number',12],['Bar sign',2],['Guest favors',50],['Personalized glassware',2]]},
 {id:'wedding-premium',name:'Wedding — Premium',event_type:'wedding',items:[['Welcome sign',1],['Seating chart',1],['Table number',15],['Bar sign',2],['Personalized place setting',100],['Guest favors',100],['Wedding party gifts',6]]},
 {id:'coach-thank-you',name:'Coach — Thank You',event_type:'coach_recognition',items:[['Engraved recognition plaque',1],['Personalized tumbler',1],['Team thank-you card',1]]},
 {id:'coach-banquet',name:'Coach — Banquet',event_type:'coach_recognition',items:[['Engraved recognition plaque',4],['Challenge coin',4],['Event banner',1],['Coach gift box',4]]},
 {id:'team-awards',name:'Sports — Season-End Awards',event_type:'sports_banquet',items:[['Custom award plaque',15],['Coaches gift',3],['Event banner',1]]},
 {id:'corporate-appreciation',name:'Business — Recognition',event_type:'corporate',items:[['Employee recognition plaque',10],['Engraved gift',10],['Event signage',2]]}
];
export const safeNumber=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)&&n>=0?n:fallback;};
export function opportunityScore(p){
 const score=Math.round(.3*safeNumber(p.customer_fit)+.25*safeNumber(p.demand_score)+.25*safeNumber(p.production_fit)+.2*safeNumber(p.differentiation_score));
 return Math.max(0,Math.min(100,score));
}
export function productEconomics(data){
 const d=data||{},units=Math.max(1,Math.floor(safeNumber(d.units,1)));
 const blank=safeNumber(d.blank_cost),consumables=safeNumber(d.consumables),packaging=safeNumber(d.packaging);
 const laborMinutes=safeNumber(d.labor_minutes),laborRate=safeNumber(d.labor_hourly_rate);
 const machineMinutes=safeNumber(d.machine_minutes),machineRate=safeNumber(d.machine_hourly_rate);
 const activeLabor=(laborMinutes/60)*laborRate;
 const machineCost=(machineMinutes/60)*machineRate;
 const variable=blank+consumables+packaging+activeLabor+machineCost+safeNumber(d.other_variable_cost);
 const spoilage=Math.min(0.95,safeNumber(d.spoilage_rate_percent)/100);
 // expected blank+processing cost per usable unit, assuming equivalent cost of a failed attempt
 const withWaste=variable/(1-spoilage);
 const price=safeNumber(d.sell_price);
 const fees=price*Math.min(1,safeNumber(d.channel_fee_percent)/100);
 const fixed=safeNumber(d.setup_cost);
 const perUnitCost=withWaste+fees+fixed/units;
 const contribution=price-perUnitCost;
 const totalContribution=contribution*units;
 return {units,price,perUnitCost,contribution,totalContribution,marginPercent:price?100*contribution/price:0,
   revenue:price*units,activeLaborMinutes:units*laborMinutes,
   contributionPerLaborHour:laborMinutes>0?contribution*60/laborMinutes:null,
   machineMinutes:units*machineMinutes,
   contributionPerMachineHour:machineMinutes>0?contribution*60/machineMinutes:null};
}
export function packageTotals(items){
 return (items||[]).reduce((a,item)=>{const qty=safeNumber(item.quantity);a.units+=qty;a.price+=qty*safeNumber(item.unit_price);a.cost+=qty*safeNumber(item.unit_cost);return a;},{units:0,price:0,cost:0});
}
export function readyForProduction(item,recipes){
 if(!item.recipe_id)return {ok:false,reason:'Select an approved material recipe.'};
 const recipe=(recipes||[]).find(r=>r.id===item.recipe_id);
 if(!recipe||recipe.status!=='approved')return {ok:false,reason:'Recipe has not been production approved.'};
 if(item.proof_status!=='approved')return {ok:false,reason:'Customer proof is not approved.'};
 if(!String(item.approved_artwork_revision||'').trim())return {ok:false,reason:'Approved artwork revision is missing.'};
 return {ok:true,reason:'Recipe and proof are approved; verify materials, quantities and job link.'};
}
export function normalizeSourceUrl(value){
 try{const url=new URL(value);return url.protocol==='https:' && !url.username && !url.password ? url.href : null;}catch{return null;}
}
export function normalizeGuestNames(text,max=500){
 // Name import is local-only until explicitly attached to an event item; never assume comma = multiple people.
 return String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x.length>0&&x.length<=120).slice(0,max);
}
export function packageTemplate(id,guests=50,tables=10){
 const t=PACKAGE_TEMPLATES.find(p=>p.id===id);
 if(!t)return null;
 return {...t,items:t.items.map(([label,q])=>({label,quantity:/guest favors|place setting/i.test(label)?Math.max(1,Math.floor(guests)): /table number/i.test(label)?Math.max(1,Math.floor(tables)):q,unit_cost:0,unit_price:0,proof_status:'draft'}))};
}
export const currency=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
