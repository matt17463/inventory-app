import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import { guideChapters, GUIDE_VERSION } from '../src/application-guide/guideData.js';
import { navSections } from '../src/navigationConfig.js';
import { trainingTutorials } from '../src/application-guide/trainingData.js';
import { documentationCoverage } from '../src/application-guide/documentationCoverage.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const src=path.join(root,'src');
const out=path.join(root,'public','skilled-crafting-application-user-guide.pdf');
const catalogFile=path.join(root,'src','application-guide','controlCatalog.generated.json');

const normalize=(v)=>String(v||'').replace(/\{[^{}]{0,200}\}/g,' ').replace(/<[^>]+>/g,' ')
 .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
 .replace(/\s+/g,' ').trim().slice(0,190);
const ascii=v=>String(v??'').normalize('NFKD').replace(/[^\x20-\x7E\n]/g,ch=>({
 '–':'-','—':'-','’':"'",'“':'"','”':'"','•':'-','→':'->','×':'x',
 '©':'(c)','°':'deg','≥':'>=','≤':'<=','✓':'OK','…':'...','\t':' '
}[ch]||'')).replace(/\s+/g,' ').trim();
const capitalize=s=>s?s[0].toUpperCase()+s.slice(1):'';
function scanFiles(dir){
 const all=[];
 for(const x of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,x.name);
  if(x.isDirectory() && !['vendor','dist','node_modules'].includes(x.name))all.push(...scanFiles(full));
  else if(x.isFile()&&x.name.endsWith('.jsx'))all.push(full);
 }
 return all;
}
const sourceFiles=scanFiles(src);
const app=fs.readFileSync(path.join(src,'App.jsx'),'utf8');
const importMap=new Map([...app.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\('([^']+)'\)\)/g)]
 .map(x=>[x[1],x[2]]));
const routes=[...app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<(\w+)[^>]*\/>\}\s*\/>/g)]
 .map(x=>({route:x[1],component:x[2],source:importMap.get(x[2])||''}));
const routeMap=new Map(routes.map(r=>[r.route,r]));
const titleMap=new Map(navSections.flatMap(g=>g.items).map(x=>[x.path,x.label]));
const pageDescriptions=new Map(navSections.flatMap(g=>g.items).map(x=>[x.path,x.keywords||'']));
function controlDescription(item){
 const label=item.label;
 if(item.type==='button')return 'Activates '+label+'. Review the related record and confirm any changes before using this control. A button may save, create, export, reconcile, navigate or trigger an external workflow; inspect the on-screen confirmation.';
 if(item.type==='select')return 'Choose the '+label+' value from the available options. Check the selection before saving because it can control filtering, pricing, material, workflow stage or fulfillment.';
 if(item.type==='checkbox')return 'Toggle '+label+' on or off. A checked option changes the behavior described on that screen; it is not a separate approval unless the workflow explicitly says so.';
 if(item.type==='file')return 'Choose a file for '+label+'. Inspect format, orientation, version and whether the file is for artwork, import, proof or upload before submitting.';
 if(item.type==='date')return 'Set the '+label+' date. Verify the customer deadline and distinguish order, ship, pickup and internal production due dates.';
 if(item.type==='number')return 'Enter a numeric value for '+label+'. Check units, quantity, cost and whether decimals or negative values are allowed.';
 if(item.type==='textarea')return 'Enter the '+label+' explanation or detailed instructions. Do not include secrets, card data or unrelated customer personal information.';
 if(item.type==='search')return 'Search or filter by '+label+'. This changes the visible results, not stored records.';
 return 'Enter '+label+'. Use the current job, customer, SKU, product, artwork or material as appropriate; review the value before submitting.';
}
function controlsIn(file){
 const s=fs.readFileSync(file,'utf8'),found=[];
 // Parse JSX tags by balanced braces, so callback arrows do not look like tag ends.
 const openings=/<(input|select|textarea|button)\b/g;let match;
 while((match=openings.exec(s))!==null){
  const tag=match[1],start=match.index;
  let brace=0,quote='',end=-1;
  for(let i=openings.lastIndex;i<Math.min(s.length,openings.lastIndex+6000);i++){
   const c=s[i],previous=s[i-1];
   if(quote){if(c===quote&&previous!=='\\')quote='';continue;}
   if(c==="'"||c==='"'||c===String.fromCharCode(96)){quote=c;continue;}
   if(c==='{')brace++;
   else if(c==='}')brace=Math.max(0,brace-1);
   else if(c==='>'&&brace===0){end=i;break;}
  }
  if(end<0)continue;
  const props=s.slice(openings.lastIndex,end);
  const before=s.slice(Math.max(0,start-650),start);
  const after=s.slice(end+1,end+650);
  const aria=props.match(/aria-label\s*=\s*["']([^"']+)["']/)?.[1];
  const placeholder=props.match(/placeholder\s*=\s*["']([^"']+)["']/)?.[1];
  const name=props.match(/\bname\s*=\s*["']([^"']+)["']/)?.[1];
  const lastLabel=before.lastIndexOf('<label');
  const labelFragment=lastLabel>=0?before.slice(lastLabel):'';
  const labelValid=labelFragment&&!labelFragment.includes('</label>');
  const nearbyLabel=labelValid?normalize(labelFragment.slice(labelFragment.indexOf('>')+1).split(/<(?:input|select|textarea|button|div)\b/)[0]):'';
  const closing=tag==='button'?after.indexOf('</button>'):-1;
  const buttonInside=tag==='button'?(closing>=0?after.slice(0,closing):after.slice(0,160)):'';
  let visible=normalize(buttonInside.replace(/\{[^{}]{0,500}\}/g,' ').replace(/<[^>]*>/g,' '));
  if(!visible&&tag==='button'){
   const labels=[...buttonInside.matchAll(/['"]([A-Z][^'"]{2,65})['"]/g)].map(x=>x[1]);
   visible=labels.length?normalize(labels.at(-1)):'';
  }
  let label=normalize(aria||(tag==='button'?visible:'')||nearbyLabel||placeholder||name||'');
  const bad=/[{}=><]|\b(?:className|onClick|setState|setParams|disabled|onChange|event|onSubmit|filter|map|return)\b/i;
  if(!label||bad.test(label)||label.length>130)label=normalize(aria||placeholder||name||'');
  if(!label||label.length<2||label.length>130||bad.test(label))continue;
  const type=tag==='input'?(props.match(/\btype\s*=\s*["']([^"']+)["']/)?.[1]||'text'):tag;
  const opts=tag==='select'?s.slice(end+1,end+1700):'';
  const options=tag==='select'?[...opts.matchAll(/<option[^>]*>([^<]{1,80})<\/option>/g)].map(x=>x[1]):[];
  const onClick=tag==='button'?(props.match(/onClick\s*=\s*\{\s*([A-Za-z_][\w.]*)\s*\}/)?.[1]||''):'';
  const item={type,label,description:controlDescription({type,label})};
  if(placeholder&&normalize(placeholder)!==label)item.placeholder=normalize(placeholder);
  if(options.length)item.options=options.slice(0,10).map(normalize);
  if(onClick)item.action=onClick;
  found.push(item);
 }
 const seen=new Set();
 return found.filter(x=>{
  const key=x.type+'|'+x.label.toLowerCase();
  if(seen.has(key))return false;seen.add(key);return true;
 }).slice(0,175);
}
const navRoutes=navSections.flatMap(g=>g.items.map(x=>({...x,section:g.label})));
const screens=navRoutes.map(item=>{
 const r=routeMap.get(item.path)||routeMap.get(item.path.split('?')[0]);
 const possible=r?.source?path.join(src,r.source.replace(/^\.\//,''))+'.jsx':null;
 const file=possible&&fs.existsSync(possible)?possible:null;
 return {section:item.section,title:item.label,path:item.path,purpose:item.keywords||'',
  source:file?path.relative(root,file).replaceAll('\\','/'):'',
  controls:file?controlsIn(file):[],
 };
});
const uniqueSources=new Set(screens.map(x=>x.source).filter(Boolean));
const extras=sourceFiles.filter(f=>!uniqueSources.has(path.relative(root,f).replaceAll('\\','/')))
 .map(f=>({source:path.relative(root,f).replaceAll('\\','/'),
    controls:controlsIn(f)})).filter(x=>x.controls.length>0);
const catalog={version:GUIDE_VERSION,generatedAt:new Date().toISOString(),screens,extraComponents:extras,
 visibleRoutes:screens.length,controls:screens.reduce((n,x)=>n+x.controls.length,0),additionalControls:extras.reduce((n,x)=>n+x.controls.length,0)};
fs.mkdirSync(path.dirname(catalogFile),{recursive:true});
fs.writeFileSync(catalogFile,JSON.stringify(catalog,null,2)+'\n');

// Audit records are deliberately separated into code-reviewed examples and
// independently verified browser/plugin screens. Do not claim full coverage.
const conditionalAudit=JSON.parse(fs.readFileSync(path.join(src,'application-guide','conditionalDialogs.json'),'utf8'));
const wordpressAudit=JSON.parse(fs.readFileSync(path.join(src,'application-guide','wordpressPluginAudits.json'),'utf8'));
const auditReport=documentationCoverage({
 screens,dialogs:conditionalAudit.dialogs||[],plugins:wordpressAudit.plugins||[]
});
const auditHandoff=JSON.parse(fs.readFileSync(path.join(root,'docs','wordpress-audit','AUDIT_COMPLETE.json'),'utf8'));
if(auditHandoff.status!==wordpressAudit.auditStatus)throw Error('WordPress audit report/registry status mismatch.');
const inspectedWordPressScreens=wordpressAudit.plugins.reduce((sum,p)=>sum+
 [...(p.adminScreens||[]),...(p.publicScreens||[])].length,0);
const inspectedWordPressFields=wordpressAudit.plugins.reduce((sum,p)=>sum+
 [...(p.adminScreens||[]),...(p.publicScreens||[])].reduce((n,page)=>n+(page.controls||[]).length,0),0);

if(auditReport.invalid.length)throw Error('Documentation registry invalid: '+auditReport.invalid.join('; '));
fs.writeFileSync(path.join(root,'public','documentation-audit-report.json'),
 JSON.stringify(auditReport,null,2)+'\n');


// The PDF is a static generated public asset; browsing or downloading it requires no database role.
const pdf=new jsPDF({orientation:'portrait',unit:'pt',format:'letter',compress:true});
const W=612,H=792,margin=48,bodyW=W-2*margin,footerY=766;
let y=65,sectionNumber=0,page=1;
const navy=[22,45,61],teal=[10,104,102],muted=[72,86,101],dark=[31,43,53];
function newPage(){
 pdf.addPage();page++;y=60;
}
function ensure(height=30){if(y+height>735)newPage();}
function textLines(v,{size=9.2,color=dark,weight='normal',indent=0,leading=13,spaceAfter=5}={}){
 const text=ascii(v);if(!text)return;
 pdf.setFont('helvetica',weight);pdf.setFontSize(size);pdf.setTextColor(...color);
 const lines=pdf.splitTextToSize(text,bodyW-indent-20);
 for(const line of lines){
  ensure(leading+2);
  // Reserve extra width for glyph spacing differences across PDF renderers.
  pdf.text(line,margin+indent,y,{maxWidth:bodyW-indent-12});
  y+=leading;
 }
 y+=spaceAfter;
}
function heading(v,{level=1}={}){
 ensure(level===1?65:40);
 const size=level===1?17:level===2?12.5:10.5;
 pdf.setFont('helvetica','bold');pdf.setFontSize(size);pdf.setTextColor(...(level===1?navy:teal));
 const lines=pdf.splitTextToSize(ascii(v),bodyW-22);
 y+=level===1?16:10;
 for(const line of lines){ensure(size+5);pdf.text(line,margin,y);y+=size+3;}
 y+=level===1?11:7;
}
function para(v){textLines(v,{size:9.4,leading:14,spaceAfter:8});}
function bullet(v,index=null){
 const prefix=index===null?'- ':(index+'. ');
 textLines(prefix+v,{size:8.9,leading:12.5,indent:9,spaceAfter:3});
}
function mini(v){textLines(v,{size:8.3,color:muted,leading:11.5,spaceAfter:3});}
function callout(title,message){
 ensure(65);
 pdf.setDrawColor(...teal);pdf.setLineWidth(2);
 pdf.line(margin,y-4,margin,Math.min(y+30,728));
 textLines(title,{size:10.2,color:teal,weight:'bold',indent:10,spaceAfter:3});
 textLines(message,{size:8.9,indent:10,leading:13,spaceAfter:9});
}
function controlBlock(c,i){
 const line=String(i)+'. '+c.label+' ('+c.type+')';
 textLines(line,{size:8.8,weight:'bold',leading:12,spaceAfter:1});
 textLines(c.description,{size:8.5,color:muted,leading:12,indent:8,spaceAfter:2});
 if(c.placeholder)mini('Displayed hint: '+c.placeholder);
 if(c.options?.length)mini('Visible options in source include: '+c.options.join(', '));
}
function finish(){
 const count=pdf.getNumberOfPages();
 for(let i=1;i<=count;i++){
  pdf.setPage(i);pdf.setDrawColor(216,225,231);pdf.line(margin,748,W-margin,748);
  pdf.setFontSize(8);pdf.setTextColor(...muted);
  pdf.text('SKILLED CRAFTING  /  APPLICATION AND WORDPRESS OPERATIONS GUIDE',margin,footerY);
  pdf.text('Page '+i+' / '+count,W-margin,footerY,{align:'right'});
 }
}
const chapterCount=guideChapters.length;
const controlCount=catalog.controls+catalog.additionalControls;
// Cover
pdf.setFillColor(...navy);pdf.rect(0,0,W,270,'F');
pdf.setFillColor(...teal);pdf.rect(0,270,W,10,'F');
pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(29);
pdf.text('SKILLED CRAFTING',margin,110);
pdf.setFontSize(19);pdf.text('Application & WordPress',margin,151);
pdf.text('Complete User Guide',margin,181);
pdf.setFontSize(10);pdf.setFont('helvetica','normal');
pdf.text('NOVICE WALKTHROUGHS  -  OWNER SCENARIOS  -  ADVANCED OPERATIONS',margin,224);
y=320;heading('Release reference '+GUIDE_VERSION,{level:2});
para('This guide combines the latest application source, October 29 workflow additions, and the October 22 live WordPress browser audit. WordPress plugin inventory and live integration certification remain partial. A visually observed control is not proof of saving, checkout, shipping, synchronization or printing.');
callout('SAFETY FIRST','Source-derived control listings are an interface inventory, not proof that every control is visible to every role or that it is safe to click. Buttons that save, synchronize, delete, place orders, email, publish, receive, or change stock must be practiced in read-only training or under supervision.');
para(chapterCount+' detailed guide chapters | '+screens.length+' navigation-linked screens | '+controlCount+' named interface controls and nested UI references.');
para('Generated: '+new Date().toISOString().slice(0,10)+'. Application routes and plugin interfaces may change after this build. Consult the live screen for current labels.');
newPage();heading('How to use this manual');
bullet('Part I explains the shop workflow and essential beginner concepts.');
bullet('Part II walks through the application by screen, including detected inputs, dropdowns and buttons.');
bullet('Part III gives detailed reference topics from the living application guide.');
bullet('Part IV shows real business-client scenarios with decisions, handoffs and checks.');
bullet('Part V describes the WordPress site and plugin workflows.');
bullet('Part VI focuses on data integrity, security, troubleshooting and advanced controls.');
bullet('Part VII lists online training modules and safe learning methods.');
callout('IMPORTANT LIMITATION','Conditional controls, modal dialogs, imported component widgets, third-party plugin UIs and dynamically generated forms may vary by role, device or current data. This manual lists all identifiable source controls and flags these limitations; it must be reviewed whenever software changes.');
heading('Part I - First day and core workflow');
para('Skilled Crafting handles marketing, client orders, WooCommerce storefronts, QuickBooks-invoiced group orders, artwork, inventory, purchasing, production, QC, packing and delivery. Most jobs pass through the Work Hub; specialist screens remain authoritative for the record they manage.');
[
 ['1. Customer / lead','Use Marketing and client records to capture the relationship and next actions.'],
 ['2. Order type','Recurring organization stores use WooCommerce. One-time group forms are reviewed in Client Orders and invoiced through QuickBooks. Do not create duplicate orders.'],
 ['3. Artwork','Collect the submitted file, mock up its proposed placement and obtain the real customer approval. An artwork file alone is not approval.'],
 ['4. Blank inventory','Pair the product, verify sizes/colors and reservations, and purchase shortages using the Purchasing Report.'],
 ['5. Recipe & production','Use the approved machine and material recipe, measured placement guide, and QR traveler for the exact order.'],
 ['6. QC and fulfillment','Record official QC, pack, confirm pickup or shipment and close the authoritative job.'],
].forEach(([h,p])=>{heading(h,{level:3});para(p);});
heading('Part II - Application walkthrough by screen');
para('Each section below uses the main application navigation. Where a screen includes a source-detectable field or button, it is named with its purpose. Controls can appear conditionally; if you do not see one, first check the selected tab, current permissions and whether an item is open.');
let currentSection='';
for(const screen of screens){
 if(screen.section!==currentSection){currentSection=screen.section;heading(currentSection,{level:1});}
 heading(screen.title+'  |  '+screen.path,{level:2});
 para(screen.purpose?capitalize(screen.purpose.replaceAll(' ', ', '))+'.':'Open this screen to use its named business function; check the current role and linked workflow.');
 if(screen.controls.length){mini('Visible source control reference ('+screen.controls.length+' detected):');screen.controls.forEach((c,i)=>controlBlock(c,i+1));}
 else mini('This route uses a navigation or dynamic component. Follow the online guide and page-specific prompts; no static controls could be reliably enumerated from the route source.');
}
heading('Other screens and nested controls',{level:1});
para('Many workflows use dialogs and child components inside a parent page. The following additional source modules contain user interface controls. They can be conditional or available only to particular roles. Use the control label and the live page as the final source of truth.');
for(const file of extras){
 heading(file.source.replace(/^src\//,''),{level:3});
 for(let i=0;i<file.controls.length;i++)controlBlock(file.controls[i],i+1);
}
heading('Part III - Complete operational reference',{level:1});
para('The following material is derived from the current application living guide, including October 29 additions. Read it alongside the screen-by-screen control reference to understand why each feature exists, how it connects to adjacent tasks, and what risks are involved.');
for(const chapter of guideChapters){
 heading(chapter.title,{level:1});
 para(chapter.description);
 for(const item of chapter.sections){
  heading(item.title,{level:2});para(item.summary);
  if(item.scenario)callout('Where this applies',item.scenario);
  if(item.useWhen?.length){heading('When to use it',{level:3});item.useWhen.forEach(b=>bullet(b));}
  if(item.steps?.length){heading('Walkthrough',{level:3});item.steps.forEach((step,i)=>bullet(step,i+1));}
  if(item.tips?.length){heading('Owner / advanced notes',{level:3});item.tips.forEach(b=>bullet(b));}
  if(item.warnings?.length){heading('Stop and verify',{level:3});item.warnings.forEach(b=>bullet(b));}
  if(item.relatedRoutes?.length)mini('Related screens: '+item.relatedRoutes.join(', '));
 }
}
heading('Part IV - Realistic customer and employee scenarios',{level:1});
para('The names below are representative example clients, not real customer data. Each scenario explains what the business owner and a new helper should do and how records pass through the application.');
const scenarios=[
 {name:'Scenario A - A school opens an annual spiritwear storefront',points:[
 'A school representative requests a year-round online store. Create/qualify the organization in Marketing; record primary contact, school colors, logo source, product ideas and order/reorder cadence.',
 'Start a recurring WooCommerce campaign in Team Stores. Choose the School Pride WordPress template and confirm readable logo-based colors. Assign an organization-specific WooCommerce product category.',
 'Approve the proposed catalog, designs, variants, prices, ordering instructions, deadline and pickup terms. Generate the WordPress draft and have the school review it.',
 'Publish only after manager and client approval. Do a controlled WooCommerce checkout test; do not confuse direct product URLs with a private invitation-only store.',
 'Paid Woo line items enter existing Woo sync and production jobs. Open the Work Hub, check stock, QR travelers, decoration instructions and QC; use the team purchasing view for demand rather than placing duplicate supplier POs.',
 'At season end clone the draft while reconfirming prices, designs, product categories, dates and client approvals. Old orders and inventory movements must not be duplicated.'
 ]},
 {name:'Scenario B - A one-time youth soccer hoodie order',points:[
 'The coach has a roster, sizes, player names and numbers but does not need a store. Send the existing /team-order online form, using a group campaign code as appropriate.',
 'In Client Orders verify quantity, garment brand/style/color/size, decoration placement and all personalized spellings. Confirm customer-approved quote and artwork.',
 'Export the existing QuickBooks invoice information, invoice through QuickBooks, and record actual payment. Do not route this customer through WooCommerce just because they are a team.',
 'Convert the paid request to the manual production job once. Use one pull sheet and reservation trail. If a product is not paired, correct the mapping instead of forcing a stock adjustment.',
 'Print QR production travelers and hand off garments for pressing. Verify personalized labels against the actual customer roster and paid order.',
 'Complete QC on the exact job, pack by player, record pickup, and close on the Production Board. File a spoilage/reprint record for mistakes.'
 ]},
 {name:'Scenario C - A small business requests branded staff polos',points:[
 'Capture company contact, quantities and whether this is a standing reorder or occasional invoice in Marketing.',
 'Import the logo to Artwork/Mockup Studio, prepare a left-chest placement on a polo template, and confirm measured print width and distance from the placket.',
 'Have the client approve the actual mockup/version and price. Record special name embroidery/DTF handling as applicable; do not treat an image being present as approval.',
 'Verify polo brand, available sizes, blank inventory bins and reorder minimums before quoting deadline.',
 'Prepare a checked manufacturing recipe with heat press material/temperature requirements and a QR traveler. A family helper should read these rather than guess placement.',
 'Run QC for placket alignment, color and sizes. Provide a consolidated delivery manifest and record handoff.'
 ]},
 {name:'Scenario D - Community fundraiser with a dedicated store',points:[
 'Define who receives the benefit, eligible product categories, per-item or percentage fundraising formula, organization approvals and end date in the marketing and campaign records.',
 'Choose Community Fundraising layout, draft client category products, approve artwork and publish through WordPress/WooCommerce only.',
 'Reconcile real paid Woo product line sales, discounts and refunds. Review ambiguous refunds; do not consider preliminary dashboard estimates a payable settlement.',
 'Consolidate production and pickup by organization. Review final order line totals and returns against WooCommerce and QuickBooks before authorizing a payout.',
 'Provide a coordinator only the aggregate dashboard; never disclose other customer purchases, payment credentials or internal wholesale pricing.'
 ]},
 {name:'Scenario E - Customer supplies an AI-generated DTF graphic',points:[
 'Keep the original file. Inspect text, spelling, dimensions, transparency and whether the customer owns/licensed content. Obtain approval before reproducing.',
 'Run DTF Artwork Preflight for 300 DPI target and the actual print size. Remove background only when safe; protect white parts that belong to the design.',
 'Inspect halos and fine lines manually at print size. Export a new version; avoid replacing the original. A change in DPI metadata does not create missing detail.',
 'Create a customer mockup, position with the appropriate tee/hoodie guide, and obtain approval of color, scale and garment.',
 'Associate the correct artwork/version and traveler with the job. Complete printing and QC: inspect edge cleanup, defects, placement, wash durability and count.'
 ]},
 {name:'Scenario F - UV patch or laser personalization job',points:[
 'Identify substrate: leather/synthetic patch, compatible film or metal for Omni UV; confirm material suitability and adhesion test before promising durability.',
 'Use the UV Studio and Material Settings library for the actual machine/material/fixture/lens combination. A stored setting is a starting point until real testing validates it.',
 'Prepare texture/white/varnish or laser vector artwork without confusing a simulated preview with machine-ready output.',
 'Approve the client design and create a production recipe/QR traveler. Record batch layout, relief or marking settings, production date and test material used.',
 'Perform first-article inspection, batch QC, packing and release; document misprints and any machine maintenance.'
 ]},
 {name:'Scenario G - A wrong-size delivery and reprint',points:[
 'Do not overwrite the original order or edit stock merely to make counts balance. Record what the customer received and the discrepancy.',
 'Check the ordered variant, actual pull sheet, product pairing and inventory movements. Compare Woo, manual invoice and Supabase job references.',
 'Record the spoilage/return or adjustment using the appropriate authoritative workflow; choose the right location for returned usable finished stock.',
 'Create any replacement work through the appropriate job/order workflow; confirm it is not a duplicate from retrying a failed request.',
 'Verify returned or damaged merchandise separately from new stock, then complete QC and customer handoff with a documented resolution.'
 ]},
 {name:'Scenario H - Family helper takes over an urgent job',points:[
 'Owner opens Work Hub and records a specific handoff with what needs doing, due date and where approved artwork resides.',
 'Helper begins with the read-only guided training drill; then opens the real job and checks every status label, not assuming linked evidence means completed.',
 'Helper verifies size/color count, blank reservations, QR recipe and measured print placement; asks before making stock or billing changes.',
 'After decorating, helper opens the exact QC checklist and records inspection under their own identity. A failed QC must trigger correction, not packing.',
 'Pack and record a true pickup/shipping event. Owner reconciles job status and client communication; family training completion alone grants no extra permissions.'
 ]},
];
for(const scenario of scenarios){heading(scenario.name,{level:2});scenario.points.forEach((v,i)=>bullet(v,i+1));}
heading('Part V - WordPress and WooCommerce plugin operations',{level:1});
const plugins=[
 {title:'Skilled Crafting Client Storefronts (repository plugin)',steps:[
 'Install and activate the Skilled Crafting Client Storefronts WordPress companion plugin. The plugin creates a Client Storefronts content type and /stores/{slug}/ native WordPress landing pages.',
 'Make a dedicated WordPress account with edit_pages and manage_woocommerce capability; create an Application Password. Store secrets only in server-side Netlify variables SC_WP_USERNAME and SC_WP_APP_PASSWORD.',
 'In the app Team Stores choose WooCommerce for a recurring school/team. Select Athletics, School Pride, Corporate or Community Fundraising structural layout; upload logo, review suggested primary/secondary/accent colors.',
 'Choose/create a client-specific Woo product category. Only published visible products in that category (and descendants) are shown on that client landing page. Product URLs and shop searches are not necessarily private.',
 'Create a draft, review WordPress preview, secure customer approval, and have a manager publish. WordPress remains source of storefront page/checkout and WooCommerce remains source of paid orders.',
 'Use [sc_client_store_directory] shortcode on the WordPress Find Your Store page. Update /team-orders/ to distinguish recurring WooCommerce store from occasional QuickBooks-invoiced group order.',
 'The plugin coordinates theme accents through product/cart/checkout for that store context; mixed-client carts fall back to neutral checkout. Verify block checkout/classic checkout in the live Divi site.',
 'Closing a campaign hides the landing page but may not unpublish separate WooCommerce product URLs. Review product status separately if orders must stop.'
 ]},
 {title:'WooCommerce / Skilled Crafting stock sync',steps:[
 'Maintain Woo parent/variation products with stable brand/style/color/size attributes and unique SKU. Map each blank to the correct application catalog product.',
 'Validate that Woo API keys, webhooks, WordPress REST endpoints and update-stock permissions are configured. Inspect data mappings after product edits and avoid bulk duplicate creation.',
 'A successful Woo checkout should create one linked order and one production demand path. Verify status, line item quantities, tax/shipping treatment and reservations.',
 'Avoid retrying timed-out bulk sync, receiving or manual order conversion before checking whether the first request completed. Use deployment/integration health pages and audit logs.'
 ]},
 {title:'WordPress client forms, product options, art requests and documents',steps:[
 'Confirm which plugins are actually installed in WordPress; the application guide references product options, document/packing-slip tools and artwork intake integrations but their plugin code is not all in this repository.',
 'Product personalizations (player name, jersey number, selected sizes/colors) must be captured in the authoritative Woo order line or client form, not only a separate packing roster.',
 'Review client form submissions inside Client Orders; use existing QuickBooks export and manual production conversion gates for occasional orders.',
 'For any artwork plugin request, inspect the original submitted asset, customer selection, proof approval and R2 storage status before production.',
 'Documents and labels should reflect the approved order and actual stock/pulled quantities, not a draft mockup or marketing estimate.'
 ]}
];
for(const plugin of plugins){heading(plugin.title,{level:2});plugin.steps.forEach((v,i)=>bullet(v,i+1));}
heading('Part VI - Operations and data-integrity assistance',{level:1});
const integrity=[
 ['Daily startup','Open Work Hub, Daily Command Center, exceptions, Purchasing and operations calendar. Confirm yesterday downloads/uploads and current API sync health before receiving inventory.'],
 ['Duplicate orders','Use source Woo order ID, manual invoice record and job ID to check whether work already exists before creating a new job or retrying a timed-out request.'],
 ['Inventory conservation','Receiving increases on-hand only after physical receipt. Reservation is not receipt; pulling must consume once. Never use quantity edits to hide wrong SKU mapping or duplicate demand.'],
 ['Purchasing shortages','Distinguish demand, reserved stock, supplier open orders, received stock, pending assignment and non-inventory rules. A team demand summary is not automatically an order to buy.'],
 ['Artwork integrity','Protect original assets, approved revisions, mockup output ID, R2 storage keys and the actual production file used. Verify download before deleting or archiving.'],
 ['Customer proof','Only a recorded customer decision for the exact version supports approval. Approval file references and QR travelers are distinct from final customer sign-off.'],
 ['QC and delivery','Latest QC passing record is required for actual pickup/shipping evidence. A QC pass or packed flag does not prove customer collection. Inspect actual physical products.'],
 ['Security and access','Use least-privilege staff roles, private R2 objects, WordPress Application Password server secrets and restricted coordinator links. Do not paste API credentials into customer or training forms.'],
 ['Legacy policies','Certain older artwork and photo tables may have broad legacy grants. Verify table policies and customer visibility before storing new confidential data.'],
 ['Data backup','Keep recoverable Supabase database backups, WordPress backups, GitHub source, Netlify environment secret inventory and offsite asset storage/restore plan. Rehearse recovery on safe test data.'],
 ['Firmware and shop devices','Treat Home Assistant/device telemetry as advisory. Validate laser, UV, heat press and print settings on real materials. Network monitors do not replace machine safety interlocks or physical checks.'],
 ['Change management','Develop on a branch; run unit, security, lint and build tests. Apply additive migrations with backups. Record changed screens in the guide and test the business workflow before production merge.'],
 ['Outages','If WordPress or Woo cannot authorize, stop publication; if QBO cannot import, do not silently mark invoice paid; if Supabase cannot confirm reservation, do not guess stock.'],
 ['Customer data','Keep sensitive personal information, family names, roster data and customer contacts private. Use coordinator aggregate views, not unrestricted payment/order tables.'],
 ['Accounting close','Reconcile Woo paid/refunded product lines, QuickBooks invoice status, spoilage, costs and fundraisers. Estimated fundraiser earnings are not an approved payout ledger.'],
];
for(const [title,detail] of integrity){heading(title,{level:2});para(detail);}
heading('Problem-to-action troubleshooting',{level:2});
[
 ['Woo checkout or store missing products','Confirm product publish/visibility, category assignment, Woo REST credentials, client store category ID and cached page/checkout context.'],
 ['WordPress store cannot publish','Check plugin Active, WordPress Application Password role, SC_WP_USERNAME and SC_WP_APP_PASSWORD in server environment, WordPress permalinks and hosting WAF.'],
 ['Pull sheet quantity incorrect','Compare Woo line items, blank mapping, existing active reservations, pending stock and duplicate job items. Audit transactions; do not bulk change on-hand.'],
 ['Supabase authorization denied','Check signed-in employee account, role mapping, RLS policy and environment deployment. Never disable RLS in production to make a button work.'],
 ['Art/mockup is blank or broken','Verify R2 object exists, upload metadata, asset signed URL expiry, original source and actual output. Do not overwrite the only client original.'],
 ['Label prints blank after first page','Inspect label template, printer media/driver, repeat quantity settings and browser print size; test on one label before batch print.'],
 ['Production status stuck or read-only transaction','Check whether the write endpoint/RPC can update the actual table, DB transaction mode, status guard and audit log; do not force it with direct SQL.'],
 ['Wrong material machine result','Compare exact substrate, fixture, lens, coating, temperature, humidity, print/laser settings and versioned recipe. Calibrate and mark failed test media as scrap.'],
 ['QR scan opens wrong traveler','Confirm printed job and job-item IDs, recipe revision and readable QR link; regenerate from the authoritative traveler rather than editing a printed label.'],
 ['Customer missed deadline','Review production calendar, client communications, purchasing ETA, QC blockers and delivery method; update expectations with the customer before silently changing due date.'],
].forEach(([title,detail])=>{heading(title,{level:3});para(detail);});
heading('Part VII - Online guided training and sign-off',{level:1});
para('The application has an online training coach and a separate Testing Mode. A visible testing banner does not guarantee that every third-party workflow is simulated. Read-only observation is the default for unsupported actions.');
for(const tutorial of trainingTutorials){
 heading(tutorial.title,{level:2});para(tutorial.summary);
 mini('Roles: '+(tutorial.roles||[]).join(', ')+'  |  Safety: '+tutorial.safeMode+'  |  Approx. '+tutorial.minutes+' min.');
 for(let i=0;i<(tutorial.steps||[]).length;i++){
  const step=tutorial.steps[i];
  bullet(step.title+': '+step.instruction,i+1);
  if(step.verify)mini('Verify: '+step.verify);
  if(step.warning)mini('Stop: '+step.warning);
 }
}

heading('Part VIII - WordPress Audit Evidence and Open Verification',{level:1});
para('Audit completed October 22, 2026 with PARTIAL status. WordPress installed-plugin inventory: '+
 auditHandoff.auditedCounts.installedPlugins+' plugins ('+auditHandoff.auditedCounts.activePlugins+' active, '+
 auditHandoff.auditedCounts.inactivePlugins+' inactive), '+auditHandoff.auditedCounts.dropIns+
 ' drop-ins. '+inspectedWordPressScreens+' screen/section references, '+inspectedWordPressFields+
 ' actual observed field/control records. '+auditHandoff.auditedCounts.inventoryOnlyPlugins+
 ' plugins received inventory-only coverage. No plugin has been fully certified end-to-end.');
callout('READ THE VERIFICATION LEVEL','The full per-field novice and advanced descriptions are in Part III under the WordPress Audit Chapters. A verified screen means the administrator saw it, not that a save, migration, shipment, customer email, or transaction was executed. Never perform such operations just to complete documentation.');
para('Conditional dialog audit: '+auditReport.dialogCount+' cases, '+auditReport.liveVerifiedDialogs+
 ' narrowly live-verified shipping visibility cases. Existing application dialog examples remain source reviewed or pending. No raw WordPress screenshots were included.');
heading('Important owner findings',{level:2});
para('A deeper source-and-configuration review from Work (PR #106) now confirms several implementation differences. This is still not staging acceptance or proof of a faulty real checkout charge.');

[
 'Installed Storefronts 0.1.2 PHP/CSS was compared directly with repository 0.1.3. The deployed version lacks product-page client-context resolution, store category related-product filtering and recently-viewed widget suppression. No cross-client exposure was observed. Stage/test before any two-file update.',
 'Skilled Crafting Product Options runs in observed Replacement mode while legacy option reading is enabled. Preserve existing order line metadata and test representative products before change.',
 'Custom SKU Builder and SkyVerge register overlapping enabled SKU-writing hooks; active WP Wham had its internal generation switch OFF. The custom batch rebuild lacks nonce protection on a state-changing GET and should NOT be used until hardened. Staging must determine actual save paths.',
 'Woo core free shipping requires >= $200 on post-discount tax-exclusive displayed subtotal OR a valid free-shipping coupon. The separate Advanced Free Shipping rule uses exact equality at tax-inclusive pre-discount subtotal $200. No real checkout totals were measured.',
 'The owner confirmed the existing 100% coupon with free shipping is intentional. Do not disable, expire, or restrict it without a separate explicit decision; the private coupon code is omitted.',
 'Some Spirit Wear classes intentionally offer no-charge distribution. Zero flat-rate base alone does not mean all parcels ship free; no-class fees and shipping-class costs vary, while a blank Heavy fallback fee permits a potential zero-cost path.',
 'Print Documents generation logging and browser auto-open do not prove physical printing, correct packing or handoff.',
 'Navigation uses both /shop-new/ and /find-your-store/ paths; verify intended customer journey before simplifying.',
].forEach((v,i)=>bullet(v,i+1));
heading('Partial verification inventory',{level:2});
para('Each plugin listed below was included in the signed-in WordPress inventory. This section identifies how much of its UI was reviewed; it does not duplicate the 405 field definitions already in Part III.');
for(const p of wordpressAudit.plugins||[]){
 const pages=[...(p.adminScreens||[]),...(p.publicScreens||[])];
 const ctrls=pages.reduce((n,x)=>n+(x.controls||[]).length,0);
 mini(p.name+' / '+(p.installedVersion||'unknown')+' / '+p.activationStatus+
  ' / '+pages.length+' observed sections / '+ctrls+' controls / '+p.reviewStatus);
}
heading('Important remaining work',{level:2});
[
 'Twenty-nine installed plugins need their plugin-specific administrative screens and conditional options reviewed.',
 'All consequential save, checkout, product sync, plugin compatibility, SKU rewrite, document print, label purchase and order/invoice behaviors need safe nonproduction evidence.',
 'Role/device differences, customer forms, artwork request-level approval dialogs and many shipping zone/coupon conditions are not exhaustively verified.',
 'No sanitized live WordPress screenshots were retained; visual tutorials can use approved fictional screenshots after a safe capture workflow.',
 'No documentation status should be upgraded to complete until these gaps are closed and the business owner reviews high-impact settings.',
 'Read-only owner remediation decisions are documented in docs/wordpress-audit/OWNER_REMEDIATION_APPROVAL_20261022.md. No staging, plugin updates, SKU repairs, coupon restrictions or rate changes are approved simply by this manual.'
].forEach((v,i)=>bullet(v,i+1));
if(auditHandoff.status!=='complete')callout('AUDIT PARTIALLY COMPLETE','The WordPress inventory is verified but operating- and dialog-level coverage is incomplete. Keep this edition labelled partially verified; use the admin Documentation Audit tab to track remaining work.');

heading('Guide coverage and maintenance notes',{level:1});
para('This PDF is built from '+screens.length+' navigation-linked screens, '+extras.length+' additional JSX components, '+chapterCount+' reference chapters, '+trainingTutorials.length+' named training modules and '+controlCount+' unique source-observed controls. A source scan cannot prove all controls are visible or that each dynamic field was captured. It is a high-coverage development reference rather than a substitute for checking the live interface.');
para('Update this manual after every new application workflow, plugin update or authenticated audit. The online Application Guide and its Documentation Audit tab track which behaviors have actually been verified. This PDF is a dated snapshot, not a guarantee of current production state.');
finish();
fs.mkdirSync(path.dirname(out),{recursive:true});
pdf.save(out);
console.log(JSON.stringify({file:out,pages:pdf.getNumberOfPages(),bytes:fs.statSync(out).size,screens:screens.length,extraComponents:extras.length,controls:controlCount,chapters:chapterCount,wordpressPlugins:wordpressAudit.plugins.length,wordpressInspectedScreens:inspectedWordPressScreens,wordpressObservedFields:inspectedWordPressFields,auditStatus:auditHandoff.status},null,2));
