/**
 * Marketing vendor source policy. Pricing is always resolved from verified, dated
 * vendor data and processed through the shared Skilled Crafting pricing engine.
 * This module does not scrape vendors or assume credentials/image licenses.
 */
export const marketingSuppliers = Object.freeze({
  sanmar: { name: "SanMar", cost_source: "account_wholesale", product_url: "https://www.sanmar.com/" },
  ssactivewear: { name: "S&S Activewear", cost_source: "account_wholesale", product_url: "https://www.ssactivewear.com/" },
  jpplus: { name: "Johnson Plastics Plus", cost_source: "published_web", product_url: "https://www.jpplus.com/" },
  uscutter: { name: "USCutter", cost_source: "published_web", product_url: "https://uscutter.com/" },
});
export const marketingTemplates = Object.freeze([
  { id: "brochure-sports", label: "Youth sports brochure", segment: "team", kind: "brochure", category: "Client acquisition" },
  { id: "brochure-schools", label: "School spirit-wear brochure", segment: "school", kind: "brochure", category: "Client acquisition" },
  { id: "brochure-business", label: "Business apparel brochure", segment: "business", kind: "brochure", category: "Client acquisition" },
  { id: "brochure-nonprofit", label: "Fundraiser brochure", segment: "nonprofit", kind: "brochure", category: "Client acquisition" },
  { id: "brochure-wedding", label: "Wedding and event brochure", segment: "all", kind: "brochure", category: "Events & packages" },
  { id: "outreach-letter", label: "Prospective client introduction letter", segment: "all", kind: "outreach", category: "Client acquisition" },
  { id: "capabilities-sheet", label: "Skilled Crafting capability statement", segment: "all", kind: "outreach", category: "Client acquisition" },
  { id: "follow-up-letter", label: "Client follow-up / next steps", segment: "all", kind: "outreach", category: "Client acquisition" },
  { id: "product-guide", label: "Supplier-linked product guide", segment: "all", kind: "product", category: "Products & mockups" },
  { id: "product-catalog", label: "Client product catalog", segment: "all", kind: "catalog", category: "Products & mockups" },
  { id: "product-description", label: "Product description / listing", segment: "all", kind: "description", category: "Products & mockups" },
  { id: "product-mockup", label: "Client product mockup approval", segment: "all", kind: "mockup", category: "Products & mockups" },
  { id: "product-color-chart", label: "Verified garment color chart", segment: "all", kind: "color", category: "Products & mockups" },
  { id: "product-placement-guide", label: "Artwork placement and sizing guide", segment: "all", kind: "artwork", category: "Artwork & branding" },
  { id: "proposal", label: "Client proposal", segment: "all", kind: "proposal", category: "Proposals & pricing" },
  { id: "client-quote", label: "Itemized client quote", segment: "all", kind: "quote", category: "Proposals & pricing" },
  { id: "pricing-sheet", label: "Client pricing sheet", segment: "all", kind: "pricing", category: "Proposals & pricing" },
  { id: "bulk-pricing", label: "Bulk and quantity pricing", segment: "all", kind: "pricing", category: "Proposals & pricing" },
  { id: "package-comparison", label: "Package comparison and upgrades", segment: "all", kind: "package", category: "Proposals & pricing" },
  { id: "fundraising-proposal", label: "School / club fundraising proposal", segment: "all", kind: "fundraiser", category: "Proposals & pricing" },
  { id: "sample-request", label: "Physical sample request", segment: "all", kind: "sample", category: "Artwork & branding" },
  { id: "brand-guide", label: "Brand usage guide", segment: "all", kind: "brand", category: "Artwork & branding" },
  { id: "logo-options", label: "Client logo option selection", segment: "all", kind: "artwork", category: "Artwork & branding" },
  { id: "artwork-approval", label: "Artwork approval & sign-off", segment: "all", kind: "artwork", category: "Artwork & branding" },
  { id: "store-preview", label: "Store preview", segment: "all", kind: "store", category: "Stores & onboarding" },
  { id: "store-launch", label: "Online store launch proposal", segment: "all", kind: "store", category: "Stores & onboarding" },
  { id: "client-intake", label: "New client discovery questionnaire", segment: "all", kind: "intake", category: "Stores & onboarding" },
  { id: "order-instructions", label: "Customer ordering instructions", segment: "all", kind: "onboarding", category: "Stores & onboarding" },
  { id: "coach-recognition", label: "Coach recognition package proposal", segment: "team", kind: "package", category: "Events & packages" },
  { id: "wedding-package", label: "Wedding personalization package", segment: "all", kind: "package", category: "Events & packages" },
  { id: "employee-recognition", label: "Employee recognition and branded gifts", segment: "business", kind: "package", category: "Events & packages" },
  { id: "event-merchandise", label: "Event merchandise proposal", segment: "all", kind: "package", category: "Events & packages" },
  { id: "seasonal-campaign", label: "Seasonal promotion / campaign brief", segment: "all", kind: "brochure", category: "Campaigns" },
  { id: "email-campaign", label: "Client email campaign draft", segment: "all", kind: "outreach", category: "Campaigns" },
  { id: "social-campaign", label: "Social media campaign content", segment: "all", kind: "outreach", category: "Campaigns" },
]);
export const brandGuideProfiles = Object.freeze({
  team: { title: "Sports program", placements: ["Left chest", "Full front", "Full back", "Cap front", "Sleeve"], variants: ["Full-color", "One-color", "Reverse"] },
  school: { title: "School", placements: ["Left chest", "Full front", "Full back", "Staff polo", "Signage"], variants: ["Primary crest", "Wordmark", "Reverse"] },
  business: { title: "Business", placements: ["Left chest", "Hat", "Business card", "Signage", "Vehicle"], variants: ["Primary", "Horizontal", "One-color"] },
  nonprofit: { title: "Nonprofit", placements: ["Left chest", "Event T-shirt", "Banner", "Volunteer shirt"], variants: ["Primary", "One-color", "Reverse"] },
});
export function normalizeSupplierOffer(offer) {
  const supplier = marketingSuppliers[String(offer.supplier || "").toLowerCase().replace(/[^a-z]/g, "")];
  if (!supplier) throw Error("Unknown supplier");
  const rawPrice = offer.unit_cost;
  const price = rawPrice === null || rawPrice === undefined || String(rawPrice).trim() === "" ? NaN : Number(rawPrice);
  if (!Number.isFinite(price) || price < 0 || !offer.sku || !offer.observed_at)
    throw Error("Supplier offer needs a real SKU, verified cost and observation date.");
  const observed = new Date(offer.observed_at);
  if (Number.isNaN(observed.getTime()) || observed.getTime() > Date.now() + 86400000) throw Error("Invalid or future supplier price observation time.");
  return { ...offer, unit_cost: price, cost_source: supplier.cost_source, supplier_name: supplier.name,
    observed_at: observed.toISOString(), source_url: offer.source_url || supplier.product_url };
}
export function suggestedBrandGuide(segment, colors = []) {
  const profile = brandGuideProfiles[segment] || brandGuideProfiles.business;
  if (!Array.isArray(colors) || colors.some(c => !/^#[0-9a-f]{6}$/i.test(c))) throw Error("Use six-digit HEX colors.");
  return { profile: profile.title, colors: [...new Set(colors.map(c => c.toUpperCase()))],
    color_details: [...new Set(colors.map(c => c.toUpperCase()))].map(hexToPrintColor),
    placements: [...profile.placements], variants: [...profile.variants],
    typography: "Suggested font families require owner review; do not assert an exact font match from a logo image.",
    printing: "CMYK depends on the output color profile. Pantone matches are approximations requiring licensed reference and physical verification.",
    approval_required: true };
}

/** Device-independent approximate CMYK starting point, not a press ICC conversion. */
export function hexToPrintColor(hex) {
  if (!/^#[a-f0-9]{6}$/i.test(hex)) throw Error("Expected six digit HEX.");
  const [r,g,b] = [1,3,5].map(index => parseInt(hex.slice(index,index+2),16));
  const k = 1-Math.max(r,g,b)/255;
  const c = k === 1 ? 0 : (1-r/255-k)/(1-k);
  const m = k === 1 ? 0 : (1-g/255-k)/(1-k);
  const y = k === 1 ? 0 : (1-b/255-k)/(1-k);
  return { hex: hex.toUpperCase(), rgb: {r,g,b}, cmyk_approx: {c,m,y,k},
    note: "Mathematical CMYK estimate only. Use an ICC profile and printed proof for production." };
}

/** Catalog import accepts only documented, explicitly verified data. Never invent sizes or stock. */
export function normalizeMarketingCatalogItem(item) {
  const offer = normalizeSupplierOffer(item);
  const sizes = Array.isArray(item.sizes) ? item.sizes : [];
  const colors = Array.isArray(item.colors) ? item.colors : [];
  if (!item.name || !item.name.trim() || sizes.some(v => typeof v !== "string") ||
      colors.some(v => typeof v !== "string"))
    throw Error("Catalog items require a name and valid optional sizes/colors.");
  if (!/^https:\/\//i.test(offer.source_url))
    throw Error("An HTTPS supplier product source is required.");
  const image_url = item.image_url || null;
  if (image_url && !/^https:\/\//i.test(image_url))
    throw Error("Product image URL must be HTTPS.");
  return { ...offer, name: item.name.trim(), sizes: [...new Set(sizes)],
    colors: [...new Set(colors)], image_url, supplier_sku: offer.sku,
    availability_verified: Boolean(item.availability_verified), 
    availability_checked_at: item.availability_checked_at || null };
}
export function compareMarketingOffers(offers) {
  if (!Array.isArray(offers)) throw Error("Expected product offers.");
  return offers.map(normalizeMarketingCatalogItem).sort((a,b)=>a.unit_cost-b.unit_cost);
}
