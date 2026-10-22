import wordpressAudit from './wordpressPluginAudits.json' with { type: 'json' };
import conditionalAudit from './conditionalDialogs.json' with { type: 'json' };

const field=(c)=>[
  (c.label||'Control')+' ('+(c.type||'control')+').',
  c.purpose?'For beginners: '+c.purpose:'',
  c.when?'When visible: '+c.when:'',
  c.required?'Required? '+String(c.required):'',
  c.options?.length?'Options observed: '+c.options.join(', '):'',
  c.advancedNotes?'Advanced: '+c.advancedNotes:'',
  c.effect?'Observed/intended effect: '+c.effect:'',
  c.errors?.length?'Possible errors or untested validations: '+c.errors.join('; '):'',
  c.safety?'Safe practice: '+c.safety:'',
].filter(Boolean).join(' ');

const section=(id,title,summary,extras={})=>({id,title,summary,...extras});
const linked=(p)=>p.integrationPoints?.length?p.integrationPoints.join(' · '):'Confirm the affected application workflow before changing settings.';
const caveat='This is a WordPress browser audit of visible interface controls, not proof that a changed setting, checkout, email, printing or data synchronization works. Do not save, publish, refund, charge, sync or repair live data as a training exercise.';

export function wordPressAuditChapters(){
 const active=wordpressAudit.plugins.filter(p=>p.activationStatus==='active').length;
 const all=wordpressAudit.plugins;
 const withScreens=all.filter(p=>[...(p.adminScreens||[]),...(p.publicScreens||[])].length>0);
 const uninspected=all.filter(p=>[...(p.adminScreens||[]),...(p.publicScreens||[])].length===0);
 const scenarios=[
  section('wp-audit-owner-school','Owner scenario: recurring school store with personalized spiritwear',
   'A school coordinator wants a reusable WooCommerce storefront in school colors, with student name options, delivery instructions and season renewal.',{
    scenario:'Woodland School requests a recurring spiritwear store. The owner prepares approved products in the correct WooCommerce category while a family helper checks the store preview.',
    steps:[
     'Open the existing Skilled Crafting Team Stores campaign. Choose the School Pride template and confirm logo, category ID and actual WordPress draft; do not publish until the customer approves.',
     'Compare installed Client Storefronts version 0.1.2 with the GitHub version 0.1.3 before trusting the newest published behavior; do not update in the middle of a customer deadline.',
     'Review shopper options in Skilled Crafting Product Options: native Replacement mode and historical legacy options can coexist. Confirm what the Woo order line actually captures.',
     'Test the final product and options in an authorized staging environment. Only confirmed paid Woo orders create the downstream production demand; do not create another QuickBooks group order.',
     'Review free-shipping qualification in BOTH Woo core methods and the separate Advanced Free Shipping rule; a $200 threshold on one rule is not the whole site policy.',
     'After ordering: check Woo-to-Supabase variation mapping, proper blank pairing, traveler, QC, packing and actual customer handoff. Do not mistake a generated print document for a physically delivered product.'
    ],warnings:[caveat,'Do not expose customer rostering data, plugin credentials, private product prices, order addresses or payment details in training screenshots.'],
    relatedRoutes:['/team-stores','/work-hub','/client-orders','/application-guide']}),
  section('wp-audit-owner-one-time','Owner scenario: one-time soccer team order invoiced through QuickBooks',
   'A soccer coach submits a one-time group form that should not become an unnecessary dedicated WordPress store.',{
    scenario:'A team orders a short run of personalized hoodies. The form is reviewed inside Skilled Crafting and invoiced through QuickBooks, not WooCommerce checkout.',
    steps:[
      'Confirm the team is occasional rather than a recurring online-store client. Use the application group intake and Client Orders.',
      'Verify each hoodie variant, player name/number and artwork version. Avoid attempting to backfill legacy Woo personalization fields for this manual invoice.',
      'Confirm the real QuickBooks invoice and payment before creating production demand. Never copy the job into a WooCommerce order solely to get paperwork.',
      'Use product-to-blank mapping, purchasing and job travelers to manufacture once. Mark errors and spoilage through the authoritative workflow.',
      'Record actual QC, per-line packing and pickup receipt in Work Hub. Print Documents generation metadata is NOT evidence the physical order was printed, packed or delivered.'
    ],relatedRoutes:['/team-order','/client-orders','/work-hub','/application-guide'],
    warnings:['QuickBooks invoices and WooCommerce checkout remain distinct financial sources.']}),
  section('wp-audit-owner-sync','Advanced scenario: changing SKU and blank-product linkage without losing orders',
   'Multiple active SKU writers and batch tools are present. Changing a SKU is potentially high impact across WooCommerce and Supabase.',{
    scenario:'A new garment line needs brand/style/color/size SKUs, while old WooCommerce orders still reference prior product variations.',
    steps:[
      'Identify the authoritative SKU generator and exact proposed SKU scheme; active plugins include more than one potential SKU writer.',
      'Check for already fulfilled Woo items, original variation IDs, blank master mapping, reserved stock and open order demand.',
      'Run safely in a nonproduction test with a before/after export. Preview changes and reconcile collision/duplicate SKU cases; no bulk SKU regeneration as a training exercise.',
      'Remember the observed WC SKU Builder indicates it does not sync Supabase during rebuild. Woo product sync and blank-master relink are separate guarded operations.',
      'Verify one test production pull sheet before broader rollout, then record the change in the application guide and operations integrity notes.'
    ],warnings:['Never use the Supabase repair tool just to inspect impact: it can create blank products and alter linkages.'],
    relatedRoutes:['/woo-sync','/product-blank-mappings','/operations-integrity','/work-hub']}),
  section('wp-audit-owner-shipping','Owner scenario: shipping, refunds and customer expectations',
   'Overlapping WooCommerce shipping rule engines mean cart shipping cannot be inferred from a single settings dialog.',{
    scenario:'A school-store order qualifies near the local $200 minimum while one coupon changes the total and a parent wants a mailed package.',
    steps:[
      'Review the applicable WooCommerce shipping zone, free-shipping method, flat-rate method, tax status and shipping class charges.',
      'Inspect Advanced Free Shipping conditions separately: the observed rule is named "Spend $200 get free shipping!" but additional eligibility can apply.',
      'Verify coupon and discount handling in a safe test cart; do not assume the observed Kitsap County configuration applies to every address.',
      'For EasyPost labels, record real parcel dimensions and an exact manager-approved rate. Existing USPS Click-N-Ship labels can be recorded without buying a duplicate.',
      'Do not mark order shipped until actual carrier acceptance; printed postage, physical shipment and verified delivery are different events.'
    ],warnings:[caveat],relatedRoutes:['/work-hub','/team-stores']}),
 ];
 const intro=[
  section('wp-audit-scope','How to read the October 22 WordPress audit',
   'Work observed the installed WordPress environment and captured 51 plugins (50 active, 1 inactive), two drop-ins, 42 screens/sections and 405 controls. The audit remains PARTIAL.',{
    useWhen:['Before relying on a plugin screenshot or changing a setting','When onboarding someone new to WordPress'],
    steps:[
     'A screen marked verified means the relevant controls were visibly inspected in WordPress, not that every save, validation, permission or downstream action was tested.',
     'None of the '+all.length+' plugins has a complete end-to-end operational certification. '+withScreens.length+' have some documented screen controls; '+uninspected.length+' are inventory-only.',
     'Only two WordPress shipping conditional-visibility cases were narrowly live verified. Existing Skilled Crafting app conditional dialogs still need separate live verification.',
     'Keep any customer information, credentials and payment details out of screenshots and downloadable training records.',
     'Use a staging environment and owner approval before changing site, product, checkout, sync or shipping behavior.'
    ],warnings:[caveat,'Work did not perform any production save, order, payment, email, label purchase, SKU rewrite or synchronization.']}),
  section('wp-audit-hazard-register','Six operating risks that should be checked before changes',
   'The browser audit surfaced configuration coexistence and plugin version drift, not automatically proven defects.',{
    steps:[
     'Client Storefronts: installed header 0.1.2 while GitHub companion code shows 0.1.3. Compare actual deployed PHP before choosing whether to update.',
     'Personalization: Skilled Crafting Product Options Replacement mode was visible with legacy fallback. Preserve old product add-on metadata until tested after cutover.',
     'Multiple SKU generation or bulk update plugins are active. Confirm a single owner of identifiers and separate Woo-to-Supabase sync before regenerating.',
     'Shipping: WooCommerce core and Advanced Free Shipping both provide rules. Local free shipping had a $200 minimum OR coupon; class pricing can also matter.',
     'Print Documents: browser generation events and auto-opening print dialogs are NOT proof of a physical successful print or customer receipt.',
     'Directory paths differ: homepage appears to use /shop-new/ while the Team Orders page links to /find-your-store/. Verify intended aliases and customer navigation.'
    ],warnings:['These are factual observations and review priorities, not authorization to change plugin configurations.']}),
 ];
 const reference=[];
 for(const p of all){
  const screens=[...(p.adminScreens||[]),...(p.publicScreens||[])];
  const pageStatus=(p.reviewStatus==='live-verified'?'Live reviewed':'Partial or inventory only');
  if(!screens.length){
   reference.push(section('wp-audit-plugin-'+p.slug,p.name+' — plugin inventory only',
    (p.businessPurpose||'Purpose requires inspection.')+' Installed version: '+(p.installedVersion||'unknown')+
    '; active status: '+p.activationStatus+'. Field-by-field admin documentation is not available yet.',{
     steps:['Inspect actual plugin settings and any context-sensitive controls under an authorized WordPress account before changing anything.',
      'Confirm behavior and dependencies: '+linked(p)],
     warnings:['NOT OPERATIONALLY VERIFIED. No plugin-specific settings or conditional dialogs were audited for this entry.'],
     relatedRoutes:['/application-guide'],
    }));
   continue;
  }
  for(let i=0;i<screens.length;i++){
   const screen=screens[i];
   const controls=screen.controls||[];
   const summary=(p.businessPurpose||'')+' Plugin '+(p.installedVersion||'unknown')+
    ', '+p.activationStatus+'. Screen '+(screen.verified?'visually observed in WordPress':'NOT LIVE VERIFIED')+
    '; plugin audit status: '+pageStatus+'.';
   reference.push(section('wp-audit-'+p.slug+'-'+i,p.name+' — '+screen.name,summary,{
    scenario:'Where to find this in WordPress: '+(screen.pathHint||screen.url||'Location not fully recorded')+'.',
    useWhen:screen.conditions?.length?screen.conditions:undefined,
    steps:controls.length?controls.map(field):['Plugin or screen controls were not safely observed; do not infer button effects from the name.'],
    tips:[...(p.integrationPoints||[]).slice(0,5).map(s=>'Application integration: '+s),
      ...(p.knownTroubleshooting||[]).slice(0,4).map(s=>'Troubleshooting: '+s)],
    warnings:[caveat,...(p.securityNotes||[]).slice(0,3)],
    relatedRoutes:['/application-guide'],
   }));
  }
 }
 return [
  {id:'wordpress-audit-owner-scenarios',title:'WordPress & WooCommerce: Verified Setup, Owner Scenarios and Operating Safety',
    description:'Real WordPress audit findings incorporated into repeatable owner/family workflows. Verified UI observation is NOT authorization to change the live site.',sections:[...intro,...scenarios]},
  {id:'wordpress-audit-field-reference',title:'WordPress Plugin Screens: Field-by-Field Audit Reference',
    description:'Detailed reference of each inspected WordPress plugin control and the remaining inventory-only plugins. Every field is described with its observed purpose and review limits.',sections:reference},
 ];
}
export function wordPressConditionalCases(){
 return (conditionalAudit.dialogs||[]).filter(x=>String(x.id||'').startsWith('wordpress-'));
}
