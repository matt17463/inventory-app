import { escapeGrowthHtml } from "./growthPricing";
import { marketingTemplates } from "./marketingCatalogPolicy";

/** Client-facing document data only. Never put supplier unit costs or margins in exports. */
const requirements = {
  "brand-guide": ["colors", "logo"],
  "product-guide": ["style", "sizes", "productColors", "retailPrice", "productImage"],
  "product-catalog": ["style", "sizes", "productColors", "retailPrice", "productImage"],
  "product-description": ["style", "description"],
  "product-mockup": ["style", "productImage", "logo", "placement"],
  "logo-options": ["logoOptions", "placement"],
  "product-color-chart": ["style", "productColors"],
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
  "order-instructions": ["description", "terms"]
};
const names = {
  colors: "verified logo HEX colors", logo: "client artwork image",
  style: "product name/style", sizes: "verified available sizes",
  productColors: "verified product color names", retailPrice: "approved client selling price",
  productImage: "licensed product/mockup image", placement: "decoration placement",
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
    if(!name || !Number.isFinite(Number(price)) || Number(price)<0 ||
      !Number.isInteger(Number(quantity)) || Number(quantity)<1)
      throw Error("Product line "+(index+1)+" needs a product, nonnegative client price and whole quantity.");
    return {name:name.slice(0,160),sku:sku.slice(0,100),sizes:sizes.slice(0,240),
      colors:colors.slice(0,240),retailPrice:Number(price),quantity:Number(quantity)};
  });
}

export function marketingDocumentMissing(doc) {
  const fields = requirements[doc.template] || ["description"];
  const multiple=Array.isArray(doc.productRows) && doc.productRows.length>0;
  const missing = [];
  if (!has(doc.organization)) missing.push("client or prospect name");
  fields.forEach(key => {
    if(multiple && ["style","sizes","productColors","retailPrice","quantity"].includes(key) &&
      ["product-guide","product-catalog","pricing-sheet","bulk-pricing","client-quote","proposal",
        "fundraising-proposal","package-comparison"].includes(doc.template)) return;
    const value = key === "logoOptions" ? (doc.logoOptions || doc.marketing_logo_options) :
      key === "productImage" ? (doc.productImage || doc.marketing_product_image?.key) :
      key === "logo" ? (doc.logo || doc.marketing_artwork?.key) : doc[key];
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
const words = value => String(value || "").split(',').map(x => x.trim()).filter(Boolean);
const docType = id => marketingTemplates.find(x => x.id === id)?.label || "Client marketing document";

export function renderMarketingDocumentHtml(doc) {
  const missing = marketingDocumentMissing(doc);
  const template = marketingTemplates.find(x => x.id === doc.template);
  const kind = template?.kind || "outreach";
  const brand = doc.branding || { color_details: [], placements: [], variants: [], typography: "", printing: "" };
  const accent = (brand.colors || []).find(x => /^#[0-9a-f]{6}$/i.test(x)) || "#184D47";
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
  const selection = product || art ? '<div class="media">' + product + art + '</div>' : '';
  const productFacts = detail("Product / style", doc.style) + detail("SKU (supplier reference)", doc.sku) +
    detail("Available sizes (verified)", doc.sizes) + detail("Available colors (verified)", doc.productColors) +
    detail("Decoration placement", doc.placement);
  const price = money(doc.retailPrice);
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
  const blocks = [];
  if (doc.description) blocks.push(section("Overview", para(doc.description)));
  if (doc.aiText) blocks.push(section("Suggested marketing copy — review before sharing", para(doc.aiText)));
  if (["brand", "artwork", "color"].includes(kind)) {
    if (art || cards) blocks.push(section("Logo and artwork options", art + (cards ? '<div class="grid">' + cards + '</div>' : '')));
    if (swatches) blocks.push(section("Client logo color palette", '<div class="swatches">' + swatches + '</div><small>CMYK values are mathematical estimates, not licensed Pantone matches or press-ready color conversions.</small>'));
    if (kind === "color") blocks.push(section("Verified garment colors", productFacts + para("Product color names are supplier-reported and must be checked against the selected garment and physical color sample. Client logo colors above are separate from garment colors.")));
    if (kind !== "color") blocks.push(section("Artwork application", productFacts + '<p>Suggested applications: ' +
      e((brand.placements || []).join(', ')) + '</p>' + para(brand.typography) + para(brand.printing)));
  } else if (["product", "catalog", "mockup", "description"].includes(kind)) {
    blocks.push(section("Product selection", selection + productFacts));
    if (price || productRows.length > 1) blocks.push(section("Client product pricing", priceTable));
    if (kind === "mockup") blocks.push(section("Proof notes", para("Placement and scale shown are for concept review only. Confirm dimensions, artwork approval and decoration method before production.")));
  } else if (["pricing", "proposal", "package", "fundraiser", "quote"].includes(kind)) {
    blocks.push(section("Products and pricing", selection + productFacts + priceTable));
    if (kind === "fundraiser") blocks.push(section("Fundraiser terms", para("Fundraising proceeds, collection process, taxes, shipping, returns and payout timing must be agreed in writing. No earnings are projected without verified pricing and costs.")));
  } else if (kind === "store") {
    blocks.push(section("Store concept and merchandise", selection + productFacts + para("This is a proposed collection, not a live store. Ordering links and fulfillment details require confirmation.")));
  } else {
    if (productFacts) blocks.push(section("Proposed products and customization", selection + productFacts));
  }
  if (doc.terms) blocks.push(section("Terms, approvals and fulfillment", para(doc.terms)));
  if (doc.cta) blocks.push(section("Next step", para(doc.cta)));
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + e(doc.organization) + ' — ' + e(docType(doc.template)) + '</title>' +
    '<style>*{box-sizing:border-box}body{font:15px/1.5 system-ui,Arial,sans-serif;margin:0;color:#1a2833;background:#eef2f3}' +
    'main{max-width:920px;margin:26px auto;background:white;padding:42px;box-shadow:0 2px 12px #0001}header{border-top:9px solid ' + accent +
    ';padding-top:24px;margin-bottom:28px}small,.subtitle{color:#596974}h1{font-size:34px;margin:8px 0}h2{font-size:19px;border-bottom:1px solid #d2dbdf;padding-bottom:7px}' +
    'section{margin:26px 0;break-inside:avoid-page}.prose{white-space:pre-wrap;overflow-wrap:anywhere}.media,.grid,.swatches{display:flex;gap:15px;flex-wrap:wrap}' +
    '.media img{max-height:260px;max-width:45%;object-fit:contain;border:1px solid #dae2e6;padding:8px}.option{border:1px solid #d7e0e5;padding:12px;min-width:160px;flex:1}' +
    '.optionimage{display:block;max-height:190px;max-width:100%;margin:12px auto;object-fit:contain}.detail{display:flex;gap:12px;border-bottom:1px solid #edf1f3;padding:7px 0}' +
    '.detail strong{min-width:190px}.swatch{min-width:140px;display:flex;flex-direction:column;gap:4px}.color{height:62px;border:1px solid #ddd}' +
    'table{border-collapse:collapse;width:100%;margin:16px 0}th,td{padding:11px;border:1px solid #d4dce0;text-align:left}th{background:#e9f0f2}' +
    '.warning{border:2px solid #ad6b25;background:#fff7e9;padding:15px}.approval{border:1px solid #bdcdd1;padding:12px}' +
    'footer{color:#62717b;border-top:1px solid #c6d2d5;padding-top:12px;font-size:12px}@media print{body{background:white}main{margin:0;max-width:none;box-shadow:none;padding:14px 20px}' +
    'header{print-color-adjust:exact;-webkit-print-color-adjust:exact}.color{print-color-adjust:exact;-webkit-print-color-adjust:exact}section{break-inside:auto}tr,.option{break-inside:avoid}}</style></head><body><main>' +
    '<header><small>SKILLED CRAFTING · ' + (missing.length ? "DRAFT FOR REVIEW" : "CLIENT REVIEW COPY") + '</small><h1>' +
    e(doc.organization || "Prospective client") + '</h1><div class="subtitle">' + e(docType(doc.template)) +
    ' · Prepared ' + e(String(doc.generated_at || "").slice(0, 10)) + '</div></header>' +
    note + blocks.join('') + '<footer>Skilled Crafting · skilledcrafting.com · Subject to client approval. Availability, decoration quality, colors, taxes, shipping and delivery dates must be confirmed before ordering. No supplier purchase costs are disclosed in this document.</footer>' +
    '</main></body></html>';
  return html;
}
