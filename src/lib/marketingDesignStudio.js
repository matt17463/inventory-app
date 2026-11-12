import {studioLayoutStyle,normalizeStudioLayout} from "./marketingStudioLayoutControls.js";
import {marketingTheme} from "./marketingDesignSystem.js";
import {schoolFundraisingExample} from "./marketingSchoolFundraising.js";
import {normalizeStudioServices} from "./marketingStudioServices.js";
import {validateStudioRetailPricing} from "./marketingStudioRetailPricing.js";
/** Shared AI-first document design prompt library and safe print layout. */
export const DESIGN_CATEGORIES={
 school:{label:"School spirit wear",brief:"Create a premium school-specific sports marketing flyer with a dramatic mascot-led hero, photorealistic school apparel, four program benefits, four illustrated ordering steps, a fundraising example, product showcase and a bold call to action. Adapt the personality to elementary, middle or high school. Additional creative requirements: Full-color US Letter premium school flyer; preserve exact approved school logo, mascot and colors; photorealistic decorated hoodies, tees, caps and beanies; layered athletic scenery, dramatic typography-safe hero, school pride, fundraising, online orders, local support, four ordering steps, illustrative wholesale-retail examples, product showcase and strong call to action. Elementary: friendly; middle: modern; high school: collegiate. No invented facts."},
 business:{label:"Business apparel",brief:"Create a premium commercial campaign with realistic embroidered workwear, custom uniforms, branded gifts, product photography, compelling business benefits and a polished contact section. Additional creative requirements: Premium commercial US Letter flyer; real business identity, professional embroidered uniforms, workwear, branded gifts, product showcase, consultation and proofing steps, clear benefits and verified contact. Adapt to client's industry; no invented prices."},
 team:{label:"Sports teams and clubs",brief:"Create an energetic athletic campaign with team crest, stadium atmosphere, jerseys, fan merchandise, coach recognition and team ordering options. Additional creative requirements: Dynamic sports club US Letter flyer; preserve approved crest and colors; realistic jerseys, fan hoodies, caps, coach gifts, stadium imagery, team benefits, ordering, fundraising, product showcase and strong call to action."},
 nonprofit:{label:"Nonprofit fundraising",brief:"Create a community-focused fundraising campaign with organization branding, tasteful emotional storytelling, realistic merchandise, donation or program support messaging and a clear call to action. Additional creative requirements: Mission-driven nonprofit US Letter campaign; authentic community imagery, approved organization identity, merchandise fundraising, supporter benefits, ordering steps and clear contact. Never invent impact figures."},
 wedding:{label:"Weddings",brief:"Elegant weddings, ceremonies and receptions with verified personalized glassware, engraved keepsakes, table signage and coordinated gifts. Refined floral/typographic atmosphere and approved client imagery; no unapproved dates or claims."},
 event:{label:"Events and celebrations",brief:"Celebrate a verified festival, fundraiser, reunion, conference, graduation or community event with dynamic merchandise, customized signage, practical event ordering, and audience-specific design. Do not imply an unverified event date, attendance or beneficiary."},
 general:{label:"Other promotional materials",brief:"Create a striking premium editorial advertising design with realistic products, strong brand identity, visual storytelling, and a clear call to action. Additional creative requirements: Distinctive premium US Letter marketing flyer; cinematic realistic products, approved branding, layered depth, benefits, process, product showcase, verified terms and strong call to action."}
};
export const DESIGN_STYLES=[
 {id:"athletic",label:"Premium athletic",direction:"dramatic lighting, layered school or team scenery, bold athletic hierarchy, dynamic angled accents"},
 {id:"editorial",label:"Modern editorial",direction:"luxury magazine art direction, elegant typography, sophisticated product photography, balanced whitespace"},
 {id:"expressive",label:"Bold creative",direction:"colorful graphic treatments, energetic illustration, rich textures and asymmetrical composition"}
];
export function designCategory(template="",segment=""){
 const s=(template+" "+segment).toLowerCase();
 if(/school/.test(s))return "school";
 if(/wedding|bridal|reception|marriage/.test(s))return "wedding";
 if(/event|festival|reunion|graduation|conference|celebration/.test(s))return "event";
 if(/sport|team|coach|club/.test(s))return "team";
 if(/nonprofit|fundrais|charit|pta|pto/.test(s))return "nonprofit";
 if(/business|uniform|corporate|workwear/.test(s))return "business";
 return "general";
}
export function designStudioPrompt({category="general",style="athletic",client="",colors=[],instructions="",variation=0}={}){
 const c=DESIGN_CATEGORIES[category]||DESIGN_CATEGORIES.general;
 const st=DESIGN_STYLES.find(x=>x.id===style)||DESIGN_STYLES[0];
 const palette=(Array.isArray(colors)?colors:[]).filter(x=>/^#[0-9a-f]{6}$/i.test(x)).slice(0,5).join(", ");
 return ["SKILLED CRAFTING AI DESIGN STUDIO","Client: "+String(client).slice(0,140),
 "Design category: "+c.label+". "+c.brief,
 "Art direction: "+st.direction+". Palette: "+(palette||"use approved client branding")+".",
 "Create one distinctive concept with sophisticated composition, depth, real-looking products, and strong visual hierarchy.",
 "Concept variation "+(Number(variation)+1)+": "+["cinematic, product-led composition","illustrative, identity-led composition","editorial, benefit-led composition"][Number(variation)%3]+".",
 "Client instructions: "+String(instructions||"").slice(0,12000),
 "Return a text-free background/hero illustration. Do not render copy, numbers, prices, phone numbers, logos or factual claims into the image. Verified editable content and the actual approved logo are composited separately."
 ].join("\n");
}
export function resolveDesignTokens(prompt,values={}){
 const known=new Set(["school_name","school_mascot","school_logo","primary_color","secondary_color","accent_color","school_level","business_phone","business_email","business_website","client_name","client_logo"]);
 return String(prompt||"").replace(/\{\{([a-z_]+)\}\}/gi,(whole,key)=>{
  const id=key.toLowerCase();
  if(!known.has(id))return whole;
  const value=String(values[id]||"").trim();
  return value||"[not supplied; do not invent]";
 });
}
export function safeText(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
export const STUDIO_CATEGORY_COPY=Object.freeze({
 school:{hero:"SPIRIT WEAR FOR YOUR SCHOOL",benefits:"WHY SCHOOLS PARTNER WITH US",collection:"YOUR SCHOOL. YOUR STYLE.",label:"THE SCHOOL SPIRIT COLLECTION",eyebrow:"SIMPLE FROM START TO FINISH",footer:"Program fundraising and ordering terms require confirmation."},
 team:{hero:"GEAR FOR YOUR TEAM",benefits:"BUILT FOR PLAYERS AND SUPPORTERS",collection:"YOUR TEAM. YOUR COLORS.",label:"THE TEAM GEAR COLLECTION",eyebrow:"FROM DESIGN TO GAME DAY",footer:"Team ordering, artwork and program terms require confirmation."},
 business:{hero:"BRANDED APPAREL FOR YOUR BUSINESS",benefits:"ELEVATE YOUR BUSINESS IDENTITY",collection:"MAKE YOUR BRAND VISIBLE.",label:"PROFESSIONAL WORKWEAR & GIFTS",eyebrow:"A CLEAR PROJECT PROCESS",footer:"Product pricing, decoration and delivery terms require confirmation."},
 nonprofit:{hero:"MERCHANDISE FOR YOUR MISSION",benefits:"SUPPORT YOUR COMMUNITY",collection:"MAKE EVERY MESSAGE COUNT.",label:"MISSION-DRIVEN MERCHANDISE",eyebrow:"PLAN YOUR CAMPAIGN",footer:"Any fundraising proceeds and impact claims require written verification."},
 wedding:{hero:"PERSONALIZED WEDDINGS AND GIFTS",benefits:"DETAILS WORTH REMEMBERING",collection:"MADE FOR YOUR CELEBRATION.",label:"THE WEDDING COLLECTION",eyebrow:"FROM IDEA TO CELEBRATION",footer:"Personalization proofs, quantities, prices and delivery dates require confirmation."},
 event:{hero:"CUSTOM MERCHANDISE FOR YOUR EVENT",benefits:"MAKE YOUR EVENT MEMORABLE",collection:"YOUR EVENT. YOUR IDENTITY.",label:"THE EVENT COLLECTION",eyebrow:"FROM PLANNING TO CELEBRATION",footer:"Event timing, ordering, personalization and product availability require confirmation."},
 general:{hero:"CUSTOM APPAREL & MERCHANDISE",benefits:"WHY WORK WITH SKILLED CRAFTING",collection:"MADE FOR YOUR MOMENT.",label:"THE CUSTOM COLLECTION",eyebrow:"SIMPLE FROM START TO FINISH",footer:"Product availability, pricing and program terms require confirmation."}
});
export function studioLayoutSections(plan,variant=0){
 const allowed=["products","benefits","steps"];
 const defaults=[["products","benefits","steps"],["products","steps","benefits"],["benefits","products","steps"]];
 const source=Array.isArray(plan?.sections)?plan.sections:[];
 const sections=[...new Set(source.filter(x=>allowed.includes(x)))];
 return [...sections,...defaults[Math.max(0,Math.min(2,Number(variant)||0))].filter(x=>!sections.includes(x))];
}
/** Keep locked sections at their current indices, moving only unlocked sections. */
export function studioMergeLockedSections(previousPlan,nextPlan,locked=[],concept=0){
 const current=studioLayoutSections(previousPlan,concept);
 const proposed=studioLayoutSections(nextPlan,concept);
 const locks=new Set((Array.isArray(locked)?locked:[]).filter(x=>current.includes(x)));
 const free=proposed.filter(x=>!locks.has(x));
 let n=0;
 return current.map(section=>locks.has(section)?section:free[n++]);
}
export function studioMoveSectionFirst(plan,section,locked=[],concept=0){
 const current=studioLayoutSections(plan,concept);
 if(!current.includes(section)||(Array.isArray(locked)&&locked.includes(section)))return current;
 return studioMergeLockedSections(plan,{sections:[section,...current.filter(x=>x!==section)]},locked,concept);
}
/** Rectangular overlap detection for critical editable regions (not decorative photos). */
export function studioRectanglesOverlap(first,second,padding=2){
 if(!first||!second)return false;
 const values=[first.left,first.top,first.right,first.bottom,second.left,second.top,second.right,second.bottom];
 if(!values.every(Number.isFinite))return false;
 return first.left<second.right-padding&&first.right>second.left+padding&&first.top<second.bottom-padding&&first.bottom>second.top+padding;
}
/** Browser-only final proof check; do not rely on CSS overflow:hidden to mask errors. */
export function inspectStudioPrintDom(doc){
 const issues=[];
 const page=doc?.querySelector?.(".page");
 if(!page){issues.push("Print page is missing.");return issues;}
 const overflow=element=>element&&element.scrollHeight>element.clientHeight+3;
 if(overflow(page))issues.push("Page content exceeds US Letter dimensions.");
 for(const selector of ["main",".campaign footer",".hero-text",".editorial-head"]){
  const element=page.querySelector(selector);
  if(overflow(element))issues.push(selector+" contains clipped content.");
 }
 const schoolHighlights=page.querySelector(".school-highlights"),heroHeadline=page.querySelector(".hero-text")||page.querySelector(".editorial-head");
 if(schoolHighlights&&heroHeadline&&studioRectanglesOverlap(schoolHighlights.getBoundingClientRect(),heroHeadline.getBoundingClientRect()))
  issues.push("School program highlights overlap the hero headline or description.");
 const heroIdentity=page.querySelector(".hero .identity");
 const heroCopy=page.querySelector(".hero-text")||page.querySelector(".editorial-head");
 if(heroIdentity&&heroCopy&&studioRectanglesOverlap(heroIdentity.getBoundingClientRect(),heroCopy.getBoundingClientRect()))
  issues.push("Approved client identity overlaps the campaign headline or description.");
 const important=[".gallery",".benefits",".steps",".school-callouts"].map(selector=>({selector,element:page.querySelector(selector)})).filter(item=>item.element);
 for(let i=0;i<important.length;i++)for(let j=i+1;j<important.length;j++){
  if(studioRectanglesOverlap(important[i].element.getBoundingClientRect(),important[j].element.getBoundingClientRect()))
   issues.push("Content overlap between "+important[i].selector+" and "+important[j].selector+".");
 }
 const main=page.querySelector("main"),footer=page.querySelector("footer");
 if(main&&footer&&studioRectanglesOverlap(main.getBoundingClientRect(),footer.getBoundingClientRect()))
  issues.push("Marketing content overlaps the contact footer.");
 const hero=page.querySelector(".hero"),headline=page.querySelector("h1");
 if(hero&&headline&&typeof headline.getBoundingClientRect==="function"){
  const heading=headline.getBoundingClientRect(),boundary=hero.getBoundingClientRect();
  if(heading.right>boundary.right+2||heading.bottom>boundary.bottom+2||heading.left<boundary.left-2)issues.push("Headline extends outside its hero area.");
 }
 return issues;
}
export function studioExportReadiness({client="",logo="",headline="",description="",benefits=[],steps=[],cta="",contact="",productImages=[],category="general"}={}){
 const errors=[];
 const isImage=value=>/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value||"");
 if(!String(client).trim())errors.push("Select a named client.");
 if(!isImage(logo))errors.push("Provide the client-approved logo.");
 if(!String(headline).trim())errors.push("Enter a verified headline.");
 if(String(headline).length>85)errors.push("Shorten the headline to avoid print clipping (85 characters maximum).");
 if(String(client).length>90)errors.push("Client name exceeds the safe single-page display limit.");
 if(String(description).length>280)errors.push("Shorten the description to 280 characters for single-page printing.");
 if(String(cta).length>80)errors.push("Shorten the call to action to 80 characters.");
 if(String(contact).length>220)errors.push("Shorten the contact section to 220 characters.");
 if((Array.isArray(benefits)?benefits:[]).length>4||(Array.isArray(benefits)?benefits:[]).some(x=>String(x).length>100))errors.push("Use up to four benefit statements, each under 100 characters.");
 if((Array.isArray(steps)?steps:[]).length>4||(Array.isArray(steps)?steps:[]).some(x=>String(x).length>85))errors.push("Use up to four short process steps, each under 85 characters.");
 if(!String(contact).trim())errors.push("Enter verified contact details.");
 if(!Array.isArray(productImages)||!productImages.some(isImage))errors.push("Add at least one approved merchandise photograph.");
 if(!Object.hasOwn(DESIGN_CATEGORIES,category))errors.push("Select a supported document category.");
 return {ready:errors.length===0,errors};
}
export function studioPrintHtml({client="",category="general",style="athletic",image="",logo="",headline="",description="",benefits=[],steps=[],cta="",contact="",prices=[],concept=0,mode="hybrid",plan=null,productImages=[],productLabels=[],colors=[],layoutAdjustments={},schoolFundraising={},studioServices={},retailPricing={}}={}){
 // The LLM is allowed to suggest composition, never authoritative brand colors or facts.
 const safeImage=x=>/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(x||"")?x:"";
 const palette=(Array.isArray(colors)?colors:[]).filter(c=>/^#[0-9a-f]{6}$/i.test(c));
 const theme=marketingTheme({segment:category==="school"?"school":category==="team"?"team":"general",confirmedColors:palette});
 const primary=theme.primary;
 const secondary=palette.find(c=>c.toLowerCase()!==primary.toLowerCase())||theme.accent;
 const variant=Math.max(0,Math.min(2,Number(concept)||0));
 const photos=(Array.isArray(productImages)?productImages:[]).map(safeImage).filter(Boolean).slice(0,4);
 const safeLayout=normalizeStudioLayout(layoutAdjustments);
 const pageStyle=studioLayoutStyle(safeLayout);
 const brand=safeImage(logo);
 const scene=safeImage(image);
 const sceneHtml=scene?'<div class="hero-scenery" aria-hidden="true" style="background-image:url(&quot;'+scene+'&quot;)"></div>':"";
 const safeList=list=>(Array.isArray(list)?list:[]).map(x=>safeText(String(x).trim())).filter(Boolean).slice(0,4);
 const copy=STUDIO_CATEGORY_COPY[category]||STUDIO_CATEGORY_COPY.general;
 const benefitItems=safeList(benefits);
 const stepItems=safeList(steps);
 const pieces=photos.length?photos.map((src,i)=>'<figure class="piece"><img src="'+src+'" alt="Approved merchandise photo '+(i+1)+'">'+(String(productLabels?.[i]||'').trim()?'<figcaption class="product-tag">'+safeText(String(productLabels[i]).trim().slice(0,60))+'</figcaption>':'')+'</figure>').join(""):'<div class="missing"><div class="missing-icon">+</div><strong>APPROVED APPAREL PHOTOGRAPHY</strong><span>Add client-approved hoodie, tee or merchandise mockups to finish this flyer.</span></div>';
 const logoHtml=brand?'<img class="client-logo" src="'+brand+'" alt="Approved client logo">':'<span class="logo-missing">APPROVED LOGO REQUIRED</span>';
 const schoolHeroLogo=category==="school"&&brand?'<img class="school-mascot-hero" src="'+brand+'" alt="" aria-hidden="true">':"";
 const safeHeadline=safeText(headline||client||"CUSTOM SPIRIT WEAR");
 const safeDescription=safeText(description);
 const safeCta=safeText(cta||"LET’S BUILD YOUR PROGRAM");
 const safeClient=safeText(client||"YOUR SCHOOL");
 const benefitHtml=benefitItems.map((text,i)=>'<div class="benefit"><span class="benefit-no">0'+(i+1)+'</span><span>'+text+'</span></div>').join("");
 const stepHtml=stepItems.map((text,i)=>'<div class="step"><b>'+(i+1)+'</b><span>'+text+'</span></div>').join("");
 const gallery='<div class="gallery '+(photos.length?'has-photos':'no-photos')+(safeLayout.presentation==='grid'?' gallery-grid':'')+'">'+pieces+'</div>';
 const benefitsBlock=benefitHtml?'<section class="benefits"><div class="eyebrow">'+safeText(copy.benefits)+'</div><div class="benefit-grid">'+benefitHtml+'</div></section>':'';
 const stepsBlock=stepHtml?'<section class="steps"><div class="eyebrow">'+safeText(copy.eyebrow)+'</div><div class="step-grid">'+stepHtml+'</div></section>':'';
 const heroLabel=copy.hero;
 const banner='<div class="banner"><span>SKILLED CRAFTING</span><span>CUSTOM APPAREL · LOCAL PARTNERSHIP</span></div>';
 const footer='<footer><strong>'+safeCta+'</strong><p>'+safeText(contact)+'</p><small>'+safeText(copy.footer)+'</small></footer>';
 const schoolHighlights=category==="school"?'<div class="school-highlights" aria-label="School spirit wear program highlights">'+[
   ['01','SCHOOL PRIDE','Apparel for your community'],
   ['02','PROGRAM FUNDING','Verified retail-price plans'],
   ['03','ONLINE STOREFRONT','Convenient supporter ordering'],
   ['04','LOCAL PARTNERSHIP','Artwork and production support']
  ].map(([number,heading,description])=>'<div class="school-highlight"><span>'+number+'</span><strong>'+heading+'</strong><small>'+description+'</small></div>').join("")+'</div>':"";
 const commonHeader='<div class="identity">'+logoHtml+'<div><span class="kicker">'+safeText(heroLabel)+'</span><span class="client">'+safeClient+'</span></div></div>';
 const orderedBlocks=studioLayoutSections(plan,variant).map(key=>({products:gallery,benefits:benefitsBlock,steps:stepsBlock})[key]).join("");
 const funding=["school","team","nonprofit"].includes(category)?schoolFundraisingExample(schoolFundraising):{enabled:false,ready:true,example:null};
 const rows=funding.ready?(funding.examples||[]):[];
 const fundingLabel=category==="school"?"ILLUSTRATIVE SCHOOL FUNDRAISING":category==="team"?"ILLUSTRATIVE TEAM FUNDRAISING":"ILLUSTRATIVE CAMPAIGN FUNDRAISING";
 const fundingHtml=funding.enabled&&funding.ready?(rows.length?
  '<div class="fundraising-mini multi-fundraising"><strong>'+fundingLabel+'</strong><table aria-label="Illustrative fundraising product calculations"><thead><tr><th>Product</th><th>Wholesale</th><th>Retail</th><th>Qty</th><th>Proceeds*</th></tr></thead><tbody>'+
  rows.map(row=>'<tr><td>'+safeText(row.title)+'</td><td>'+row.wholesale+'</td><td>'+row.retail+'</td><td>'+row.quantity+'</td><td>'+row.total+'</td></tr>').join("")+
  '</tbody><tfoot><tr><th colspan="4">Illustrative total</th><th>'+funding.grandTotal+'</th></tr></tfoot></table></div>':
  '<div class="fundraising-mini"><strong>'+fundingLabel+'</strong><span>Decorated wholesale '+funding.example.wholesale+' · retail '+funding.example.retail+'<br>'+funding.example.quantity+' items × '+funding.example.perItem+' difference = <b>'+funding.example.total+'</b> before expenses*</span></div>'):'';
 const retail=["school","team","nonprofit"].includes(category)?{enabled:false,ready:true,examples:[]} : validateStudioRetailPricing(retailPricing);
 const retailHtml=retail.enabled&&retail.ready?'<section class="retail-mini multi-fundraising"><strong>ILLUSTRATIVE APPROVED PRODUCT PRICING</strong><table aria-label="Verified retail product options"><thead><tr><th>Product</th><th>Retail</th><th>Qty</th><th>Illustrative total</th></tr></thead><tbody>'+
  retail.examples.map(row=>'<tr><td>'+safeText(row.title)+'</td><td>'+row.retail+'</td><td>'+row.quantity+'</td><td>'+row.total+'</td></tr>').join("")+
  '</tbody><tfoot><tr><th colspan="3">Illustrative merchandise total</th><th>'+retail.grandTotal+'</th></tr></tfoot></table><small>*Excludes taxes, delivery, setup and other agreed fees. Confirm prices and stock before ordering.</small></section>':"";
 const services=normalizeStudioServices(studioServices,category);
 const artworkOptions=services.enabled?'<section class="artwork-options"><strong>'+safeText(services.heading)+'</strong><span>'+safeText(services.description)+(services.examples?'<em>'+safeText(services.examples)+'</em>':'')+'</span></section>':'';
 const schoolDisclaimer=funding.enabled&&funding.ready?'<small class="fundraising-note">*Illustrative gross proceeds before taxes, payment processing, shipping, refunds and other agreed costs. Not guaranteed; final amounts require approval.</small>':"";
 const schoolClass=category==="school"?" school-layout":"";
 const headlineDensity=category==="school"&&String(headline||"").length>30?" long-headline":"";
 const clientCallouts=fundingHtml||retailHtml||artworkOptions?'<div class="school-callouts category-callouts">'+fundingHtml+retailHtml+artworkOptions+schoolDisclaimer+'</div>':"";


 const themes=[
  '<div class="page campaign athletic'+schoolClass+headlineDensity+'" style="'+pageStyle+'">'+banner+'<header class="hero">'+sceneHtml+schoolHeroLogo+commonHeader+'<div class="hero-text"><div class="slanted">WEAR YOUR PRIDE</div><h1>'+safeHeadline+'</h1><p>'+safeDescription+'</p></div>'+schoolHighlights+'<div class="stripe"></div></header><main><div class="section-heading"><span>01 / FEATURED MERCHANDISE</span><h2>'+safeText(copy.collection)+'</h2></div>'+orderedBlocks+clientCallouts+'</main>'+footer+'</div>',
  '<div class="page campaign editorial'+schoolClass+headlineDensity+'" style="'+pageStyle+'">'+banner+'<header class="hero">'+sceneHtml+schoolHeroLogo+commonHeader+'<div class="editorial-head"><span class="issue">'+safeText(copy.label)+'</span><h1>'+safeHeadline+'</h1><p>'+safeDescription+'</p></div>'+schoolHighlights+'</header><main><div class="section-heading"><span>THE COLLECTION / 01</span><h2>'+safeText(copy.collection)+'</h2></div>'+orderedBlocks+clientCallouts+'</main>'+footer+'</div>',
  '<div class="page campaign bold'+schoolClass+headlineDensity+'" style="'+pageStyle+'">'+banner+'<header class="hero">'+sceneHtml+schoolHeroLogo+commonHeader+'<div class="hero-text"><span class="super-label">SHOW UP. STAND OUT.</span><h1>'+safeHeadline+'</h1><p>'+safeDescription+'</p></div>'+schoolHighlights+'<div class="hero-rule"></div></header><main><div class="section-heading"><span>BUILT AROUND YOUR COMMUNITY</span><h2>'+safeText(copy.collection)+'</h2></div>'+orderedBlocks+clientCallouts+'</main>'+footer+'</div>'
 ];
 // Never bake generated LLM facts, invented pricing, or text into background imagery.
 void style;void prices;void mode;
 const css=String.raw`@page{size:letter;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#e5ebf0;font-family:Arial,Helvetica,sans-serif;color:#1a2b3d}.page{--primary:PRIMARY;--secondary:SECONDARY;width:8.5in;height:11in;margin:0 auto;overflow:hidden;position:relative;background:white;display:flex;flex-direction:column}.campaign .banner{height:.35in;background:#12233a;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 .44in;font-size:7pt;font-weight:800;letter-spacing:1.6px}.campaign .hero{min-height:3.35in;padding:.32in .48in .22in;position:relative;background:var(--primary);color:#fff;overflow:hidden}.identity{display:flex;align-items:center;gap:.16in;position:relative;z-index:2}.client-logo{width:.85in;height:.85in;object-fit:contain;background:#fff;padding:5px;border-radius:4px;box-shadow:0 8px 20px #0003}.logo-missing{border:1px dashed #fff9;font-size:7pt;padding:12px}.identity>div{display:flex;flex-direction:column;gap:5px}.kicker{letter-spacing:1.6px;font-size:8pt;font-weight:bold}.client{font-size:13pt;font-weight:900}.hero-text{position:relative;z-index:2;margin-top:.21in;max-width:6.8in}.hero h1{font-family:Impact,Arial Black,Arial,sans-serif;font-stretch:condensed;font-size:40pt;text-transform:uppercase;line-height:.99;letter-spacing:.4px;margin:.08in 0 .12in;overflow-wrap:break-word}.hero p{max-width:5.8in;font-size:12pt;line-height:1.35;margin:0}.slanted,.super-label{display:inline-block;background:var(--secondary);padding:6px 12px;font-size:10pt;letter-spacing:2px;font-weight:900;color:#132234}.hero .stripe{position:absolute;right:-.5in;top:-.5in;height:5in;width:2.5in;background:#ffffff13;transform:rotate(24deg);border-left:10px solid var(--secondary)}main{flex:1;min-height:0;padding:.24in .48in .1in;display:flex;flex-direction:column;gap:.16in}.section-heading span,.eyebrow{font-size:8pt;letter-spacing:1.6px;font-weight:900;color:var(--primary)}.section-heading h2{font-family:Impact,Arial Black,Arial,sans-serif;font-size:22pt;margin:4px 0 0;letter-spacing:.2px}.gallery{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.12in;height:2.35in}.piece{margin:0;background:#f1f5f8;border:1px solid #e3e9ef;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center}.piece img{display:block;width:100%;height:100%;object-fit:contain}.gallery.has-photos:has(.piece:only-child){grid-template-columns:1fr}.gallery.has-photos:has(.piece:nth-child(2):last-child){grid-template-columns:repeat(2,1fr)}.gallery.has-photos:has(.piece:nth-child(3):last-child){grid-template-columns:repeat(3,1fr)}.no-photos{display:block;height:2.35in;border:2px dashed #9baec2;background:linear-gradient(135deg,#edf4f9,#f9fafc)}.missing{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:.2in;color:#50677e}.missing-icon{height:.45in;width:.45in;border:2px solid #859caf;border-radius:50%;font-size:26pt;line-height:.39in}.missing strong{font-size:12pt;letter-spacing:1.5px}.missing span{font-size:10pt;max-width:4in}.benefit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.08in;margin-top:.08in}.benefit{background:#eff3f7;padding:.09in .11in;border-left:4px solid var(--secondary);display:flex;gap:8px;align-items:flex-start;font-size:9pt;line-height:1.2}.benefit-no{font-size:9pt;font-weight:900;color:var(--primary)}.step-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.09in;margin-top:.09in}.step{display:flex;flex-direction:column;gap:6px;font-size:9pt}.step b{width:.26in;height:.26in;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--primary);color:white;font-size:9pt}.campaign footer{min-height:.92in;background:#10263e;color:white;padding:.17in .48in;display:flex;flex-direction:column;gap:4px;justify-content:center}.campaign footer strong{font-family:Impact,Arial Black,Arial,sans-serif;font-size:19pt;letter-spacing:.7px}.campaign footer p{font-size:10pt;margin:0}.campaign footer small{font-size:7pt;opacity:.8}.athletic .hero{background:linear-gradient(115deg,#10243d,var(--primary) 78%)}.athletic .hero::after{content:"";position:absolute;left:-.3in;bottom:-.85in;width:9in;height:1.2in;background:var(--secondary);transform:rotate(-5deg);opacity:.88}.athletic .section-heading h2{color:var(--primary)}.editorial{background:#fcfaf5}.editorial .hero{min-height:3.2in;background:#fcfaf5;color:#172a3b;border-bottom:6px solid var(--secondary)}.editorial .kicker,.editorial .client{color:var(--primary)}.editorial .hero h1{font-family:Georgia,serif;font-size:36pt;line-height:1.04;text-transform:none;max-width:6.5in}.editorial .hero p{font-family:Georgia,serif;font-style:italic;font-size:13pt;color:#425569}.editorial .editorial-head{padding-top:.19in}.editorial .issue{font-size:9pt;letter-spacing:2px;font-weight:800;color:var(--primary)}.editorial .gallery{height:2.55in}.editorial .benefit{background:#f3f0e7;border-left-color:var(--primary)}.editorial main{gap:.2in}.editorial .section-heading h2{font-family:Georgia,serif;font-size:20pt;font-weight:500}.editorial .editorial-bottom{display:grid;grid-template-columns:1fr 1fr;gap:.18in}.editorial .benefit-grid{grid-template-columns:1fr}.editorial .step-grid{grid-template-columns:repeat(2,1fr)}.editorial footer{background:var(--primary)}.bold .hero{min-height:3.1in;background:linear-gradient(120deg,var(--primary) 0%,#0d2139 100%)}.bold .hero h1{font-size:43pt;color:#fff}.bold .hero .super-label{background:var(--secondary)}.bold .hero-rule{position:absolute;right:-.55in;bottom:-.7in;width:4in;height:1.4in;border-top:25px solid var(--secondary);transform:rotate(-18deg)}.bold .benefit-grid{grid-template-columns:repeat(4,1fr)}.bold .benefit{flex-direction:column;min-height:.8in}.bold .gallery{height:2.05in}.bold main{gap:.15in}.bold .section-heading h2{color:var(--primary)}.athletic .gallery.has-photos{display:flex;align-items:center;justify-content:center;padding:.08in .18in;isolation:isolate}.athletic .gallery.has-photos .piece{flex:1 1 0;min-width:0;height:93%;border:0;background:transparent;overflow:visible;filter:drop-shadow(0 9px 8px #102b4655)}.athletic .gallery.has-photos .piece:first-child{transform:rotate(-7deg) translateX(.09in)}.athletic .gallery.has-photos .piece:nth-child(2){transform:scale(1.13) translateY(-.08in);z-index:2}.athletic .gallery.has-photos .piece:nth-child(3){transform:rotate(7deg) translateX(-.09in)}.athletic .gallery.has-photos .piece:nth-child(4){transform:rotate(-5deg) translateY(.04in)}.athletic .gallery.has-photos .piece img{object-fit:contain;max-height:100%}.editorial .gallery .piece{background:#f6f1e9;border:1px solid #e3d8c9}.bold .gallery .piece{background:#eef3f7;box-shadow:0 9px 14px #10243d19}.campaign .hero-scenery{position:absolute;inset:0;background-position:center;background-size:cover;opacity:var(--studio-scene-opacity,.38);pointer-events:none}.campaign .hero-scenery::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#092037dd,#09203766)}.editorial .hero-scenery{opacity:.11}.editorial .hero-scenery::after{background:linear-gradient(90deg,#fff8,#fff4)}.campaign .hero{min-height:var(--studio-hero-height,3.35in)}.campaign main{gap:var(--studio-gap,.16in)}.campaign .gallery{height:var(--studio-gallery-height,2.35in)}.campaign .gallery.gallery-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:0}.campaign .gallery.gallery-grid .piece{transform:none;filter:none;box-shadow:none;background:#f3f6f9;border:1px solid #dde5ec;overflow:hidden;height:100%}.campaign .gallery.gallery-grid .piece img{max-height:100%}.school-callouts{display:flex;flex-direction:column;gap:5px;margin-top:auto}.school-callouts .artwork-options,.school-callouts .fundraising-mini{border-radius:5px;padding:5px 9px;display:flex;justify-content:space-between;align-items:center;gap:10px;background:#eff3f7;border-left:4px solid var(--secondary)}.school-callouts strong{font-size:7.5pt;line-height:1.15;flex:0 1 46%;color:var(--primary)}.school-callouts span{font-size:7.4pt;line-height:1.15;flex:1}.school-callouts .fundraising-mini{background:#faf5e8}.school-callouts .fundraising-mini b{font-size:9pt}.school-callouts .fundraising-note{font-size:6.5pt;color:#455168}.school-layout main{gap:.075in;padding-top:.12in;padding-bottom:.05in}.school-layout .gallery{height:1.82in}.school-layout .benefit-grid{gap:.04in;margin-top:.05in}.school-layout .benefit{padding:.06in .08in;font-size:8.5pt}.school-layout .step-grid{gap:.06in;margin-top:.05in}.school-layout .step{gap:3px;font-size:8.5pt}.school-layout .section-heading h2{font-size:19pt}.school-layout .school-callouts{gap:3px}.school-layout .school-callouts .artwork-options,.school-layout .school-callouts .fundraising-mini{padding:4px 7px}.campaign .gallery .piece{position:relative}.campaign .product-tag{position:absolute;left:0;right:0;bottom:0;padding:5px 7px;background:#f8fafcf0;color:#102a45;font-size:8pt;font-weight:bold;line-height:1.2;text-align:center;overflow-wrap:anywhere}.campaign .gallery.gallery-grid .product-tag{font-size:7.5pt}.school-layout .hero-text{margin-top:.06in}.school-layout.long-headline .hero h1{font-size:23pt;line-height:.94;margin:.03in 0 .015in}.school-layout.editorial.long-headline .hero h1{font-size:25pt;line-height:1;margin-bottom:.02in}.school-layout .hero h1{font-size:27pt;line-height:.94;margin:.05in 0 .045in}.school-layout .hero p{font-size:9.2pt;line-height:1.15}.school-layout .school-highlights{bottom:.08in}.school-layout main{justify-content:space-between}.school-layout .school-callouts{margin-top:0}.school-layout.editorial .hero h1{font-size:28pt;line-height:1}.school-layout.editorial .editorial-head{padding-top:0}.school-layout.editorial .hero p{font-size:10pt}.school-layout .school-mascot-hero{position:absolute;right:.16in;top:.36in;width:2.9in;height:2.9in;object-fit:contain;opacity:.22;pointer-events:none;z-index:1;filter:drop-shadow(0 0 9px #0007)}.editorial.school-layout .school-mascot-hero{opacity:.09;filter:none}.school-layout .hero-text,.school-layout .editorial-head{position:relative;z-index:2}.school-layout .hero h1{font-size:32pt;max-width:5.5in}.school-layout .hero p{font-size:10pt;max-width:5.1in}.school-layout .hero-text{margin-top:.12in}.school-layout .editorial-head{padding-top:.08in}.school-layout.editorial .hero h1{font-size:31pt}.school-layout .school-highlights{position:absolute;bottom:.12in;left:.48in;right:.48in;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.055in;z-index:5}.school-layout .school-highlight{background:#ffffffed;color:#173149;border-top:3px solid var(--secondary);padding:.07in .065in;display:flex;flex-direction:column;min-height:.61in;gap:2px;box-shadow:0 2px 12px #09192a30}.school-layout .school-highlight span{font-size:7pt;color:var(--primary);font-weight:bold}.school-layout .school-highlight strong{font-size:7.6pt;letter-spacing:.5px;line-height:1.05}.school-layout .school-highlight small{font-size:6.5pt;line-height:1.1}.school-layout.editorial .school-highlight{background:#e9edf0;border-color:var(--primary);box-shadow:none}.school-layout .school-mascot-hero{left:var(--studio-mascot-left,auto);right:var(--studio-mascot-right,.20in);top:.72in;width:var(--studio-mascot-size,2.4in);height:var(--studio-mascot-size,2.4in);opacity:var(--studio-mascot-opacity,.17)}.campaign .hero-text,.campaign .editorial-head{translate:var(--studio-headline-x,0in) var(--studio-headline-y,0in)}.campaign .gallery{translate:var(--studio-gallery-x,0in) var(--studio-gallery-y,0in)}.school-layout.editorial .gallery{height:1.60in}.school-layout.editorial main{gap:.045in;padding-top:.08in;padding-bottom:.035in}.school-layout.editorial .section-heading h2{font-size:17pt}.school-layout.editorial .category-callouts{gap:2px}.campaign .category-callouts .retail-mini{display:block;border-radius:4px;border-left:3px solid var(--secondary);background:#f4f6f8;padding:4px 7px}.campaign .retail-mini small{font-size:6pt;color:#475569}.campaign .category-callouts{display:flex;flex-direction:column;gap:3px;margin-top:auto}.campaign .category-callouts .artwork-options,.campaign .category-callouts .fundraising-mini{border-radius:4px;padding:4px 7px;display:flex;align-items:start;gap:7px;background:#eff3f7;border-left:3px solid var(--secondary)}.campaign .category-callouts strong{font-size:7pt;line-height:1.1;flex:0 1 31%;color:var(--primary)}.campaign .category-callouts span{font-size:7pt;line-height:1.15;flex:1}.campaign .category-callouts em{display:block;font-style:normal;font-size:6.5pt;color:#3e5166;margin-top:2px}.campaign .category-callouts .multi-fundraising{display:block;padding:4px 7px}.campaign .multi-fundraising strong{display:block;margin-bottom:3px}.campaign .multi-fundraising table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:6.6pt;line-height:1.15}.campaign .multi-fundraising th,.campaign .multi-fundraising td{padding:2px 3px;border-bottom:1px solid #ccd6dd;text-align:right;overflow-wrap:anywhere}.campaign .multi-fundraising th:first-child,.campaign .multi-fundraising td:first-child{text-align:left;width:38%}.campaign .multi-fundraising tfoot th{font-weight:bold;border-top:1px solid #506b82}.campaign .fundraising-note{font-size:6pt;color:#475569}@media print{html,body{background:#fff}.page{margin:0;print-color-adjust:exact;-webkit-print-color-adjust:exact}}@media screen{body{background:#e5ebf0}}`;
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+safeClient+' — Skilled Crafting flyer</title><style>'+css.replace("PRIMARY",primary).replace("SECONDARY",secondary)+'</style></head><body>'+themes[variant]+'</body></html>';
}

/** Deterministic, text-free SVG art for offline-first marketing layouts.
 * No remote images, untrusted markup, paid services, or invented merchandise.
 * Product photos and verified client identity remain separate editorial layers.
 */
export function offlineStudioArtwork({concept=1,colors=[],style="athletic",category="general"}={}){
 const index=Math.min(2,Math.max(0,Number(concept)-1||0));
 const valid=Array.isArray(colors)?colors.filter(c=>/^#[0-9a-f]{6}$/i.test(c)):[];
 const primary=valid[0]||"#173a61",secondary=valid[1]||"#335d83",accent=valid[2]||"#e9b653";
 const palettes=[[primary,secondary,accent],[secondary,primary,accent],["#111d33",primary,accent]];
 const [a,b,c]=palettes[index];
 const graphics=[
  '<path d="M-120 800L590-120 960-120 250 1040Z" fill="url(#shine)" opacity=".62"/><path d="M560-80L960 340 960 690 300-80Z" fill="'+c+'" opacity=".18"/><circle cx="710" cy="570" r="310" fill="none" stroke="'+c+'" stroke-width="18" opacity=".36"/>',
  '<circle cx="510" cy="460" r="355" fill="url(#glow)" opacity=".72"/><path d="M0 190L960 0V130L0 330ZM0 670L960 480V600L0 790Z" fill="'+c+'" opacity=".24"/><path d="M100 980L860 100" stroke="white" stroke-width="7" opacity=".19"/>',
  '<path d="M0 0H960V330L0 600Z" fill="url(#shine)" opacity=".45"/><rect x="500" y="70" width="340" height="900" rx="38" fill="white" opacity=".07" transform="rotate(13 670 520)"/><circle cx="180" cy="730" r="290" fill="none" stroke="'+c+'" stroke-width="12" opacity=".4"/>'
 ][index];
 const motifs={
  school:'<path d="M0 790L170 470 295 670 490 355 690 625 850 450 960 680V930H0Z" fill="white" opacity=".12"/><path d="M0 880l50-110 50 110m60 0 70-150 70 150m150 0 70-180 70 180m130 0 60-145 60 145" fill="none" stroke="white" stroke-width="16" opacity=".2"/>',
  team:'<path d="M-40 940Q480 140 1000 940M-40 1040Q480 240 1000 1040" fill="none" stroke="white" stroke-width="40" opacity=".18"/><circle cx="760" cy="260" r="165" fill="none" stroke="white" stroke-width="12" opacity=".2"/>',
  business:'<path d="M80 910V420h125v490m60 0V240h180v670m40 0V500h145v410m40 0V330h195v580" fill="none" stroke="white" stroke-width="16" opacity=".14"/>',
  nonprofit:'<circle cx="410" cy="610" r="220" fill="none" stroke="white" stroke-width="35" opacity=".15"/><circle cx="600" cy="570" r="160" fill="none" stroke="white" stroke-width="26" opacity=".17"/>',
  wedding:'<path d="M0 850Q130 320 340 470T740 390Q840 260 960 180" fill="none" stroke="white" stroke-width="14" opacity=".2"/><circle cx="280" cy="260" r="145" fill="none" stroke="white" stroke-width="24" opacity=".14"/>',
  event:'<path d="M50 390L195 150 340 390M440 390L610 125 785 390M760 760l110-260 110 260" fill="none" stroke="white" stroke-width="15" opacity=".17"/><circle cx="525" cy="615" r="170" stroke="white" stroke-width="14" fill="none" opacity=".16"/>',
  general:'<path d="M120 720L850 140M280 960L960 300" stroke="white" stroke-width="50" opacity=".12"/>'
 };
 const motif=motifs[category]||motifs.general;
 const texture=style==="editorial"?.12:style==="expressive"?.3:.2;
 return '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1200" viewBox="0 0 960 1200"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="'+a+'"/><stop offset="1" stop-color="'+b+'"/></linearGradient><linearGradient id="shine" x2="1" y2="1"><stop stop-color="white" stop-opacity=".38"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><radialGradient id="glow"><stop stop-color="'+c+'" stop-opacity=".65"/><stop offset="1" stop-color="'+c+'" stop-opacity="0"/></radialGradient><pattern id="grain" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M0 35L35 0" stroke="white" stroke-opacity="'+texture+'" stroke-width="1"/></pattern></defs><rect width="960" height="1200" fill="url(#bg)"/>'+graphics+motif+'<rect width="960" height="1200" fill="url(#grain)" opacity=".35"/><rect y="950" width="960" height="250" fill="#0b1728" opacity=".42"/></svg>';
}

/** Landscape-only text-free hero art (1200×540); never synthesizes a client logo. */
export function offlineStudioHeroArtwork({concept=1,colors=[],category="general",style="athletic"}={}){
 const id=Math.max(0,Math.min(2,Number(concept)-1||0));
 const palette=Array.isArray(colors)?colors.filter(color=>/^#[0-9a-f]{6}$/i.test(color)).slice(0,3):[];
 const a=palette[0]||"#16395f",b=palette[1]||"#34577f",gold=palette[2]||"#e6bb4c";
 const base=[
  '<path d="M530-80L1220 480V570L480 100Z" fill="url(#glow)" opacity=".48"/><path d="M720-60L1260 480" stroke="'+gold+'" opacity=".23" stroke-width="90"/>',
  '<ellipse cx="960" cy="230" rx="460" ry="325" fill="url(#glow)" opacity=".62"/><path d="M570 540Q900 110 1270 400" fill="none" stroke="'+gold+'" stroke-width="46" opacity=".20"/>',
  '<path d="M660 0L1220 270V520L530 220Z" fill="url(#glow)" opacity=".52"/><circle cx="1050" cy="250" r="235" fill="none" stroke="'+gold+'" stroke-width="25" opacity=".22"/>'
 ][id];
 const families={
  school:'<path d="M440 410L650 205 750 330 870 115 1010 315 1110 200 1230 380V540H440Z" fill="#fff" opacity=".095"/><path d="M450 485L620 285 730 420 890 240 1015 420 1125 305 1220 430V540H450Z" fill="#080f21" opacity=".25"/><path d="M575 530l30-120 30 120m135 0 38-145 38 145m146 0 44-115 44 115" fill="none" stroke="#fff" stroke-width="16" opacity=".16"/>',
  team:'<path d="M570 560Q870-40 1250 560M690 570Q930 160 1200 550" fill="none" stroke="#fff" stroke-width="24" opacity=".14"/><path d="M885 0v280m-40-240h80" stroke="'+gold+'" stroke-width="14" opacity=".25"/><ellipse cx="1000" cy="360" rx="310" ry="110" fill="none" stroke="#fff" stroke-width="8" opacity=".2"/>',
  business:'<path d="M585 500V265h95v235m40 0V135h125v365m50 0V230h115v270m45 0V90h135v410" fill="none" stroke="#fff" stroke-width="13" opacity=".15"/><path d="M550 515h650" stroke="'+gold+'" stroke-width="20" opacity=".15"/>',
  nonprofit:'<circle cx="875" cy="335" r="190" fill="none" stroke="#fff" stroke-width="33" opacity=".13"/><circle cx="1065" cy="300" r="160" fill="none" stroke="'+gold+'" stroke-width="24" opacity=".17"/><path d="M625 470Q850 275 1210 445" stroke="#fff" stroke-width="25" fill="none" opacity=".12"/>',
  wedding:'<path d="M615 550Q705 80 970 230T1230 90" fill="none" stroke="#fff" stroke-width="12" opacity=".22"/><path d="M780 460q-90-70 0-140q90 70 0 140m185-80q-88-70 0-140q88 70 0 140" fill="none" stroke="'+gold+'" stroke-width="12" opacity=".26"/><circle cx="1080" cy="225" r="130" fill="none" stroke="#fff" stroke-width="16" opacity=".13"/>',
  event:'<path d="M560 445L680 150 805 445M780 485L940 85 1100 485M1030 370L1175 150 1260 325" fill="none" stroke="#fff" stroke-width="16" opacity=".18"/><circle cx="920" cy="260" r="190" stroke="'+gold+'" stroke-width="21" fill="none" opacity=".16"/><path d="M560 530H1200" stroke="#fff" stroke-width="14" opacity=".16"/>',
  general:'<path d="M500 540L990 30M690 570L1210 130" stroke="#fff" stroke-width="62" opacity=".09"/><circle cx="970" cy="310" r="245" fill="none" stroke="'+gold+'" stroke-width="20" opacity=".2"/>'
 };
 const overlay=families[category]||families.general;
 const grain=style==="editorial"?.08:.18;
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="540" viewBox="0 0 1200 540"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="'+a+'"/><stop offset="1" stop-color="'+b+'"/></linearGradient><radialGradient id="glow"><stop stop-color="'+gold+'" stop-opacity=".62"/><stop offset="1" stop-color="'+gold+'" stop-opacity="0"/></radialGradient><pattern id="texture" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 28L28 0" fill="none" stroke="#fff" stroke-width="1" opacity="'+grain+'"/></pattern></defs><rect width="1200" height="540" fill="url(#bg)"/>'+base+overlay+'<rect width="1200" height="540" fill="url(#texture)" opacity=".35"/></svg>';
}
