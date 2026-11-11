import { technicalGuideMissing } from "./marketingTechnicalGuide.js";
import { marketingDocumentModel, marketingSectionMissing } from "./marketingDocumentModel.js";
import { escapeGrowthHtml } from "./growthPricing.js";
import { marketingTemplates } from "./marketingCatalogPolicy.js";
import { marketingTheme } from "./marketingDesignSystem.js";

/** Client-facing document data only. Never put supplier unit costs or margins in exports. */
const requirements = {
  "brand-guide": ["colors", "logo"],
  "product-guide": ["style", "sizes", "productColors", "retailPrice", "productImage"],
  "product-catalog": ["style", "sizes", "productColors", "retailPrice", "productImage"],
  "product-description": ["style", "description"],
  "product-mockup": ["style", "productImage", "logo", "placement"],
  "logo-options": ["logoOptions", "placement"],
  "product-color-chart": ["style", "productColors", "productSwatches"],
  "pricing-sheet": ["style", "retailPrice", "quantity"],
  "bulk-pricing": ["style", "retailPrice", "quantity"],
  "client-quote": ["style", "retailPrice", "quantity", "terms"],
  "proposal": ["description", "style", "retailPrice", "terms"],
  "fundraising-proposal": ["description", "style", "retailPrice", "terms"],
  "package-comparison": ["description", "style", "retailPrice"],
  "artwork-approval": ["logo", "placement", "terms"],
  "product-placement-guide": ["logo", "style", "placement"],
  "store-preview": ["description", "style"],
  "client-intake": ["description"],
  "sample-request": ["style", "sizes", "productColors", "placement", "terms"],
  "order-instructions": ["description", "terms"]
};
const names = {
  colors: "verified logo HEX colors", logo: "client artwork image",
  style: "product name/style", sizes: "verified available sizes",
  productColors: "verified product color names", retailPrice: "approved client selling price",
  productImage: "licensed product/mockup image", productSwatches: "verified color swatches", placement: "decoration placement",
  logoOptions: "at least two client artwork options",
  quantity: "quoted quantity", terms: "terms or approval instructions",
  description: "project or campaign brief"
};
const has = (v) => typeof v === "string" ? Boolean(v.trim()) : Array.isArray(v) ? v.length > 0 : Boolean(v);
/** Explicit, client-reviewed rows; never import internal supplier costs into client prices. */
export function parseMarketingProductRows(input) {
  const lines=String(input||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(lines.length>25)throw Error("Use no more than 25 product lines per document.");
  return lines.map((line,index)=>{
    const parts=line.split("|").map(x=>x.trim());
    if(parts.length!==6)throw Error("Product line "+(index+1)+" needs: Product | SKU | Sizes | Colors | Client price | Quantity.");
    const [name,sku,sizes,colors,price,quantity]=parts;
    if(!name || !price || !Number.isFinite(Number(price)) || Number(price)<0 ||
      !Number.isInteger(Number(quantity)) || Number(quantity)<1)
      throw Error("Product line "+(index+1)+" needs a product, nonnegative client price and whole quantity.");
    return {name:name.slice(0,160),sku:sku.slice(0,100),sizes:sizes.slice(0,240),
      colors:colors.slice(0,240),retailPrice:Number(price),quantity:Number(quantity)};
  });
}

/** Color names and visual hex references are entered by staff, never inferred from a logo. */
export function parseMarketingColorSwatches(input) {
  const lines=String(input||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(lines.length>30)throw Error("Use no more than 30 color swatches.");
  return lines.map((line,index)=>{
    const parts=line.split("|").map(x=>x.trim());
    if(parts.length!==2 || !parts[0] || !/^#[0-9a-f]{6}$/i.test(parts[1]))
      throw Error("Color swatch "+(index+1)+" needs: Verified color name | #RRGGBB.");
    return {name:parts[0].slice(0,120),hex:parts[1].toUpperCase()};
  });
}
export function marketingDocumentMissing(doc) {
  const kind=marketingTemplates.find(t=>t.id===doc.template)?.kind;
  const defaults={
    package:["description","style","retailPrice","terms"],
    store:["description","style","terms"],
    brochure:["description"],
    outreach:["description"],
    sample:["style","sizes","productColors","placement","terms"],
    pricing:["style","retailPrice","quantity"]
  };
  const fields = doc.contentVersion === 2 && doc.template === "product-description"
    ? ["style", "sizes", "productColors", "retailPrice", "productImage", "description"]
    : requirements[doc.template] || defaults[kind] || ["description"];
  const multiple=Array.isArray(doc.productRows) && doc.productRows.length>0;
  const missing = [...marketingSectionMissing(doc), ...technicalGuideMissing(doc)];
  if (!has(doc.organization)) missing.push("client or prospect name");
  fields.forEach(key => {
    if(key==="productImage" && doc.template==="product-catalog" && doc.productRows?.length>1) {
      const gallery=doc.productImages || doc.marketing_product_images || [];
      if (!Array.isArray(gallery) || (doc.productRows.every(row => row.gallery?.length)
        ? doc.productRows.some(row => row.gallery.some(item => !Number.isInteger(item.index) || !gallery[item.index]))
        : gallery.length !== doc.productRows.length))
        missing.push("one licensed product image per catalog line");
      return;
    }
    if (multiple && doc.contentVersion === 2 && ["product-catalog", "product-description"].includes(doc.template)) {
      const rowField = { style: "name", sizes: "sizes", productColors: "colors", retailPrice: "retailPrice" }[key];
      if (rowField && doc.productRows.every(row => key === "retailPrice"
        ? has(row[rowField]) || row[rowField] === 0 : has(row[rowField]))) return;
      if (key === "productImage" && (doc.productImages?.[0] || doc.marketing_product_images?.[0])) return;
    }
    if(multiple && ["style","sizes","productColors","retailPrice","quantity"].includes(key) &&
      (["product","catalog","pricing","quote","proposal","fundraiser","package"].includes(kind)) &&
      !(doc.contentVersion === 2 && doc.template === "product-catalog")) return;
    const value = key === "colors" ? (doc.contentVersion === 2 ? doc.confirmedColors : doc.colors || doc.branding?.colors) :
      key === "logoOptions" ? (doc.logoOptions || doc.marketing_logo_options) :
      key === "productImage" ? (doc.productImage || (doc.marketing_product_image?.key || doc.marketing_product_image?.asset_id)) :
      key === "logo" ? (doc.logo || (doc.marketing_artwork?.key || doc.marketing_artwork?.asset_id)) : doc[key];
    if (key === "logoOptions" ? !Array.isArray(value) || value.length < 2 : !has(value))
      missing.push(names[key] || key);
  });
  return missing;
}
const e = escapeGrowthHtml;
const para = (value) => '<p class="prose">' + e(value) + '</p>';
const image = (value, alt, className = "") => /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value || "")
  ? '<img class="' + className + '" alt="' + e(alt) + '" src="' + value + '">' : "";
const section = (heading, contents) => '<section><h2>' + e(heading) + '</h2>' + contents + '</section>';
const detail = (heading, value) => has(value) ? '<div class="detail"><strong>' + e(heading) + '</strong><span>' + e(value) + '</span></div>' : "";
const money = (v) => has(v) && Number.isFinite(Number(v)) && Number(v) >= 0 ? '$' + Number(v).toFixed(2) : '';
const docType = id => marketingTemplates.find(x => x.id === id)?.label || "Client marketing document";
const conceptPrograms = {
  team: ["Team uniforms", "Spirit wear", "Coach apparel and recognition", "Personalized accessories"],
  school: ["Student spirit wear", "Staff apparel", "School fundraiser storefronts", "Recognition gifts"],
  business: ["Branded employee apparel", "Workwear and hats", "Promotional products", "Employee recognition"],
  nonprofit: ["Fundraising apparel", "Volunteer gear", "Event merchandise", "Supporter stores"]
};
const conceptList = segment => '<ul>' + (conceptPrograms[segment] || conceptPrograms.business)
  .map(item => '<li>' + e(item) + '</li>').join('') + '</ul>';


const marketingStories = {
 "brochure-sports": ["Build a stronger team identity", "Coordinated uniforms, fan apparel and recognition products help your program look and feel connected.", ["Team colors and artwork","Fan and family merchandise","Coach and volunteer recognition","Storefront or team-order planning"]],
 "brochure-schools": ["More school pride. More support for your programs.", "Bring students, families, staff and fans together with school-branded merchandise and a convenient way to order.", ["Spirit wear and staff apparel","Wholesale-to-retail fundraising options","Dedicated school storefront planning","Local artwork and production guidance"]],
 "brochure-business": ["Make your brand part of the workday", "Give your team a consistent, professional look with branded apparel and practical promotional merchandise.", ["Employee apparel and workwear","Logo placement and artwork support","Reordering and size coordination","Recognition and branded gifts"]],
 "brochure-nonprofit": ["Turn community support into something visible", "Equip volunteers and supporters with branded merchandise designed around your cause and event.", ["Volunteer and event apparel","Fundraiser merchandise concepts","Supporter ordering options","Clear product and fulfillment planning"]],
 "brochure-wedding": ["Personal details that make an event memorable", "Coordinate custom keepsakes, signage, glassware and gifts with one creative production partner.", ["Personalized gifts and favors","Welcome and table signage","Glassware and keepsakes","Artwork proofing and event timelines"]],
 "coach-recognition": ["Recognize the people behind the season", "Build coordinated appreciation gifts for coaches and volunteers using your club identity.", ["Personalized apparel and hats","Engraved or printed keepsakes","Package choices by budget","Proofing and presentation options"]],
 "wedding-package": ["Thoughtful details, designed for your day", "Plan a cohesive collection of custom event pieces, from welcome signage to take-home gifts.", ["Coordinated design theme","Personalized favors and glassware","Decor and keepsake options","Production timing and approvals"]],
 "employee-recognition": ["Recognition that feels personal", "Combine branded apparel and custom gifts to celebrate your people and milestones.", ["Staff gift packages","Personalized awards","Apparel and accessories","Budget and delivery planning"]],
 "event-merchandise": ["Make the event memorable beyond the day", "Offer merchandise and keepsakes that reinforce your event identity.", ["Attendee apparel","Commemorative gifts","Sponsor and staff branding","Order and pickup planning"]],
 "fundraising-proposal": ["A practical way to support your program", "Offer products your community wants while agreeing in advance on selling prices, costs and proceeds.", ["Approved wholesale and retail pricing","Store or group-order options","Reconciliation and payout terms","Artwork, tax and fulfillment review"]],
 "store-launch": ["An easier way for supporters to order", "Give your community a clear, branded destination for approved products.", ["Branded storefront concept","Product and size selections","Payment and ordering flow","Fulfillment and launch checklist"]],
 "capabilities-sheet": ["One creative partner. Many ways to make it.", "Skilled Crafting supports custom apparel, printing, engraving and personalization for schools, clubs, businesses and events.", ["Custom apparel and decoration","Personalized gifts and recognition","Artwork preparation and mockups","Online-store and order coordination"]]
};
function marketingStory(doc){
 const story=marketingStories[doc.template] || (()=>{
 const kind=marketingTemplates.find(t=>t.id===doc.template)?.kind;
 const generic={
  product:["Showcase the details that matter","Help your customer compare approved garments, available options and decoration details.",["Product features and options","Verified sizes and colors","Client-approved artwork","Pricing and fulfillment review"]],
  catalog:["A collection made for your organization","Compare selected branded products and choose the right mix for your audience.",["Coordinated product range","Visual product previews","Clear selling prices","Simple selection and approval"]],
  mockup:["See your design before production","Review the artwork and placement concept before approving the final specifications.",["Original client artwork","Garment and color choices","Placement review","Production proof approval"]],
  pricing:["Clear choices. Confident decisions.","Review itemized pricing and quantities before confirming a custom order.",["Itemized options","Quantity-based planning","Approval of all charges","Fulfillment terms"]],
  proposal:["A plan tailored to your goals","Bring product recommendations, artwork and practical ordering details into one clear proposal.",["Recommended merchandise","Artwork and branding","Transparent pricing","Next steps and approvals"]],
  package:["A coordinated collection, not just individual products","Compare personalized items that work together for your team, business or event.",["Package concept","Personalization options","Budget planning","Timing and approvals"]],
  outreach:["Start with a conversation about your goals","Explore the products and creative services that can support your organization.",["Your audience and goals","Product possibilities","Artwork and branding","An easy next step"]],
  store:["Make ordering easier for your community","Plan a branded shopping experience around approved products and clear fulfillment expectations.",["Branded product collection","Easy supporter access","Order coordination","Launch and fulfillment planning"]],
  artwork:["Protect your brand through careful proofing","Review logos, colors, sizing and placement before authorizing production.",["Original artwork","Color and size checks","Placement decisions","Documented sign-off"]],
  brand:["Keep every application consistent","Create a practical reference for colors, artwork versions and decoration placement.",["Logo variants","Color guidance","Approved placement","Production review"]],
  color:["Choose colors with confidence","Compare verified garment color references with your branding.",["Product color options","Visual swatches","Logo compatibility","Sample verification"]],
  sample:["Evaluate a sample before committing","Confirm product, artwork and decoration details for a physical sample request.",["Sample specifications","Artwork placement","Costs and timing","Approval workflow"]],
  intake:["Tell us what you're planning","A few key details help us recommend the right products and production approach.",["Audience and purpose","Products and quantities","Artwork readiness","Budget and timing"]],
  onboarding:["From approval to delivery","Follow a clear ordering process with fewer surprises.",["Confirm products","Approve artwork","Review pricing","Plan fulfillment"]],
  description:["Make every product easy to understand","Show customers what makes this custom item a good fit.",["Product identity","Available options","Decoration details","Ordering information"]]
 };
 return generic[kind];
 })();if(!story)return "";
 const [headline,summary,points]=story;
 return '<div class="hero-story"><div class="eyebrow">SKILLED CRAFTING / '+e(doc.segment||"CUSTOM PROGRAMS")+'</div><h2>'+e(headline)+'</h2><p>'+e(summary)+'</p></div>'+
 '<div class="benefit-grid">'+points.map((point,i)=>'<div class="benefit"><span class="benefit-number">0'+(i+1)+'</span><strong>'+e(point)+'</strong></div>').join("")+'</div>';
}
function marketingProcess(doc){
 if(!["brochure","fundraiser","store","package","proposal"].includes(marketingTemplates.find(t=>t.id===doc.template)?.kind))return "";
 const steps=["Plan products, artwork and goals together","Confirm decoration, pricing and approvals","Choose an ordering and fulfillment approach","Review results and next steps"];
 return '<section class="process"><h2>How we work together</h2><div class="process-grid">'+steps.map((step,i)=>'<div><b>'+e(String(i+1))+'</b><span>'+e(step)+'</span></div>').join("")+'</div></section>';
}
export function renderMarketingDocumentHtml(doc) {
  const missing = marketingDocumentMissing(doc);
  const template = marketingTemplates.find(x => x.id === doc.template);
  const kind = template?.kind || "outreach";
  const brand = doc.branding || { color_details: [], placements: [], variants: [], typography: "", printing: "" };
  const theme = marketingTheme(doc);
  const accent = theme.accent;
  const primary = doc.contentVersion === 2 && template ? marketingDocumentModel(doc).headingColor : theme.primary;
  const note = missing.length
    ? '<div class="warning"><strong>DRAFT — INFORMATION REQUIRED BEFORE FINAL APPROVAL</strong><ul>' +
      missing.map(x => '<li>' + e(x) + '</li>').join('') + '</ul></div>'
    : '<div class="approval">Complete for internal review. Client approval and production verification are still required.</div>';
  const product = image(doc.productImage, "Actual client-selected product or mockup image", "product");
  const art = image(doc.logo, "Client-supplied artwork", "logo");
  const cards = (doc.logoOptions || []).map((src, i) => '<article class="option"><b>Option ' + (i + 1) + '</b>' +
    image(src, "Client artwork option " + (i + 1), "optionimage") + '<p>Selection: __________</p></article>').join('');
  const swatches = (brand.color_details || []).map(c => '<div class="swatch"><div class="color" style="background:' + e(c.hex) + '"></div>' +
    '<strong>' + e(c.hex) + '</strong><small>RGB ' + Object.values(c.rgb).join(', ') + '</small><small>CMYK estimate ' +
    Object.values(c.cmyk_approx).map(n => Math.round(n * 100) + '%').join(' / ') + '</small></div>').join('');
  const galleryImages=(Array.isArray(doc.productImages)?doc.productImages:[]).map((src,i)=>
    '<figure class="gallery-card">'+image(src,"Catalog product "+(i+1),"gallery-image")+
    '<figcaption>'+e(doc.productRows?.[i]?.name || "Product "+(i+1))+'</figcaption></figure>').join('');
  const selection = product || art || galleryImages ? '<div class="media">' + (galleryImages || product) + art + '</div>' : '';
  const productFacts = detail("Product / style", doc.style) + detail("SKU (supplier reference)", doc.sku) +
    detail("Available sizes (verified)", doc.sizes) + detail("Available colors (verified)", doc.productColors) +
    detail("Decoration placement", doc.placement);
  const price = money(doc.retailPrice);
  const garmentSwatches=(doc.productSwatches||[]).map(c=>'<div class="swatch"><div class="color" style="background:'+
    e(/^#[0-9a-f]{6}$/i.test(c.hex)?c.hex:"#FFFFFF")+'"></div><strong>'+e(c.name)+'</strong><small>'+e(c.hex)+
    '</small></div>').join('');
  const productRows=(Array.isArray(doc.productRows) && doc.productRows.length ? doc.productRows : [{
    name:doc.style || "Select product",sku:doc.sku || "",sizes:doc.sizes || "",
    colors:doc.productColors || "",retailPrice:doc.retailPrice,quantity:doc.quantity
  }]);
  const priceTable = '<table><thead><tr><th>Product</th><th>SKU</th><th>Sizes / colors</th><th>Quantity</th><th>Client unit price</th><th>Line total</th></tr></thead><tbody>' +
    productRows.map(p=>{
      const amount=money(p.retailPrice);
      const qty=Number(p.quantity);
      return '<tr><td>'+e(p.name)+'</td><td>'+e(p.sku)+'</td><td>'+e([p.sizes,p.colors].filter(Boolean).join(' / '))+
        '</td><td>'+e(p.quantity || "TBC")+'</td><td>'+(amount||"TBC")+'</td><td>'+
        (amount&&Number.isInteger(qty)&&qty>0?money(Number(p.retailPrice)*qty):"TBC")+'</td></tr>';
    }).join('') + '</tbody></table>';
  const blocks = Object.entries(doc.sectionContent || {}).filter(([, value]) => typeof value === "string" && value.trim())
    .map(([heading, value]) => section(heading, para(value)));
  const story = marketingStory(doc);
  if(story) blocks.push(story);
  const process = marketingProcess(doc);
  if(process) blocks.push(process);
  if (doc.description) blocks.push(section("Overview", para(doc.description)));
  if (doc.aiText) blocks.push(section("Suggested marketing copy — review before sharing", para(doc.aiText)));
  if (["brand", "artwork", "color"].includes(kind)) {
    if (art || cards) blocks.push(section("Logo and artwork options", art + (cards ? '<div class="grid">' + cards + '</div>' : '')));
    if (swatches) blocks.push(section("Client logo color palette", '<div class="swatches">' + swatches + '</div><small>CMYK values are mathematical estimates, not licensed Pantone matches or press-ready color conversions.</small>'));
    if (kind === "color") blocks.push(section("Garment colors", productFacts +
      '<div class="swatches">'+garmentSwatches+'</div>'+
      para("Hex swatches are screen approximations entered from documented product color references. Confirm actual manufacturer color and physical garment samples. Client logo colors above are separate from garment colors.")));
    if (kind !== "color") blocks.push(section("Artwork application", productFacts +
      '<p>Suggested artwork versions: '+e((brand.variants||[]).join(", "))+'</p>' +
      '<p>Suggested applications: ' +
      e((brand.placements || []).join(', ')) + '</p>' + para(brand.typography) + para(brand.printing)));
  } else if (["product", "catalog", "mockup", "description"].includes(kind)) {
    blocks.push(section("Product selection", selection + productFacts));
    if (price || doc.productRows?.length) blocks.push(section("Client product pricing", priceTable));
    if (kind === "mockup") blocks.push(section("Proof notes", para("Placement and scale shown are for concept review only. Confirm dimensions, artwork approval and decoration method before production.")));
  } else if (["pricing", "proposal", "package", "fundraiser", "quote"].includes(kind)) {
    blocks.push(section("Products and pricing", selection + productFacts + priceTable));
    if (kind === "fundraiser") blocks.push(section("Fundraiser terms", para("Fundraising proceeds, collection process, taxes, shipping, returns and payout timing must be agreed in writing. No earnings are projected without verified pricing and costs.")));
  } else if (kind === "store") {
    blocks.push(section("Store concept and merchandise", selection + productFacts + para("This is a proposed collection, not a live store. Ordering links and fulfillment details require confirmation.")));
  } else {
    if (productFacts) blocks.push(section("Proposed products and customization", selection + productFacts));
  }
  if (kind === "brochure") {
    blocks.push(section("Product and service concepts", conceptList(doc.segment) +
      para("These examples are discussion starters. Specific garments, product images, sizes, artwork, client prices and fulfillment terms are selected and verified during quoting.")));
    if (has(doc.style) || doc.productRows?.length) blocks.push(section("Selected product concepts", selection + productFacts +
      (doc.productRows?.length || price ? priceTable : "")));
  }
  if (kind === "sample") blocks.push(section("Sample request details", selection + productFacts +
    detail("Requested quantity", doc.quantity) +
    para("Physical sample selection, production method, artwork rights, shipping, costs and timing require staff confirmation before creating a production job.")));
  if (kind === "intake") blocks.push(section("Client discovery questionnaire",
    "<ol><li>Which products or services are you interested in?</li><li>Who will receive or purchase the products?</li>" +
    "<li>What estimated quantities, sizes and garment colors are needed?</li>" +
    "<li>Do you have original artwork, usage rights, or an approved brand guide?</li>" +
    "<li>What is the target budget, delivery date, and distribution method?</li>" +
    "<li>Will orders be collected through an online store, group order or direct invoice?</li>" +
    "<li>Who can approve artwork, pricing and final production?</li></ol>" +
    para("Please enter answers and share approved files securely with Skilled Crafting.")));
  if (kind === "onboarding") blocks.push(section("Ordering and approval workflow",
    "<ol><li>Confirm the products, colors, sizes and quantities.</li>" +
    "<li>Provide customer artwork or approve the selected logo options.</li>" +
    "<li>Review itemized selling prices and any setup, delivery or tax terms.</li>" +
    "<li>Approve a correctly scaled artwork proof.</li>" +
    "<li>Receive ordering and fulfillment instructions before paying.</li></ol>"));
  if (kind === "outreach") blocks.push(section("Conversation and next steps",
    para("Share the products or program you are considering. Skilled Crafting can prepare a tailored concept and a quote after product, artwork and quantity requirements are confirmed.")));
  if (["artwork","brand","mockup","sample"].includes(kind)) blocks.push(section("Review and sign-off",
    "<p>Selected option: _____________________</p><p>Requested revisions: _____________________________________</p>" +
    "<p>Reviewer name: _____________________ Date: ______________</p>" +
    "<small>Signing a concept is not an order or production authorization. Final artwork and product specifications require confirmation.</small>"));
  if (doc.terms) blocks.push(section("Terms, approvals and fulfillment", para(doc.terms)));
  if (doc.cta) blocks.push(section("Next step", para(doc.cta)));
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + e(doc.organization) + ' — ' + e(docType(doc.template)) + '</title>' +
    '<style>*{box-sizing:border-box}body{font:15px/1.5 system-ui,Arial,sans-serif;margin:0;color:#1a2833;background:#eef2f3}' +
    'main{max-width:816px;min-height:1056px;margin:26px auto;background:white;padding:38px 42px;box-shadow:0 4px 24px #0002;border-radius:5px}header{background:' + primary + ';color:white;border-top:9px solid ' + accent +
    ';padding:22px 25px;margin:-38px -42px 26px}header small,header .subtitle{color:#dce8f4}small,.subtitle{color:#596974}h1{font-size:30px;margin:8px 0}h2{font-size:19px;color:#102f56;border-bottom:2px solid #e4eaf2;padding-bottom:7px}' +
    'section{margin:23px 0;break-inside:avoid-page}.hero-story{padding:24px;background:#eaf1f9;border-left:7px solid '+accent+';margin:18px 0}.hero-story .eyebrow{font-size:10px;letter-spacing:2px;font-weight:800;color:#bd263b}.hero-story h2{font-size:26px;line-height:1.18;border:0;margin:8px 0}.hero-story p{font-size:15px;margin:8px 0}.benefit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}.benefit{background:#f3f6fb;border-top:3px solid #c51f32;padding:13px;display:flex;align-items:center;gap:10px;min-height:68px}.benefit-number{font-size:20px;color:#c51f32;font-weight:800}.process-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.process-grid div{background:#102f56;color:white;padding:12px;min-height:104px}.process-grid b{display:block;color:#f4a5ae;font-size:20px}.process-grid span{font-size:12px}.prose{white-space:pre-wrap;overflow-wrap:anywhere}.media,.grid,.swatches{display:flex;gap:15px;flex-wrap:wrap}' +
    '.media img{max-height:260px;max-width:45%;object-fit:contain;border:1px solid #dae2e6;padding:8px}.gallery-card{flex:1;min-width:180px;max-width:310px;margin:0;border:1px solid #dae2e6;padding:10px}.gallery-card img{max-width:100%;width:100%;height:180px;object-fit:contain;border:0}.gallery-card figcaption{font-weight:600;padding-top:6px}.option{border:1px solid #d7e0e5;padding:12px;min-width:160px;flex:1}' +
    '.optionimage{display:block;max-height:190px;max-width:100%;margin:12px auto;object-fit:contain}.detail{display:flex;gap:12px;border-bottom:1px solid #edf1f3;padding:7px 0}' +
    '.detail strong{min-width:190px}.swatch{min-width:140px;display:flex;flex-direction:column;gap:4px}.color{height:62px;border:1px solid #ddd}' +
    'table{border-collapse:collapse;width:100%;margin:16px 0}th,td{padding:11px;border:1px solid #d4dce0;text-align:left}th{background:#102f56;color:white}' +
    '.warning{border:2px solid #ad6b25;background:#fff7e9;padding:15px}.approval{border:1px solid #bdcdd1;padding:12px}' +
    'footer{color:#62717b;border-top:1px solid #c6d2d5;padding-top:12px;font-size:12px}@page{size:letter;margin:0.32in}@media print{body{background:white}main{margin:0;max-width:none;box-shadow:none;padding:14px 20px}' +
    'header,.hero-story,.benefit,.process-grid div,th{print-color-adjust:exact;-webkit-print-color-adjust:exact}.color{print-color-adjust:exact;-webkit-print-color-adjust:exact}section{break-inside:auto}tr,.option{break-inside:avoid}}</style></head><body><main>' +
    '<header><small>SKILLED CRAFTING · ' + (missing.length ? "DRAFT FOR REVIEW" : "CLIENT REVIEW COPY") + '</small><h1>' +
    e(doc.organization || "Prospective client") + '</h1><div class="subtitle">' + e(docType(doc.template)) +
    ' · Prepared ' + e(String(doc.generated_at || "").slice(0, 10)) + '</div></header>' +
    note + blocks.join('') + '<footer>Skilled Crafting · skilledcrafting.com · Subject to client approval. Availability, decoration quality, colors, taxes, shipping and delivery dates must be confirmed before ordering. No supplier purchase costs are disclosed in this document.</footer>' +
    '</main></body></html>';
  return html;
}
