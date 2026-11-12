/** Shared AI-first document design prompt library and safe print layout. */
export const DESIGN_CATEGORIES={
 school:{label:"School spirit wear",brief:"Create a premium school-specific sports marketing flyer with a dramatic mascot-led hero, photorealistic school apparel, four program benefits, four illustrated ordering steps, a fundraising example, product showcase and a bold call to action. Adapt the personality to elementary, middle or high school."},
 business:{label:"Business apparel",brief:"Create a premium commercial campaign with realistic embroidered workwear, custom uniforms, branded gifts, product photography, compelling business benefits and a polished contact section."},
 team:{label:"Sports teams and clubs",brief:"Create an energetic athletic campaign with team crest, stadium atmosphere, jerseys, fan merchandise, coach recognition and team ordering options."},
 nonprofit:{label:"Nonprofit fundraising",brief:"Create a community-focused fundraising campaign with organization branding, tasteful emotional storytelling, realistic merchandise, donation or program support messaging and a clear call to action."},
 wedding:{label:"Weddings and events",brief:"Create an elegant event marketing piece with personalized glassware, engraved gifts, signage, coordinated keepsakes, atmospheric photography and refined typography."},
 general:{label:"Other promotional materials",brief:"Create a striking premium editorial advertising design with realistic products, strong brand identity, visual storytelling, and a clear call to action."}
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
 "Client instructions: "+String(instructions||"").slice(0,4000),
 "Return a text-free background/hero illustration. Do not render copy, numbers, prices, phone numbers, logos or factual claims into the image. Verified editable content and the actual approved logo are composited separately."
 ].join("\n");
}
export function safeText(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
export function studioPrintHtml({client="",category="general",style="athletic",image="",logo="",headline="",description="",benefits=[],steps=[],cta="",contact="",prices=[],concept=0,mode="hybrid"}={}){
 const safeImage=x=>/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(x||"")?x:"";
 const bg=safeImage(image),brand=safeImage(logo);
 const variant=Math.max(0,Math.min(2,Number(concept)||0));
 const artFirst=mode==="artwork";
 const color=style==="editorial"?"#24334a":style==="expressive"?"#40225f":"#142b45";
 const variantCss=variant===1?".hero{min-height:4.3in}.hero h1{max-width:4.5in}.grid{grid-template-columns:repeat(4,1fr)}":variant===2?".hero{min-height:2.9in}.hero h1{font-size:27pt}.grid{grid-template-columns:repeat(2,1fr)}main{padding:.28in .5in}":"";
 const artworkCss=artFirst?".hero{min-height:7.7in}.hero h1{max-width:6in;margin-top:3.5in}main{padding:.15in .36in}main section{margin-bottom:.09in}main section h2{font-size:12pt}main .grid{grid-template-columns:repeat(4,1fr)}main .grid>div{font-size:8pt}main ol{font-size:8pt}":"";
 const items=(list,tag)=>list.map(x=>"<"+tag+">"+safeText(x)+"</"+tag+">").join("");
 const pricing=prices.length?"<section><h2>Illustrative pricing</h2><table><thead><tr><th>Product</th><th>Wholesale</th><th>Retail</th><th>Return</th></tr></thead><tbody>"+prices.map(p=>"<tr>"+[p.product,p.wholesale,p.retail,p.return].map(v=>"<td>"+safeText(v)+"</td>").join("")+"</tr>").join("")+"</tbody></table><small>Examples only; actual prices and payout terms vary.</small></section>":"";
 return '<!doctype html><html><head><meta charset="utf-8"><title>'+safeText(client)+' — Skilled Crafting</title><style>@page{size:letter;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#1c2b39;background:#fff}.page{width:8.5in;min-height:11in;margin:auto}.hero{background:'+color+';color:white;position:relative;min-height:3.4in;overflow:hidden;padding:.35in}.hero>img.scene{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.7}.hero .content{position:relative;z-index:1;text-shadow:0 2px 7px #000b}.logo{max-width:1.2in;max-height:.9in;object-fit:contain;background:#fff;border-radius:8px;padding:5px}.hero h1{font-size:32pt;line-height:1.03;max-width:6.5in;margin:.24in 0 .12in}.hero p{font-size:13pt;max-width:5.6in}.brand{font-weight:800;letter-spacing:2px;font-size:10pt}main{padding:.22in .36in}section{margin:0 0 .16in}h2{font-size:15pt;color:'+color+';margin:0 0 .08in;text-transform:uppercase}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.1in}.grid>div{background:#eef2f7;border-radius:8px;padding:.1in;font-size:10pt}ol{columns:2;font-size:10pt;line-height:1.5;padding-left:.24in;margin:.05in 0}table{width:100%;border-collapse:collapse;font-size:9pt}th,td{text-align:left;border-bottom:1px solid #ddd;padding:5px}footer{background:'+color+';color:#fff;padding:.22in .36in}footer strong{font-size:16pt}footer p{margin:.08in 0;font-size:10pt}small{font-size:8pt}'+variantCss+artworkCss+'@media print{.page{margin:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="page"><header class="hero">'+(bg?'<img class="scene" src="'+bg+'" alt="">':'')+'<div class="content"><div class="brand">SKILLED CRAFTING · YOUR LOCAL CUSTOM MERCHANDISE PARTNER</div>'+(brand?'<img class="logo" src="'+brand+'" alt="Approved client logo">':'')+'<h1>'+safeText(headline||client)+'</h1><p>'+safeText(description)+'</p></div></header><main>'+(benefits.length?'<section><h2>Why choose this program?</h2><div class="grid">'+items(benefits,"div")+'</div></section>':'')+(steps.length?'<section><h2>How it works</h2><ol>'+items(steps,"li")+'</ol></section>':'')+pricing+'</main><footer><strong>'+safeText(cta||"Let’s create something great together")+'</strong><p>'+safeText(contact)+'</p><small>Pricing, fulfillment and program terms subject to written agreement.</small></footer></div></body></html>';
}
