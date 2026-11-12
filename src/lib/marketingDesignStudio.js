/** Shared AI-first document design prompt library and safe print layout. */
export const DESIGN_CATEGORIES={
 school:{label:"School spirit wear",brief:"Create a premium school-specific sports marketing flyer with a dramatic mascot-led hero, photorealistic school apparel, four program benefits, four illustrated ordering steps, a fundraising example, product showcase and a bold call to action. Adapt the personality to elementary, middle or high school. Additional creative requirements: Full-color US Letter premium school flyer; preserve exact approved school logo, mascot and colors; photorealistic decorated hoodies, tees, caps and beanies; layered athletic scenery, dramatic typography-safe hero, school pride, fundraising, online orders, local support, four ordering steps, illustrative wholesale-retail examples, product showcase and strong call to action. Elementary: friendly; middle: modern; high school: collegiate. No invented facts."},
 business:{label:"Business apparel",brief:"Create a premium commercial campaign with realistic embroidered workwear, custom uniforms, branded gifts, product photography, compelling business benefits and a polished contact section. Additional creative requirements: Premium commercial US Letter flyer; real business identity, professional embroidered uniforms, workwear, branded gifts, product showcase, consultation and proofing steps, clear benefits and verified contact. Adapt to client's industry; no invented prices."},
 team:{label:"Sports teams and clubs",brief:"Create an energetic athletic campaign with team crest, stadium atmosphere, jerseys, fan merchandise, coach recognition and team ordering options. Additional creative requirements: Dynamic sports club US Letter flyer; preserve approved crest and colors; realistic jerseys, fan hoodies, caps, coach gifts, stadium imagery, team benefits, ordering, fundraising, product showcase and strong call to action."},
 nonprofit:{label:"Nonprofit fundraising",brief:"Create a community-focused fundraising campaign with organization branding, tasteful emotional storytelling, realistic merchandise, donation or program support messaging and a clear call to action. Additional creative requirements: Mission-driven nonprofit US Letter campaign; authentic community imagery, approved organization identity, merchandise fundraising, supporter benefits, ordering steps and clear contact. Never invent impact figures."},
 wedding:{label:"Weddings and events",brief:"Create an elegant event marketing piece with personalized glassware, engraved gifts, signage, coordinated keepsakes, atmospheric photography and refined typography. Additional creative requirements: Elegant event US Letter flyer; atmospheric engraved glassware, keepsakes, gifts, signage, refined typography, product showcase, consultation and approval process, verified contact."},
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
 if(/wedding|event/.test(s))return "wedding";
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
export function studioPrintHtml({client="",category="general",style="athletic",image="",logo="",headline="",description="",benefits=[],steps=[],cta="",contact="",prices=[],concept=0,mode="hybrid",plan=null,productImages=[],colors=[],heroImage=""}={}){
 // The LLM is allowed to suggest composition, never authoritative brand colors or facts.
 const safeImage=x=>/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(x||"")?x:"";
 const palette=(Array.isArray(colors)?colors:[]).filter(c=>/^#[0-9a-f]{6}$/i.test(c));
 const primary=palette.find(c=>!["#ffffff","#fefefe","#000000"].includes(c.toLowerCase()))||"#193b60";
 const secondary=palette[1]&&palette[1].toLowerCase()!==primary.toLowerCase()?palette[1]:"#d4a94a";
 const variant=Math.max(0,Math.min(2,Number(concept)||0));
 const photos=(Array.isArray(productImages)?productImages:[]).map(safeImage).filter(Boolean).slice(0,4);
 const brand=safeImage(logo);
 const heroPhoto=safeImage(heroImage);
 const heroPhotoLayer=heroPhoto?'<img class="hero-photo" src="'+heroPhoto+'" alt="Approved campaign scene">':'';
 const safeList=list=>(Array.isArray(list)?list:[]).map(x=>safeText(String(x).trim())).filter(Boolean).slice(0,4);
 const benefitItems=safeList(benefits);
 const stepItems=safeList(steps);
 const pieces=photos.length?photos.map((src,i)=>'<figure class="piece"><img src="'+src+'" alt="Approved merchandise photo '+(i+1)+'"></figure>').join(""):'<div class="missing"><div class="missing-icon">+</div><strong>APPROVED APPAREL PHOTOGRAPHY</strong><span>Add client-approved hoodie, tee or merchandise mockups to finish this flyer.</span></div>';
 const logoHtml=brand?'<img class="client-logo" src="'+brand+'" alt="Approved client logo">':'<span class="logo-missing">APPROVED LOGO REQUIRED</span>';
 const safeHeadline=safeText(headline||client||"CUSTOM SPIRIT WEAR");
 const safeDescription=safeText(description);
 const safeCta=safeText(cta||"LET’S BUILD YOUR PROGRAM");
 const safeClient=safeText(client||"YOUR SCHOOL");
 const benefitHtml=benefitItems.map((text,i)=>'<div class="benefit"><span class="benefit-no">0'+(i+1)+'</span><span>'+text+'</span></div>').join("");
 const stepHtml=stepItems.map((text,i)=>'<div class="step"><b>'+(i+1)+'</b><span>'+text+'</span></div>').join("");
 const gallery='<div class="gallery '+(photos.length?'has-photos':'no-photos')+'">'+pieces+'</div>';
 const benefitsBlock=benefitHtml?'<section class="benefits"><div class="eyebrow">WHY SCHOOLS PARTNER WITH US</div><div class="benefit-grid">'+benefitHtml+'</div></section>':'';
 const stepsBlock=stepHtml?'<section class="steps"><div class="eyebrow">SIMPLE FROM START TO FINISH</div><div class="step-grid">'+stepHtml+'</div></section>':'';
 const heroLabel=category==="school"?"SPIRIT WEAR FOR YOUR SCHOOL":category==="team"?"GEAR FOR YOUR TEAM":"CUSTOM APPAREL & MERCHANDISE";
 const banner='<div class="banner"><span>SKILLED CRAFTING</span><span>CUSTOM APPAREL · LOCAL PARTNERSHIP</span></div>';
 const footer='<footer><strong>'+safeCta+'</strong><p>'+safeText(contact)+'</p><small>Product availability, pricing and program terms require confirmation.</small></footer>';
 const commonHeader='<div class="identity">'+logoHtml+'<div><span class="kicker">'+safeText(heroLabel)+'</span><span class="client">'+safeClient+'</span></div></div>';
 const themes=[
  '<div class="page campaign athletic">'+banner+'<header class="hero">'+heroPhotoLayer+commonHeader+'<div class="hero-text"><div class="slanted">WEAR YOUR PRIDE</div><h1>'+safeHeadline+'</h1><p>'+safeDescription+'</p></div><div class="stripe"></div></header><main><div class="section-heading"><span>01 / FEATURED MERCHANDISE</span><h2>YOUR SCHOOL. YOUR STYLE.</h2></div>'+gallery+benefitsBlock+stepsBlock+'</main>'+footer+'</div>',
  '<div class="page campaign editorial">'+banner+'<header class="hero">'+heroPhotoLayer+commonHeader+'<div class="editorial-head"><span class="issue">THE SCHOOL SPIRIT COLLECTION</span><h1>'+safeHeadline+'</h1><p>'+safeDescription+'</p></div></header><main><div class="section-heading"><span>THE COLLECTION / 01</span><h2>Designed for school pride.</h2></div>'+gallery+'<div class="editorial-bottom">'+benefitsBlock+stepsBlock+'</div></main>'+footer+'</div>',
  '<div class="page campaign bold">'+banner+'<header class="hero">'+heroPhotoLayer+commonHeader+'<div class="hero-text"><span class="super-label">SHOW UP. STAND OUT.</span><h1>'+safeHeadline+'</h1><p>'+safeDescription+'</p></div><div class="hero-rule"></div></header><main><div class="section-heading"><span>BUILT AROUND YOUR COMMUNITY</span><h2>MORE THAN MERCH.</h2></div>'+benefitsBlock+gallery+stepsBlock+'</main>'+footer+'</div>'
 ];
 // Never bake generated LLM facts, invented pricing, or text into background imagery.
 void image;void style;void prices;void mode;void plan;
 const css=String.raw`@page{size:letter;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#e5ebf0;font-family:Arial,Helvetica,sans-serif;color:#1a2b3d}.page{--primary:PRIMARY;--secondary:SECONDARY;width:8.5in;height:11in;margin:0 auto;overflow:hidden;position:relative;background:white;display:flex;flex-direction:column}.campaign .banner{height:.35in;background:#12233a;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 .44in;font-size:7pt;font-weight:800;letter-spacing:1.6px}.campaign .hero{min-height:3.35in;padding:.32in .48in .22in;position:relative;background:var(--primary);color:#fff;overflow:hidden}.hero-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;opacity:.30;pointer-events:none}.hero:has(.hero-photo)::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#07182bcc 0%,#07182b80 65%,#07182b44 100%);z-index:1}.identity{display:flex;align-items:center;gap:.16in;position:relative;z-index:2}.client-logo{width:.85in;height:.85in;object-fit:contain;background:#fff;padding:5px;border-radius:4px;box-shadow:0 8px 20px #0003}.logo-missing{border:1px dashed #fff9;font-size:7pt;padding:12px}.identity>div{display:flex;flex-direction:column;gap:5px}.kicker{letter-spacing:1.6px;font-size:8pt;font-weight:bold}.client{font-size:13pt;font-weight:900}.hero-text{position:relative;z-index:2;margin-top:.21in;max-width:6.8in}.hero h1{font-family:Impact,Arial Black,Arial,sans-serif;font-stretch:condensed;font-size:40pt;text-transform:uppercase;line-height:.99;letter-spacing:.4px;margin:.08in 0 .12in;overflow-wrap:break-word}.hero p{max-width:5.8in;font-size:12pt;line-height:1.35;margin:0}.slanted,.super-label{display:inline-block;background:var(--secondary);padding:6px 12px;font-size:10pt;letter-spacing:2px;font-weight:900;color:#132234}.hero .stripe{position:absolute;right:-.5in;top:-.5in;height:5in;width:2.5in;background:#ffffff13;transform:rotate(24deg);border-left:10px solid var(--secondary)}main{flex:1;min-height:0;padding:.24in .48in .1in;display:flex;flex-direction:column;gap:.16in}.section-heading span,.eyebrow{font-size:8pt;letter-spacing:1.6px;font-weight:900;color:var(--primary)}.section-heading h2{font-family:Impact,Arial Black,Arial,sans-serif;font-size:22pt;margin:4px 0 0;letter-spacing:.2px}.gallery{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.12in;height:2.35in}.piece{margin:0;background:#f1f5f8;border:1px solid #e3e9ef;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center}.piece img{display:block;width:100%;height:100%;object-fit:contain}.gallery.has-photos:has(.piece:only-child){grid-template-columns:1fr}.gallery.has-photos:has(.piece:nth-child(2):last-child){grid-template-columns:repeat(2,1fr)}.gallery.has-photos:has(.piece:nth-child(3):last-child){grid-template-columns:repeat(3,1fr)}.no-photos{display:block;height:2.35in;border:2px dashed #9baec2;background:linear-gradient(135deg,#edf4f9,#f9fafc)}.missing{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:.2in;color:#50677e}.missing-icon{height:.45in;width:.45in;border:2px solid #859caf;border-radius:50%;font-size:26pt;line-height:.39in}.missing strong{font-size:12pt;letter-spacing:1.5px}.missing span{font-size:10pt;max-width:4in}.benefit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.08in;margin-top:.08in}.benefit{background:#eff3f7;padding:.09in .11in;border-left:4px solid var(--secondary);display:flex;gap:8px;align-items:flex-start;font-size:9pt;line-height:1.2}.benefit-no{font-size:9pt;font-weight:900;color:var(--primary)}.step-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.09in;margin-top:.09in}.step{display:flex;flex-direction:column;gap:6px;font-size:9pt}.step b{width:.26in;height:.26in;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--primary);color:white;font-size:9pt}.campaign footer{min-height:.92in;background:#10263e;color:white;padding:.17in .48in;display:flex;flex-direction:column;gap:4px;justify-content:center}.campaign footer strong{font-family:Impact,Arial Black,Arial,sans-serif;font-size:19pt;letter-spacing:.7px}.campaign footer p{font-size:10pt;margin:0}.campaign footer small{font-size:7pt;opacity:.8}.athletic .hero{background:linear-gradient(115deg,#10243d,var(--primary) 78%)}.athletic .hero::after{content:"";position:absolute;left:-.3in;bottom:-.85in;width:9in;height:1.2in;background:var(--secondary);transform:rotate(-5deg);opacity:.88}.athletic .section-heading h2{color:var(--primary)}.editorial{background:#fcfaf5}.editorial .hero{min-height:3.2in;background:#fcfaf5;color:#172a3b;border-bottom:6px solid var(--secondary)}.editorial .hero:has(.hero-photo)::before{background:linear-gradient(90deg,#fffef4f0,#fffef4b3)}.editorial .hero-photo{opacity:.22}.editorial .kicker,.editorial .client{color:var(--primary)}.editorial .hero h1{font-family:Georgia,serif;font-size:36pt;line-height:1.04;text-transform:none;max-width:6.5in}.editorial .hero p{font-family:Georgia,serif;font-style:italic;font-size:13pt;color:#425569}.editorial .editorial-head{padding-top:.19in}.editorial .issue{font-size:9pt;letter-spacing:2px;font-weight:800;color:var(--primary)}.editorial .gallery{height:2.55in}.editorial .benefit{background:#f3f0e7;border-left-color:var(--primary)}.editorial main{gap:.2in}.editorial .section-heading h2{font-family:Georgia,serif;font-size:20pt;font-weight:500}.editorial .editorial-bottom{display:grid;grid-template-columns:1fr 1fr;gap:.18in}.editorial .benefit-grid{grid-template-columns:1fr}.editorial .step-grid{grid-template-columns:repeat(2,1fr)}.editorial footer{background:var(--primary)}.bold .hero{min-height:3.1in;background:linear-gradient(120deg,var(--primary) 0%,#0d2139 100%)}.bold .hero-photo{opacity:.38}.bold .hero h1{font-size:43pt;color:#fff}.bold .hero .super-label{background:var(--secondary)}.bold .hero-rule{position:absolute;right:-.55in;bottom:-.7in;width:4in;height:1.4in;border-top:25px solid var(--secondary);transform:rotate(-18deg)}.bold .benefit-grid{grid-template-columns:repeat(4,1fr)}.bold .benefit{flex-direction:column;min-height:.8in}.bold .gallery{height:2.05in}.bold main{gap:.15in}.bold .section-heading h2{color:var(--primary)}@media print{html,body{background:#fff}.page{margin:0;print-color-adjust:exact;-webkit-print-color-adjust:exact}}@media screen{body{background:#e5ebf0}}`;
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+safeClient+' — Skilled Crafting flyer</title><style>'+css.replace("PRIMARY",primary).replace("SECONDARY",secondary)+'</style></head><body>'+themes[variant]+'</body></html>';
}

/** Deterministic, text-free SVG art for offline-first marketing layouts.
 * No remote images, untrusted markup, paid services, or invented merchandise.
 * Product photos and verified client identity remain separate editorial layers.
 */
export function offlineStudioArtwork({concept=1,colors=[],style="athletic"}={}){
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
 const texture=style==="editorial"?.12:style==="expressive"?.3:.2;
 return '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1200" viewBox="0 0 960 1200"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="'+a+'"/><stop offset="1" stop-color="'+b+'"/></linearGradient><linearGradient id="shine" x2="1" y2="1"><stop stop-color="white" stop-opacity=".38"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><radialGradient id="glow"><stop stop-color="'+c+'" stop-opacity=".65"/><stop offset="1" stop-color="'+c+'" stop-opacity="0"/></radialGradient><pattern id="grain" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M0 35L35 0" stroke="white" stroke-opacity="'+texture+'" stroke-width="1"/></pattern></defs><rect width="960" height="1200" fill="url(#bg)"/>'+graphics+'<rect width="960" height="1200" fill="url(#grain)" opacity=".35"/><rect y="950" width="960" height="250" fill="#0b1728" opacity=".42"/></svg>';
}
