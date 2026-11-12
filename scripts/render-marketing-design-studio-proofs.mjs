/* global document */
// Layout regression proofs are synthetic: NEVER approved client artworks.
import {mkdirSync,writeFileSync} from "node:fs";
import sharp from "sharp";
import {chromium} from "@playwright/test";
import {PDFDocument} from "pdf-lib";
import {studioPrintHtml} from "../src/lib/marketingDesignStudio.js";
import {marketingCampaignProfile} from "../src/lib/marketingCampaignProfiles.js";

const out="artifacts/marketing-ai-design-studio";
mkdirSync(out,{recursive:true});
const png=async(svg)=>"data:image/png;base64,"+(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
const badge=await png('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="500" height="500" rx="88" fill="#123658"/><circle cx="250" cy="222" r="155" stroke="#dbb74b" stroke-width="21" fill="none"/><text x="250" y="218" text-anchor="middle" fill="white" font-size="64" font-family="Arial" font-weight="bold">DEMO</text><text x="250" y="290" text-anchor="middle" fill="white" font-size="40" font-family="Arial">ARTWORK</text><text x="250" y="410" text-anchor="middle" fill="#dbb74b" font-size="26" font-family="Arial">TEST ONLY</text></svg>');
async function product(index){
 const fills=["#163d71","#c9ced3","#272d38","#345948","#644475"];
 const fill=fills[index];
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="560" height="650"><rect width="560" height="650" fill="#fff"/><path d="M160 110 215 78 345 78 400 110 525 238 443 313 400 278 400 590 160 590 160 278 117 313 35 238Z" fill="'+fill+'" stroke="#778391" stroke-width="8"/><text x="280" y="322" text-anchor="middle" fill="#fff" font-family="Arial" font-size="47" font-weight="bold">TEST</text><text x="280" y="365" text-anchor="middle" fill="#fff" font-family="Arial" font-size="24">MOCKUP</text></svg>';
 return png(svg);
}
const products=await Promise.all(Array.from({length:5},(_,i)=>product(i)));
const cases=[
 ["school","Example Elementary",0,["#244d87","#edc945"]],
 ["school","Example High School",1,["#541b72","#f1cc20"]],
 ["school","Example Middle School",2,["#144936","#edbc34"]],
 ["business","Example Service Co.",0,["#1c405e","#d69e42"]],
 ["nonprofit","Example Community Foundation",1,["#1d6b5d","#d8b35a"]],
 ["team","Example Athletics Club",2,["#1a3b8a","#f1d031"]],
 ["wedding","Example Wedding & Events",1,["#645c68","#e2c7a5"]],
 ["general","Example Maker Studio",0,["#3b436b","#f2bd69"]]
];
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 for(const [category,client,concept,colors] of cases){
  const profile=marketingCampaignProfile(category);
  const html=studioPrintHtml({client,category,colors,logo:badge,concept,
   headline:profile.collection,
   description:"Verified program copy belongs here. This synthetic test document is not for client distribution.",
   productImages:products,benefits:["Coordinated approved designs","Simple organization-wide ordering","Local custom production","Flexible product choices"],
   steps:["Discuss options","Approve artwork","Order products","Complete fulfillment"],
   cta:"LET'S CREATE YOUR COLLECTION",
   contact:"preview@example.invalid · example.invalid",
   fundraisingNote:["school","team","nonprofit"].includes(category)?"Supporter merchandise can help fund programs based on approved terms.":"",
   artworkOptions:profile.defaultOptions,artworkMessage:profile.defaultMessage,
   artworkVariantImage:category==="school"?badge:"",
   fundraisingRows:category==="school"?[{product:"TEST School Tee",wholesale:10,retail:18,quantity:50,verified:true},{product:"TEST School Hoodie",wholesale:22,retail:38,quantity:30,verified:true}]:[],
   plan:{sections:["hero","products","benefits","steps","cta"],align:"left",emphasis:"hero",composition:"split"}});
  const page=await browser.newPage({viewport:{width:816,height:1056},deviceScaleFactor:1});
  await page.setContent(html,{waitUntil:"load"});
  await page.evaluate(()=>document.fonts.ready);
  const check=await page.evaluate(()=>{
   const rect=(q)=>{const n=document.querySelector(q);if(!n)return null;const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};};
   const body=rect(".page"),footer=rect("footer"),options=rect(".artwork-options"),gallery=rect(".gallery");
   const over=Array.from(document.querySelectorAll(".page *")).map(e=>({name:e.tagName.toLowerCase(),height:e.scrollHeight,client:e.clientHeight,overflow:e.scrollHeight-e.clientHeight})).filter(x=>x.overflow>10).slice(0,12);
   return {body,footer,options,gallery,pageScroll:document.querySelector(".page").scrollHeight,over};
  });
  if(!check.footer||!check.options||!check.gallery)throw Error(category+" missing major campaign sections");
  if(check.footer.bottom>1057||check.footer.top<0)throw Error(category+" footer exceeds Letter page: "+JSON.stringify(check));
  if(check.options.bottom>check.footer.top+3)throw Error(category+" options overlap CTA footer: "+JSON.stringify(check));
  if(check.pageScroll>1085)throw Error(category+" overflow inside fixed letter page: "+JSON.stringify(check));
  if(category==="school" && check.footer.top-check.options.bottom>45)throw Error("School flyer has excessive empty space before its call to action: "+JSON.stringify(check));
  const name=category+"-"+concept;
  await page.screenshot({path:out+"/"+name+".png"});
  const pdf=await page.pdf({printBackground:true,preferCSSPageSize:true,scale:1});
  if((await PDFDocument.load(pdf)).getPageCount()!==1)throw Error(name+" printed as more than one page");
  writeFileSync(out+"/"+name+".pdf",pdf);
  writeFileSync(out+"/"+name+".html",html);
  console.log(name,"visual proof OK",JSON.stringify({pageScroll:check.pageScroll,optionsBottom:check.options.bottom,footerTop:check.footer.top}));
  await page.close();
 }
}finally{await browser.close();}
console.log("All 8 category-adaptive full-page visual proofs saved at "+out);
