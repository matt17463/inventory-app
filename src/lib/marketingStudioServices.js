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
export const defaultStudioServices=(category="school")=>({enabled:true,...(STUDIO_SERVICE_DEFAULTS[category]||STUDIO_SERVICE_DEFAULTS.general)});
export function normalizeStudioServices(value={},category="school"){
 const base=defaultStudioServices(category);
 const source=value&&typeof value==="object"?value:{};
 return {
  enabled:source.enabled!==false,
  heading:String(source.heading??base.heading).trim().slice(0,92),
  description:String(source.description??base.description).trim().slice(0,280),
  examples:String(source.examples??base.examples).trim().slice(0,125)
 };
}
export function validateStudioServices(value,category="school"){
 const item=normalizeStudioServices(value,category),errors=[];
 if(item.enabled){
  if(!item.heading)errors.push("Enter a heading for the artwork and services section.");
  if(!item.description)errors.push("Describe the artwork services you are offering.");
 }
 return {ready:errors.length===0,errors,services:item};
}
