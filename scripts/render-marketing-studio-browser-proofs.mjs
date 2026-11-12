/**
 * Render synthetic (never client-approved) flyer HTML in Chromium at print size.
 * Screenshots and PDFs are visual review artifacts, not proof of client approval.
 */
import {readdirSync,writeFileSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {chromium} from "@playwright/test";

const output="artifacts/marketing-flyers";
const files=readdirSync(output).filter(name=>/^(?:school|team|business|nonprofit|wedding|general)-ai-studio-concept-[123]\.html$/.test(name));
if(files.length!==8)throw Error("Expected exactly eight audience/concept fixture documents; found "+files.length);
const browser=await chromium.launch({headless:true});
const report=[];
try{
 for(const name of files){
  const page=await browser.newPage({viewport:{width:816,height:1056},deviceScaleFactor:1});
  try{
   await page.goto(pathToFileURL(path.resolve(output,name)).href,{waitUntil:"load"});
   await page.evaluate(()=>document.fonts.ready);
   const results=await page.evaluate(()=>{
    const documentPage=document.querySelector(".page");
    if(!documentPage)return {errors:["Missing US Letter page"]};
    const errors=[];
    const targets=[".page","main","footer",".school-callouts"];
    const detail={};
    for(const selector of targets){
     const el=selector===".page"?documentPage:documentPage.querySelector(selector);
     if(!el)continue;
     const bounding=el.getBoundingClientRect();
     detail[selector]={left:bounding.left,top:bounding.top,right:bounding.right,bottom:bounding.bottom,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight};
     if(el.scrollHeight>el.clientHeight+3)errors.push(selector+" has overflowed its printed box");
    }
    const logo=documentPage.querySelector(".hero .identity"),text=documentPage.querySelector(".hero-text,.editorial-head");
    if(logo&&text){
     const a=logo.getBoundingClientRect(),b=text.getBoundingClientRect();
     if(a.left<b.right-2&&a.right>b.left+2&&a.top<b.bottom-2&&a.bottom>b.top+2)errors.push("Brand logo and hero content overlap");
    }
    const main=documentPage.querySelector("main"),footer=documentPage.querySelector("footer");
    if(main&&footer&&main.getBoundingClientRect().bottom>footer.getBoundingClientRect().top+2)errors.push("Main content overlays footer");
    return {errors,detail};
   });
   const base=name.slice(0,-5);
   await page.screenshot({path:path.join(output,base+".png"),fullPage:false});
   await page.pdf({path:path.join(output,base+".pdf"),format:"Letter",printBackground:true,preferCSSPageSize:true});
   report.push({file:name,errors:results.errors,layout:results.detail});
  }finally{await page.close();}
 }
}finally{await browser.close();}
writeFileSync(path.join(output,"studio-browser-layout-report.json"),JSON.stringify(report,null,2));
const failures=report.filter(x=>x.errors.length);
if(failures.length)throw Error("Studio browser print fixtures failed: "+JSON.stringify(failures.map(x=>({file:x.file,errors:x.errors}))));
console.log("Validated",report.length,"synthetic Studio print proofs with screenshots and PDFs");
