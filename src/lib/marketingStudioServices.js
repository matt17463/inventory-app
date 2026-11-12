/** Purpose-specific client-facing service callouts, editable for every audience. */
export const STUDIO_SERVICE_DEFAULTS=Object.freeze({
 school:{heading:"ARTWORK REFRESH • SEASONAL & SPORT-SPECIFIC DESIGNS",description:"We can refresh your existing school artwork, develop seasonal editions, and create sport, club and team-specific logo variations.",examples:"School logo updates; seasonal spirit wear; club and sports artwork"},
 team:{heading:"TEAM ARTWORK • SEASONAL & COACH OPTIONS",description:"Explore crest refinements, tournament editions, coordinated fan gear, and personalized coach-recognition artwork.",examples:"Tournament editions; player and team designs; coach recognition"},
 business:{heading:"BRAND REFRESH • EMPLOYEE & EVENT COLLECTIONS",description:"We can refine your branding for workwear, create department-specific designs, and coordinate seasonal or event merchandise.",examples:"Workwear placements; department designs; corporate gifts"},
 nonprofit:{heading:"MISSION ARTWORK • CAMPAIGN COLLECTIONS",description:"Create approved campaign-specific graphics, volunteer collections, and seasonal designs that support your organization's message.",examples:"Volunteer apparel; awareness campaigns; donor gifts"},
 wedding:{heading:"PERSONALIZED ARTWORK • EVENT KEEPSAKES",description:"Coordinate your approved monogram, theme and names across reception signage, favors, glassware and keepsakes.",examples:"Monogram options; personalized glassware; guest keepsakes"},
 event:{heading:"EVENT ARTWORK • MERCHANDISE OPTIONS",description:"Develop approved event graphics and coordinated designs for volunteers, sponsors, attendees and special editions.",examples:"Sponsor versions; event merchandise; attendee gifts"},
 general:{heading:"CUSTOM ARTWORK • SPECIAL COLLECTIONS",description:"Refresh your graphics and create coordinated editions for seasonal promotions, special occasions and new merchandise.",examples:"Logo refreshes; seasonal collections; custom gifts"}
});
import {marketingTemplates} from "./marketingCatalogPolicy.js";
const DOCUMENT_SERVICE_PRESETS=Object.freeze({
 brand:{heading:"BRAND GUIDE • APPROVED LOGO USAGE",description:"Review your approved logo applications, brand colors, type choices and suitable decoration methods before publishing brand standards.",examples:"Primary and one-color marks; logo placement; print specifications"},
 artwork:{heading:"ARTWORK OPTIONS • PROOFING & REVISIONS",description:"Compare approved logo versions, decoration placement options and revision notes before authorizing production.",examples:"Logo variants; artwork placement; client approval"},
 mockup:{heading:"DECORATED PRODUCT PROOFS",description:"Review available colors, approved artwork placements and mockup revisions before confirming a product for production.",examples:"Front and back views; approved color options; proof revisions"},
 catalog:{heading:"APPROVED MERCHANDISE COLLECTIONS",description:"Explore coordinated items and decoration options using verified mockups, product names and approved client-facing prices.",examples:"Apparel ranges; colors and sizes; gift options"},
 product:{heading:"FEATURED PRODUCT CUSTOMIZATIONS",description:"Ask about confirmed sizes, colors, decoration positions and customization options for the featured item.",examples:"Product colors; decoration locations; personalization"},
 description:{heading:"PRODUCT DETAILS • CUSTOM OPTIONS",description:"Present confirmed product benefits, materials and decoration methods without inventing specifications or stock.",examples:"Features; personalization; approved decoration"},
 quote:{heading:"REVIEW YOUR ITEMIZED QUOTE",description:"Confirm artwork proofs, quantities, decorated product choices and official quoted pricing before accepting an order.",examples:"Quote review; artwork approval; next steps"},
 pricing:{heading:"PRICING OPTIONS • PRODUCT SELECTION",description:"Compare approved retail pricing, available variations and quantity-based options. Verify all costs and terms before ordering.",examples:"Price tiers; product variants; setup requirements"},
 fundraiser:{heading:"FUNDRAISING OPTIONS • DESIGN SUPPORT",description:"Select approved supporter merchandise, verify decorated wholesale and retail pricing, and explore artwork for your program.",examples:"Seasonal collections; verified proceeds; team or campaign editions"},
 store:{heading:"YOUR ONLINE STORE • ORDERING SUPPORT",description:"Plan your approved customer storefront, product collections and ordering instructions with coordinated artwork.",examples:"Store launch; product setup; ordering communications"},
 onboarding:{heading:"CUSTOMER ORDERING • SUPPORT SERVICES",description:"Explain how supporters choose approved merchandise, verify options and follow the purchasing and fulfillment process.",examples:"Ordering steps; sizes and colors; delivery instructions"},
 intake:{heading:"PROJECT DISCOVERY • ARTWORK PLANNING",description:"Gather your program goals, existing artwork, product requirements and timing before recommending customized options.",examples:"Design consultation; product selection; project planning"},
 outreach:{heading:"LET'S DESIGN SOMETHING TOGETHER",description:"Learn about decoration services, current approved product options and artwork support suitable for your organization.",examples:"Introduction; sample options; follow-up"},
 sample:{heading:"SAMPLES • PRODUCT REVIEW",description:"Evaluate confirmed garment styles, available colors and decoration samples before approving the final lineup.",examples:"Fit and material samples; design proof; approval"},
 color:{heading:"COLOR OPTIONS • BRAND CONSISTENCY",description:"Compare verified manufacturer colors and their appearance with your approved brand artwork before making selections.",examples:"Color chart; sample review; brand color matching"},
 package:{heading:"COORDINATED PACKAGES • PERSONALIZATION",description:"Combine approved merchandise, custom decoration and meaningful gift or recognition options for your audience.",examples:"Package choices; personalization; optional upgrades"},
 proposal:{heading:"PROGRAM PROPOSAL • ARTWORK SERVICES",description:"Review proposed customized merchandise, approved artwork, expected ordering workflow and confirmed terms.",examples:"Program scope; design approval; delivery planning"}
});
export function defaultStudioServices(category="school",template=""){
 const base=STUDIO_SERVICE_DEFAULTS[category]||STUDIO_SERVICE_DEFAULTS.general;
 const selected=marketingTemplates.find(item=>item.id===template);
 const override=DOCUMENT_SERVICE_PRESETS[selected?.kind];
 return {enabled:true,...base,...(override||{})};
}

export function normalizeStudioServices(value={},category="school",template=""){
 const base=defaultStudioServices(category,template);
 const source=value&&typeof value==="object"?value:{};
 return {
  enabled:source.enabled!==false,
  heading:String(source.heading??base.heading).trim().slice(0,92),
  description:String(source.description??base.description).trim().slice(0,280),
  examples:String(source.examples??base.examples).trim().slice(0,125)
 };
}
export function validateStudioServices(value,category="school",template=""){
 const item=normalizeStudioServices(value,category,template),errors=[];
 if(item.enabled){
  if(!item.heading)errors.push("Enter a heading for the artwork and services section.");
  if(!item.description)errors.push("Describe the artwork services you are offering.");
 }
 return {ready:errors.length===0,errors,services:item};
}
