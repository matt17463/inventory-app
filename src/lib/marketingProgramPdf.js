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
/** Fully editable, school-branded two-page editorial flyer.
 * Original artwork and product mockups come from the editor, never generated stand-ins.
 * Page 1 is the visual cover; page 2 contains the verified program and pricing details.
 */
export function buildSchoolProgramPdf(d){
 validateProgramProducts(d.products,true);requireBrand(d);
 const pdf=new jsPDF({unit:"pt",format:"letter",compress:true});
 const verified=(d.colors||[]).filter(v=>/^#[0-9a-f]{6}$/i.test(v));
 const colorHex=(hex)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const primary=colorHex(verified[0]||"#233B69");
 const secondary=colorHex(verified[1]||"#E6B93E");
 const white=[255,255,255], ink=[25,38,56], muted=[88,101,117];
 const dark=(rgb)=>{const [r,g,b]=rgb.map(x=>{const v=x/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;});return r*.2126+g*.7152+b*.0722<.25;};
 const contrastText=dark(primary)?white:ink;
 const write=(v,x,y,size=10,color=ink,bold=false)=>text(pdf,v,x,y,size,color,bold);
 const wrap=(v,x,y,w,size=10,color=ink,lineHeight=1.3,maxLines=6,bold=false)=>{
  pdf.setFont("helvetica",bold==="display"?"bolditalic":bold?"bold":"normal");pdf.setFontSize(size);pdf.setTextColor(...color);
  const rows=pdf.splitTextToSize(String(v||""),w).slice(0,maxLines);
  rows.forEach((line,i)=>pdf.text(line,x,y+i*size*lineHeight));
  return y+rows.length*size*lineHeight;
 };
 const bar=(x,y,w,h,color)=>{pdf.setFillColor(...color);pdf.rect(x,y,w,h,"F");};
 const mix=(a,b,f)=>a.map((v,i)=>Math.round(v*(1-f)+b[i]*f));
 const accentLight=mix(primary,white,.19),accentShade=mix(primary,[0,0,0],.22);
 const backdrop=()=>{
  if(typeof pdf.triangle!=="function")return;
  // Geometric mountain and evergreen silhouettes echo the original school flyers.
  pdf.setFillColor(...accentLight);
  for(const [x,y,w] of [[-100,333,280],[72,310,250],[303,335,300],[477,307,218]]){
   pdf.triangle(x,356,x+w/2,y-158,x+w,356,"F");
  }
  pdf.setFillColor(...accentShade);
  for(const [x,h] of [[3,105],[24,77],[585,100],[610,126]]){
   pdf.triangle(x-30,361,x,361-h,x+30,361,"F");
   pdf.triangle(x-24,355,x,347-h,x+24,355,"F");
  }
 };

 const featured=d.products.slice(0,3), title=d.headline?.trim()||"WEAR YOUR SCHOOL PRIDE";
 const subtitle=d.tagline?.trim()||"Spirit wear for students, families, staff and supporters";
 // PAGE 1: mascot-led, full-bleed school flyer with an apparel showcase.
 bar(0,0,612,792,white);
 bar(0,0,612,366,primary);
 bar(0,0,612,8,secondary);
 bar(0,78,612,5,secondary);
 if(d.backgroundArtwork){
  const kind=d.backgroundArtwork.startsWith("data:image/jpeg")?"JPEG":"PNG";
  pdf.addImage(d.backgroundArtwork,kind,0,83,612,283,undefined,"FAST");
  // Retain a solid brand panel behind the legibility-critical headline.
  bar(205,124,392,240,primary);
 }
 backdrop();
 if(d.businessLogo)image(pdf,d.businessLogo,27,16,79,54);
 write("SKILLED CRAFTING",118,34,18,contrastText,true);
 write("CUSTOM APPAREL  /  PRINTING  /  PERSONALIZATION",119,54,8,contrastText);
 write("YOUR LOCAL SPIRIT WEAR PARTNER",410,66,8,contrastText,true);
 // The school artwork is prominently displayed, never reduced to a document thumbnail.
 pdf.setFillColor(...mix(primary,secondary,.36));
 if(typeof pdf.ellipse==="function")pdf.ellipse(121,183,104,103,"F");
 if(d.heroArtwork)image(pdf,d.heroArtwork,27,98,188,170);
 wrap(d.organization||"Your School",223,151,353,26,accentShade,1.1,3,true);
 wrap(d.organization||"Your School",221,148,353,26,contrastText,1.1,3,true);
 bar(218,235,362,53,secondary);
 if(typeof pdf.triangle==="function"){
  pdf.setFillColor(...secondary);
  pdf.triangle(202,247,218,235,218,278,"F");
  pdf.triangle(580,235,600,247,580,276,"F");
  pdf.triangle(214,287,234,282,244,288,"F");
 }
 wrap(title,231,267,335,17,dark(secondary)?white:ink,1.13,2,"display");
 wrap(subtitle,223,316,344,11,contrastText,1.35,3);
 write("A COLLECTION MADE FOR YOUR SCHOOL",32,389,15,primary,true);
 // Use prominent genuine product mockups, placed on a clean stage.
 featured.forEach((product,i)=>{
  const count=featured.length;
  const width=count===1?260:count===2?254:174;
  const gap=count===1?0:count===2?25:15;
  const x=count===1?176:count===2?37+i*(width+gap):30+i*(width+gap);
  pdf.setFillColor(245,247,250);
  pdf.roundedRect(x,407,width,222,12,12,"F");
  image(pdf,product.mockup,x+9,415,width-18,153);
  wrap(product.name,x+12,589,width-24,11,ink,1.14,2,true);
  const tier=programPriceRows(product)[0];
  write("RETAIL  "+money(tier.retail),x+12,614,10,primary,true);
 });
 // Three strong value pillars reflect the original school's promotional flyer.
 const highlights=[
  ["SCHOOL PRIDE","Coordinated apparel for students, families and staff"],
  ["PROGRAM SUPPORT","Agreed retail pricing creates a potential program return"],
  ["EASY ORDERING","A streamlined storefront and fulfillment plan"]
 ];
 highlights.forEach((item,i)=>{
  const x=29+i*193;
  bar(x,649,179,7,i===1?secondary:primary);
  if(typeof pdf.circle==="function"){
   pdf.setFillColor(...secondary);pdf.circle(x+14,673,12,"F");
   write(String(i+1),x+10,677,11,dark(secondary)?white:ink,true);
  }
  wrap(item[0],x+32,677,146,10,primary,1.1,2,true);
  wrap(item[1],x+4,696,167,9,ink,1.2,3);
 });
 bar(0,742,612,50,primary);
 write("LET'S BRING SCHOOL SPIRIT TO LIFE",30,766,12,contrastText,true);
 write("skilledcrafting.com",406,766,10,contrastText,true);
 write("1 / 2",557,782,8,contrastText);
 // PAGE 2: program explanation, editable commercial information, and call to action.
 pdf.addPage();
 bar(0,0,612,108,primary);bar(0,105,612,5,secondary);
 if(d.schoolLogo)image(pdf,d.schoolLogo,35,14,80,76);
 write(d.organization||"School spirit wear",132,44,21,contrastText,true);
 write("PROGRAM OPTIONS & PRICING",132,70,12,contrastText,true);
 write("A straightforward way to support your school community",34,145,16,primary,true);
 wrap(d.programDescription?.trim()||"Choose approved apparel and artwork, agree on decorated wholesale prices, and offer a coordinated collection to your school community.",34,169,542,10,ink,1.4,4);
 bar(34,209,544,28,secondary);
 write("ARTWORK MODERNIZATION  /  SEASONAL & YEAR-ROUND DESIGNS",45,227,10,dark(secondary)?white:ink,true);
 const steps=[
  ["01", "DESIGN", "Confirm the school logo, garment choices, colors and artwork placements."],
  ["02", "APPROVE", "Review decoration, wholesale and retail pricing, and ordering terms."],
  ["03", "LAUNCH", "Share the approved collection and ordering instructions with supporters."]
 ];
 steps.forEach((step,i)=>{
  const x=34+i*184;
  pdf.setFillColor(242,245,249);pdf.roundedRect(x,243,173,123,8,8,"F");
  write(step[0],x+12,267,15,primary,true);
  write(step[1],x+48,267,11,primary,true);
  wrap(step[2],x+12,291,149,9,ink,1.35,5);
 });
 write("SCHOOL COLLECTION",34,405,15,primary,true);
 const priceRows=featured.map(product=>({product,price:programPriceRows(product)[0]}));
 priceRows.forEach(({product,price},i)=>{
  const y=430+i*61;
  pdf.setFillColor(i%2?250:241,i%2?250:245,i%2?250:249);pdf.rect(34,y,544,56,"F");
  image(pdf,product.mockup,40,y+4,49,47);
  write(product.name,101,y+19,10,ink,true);
  write("Retail "+money(price.retail),101,y+38,9,primary,true);
  write("School retains "+money(price.school)+" per item*",365,y+30,9,ink,true);
 });
 const afterRows=430+priceRows.length*61;
 write("LET'S CREATE YOUR COLLECTION",34,Math.max(645,afterRows+34),16,primary,true);
 wrap([d.contact.phone,d.contact.email,d.contact.website].filter(Boolean).join("  |  "),34,Math.max(667,afterRows+56),540,10,ink,1.4,2);
 pdf.setDrawColor(209,217,225);pdf.line(34,724,578,724);
 wrap("*Illustrative difference between agreed decorated wholesale and approved retail price. Actual proceeds, taxes, fees, refunds, shipping and payout terms require written agreement.",34,740,541,8,muted,1.25,4);
 write("2 / 2",551,780,9,muted);
 return pdf;
}
export function exportSchoolProgramPdf(d){
 buildSchoolProgramPdf(d).save("skilled-crafting-school-spirit-wear.pdf");
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
