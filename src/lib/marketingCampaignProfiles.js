/** Creative art direction shared across client-adaptive marketing campaigns.
 * Pure static geometry is decorative; real logos, mascot artwork, products and facts
 * are always supplied/approved separately.
 */
const PROFILES={
 school:{
  kicker:"SPIRIT WEAR FOR YOUR SCHOOL",slogan:"ONE SCHOOL. EVERY TEAM.",collection:"YOUR SCHOOL. YOUR STYLE.",
  collectionEyebrow:"01 / FEATURED SPIRIT WEAR",editorialTitle:"A collection worth wearing.",boldTitle:"EVERY STUDENT. EVERY SEASON.",
  benefits:"WHY SCHOOLS PARTNER WITH US",steps:"FROM IDEA TO ONLINE ORDERS",funding:"PROGRAM FUNDING",
  artwork:"ONE SCHOOL. ENDLESS SPIRIT.",artworkEyebrow:"ARTWORK MODERNIZATION & SEASONAL DESIGNS",
  defaultOptions:["Logo refresh & alternate versions","Fall, winter & spring collections","Sport and team-specific artwork","Clubs, activities & special events"],
  defaultMessage:"Refresh approved school artwork and build matching designs for seasons, athletics, clubs and special occasions.",
  motif:"school",heroTone:"collegiate"
 },
 business:{
  kicker:"CUSTOM APPAREL FOR YOUR BUSINESS",slogan:"YOUR TEAM. YOUR BRAND.",collection:"MAKE YOUR BRAND VISIBLE.",
  collectionEyebrow:"01 / BRANDED APPAREL & GIFTS",editorialTitle:"Professional from every angle.",boldTitle:"BRAND IDENTITY, BUILT IN.",
  benefits:"WHY BUSINESSES WORK WITH US",steps:"YOUR BRANDING WORKFLOW",funding:"PROGRAM OPPORTUNITIES",
  artwork:"A BRAND THAT WORKS EVERYWHERE.",artworkEyebrow:"BRAND EXTENSIONS & CAMPAIGNS",
  defaultOptions:["Workwear & staff uniform collections","Seasonal promotional campaigns","Embroidered & printed logo versions","Events & employee appreciation"],
  defaultMessage:"Adapt approved branding across workwear, client gifts, campaigns and coordinated team apparel.",
  motif:"business",heroTone:"professional"
 },
 team:{
  kicker:"CUSTOM GEAR FOR YOUR CLUB",slogan:"WEAR THE TEAM.",collection:"GEAR FOR EVERY SUPPORTER.",
  collectionEyebrow:"01 / TEAM & FAN MERCHANDISE",editorialTitle:"Wear the colors together.",boldTitle:"ONE CREST. ONE COMMUNITY.",
  benefits:"WHY CLUBS PARTNER WITH US",steps:"BUILD YOUR TEAM COLLECTION",funding:"CLUB FUNDING",
  artwork:"ONE CLUB. EVERY OCCASION.",artworkEyebrow:"TEAM, SEASON & EVENT ARTWORK",
  defaultOptions:["Home and away design options","Tournament & travel collections","Coach and volunteer recognition","Age-group and sport-specific variants"],
  defaultMessage:"Create coordinated editions of your approved club crest for teams, tournaments, fanwear and recognition gifts.",
  motif:"team",heroTone:"athletic"
 },
 nonprofit:{
  kicker:"MERCHANDISE WITH A MISSION",slogan:"MAKE SUPPORT VISIBLE.",collection:"WEAR YOUR MISSION.",
  collectionEyebrow:"01 / MISSION-LED MERCHANDISE",editorialTitle:"A collection with purpose.",boldTitle:"YOUR CAUSE. YOUR COMMUNITY.",
  benefits:"WHY COMMUNITY PARTNERS CHOOSE US",steps:"FROM MISSION TO MERCHANDISE",funding:"CAMPAIGN SUPPORT",
  artwork:"MORE WAYS TO SHARE YOUR MISSION.",artworkEyebrow:"CAMPAIGN & EVENT DESIGN OPTIONS",
  defaultOptions:["Fundraising campaign editions","Volunteer and staff apparel","Awareness month collections","Community event merchandise"],
  defaultMessage:"Build consistent, approved mission artwork for awareness campaigns, volunteers, events and supporter merchandise.",
  motif:"nonprofit",heroTone:"welcoming"
 },
 wedding:{
  kicker:"PERSONALIZED WEDDINGS & EVENTS",slogan:"MADE FOR THE MOMENT.",collection:"DETAILS WORTH KEEPING.",
  collectionEyebrow:"01 / PERSONALIZED KEEPSAKES",editorialTitle:"Beautifully considered details.",boldTitle:"MOMENTS MADE PERSONAL.",
  benefits:"THOUGHTFUL EVENT DETAILS",steps:"YOUR PERSONALIZATION PROCESS",funding:"PACKAGE OPTIONS",
  artwork:"YOUR STYLE, THROUGH EVERY DETAIL.",artworkEyebrow:"COORDINATED EVENT DESIGN",
  defaultOptions:["Matching ceremony and reception pieces","Personalized wedding party gifts","Engraved glassware and keepsakes","Invitations, signage and favors"],
  defaultMessage:"Coordinate typography, approved monograms and personalized motifs across keepsakes, signage, gifts and tablescapes.",
  motif:"wedding",heroTone:"elegant"
 },
 general:{
  kicker:"CUSTOM PRINT & PERSONALIZATION",slogan:"MAKE IT YOURS.",collection:"CREATE SOMETHING DISTINCTIVE.",
  collectionEyebrow:"01 / FEATURED CUSTOM PRODUCTS",editorialTitle:"Designed with intention.",boldTitle:"YOUR IDEA. MADE TANGIBLE.",
  benefits:"WHY CUSTOMERS PARTNER WITH US",steps:"FROM CONCEPT TO COMPLETION",funding:"PACKAGE OPTIONS",
  artwork:"PERSONALIZED FOR THE OCCASION.",artworkEyebrow:"ARTWORK & CREATIVE OPTIONS",
  defaultOptions:["Alternative brand treatments","Coordinated event merchandise","Seasonal collections","Custom gifts and personalization"],
  defaultMessage:"Make a coordinated collection using approved branding, original artwork and personalized product designs.",
  motif:"general",heroTone:"expressive"
 }
};
export function marketingCampaignProfile(category){
 return PROFILES[category]||PROFILES.general;
}
export function marketingCampaignMood(category,client="",preference="auto",colors=[]){
 const choices=new Set(["collegiate","playful","professional","athletic","welcoming","elegant","expressive"]);
 if(choices.has(preference))return preference;
 const name=String(client||"").toLowerCase();
 if(category==="school"){
  if(/elementary|primary|preschool/.test(name))return "playful";
  if(/high school|secondary|academy/.test(name))return "collegiate";
 }
 // Read the already approved client HEX palette, not unverified color guesses.
 const palette=(Array.isArray(colors)?colors:[]).filter(x=>/^#[0-9a-f]{6}$/i.test(x));
 const statistics=palette.map(hex=>{
  const red=parseInt(hex.slice(1,3),16)/255,green=parseInt(hex.slice(3,5),16)/255,blue=parseInt(hex.slice(5,7),16)/255;
  const brightest=Math.max(red,green,blue),dim=Math.min(red,green,blue);
  return {saturation:brightest===0?0:(brightest-dim)/brightest,brightness:brightest};
 });
 const vivid=statistics.filter(x=>x.saturation>.55&&x.brightness>.45).length;
 const muted=statistics.length>0&&statistics.every(x=>x.saturation<.25);
 if(category==="school"){
  if(vivid>=2)return "athletic";
  if(muted)return "professional";
 }
 if(category==="general"&&vivid>=2)return "expressive";
 return marketingCampaignProfile(category).heroTone;
}
export function marketingCampaignMotif(category){
 const motifs={
  // Abstract mountain and evergreen silhouettes, not claims about actual school location.
  school:'<path d="M0 205 95 122 156 163 280 54 382 165 472 94 585 175 660 138 810 238V330H0Z" fill="white" opacity=".18"/><path d="M0 236 130 164 246 210 347 119 474 212 550 170 685 220 810 190V330H0Z" fill="white" opacity=".12"/><g fill="white" opacity=".25"><path d="m25 277 22-83 22 83h-17v35H41v-35z M104 298l20-90 21 90h-15v32h-12v-32z M710 287l20-92 22 92h-16v40h-12v-40z M764 299l18-75 18 75h-13v28h-9v-28z"/></g>',
  team:'<path d="M-20 220Q405 42 830 220" stroke="white" stroke-width="5" fill="none" opacity=".18"/><path d="M-20 254Q405 76 830 254 M-20 284Q405 106 830 284" stroke="white" stroke-width="2" fill="none" opacity=".14"/><path d="M520 60 760 300 M610 15 810 210" stroke="white" stroke-width="18" opacity=".08"/>',
  business:'<path d="M0 280 115 175 170 215 315 70 405 176 545 55 665 215 810 115V330H0" fill="white" opacity=".10"/><path d="M0 220 210 40 280 120 505 -25" stroke="white" stroke-width="32" opacity=".09" fill="none"/><path d="M615 45 810 230" stroke="white" stroke-width="16" opacity=".12"/>',
  nonprofit:'<circle cx="720" cy="165" r="165" stroke="white" stroke-width="35" fill="none" opacity=".12"/><circle cx="720" cy="165" r="95" stroke="white" stroke-width="8" fill="none" opacity=".15"/><path d="M0 258Q230 125 460 260T920 265" stroke="white" stroke-width="14" fill="none" opacity=".13"/>',
  wedding:'<path d="M820-30Q500 110 720 330 M735-20Q550 160 790 330" fill="none" stroke="white" stroke-width="3" opacity=".24"/><g fill="white" opacity=".20"><ellipse cx="652" cy="110" rx="24" ry="52" transform="rotate(-34 652 110)"/><ellipse cx="725" cy="155" rx="24" ry="52" transform="rotate(35 725 155)"/><ellipse cx="690" cy="232" rx="24" ry="52" transform="rotate(-30 690 232)"/></g>',
  general:'<circle cx="700" cy="130" r="190" stroke="white" stroke-width="38" fill="none" opacity=".12"/><path d="M0 280 210 75 480 300 725 40" stroke="white" stroke-width="52" fill="none" opacity=".08"/>'
 };
 return '<svg class="hero-motif" viewBox="0 0 810 330" preserveAspectRatio="xMidYMid slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'+(motifs[category]||motifs.general)+'</svg>';
}
export function marketingCategoryKeys(){return Object.keys(PROFILES);}
