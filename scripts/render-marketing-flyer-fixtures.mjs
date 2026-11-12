// Visual layout fixtures: synthetic artwork only, never client-approved logos or prices.
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { buildSchoolProgramPdf } from "../src/lib/marketingProgramPdf.js";
import { schoolFlyerSvg } from "../src/lib/marketingIllustratedFlyer.js";
import {studioPrintHtml,offlineStudioHeroArtwork} from "../src/lib/marketingDesignStudio.js";

const output = "artifacts/marketing-flyers";
mkdirSync(output, { recursive: true });
const schools = [
  { key:"greywolf", school:"Greywolf Elementary", primary:"#0F417D", secondary:"#F1D51A", initials:"GE", short:"GREYWOLF" },
  { key:"helen-haller", school:"Helen Haller Elementary", primary:"#075538", secondary:"#F3D21E", initials:"HH", short:"COUGARS" },
  { key:"sequim", school:"Sequim High School", primary:"#4E176B", secondary:"#F4D514", initials:"SH", short:"SEQUIM" },
];
const png=async svg=>"data:image/png;base64,"+(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
const brand=await png('<svg xmlns="http://www.w3.org/2000/svg" width="330" height="150"><text x="12" y="60" font-size="54" fill="#173A61" font-family="Arial" font-weight="bold">SC</text><text x="13" y="95" font-size="22" fill="#173A61" font-family="Arial">SKILLED CRAFTING</text></svg>');
function badge(s){return '<svg xmlns="http://www.w3.org/2000/svg" width="450" height="450"><circle cx="225" cy="225" r="196" fill="'+s.primary+'" stroke="'+s.secondary+'" stroke-width="24"/><text x="225" y="260" text-anchor="middle" font-size="132" font-family="Arial" font-weight="bold" fill="white">'+s.initials+'</text><text x="225" y="340" text-anchor="middle" font-size="27" font-family="Arial" fill="white">TEST ART</text></svg>';}
function garment(s,name,index){
 const body=index===2?'#2A2D35':index===1?'#E3E3E3':s.primary;
 const letter=index===1?s.primary:"#FFFFFF";
 return '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="520">'+
  '<path d="M120 80 L175 52 L245 52 L300 80 L385 155 L332 233 L304 204 L304 467 L116 467 L116 204 L88 233 L35 155 Z" fill="'+body+'" stroke="#7E8999" stroke-width="9"/>'+
  '<path d="M176 52 Q210 125 244 52" stroke="#697485" stroke-width="9" fill="none"/>'+
  '<text x="210" y="244" text-anchor="middle" fill="'+letter+'" font-family="Arial" font-weight="bold" font-size="34">'+s.short+'</text>'+
  '<text x="210" y="285" text-anchor="middle" fill="'+letter+'" font-family="Arial" font-size="25">TEST MOCKUP</text></svg>';
}
for(const s of schools){
 const products=[];
 for(let index=0;index<3;index++){
  products.push({
   name:["Spirit tee","School hoodie","Warm-up top"][index],
   mockup:await png(garment(s,s.short,index)),
   tiers:[{min:1,wholesale:["12","25","23"][index],retail:["20","40","38"][index]}],
  });
 }
 const data={
  organization:s.school,colors:[s.primary,s.secondary],businessLogo:brand,
  schoolLogo:await png(badge(s)),heroArtwork:await png(badge(s)),
  headline:"WEAR YOUR SCHOOL PRIDE",tagline:"One school. Every student. More ways to show your spirit.",
  programDescription:"A sample spirit-wear program for school leaders and community supporters. Replace all testing details with verified client content before sharing.",
  notes:"TEST LAYOUT ONLY — not approved school merchandise.",
  contact:{email:"preview@example.invalid",website:"skilledcrafting.com"},products,
 };
 const svg=schoolFlyerSvg(data);
 writeFileSync(output+"/"+s.key+"-illustrated.svg",svg);
 await sharp(Buffer.from(svg)).resize({width:1224}).png().toFile(output+"/"+s.key+"-illustrated.png");
 const file=buildSchoolProgramPdf(data);
 const bytes=Buffer.from(file.output("arraybuffer"));
 writeFileSync(output+"/"+s.key+".pdf",bytes);
 console.log(s.school,bytes.length,"bytes",file.getNumberOfPages(),"pages");
 if(file.getNumberOfPages()!==2)throw Error(s.school+" was not exactly two pages");
}

/**
 * HTML fixture proofs exercise the AI Studio print compositor directly, including
 * category-specific language and optional school fundraising. Synthetic imagery
 * remains clearly marked and cannot be distributed as approved merchandise.
 */
const previewGarments=await Promise.all([0,1,2].map(i=>png(garment({primary:"#243F6E",secondary:"#E6B93E",short:"TEST"},"TEST",i))));
const syntheticSchoolCrest=await png(badge({primary:"#1F4369",secondary:"#E6B93E",initials:"TS"}));
const businessCategories=["school","team","business","nonprofit","wedding","event","general"];
for(const category of businessCategories){
 const variants=category==="school"?3:1;
 for(let concept=0;concept<variants;concept++){
  const artwork="data:image/png;base64,"+(await sharp(Buffer.from(offlineStudioHeroArtwork({category,concept:concept+1,colors:["#1F4369","#E6B93E"]}))).resize({width:2550,height:1150,fit:"fill"}).png().toBuffer()).toString("base64");
  const html=studioPrintHtml({
   client:category==="school"?"Synthetic Example School":"Synthetic "+category.toUpperCase()+" Client",
   category,concept,image:artwork,logo:category==="school"?syntheticSchoolCrest:brand,headline:"SAMPLE DESIGN — NOT CLIENT APPROVED",
   description:"Print layout test with synthetic branding and merchandise. Do not distribute.",
   benefits:["SCHOOL PRIDE — coordinated community spirit wear","PROGRAM FUNDING — approved wholesale-to-retail plans","EASY ONLINE ORDERING — dedicated client storefront","LOCAL SUPPORT — art prep and order fulfillment"],
   steps:["Plan together with your coordinator","Choose approved designs and prices","Supporters order through your shop","Review program proceeds and results"],
   cta:"CONTACT FOR AN APPROVED CLIENT PROOF",contact:"preview@example.invalid",
   productImages:previewGarments,productLabels:["Sample spirit tee","Sample hoodie","Sample warm-up top"],
   colors:["#1F4369","#E6B93E"],
   schoolFundraising:category==="school"?{enabled:true,wholesale:"18.25",retail:"29.75",quantity:"75"}:{enabled:false}
  });
  writeFileSync(output+"/"+category+"-ai-studio-concept-"+(concept+1)+".html",html);
  if(!html.includes("SAMPLE DESIGN")||category==="school"&&!html.includes("ARTWORK REFRESH"))throw Error("Invalid marketing design fixture: "+category);
 }
}
