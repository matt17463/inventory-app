import { jsPDF } from "jspdf";
const money=n=>"$"+Number(n).toFixed(2);
export function validateProgramProducts(products,school=false){
 if(!Array.isArray(products)||!products.length||products.length>25)throw Error("Select 1–25 products.");
 if(school&&(!products.some(p=>p.type==="tee")||!products.some(p=>p.type==="hoodie")))throw Error("Include a tee and hoodie.");
 products.forEach((p,i)=>{
  if(!p.name?.trim()||!p.mockup)throw Error("Product "+(i+1)+": name and rendered mockup required.");
  if(!p.tiers?.length||p.tiers.length>7)throw Error("Product "+(i+1)+": enter 1–7 price tiers.");
  p.tiers.forEach(t=>{
   if(!Number.isInteger(Number(t.min))||Number(t.min)<1||t.wholesale===""||t.retail===""||
    !Number.isFinite(Number(t.wholesale))||!Number.isFinite(Number(t.retail))||
    Number(t.wholesale)<0||Number(t.retail)<Number(t.wholesale))
    throw Error("Product "+(i+1)+": invalid wholesale/retail tier.");
  });
 });
}
export function programPriceRows(p){return [...p.tiers].sort((a,b)=>Number(a.min)-Number(b.min)).map(t=>({
 min:Number(t.min),wholesale:Number(t.wholesale),retail:Number(t.retail),
 school:Number((Number(t.retail)-Number(t.wholesale)).toFixed(2))}));}
const navy=[19,45,60],teal=[17,105,103];
function text(pdf,value,x,y,size=10,color=navy,bold=false){
 pdf.setTextColor(...color);pdf.setFont("helvetica",bold?"bold":"normal");pdf.setFontSize(size);
 pdf.text(String(value||"").slice(0,150),x,y);
}
function image(pdf,src,x,y,w,h){
 if(!src)return;
 const type=src.startsWith("data:image/jpeg")?"JPEG":"PNG";
 const info=typeof pdf.getImageProperties==="function"?pdf.getImageProperties(src):null;
 const ratio=info?.width&&info?.height?Math.min(w/info.width,h/info.height):1;
 const iw=info?info.width*ratio:w,ih=info?info.height*ratio:h;
 pdf.addImage(src,type,x+(w-iw)/2,y+(h-ih)/2,iw,ih,undefined,"FAST");
}
function rect(pdf,x,y,w,h,color=[239,246,246]){pdf.setFillColor(...color);pdf.roundedRect(x,y,w,h,7,7,"F");}
function header(pdf,d,title,subtitle){
 pdf.setFillColor(...navy);pdf.rect(0,0,612,104,"F");
 image(pdf,d.businessLogo,30,13,72,72);
 text(pdf,"SKILLED CRAFTING",116,41,19,[255,255,255],true);
 text(pdf,title,116,65,13,[255,255,255],true);
 text(pdf,subtitle,116,83,9,[221,239,238]);
 pdf.setFillColor(245,179,66);pdf.rect(0,102,612,3,"F");
}
function footer(pdf,d,page){
 pdf.setDrawColor(208,222,224);pdf.line(30,741,580,741);
 text(pdf,[d.contact.phone,d.contact.email,d.contact.website].filter(Boolean).join("  |  "),30,755,9,teal,true);
 text(pdf,d.contact.address,30,770,8);
 text(pdf,"Illustrative proposal. Final pricing, proceeds, taxes, refunds and fulfillment require written approval.",30,784,7,[90,104,110]);
 text(pdf,String(page),565,770,9);
}
function card(pdf,p,x,y,w,h){
 rect(pdf,x,y,w,h);image(pdf,p.mockup,x+12,y+10,w-24,h-76);
 text(pdf,p.name,x+12,y+h-52,12,navy,true);
 const t=programPriceRows(p)[0];
 text(pdf,"Wholesale "+money(t.wholesale)+"   Retail "+money(t.retail),x+12,y+h-34,9,teal,true);
 text(pdf,"School/club retains "+money(t.school)+" per item",x+12,y+h-17,9);
}
function requireBrand(d){
 if(!d.businessLogo)throw Error("Upload the Skilled Crafting business logo.");
 if(!d.contact.email?.trim()&&!d.contact.phone?.trim())throw Error("Enter a business phone or email.");
 if(!d.contact.website?.trim())throw Error("Enter the business website.");
}
export function exportSchoolProgramPdf(d){
 validateProgramProducts(d.products,true);requireBrand(d);
 const pdf=new jsPDF({unit:"pt",format:"letter",compress:true});
 header(pdf,d,"SCHOOL SPIRIT WEAR","Schools  •  Clubs  •  Teams  •  Sports programs");
 text(pdf,"YOUR SCHOOL. YOUR COLORS. YOUR COMMUNITY.",30,136,16,navy,true);
 text(pdf,d.organization?"Prepared for "+d.organization:"A spirit-wear program built around your community",30,155,10,teal);
 card(pdf,d.products.find(p=>p.type==="tee"),30,172,265,280);
 card(pdf,d.products.find(p=>p.type==="hoodie"),305,172,275,280);
 rect(pdf,30,465,550,113,[224,244,239]);
 text(pdf,"HOW THE WHOLESALE → RETAIL ARRANGEMENT WORKS",44,487,12,navy,true);
 ["1. We agree on decorated wholesale prices and approved product options.",
  "2. Your school, club or team sets the retail price charged to supporters.",
  "3. Your organization keeps the retail-minus-wholesale difference per sale.",
  "4. We agree on order collection, delivery, taxes and payout terms in writing."
 ].forEach((v,i)=>text(pdf,v,44,508+i*18,9));
 const tee=programPriceRows(d.products.find(p=>p.type==="tee"))[0],hoodie=programPriceRows(d.products.find(p=>p.type==="hoodie"))[0];
 text(pdf,"ILLUSTRATIVE PER-ITEM RETURN",30,606,12,teal,true);
 text(pdf,"Tee: "+money(tee.wholesale)+" wholesale  →  "+money(tee.retail)+" retail  =  "+money(tee.school)+" for your program",30,626,10);
 text(pdf,"Hoodie: "+money(hoodie.wholesale)+" wholesale  →  "+money(hoodie.retail)+" retail  =  "+money(hoodie.school)+" for your program",30,644,10);
 text(pdf,"CUSTOM MERCHANDISE, MADE SIMPLE",30,672,12,navy,true);
 pdf.setFontSize(9);pdf.setTextColor(...navy);
 const lines=pdf.splitTextToSize(d.notes||"School-logo tees and hoodies, artwork proofing, size and color choices, ordering options and fulfillment planning.",545).slice(0,3);
 pdf.text(lines,30,691);
 text(pdf,"LET'S BUILD YOUR SCHOOL PROGRAM — CONTACT US",30,728,11,teal,true);
 footer(pdf,d,1);pdf.save("skilled-crafting-school-spirit-wear.pdf");
}
export function exportClientCatalogPdf(d){
 validateProgramProducts(d.products);requireBrand(d);
 const pdf=new jsPDF({unit:"pt",format:"letter",compress:true});
 for(let i=0;i<d.products.length;i+=2){
  if(i)pdf.addPage();
  header(pdf,d,"CLIENT PRODUCT CATALOG",d.organization||"Custom apparel and branded merchandise");
  d.products.slice(i,i+2).forEach((p,j)=>{
   const y=122+j*300;rect(pdf,30,y,550,285);
   image(pdf,p.mockup,42,y+12,212,214);
   text(pdf,p.name,270,y+26,14,navy,true);
   text(pdf,[p.sku,p.sizes,p.colors].filter(Boolean).join(" | "),270,y+45,8);
   text(pdf,"QTY       WHOLESALE       RETAIL       SCHOOL/CLUB",270,y+73,8,teal,true);
   programPriceRows(p).forEach((r,k)=>{
    const yy=y+95+k*21;if(k%2===0)rect(pdf,265,yy-13,302,19);
    text(pdf,r.min+"+",278,yy,9);text(pdf,money(r.wholesale),346,yy,9);
    text(pdf,money(r.retail),431,yy,9);text(pdf,money(r.school),514,yy,9);
   });
   text(pdf,"Concept mockup — verify placement, color and artwork proof.",270,y+257,8);
  });
  footer(pdf,d,Math.floor(i/2)+1);
 }
 pdf.save("skilled-crafting-client-product-catalog.pdf");
}
