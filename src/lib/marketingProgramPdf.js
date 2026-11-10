import { jsPDF } from "jspdf";
const money=n=>"$"+Number(n).toFixed(2);
export function validateProgramProducts(products,school=false){
 if(!Array.isArray(products)||!products.length||products.length>25)throw Error("Select 1–25 products.");

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
/** Value-led, print-safe one-page flyer. All commercial figures come from approved editor inputs. */
export function exportSchoolProgramPdf(d){
 validateProgramProducts(d.products,true);requireBrand(d);
 const pdf=new jsPDF({unit:"pt",format:"letter",compress:true});
 const featured=d.products.slice(0,2);
 const white=[255,255,255],red=[194,32,46],light=[237,244,250],ink=[23,45,76];
 const write=(value,x,y,size=9,color=ink,bold=false)=>text(pdf,value,x,y,size,color,bold);
 const multiline=(value,x,y,width,size=9,color=ink,leading=12)=>{
  pdf.setFont("helvetica","normal");pdf.setFontSize(size);pdf.setTextColor(...color);
  const lines=pdf.splitTextToSize(String(value),width);
  pdf.text(lines,x,y,{lineHeightFactor:leading/size});
 };
 pdf.setFillColor(...navy);pdf.rect(0,0,612,99,"F");
 pdf.setFillColor(...red);pdf.rect(0,96,612,4,"F");
 image(pdf,d.businessLogo,29,12,86,68);
 write("SKILLED CRAFTING",125,39,19,white,true);
 write("CUSTOM APPAREL  |  PRINTING  |  PERSONALIZATION",125,56,8,[223,236,247]);
 write("YOUR LOCAL SPIRIT WEAR PARTNER",125,78,11,white,true);
 write("SCHOOL SPIRIT WEAR PROGRAM",30,132,20,navy,true);
 write("Build school pride. Support your programs. Make ordering easier.",30,151,11,red,true);
 if(d.organization)write("A program prepared for "+d.organization,30,168,9,teal);
 const benefits=[
  ["SCHOOL PRIDE","School-branded apparel for students, families, staff and fans."],
  ["PROGRAM FUNDING","Set a selling price above your approved wholesale cost."],
  ["EASY ONLINE ORDERS","A dedicated storefront helps supporters order directly."],
  ["LOCAL SUPPORT","Artwork preparation, product guidance and fulfillment planning."]
 ];
 benefits.forEach((item,i)=>{
  const x=30+i*140;
  pdf.setFillColor(...light);pdf.roundedRect(x,184,132,105,7,7,"F");
  pdf.setFillColor(...red);pdf.roundedRect(x+10,195,10,10,5,5,"F");
  write(item[0],x+9,221,9,navy,true);
  multiline(item[1],x+9,239,113,8,ink,11);
 });
 write("HOW YOUR PROGRAM WORKS",30,318,13,navy,true);
 const steps=[
  ["1","PLAN TOGETHER","Choose products, artwork and a pricing approach."],
  ["2","WE BUILD YOUR STORE","Offer approved designs and sizes in an online storefront."],
  ["3","SUPPORTERS ORDER","Families and fans shop; we coordinate production."],
  ["4","YOUR PROGRAM BENEFITS","Reconcile sales and proceeds under agreed terms."]
 ];
 steps.forEach((item,i)=>{
  const y=338+i*40;
  pdf.setFillColor(...red);pdf.roundedRect(31,y-8,24,24,12,12,"F");
  write(item[0],39,y+8,11,white,true);
  write(item[1],65,y,9,navy,true);
  write(item[2],65,y+14,8,ink);
 });
 pdf.setFillColor(228,239,248);pdf.roundedRect(315,308,267,192,9,9,"F");
 write("THE WHOLESALE - RETAIL ADVANTAGE",329,332,11,navy,true);
 multiline("We agree on your decorated wholesale price. Your organization chooses an approved retail price and retains the difference on each sale.",329,350,237,9,ink,13);
 pdf.setFillColor(...navy);pdf.rect(329,399,239,23,"F");
 write("EXAMPLE",337,415,8,white,true);
 write("WHOLESALE",402,415,7,white,true);
 write("RETAIL",473,415,7,white,true);
 write("RETURN",529,415,7,white,true);
 featured.forEach((product,i)=>{
  const name=product.name, row=programPriceRows(product)[0];
  const y=440+i*27;
  write(name,337,y,9,ink,true);write(money(row.wholesale),405,y,9);
  write(money(row.retail),473,y,9);write(money(row.school),529,y,9,red,true);
 });
 write("Examples only; actual prices and payout terms vary.",329,490,7,[90,104,110]);
 write("WHY PARTNER WITH SKILLED CRAFTING?",30,531,12,navy,true);
 multiline("Custom school branding  |  Product and decoration guidance  |  Online storefront options  |  Quality-focused production  |  One local point of contact",30,549,547,9,ink,13);
 pdf.setDrawColor(199,215,227);pdf.line(30,583,582,583);
 write("A FEW WAYS TO SHOW YOUR SCHOOL PRIDE",30,601,11,navy,true);
 // Product samples are intentionally secondary: a compact row near the bottom.
 featured.forEach((product,i)=>{
  const x=featured.length===1?247:(i===0?91:350);
  image(pdf,product.mockup,x,608,118,83);
  write(product.name.slice(0,27).toUpperCase(),x,703,8,navy,true);
 });
 pdf.setFillColor(...navy);pdf.rect(0,718,612,74,"F");
 write("LET'S BUILD YOUR SCHOOL PROGRAM",30,741,12,white,true);
 write([d.contact.phone,d.contact.email].filter(Boolean).join("  |  "),30,758,9,white);
 write(d.contact.website||"",30,773,9,[222,238,247],true);
 if(d.contact.address)write(d.contact.address,330,773,8,white);
 write("Pricing, fulfillment and program terms subject to written agreement.",330,788,6,[222,238,247]);
 pdf.save("skilled-crafting-school-spirit-wear.pdf");
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
