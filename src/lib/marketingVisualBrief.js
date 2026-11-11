/**
 * Shared visual direction for every marketing document template.
 * Image-generation services can consume this creative brief alongside approved
 * brand assets; factual content remains outside generative artwork.
 */
const limit=(value,max=500)=>String(value??"").trim().slice(0,max);
const safeColors=colors=>(Array.isArray(colors)?colors:String(colors||"").split(",")).map(x=>x.trim()).filter(x=>/^#[0-9a-f]{6}$/i.test(x)).slice(0,6);
const contexts={
 school:"premium school spirit-wear campaign; athletic display lettering, layered mountains and evergreens, mascot-led hero, realistic overlapping branded apparel",
 team:"premium youth sports campaign; energetic stadium lighting, bold athletic lettering, dynamic motion, realistic decorated team merchandise",
 business:"premium business branding campaign; polished commercial photography, professional workwear and gifts, restrained architectural lighting",
 nonprofit:"compelling nonprofit fundraising campaign; authentic community-focused imagery, uplifting visual hierarchy, realistic merchandise",
 wedding:"elegant wedding and event personalization campaign; refined typography, atmospheric product photography, tasteful florals and realistic engraved gifts",
 event:"premium event merchandise campaign; bold celebratory art direction, dynamic visual hierarchy, realistic customized products",
 general:"premium commercial advertising campaign; editorial composition, sophisticated typography, dimensional product imagery"
};
export function marketingVisualBrief({templateId="",templateLabel="",organization="",segment="",colors=[],purpose="",description="",products="",style="premium",audience=""}={}){
 const id=limit(templateId,90),label=limit(templateLabel,120),client=limit(organization,140);
 const group=/school|fundrais/i.test(id+" "+segment)?"school":/coach|sport|team/i.test(id+" "+segment)?"team":/wedding/i.test(id)?"wedding":/event/i.test(id)?"event":/nonprofit/i.test(segment)?"nonprofit":/business/i.test(id+" "+segment)?"business":"general";
 const palette=safeColors(colors);
 return [
  "SKILLED CRAFTING — REUSABLE AI VISUAL DESIGN BRIEF",
  "Deliverable: "+(label||id||"marketing collateral")+". Client: "+(client||"not selected")+".",
  "Creative direction: "+contexts[group]+".",
  "Design objective: visually compelling, professionally art-directed promotional material with rich layered scenery, purposeful lighting, textured accents, believable product photography and clear hierarchy. Avoid generic clipart, basic SVG shapes, stock-looking placeholders and plain document styling.",
  "Brand: use only the client's supplied, approved logo/mascot as the authoritative identity. Preserve its distinctive proportions and colors; do not redraw it into a different mascot. Palette: "+(palette.join(", ")||"await verified brand colors")+".",
  "Purpose: "+(limit(purpose,350)||"promote verified Skilled Crafting products and services")+". Audience: "+(limit(audience,120)||"the client's audience")+".",
  "Context: "+(limit(description,700)||"none supplied")+". Products: "+(limit(products,500)||"only approved merchandise imagery")+".",
  "Visual style preference: "+limit(style,120)+".",
  "Use real approved product mockups when provided. Do not invent decoration details, prices, specifications, endorsements, fundraising results, discounts, delivery dates, or contact information.",
  "IMPORTANT OUTPUT ARCHITECTURE: create a text-free high-resolution background/hero illustration with intentional negative space for copy, logos, product images and data overlays. Never bake prices, dates, contacts, legal terms, charts or critical instructions into generated pixels. The application must compose those separately as editable, verified layers.",
  "Create at print-safe aspect ratio for the chosen output. Ensure strong contrast, trim-safe margins and visual consistency with other client marketing collateral. Allow controlled revisions without changing approved brand assets."
 ].join("\n");
}
