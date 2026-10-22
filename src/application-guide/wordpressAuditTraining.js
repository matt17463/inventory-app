import audits from './wordpressPluginAudits.json' with { type: 'json' };
const roleModules=[
 {id:'storefronts',slug:'skilled-crafting-client-storefronts',name:'Client storefront templates and approved publishing',
  roles:['marketing','manager','owner-admin'],minutes:25,
  scenario:'Example Woodland School wants a recurring branded shop. Identify a QA draft, client product category, logo colors and public landing instructions. Do not publish a live storefront.',
  caution:'The October 22 initial WordPress audit saw 0.1.2; GitHub now offers 0.1.4. Recheck the installed live header; previous 0.1.3 source comparisons are historical, not new live verification.'},
 {id:'personalization',slug:'skilled-crafting-product-options',name:'Product personalization and legacy metadata',
  roles:['marketing','artwork','production','manager','owner-admin'],minutes:25,
  scenario:'Example youth team requires player names and jersey numbers. Locate native options and legacy reading mode, then explain where order-line metadata should be retained.',
  caution:'Replacement mode with legacy fallback was observed. Do not change migration mode or delete legacy options as training.'},
 {id:'artwork',slug:'skilled-crafting-artwork-system',name:'Artwork intake, revision and R2 handoff',
  roles:['artwork','marketing','production','manager','owner-admin'],minutes:25,
  scenario:'Example client submitted an AI-generated DTF image. Identify original asset, the revision/approval path and the exact file intended for printing.',
  caution:'Request-level approval, retry and durable R2 outcomes were not verified; never assume file presence proves client approval.'},
 {id:'documents',slug:'skilled-crafting-print-documents',name:'Invoices, packing slips and physical print verification',
  roles:['new-employee','production','manager','owner-admin'],minutes:22,
  scenario:'Example order has three hoodie sizes. Identify print document paper, field inclusion and the difference between PDF generation and physical packed garments.',
  caution:'Auto-open printing and generation logging can fire without physical print success. Do not generate real output just to practice.'},
 {id:'shipping',slug:'woocommerce',name:'WooCommerce shipping zones, coupons and customer checkout',
  roles:['marketing','manager','owner-admin'],minutes:30,
  scenario:'Example Kitsap County spiritwear cart approaches $200 with a coupon and a shipping class. Compare core free-shipping logic, flat rate and Advanced Free Shipping conditions.',
  caution:'This audit inspected only some shipping zones and modal visibility; other zone, tax and coupon combinations remain untested.'},
 {id:'sync',slug:'woocommerce-to-supabase-product-sync',name:'WooCommerce product sync versus blank-master relinking',
  roles:['production','warehouse','manager','owner-admin'],minutes:22,
  scenario:'Example new style creates multiple sizes. Locate sync and blank relink controls, and explain why seeing a product in Supabase does not prove its inventory pairing.',
  caution:'No live sync, bulk job, SKU regeneration or database repair was run. Do not push a real batch to learn a screen.'},
];
export function wordpressAuditTutorials(){
 return roleModules.map(m=>{
  const plugin=(audits.plugins||[]).find(p=>p.slug===m.slug);
  const screens=[...(plugin?.adminScreens||[]),...(plugin?.publicScreens||[])].filter(s=>s.verified===true);
  const steps=[
    {title:'Identify this client task and the correct order channel',
     instruction:m.scenario,route:'/application-guide',readOnly:true,
     verify:'You know whether recurring WooCommerce or an occasional QuickBooks manual invoice owns the transaction.'},
    {title:'Check actual plugin and version',
     instruction:'In the owner reference or audit tab, locate '+(plugin?.name||m.name)+'. Observed version: '+(plugin?.installedVersion||'not established')+'. Its plugin review is '+(plugin?.reviewStatus||'unverified')+'; screen observation does not certify live writes.',
     route:'/application-guide',readOnly:true,
     verify:'You can distinguish active installation, screen observation, saved configuration and actual downstream business effects.'},
  ];
  for(const screen of screens.slice(0,6)){
   const sample=(screen.controls||[]).slice(0,4);
   steps.push({
    title:'Inspect '+screen.name,
    instruction:'Read the control reference for '+screen.name+' and discuss '+(sample.length?sample.map(c=>c.label).join(', '):'the visible screen')+
       '. The audit observed the interface but did not safely exercise production writes.',
    route:'/application-guide',readOnly:true,
    verify:'For each displayed control, explain its stated purpose, its options where known, and why saved behavior is not yet proven.',
    warning:'Do not save plugin settings, checkout, fulfillment, shipping or repair data during this exercise.',
   });
  }
  steps.push({
   title:'Explain the stop conditions before live work',
   instruction:m.caution,route:'/application-guide',readOnly:true,
   verify:'You know exactly what needs owner review or a separate nonproduction test before changing the live site.',
  });
  return {
   id:'wordpress-audit-'+m.id,roles:m.roles,title:'WordPress audit: '+m.name,
   level:'Advanced',minutes:m.minutes,safeMode:'guided-read-only',
   summary:m.scenario,
   outcome:'Explain observed WordPress controls and the safe steps in the linked Skilled Crafting workflow without performing unauthorized changes.',
   steps,
  };
 });
}
