import {PDFDocument,StandardFonts,rgb} from "pdf-lib";
const hexColor=value=>{const m=/^#([0-9a-f]{6})$/i.exec(value||"");const x=m?m[1]:"142b45";return rgb(parseInt(x.slice(0,2),16)/255,parseInt(x.slice(2,4),16)/255,parseInt(x.slice(4,6),16)/255)};
const imageBytes=url=>{const m=/^data:image\/(png|jpeg);base64,([a-z\d+/=]+)$/i.exec(url||"");if(!m)throw Error("A PNG or JPEG design image is required.");return {kind:m[1],bytes:Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0))}};
const ascii=s=>String(s||"").replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,"-").replace(/[^\x20-\x7e]/g," ");
function wrap(text,font,size,maxWidth){const words=ascii(text).split(/\s+/).filter(Boolean);const lines=[];let line="";for(const word of words){const next=line?line+" "+word:word;if(font.widthOfTextAtSize(next,size)>maxWidth&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;}
export async function buildStudioPdf({image,logo,headline,description,benefits=[],steps=[],cta,contact="",plan={},mode="hybrid"}){
 const doc=await PDFDocument.create();const page=doc.addPage([612,792]);
 const font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const accent=hexColor(plan.accent);
 const heroHeight=mode==="artwork"?430:plan.composition==="full-bleed"?350:plan.composition==="editorial"?235:275;
 const art=imageBytes(image);const embedded=art.kind==="png"?await doc.embedPng(art.bytes):await doc.embedJpg(art.bytes);
 const scale=Math.max(612/embedded.width,heroHeight/embedded.height);
 const w=embedded.width*scale,h=embedded.height*scale;
 page.drawImage(embedded,{x:(612-w)/2,y:792-heroHeight+(heroHeight-h)/2,width:w,height:h});
 page.drawRectangle({x:0,y:792-heroHeight,width:612,height:heroHeight,color:rgb(0.03,0.08,0.14),opacity:.38});
 let y=792-36;
 if(logo){try{const b=imageBytes(logo);const l=b.kind==="png"?await doc.embedPng(b.bytes):await doc.embedJpg(b.bytes);const sz=l.scaleToFit(100,72);page.drawRectangle({x:28,y:y-75,width:110,height:78,color:rgb(1,1,1),opacity:.95});page.drawImage(l,{x:33+(100-sz.width)/2,y:y-70+(65-sz.height)/2,width:sz.width,height:sz.height});}catch{}}
 page.drawText("SKILLED CRAFTING",{x:150,y:y-8,size:11,font:bold,color:rgb(1,1,1)});
 y-=120;
 const titleLines=wrap(headline,bold,27,540).slice(0,3);
 for(const line of titleLines){page.drawText(line,{x:30,y,size:27,font:bold,color:rgb(1,1,1)});y-=32;}
 for(const line of wrap(description,font,11,530).slice(0,3)){page.drawText(line,{x:32,y,size:11,font,color:rgb(1,1,1)});y-=15;}
 let cursor=792-heroHeight-26;
 const order=Array.isArray(plan.sections)?plan.sections:["hero","benefits","steps","cta"];
 const blocks={benefits,steps};
 for(const name of order){
  if(!blocks[name]?.length)continue;
  if(cursor<95)break;
  page.drawText(name==="benefits"?"PROGRAM BENEFITS":"HOW IT WORKS",{x:32,y:cursor,size:14,font:bold,color:accent});cursor-=20;
  const maxRows=Math.min(4,blocks[name].length);
  for(let i=0;i<maxRows;i++){
   const x=32+(i%2)*277;const row=Math.floor(i/2);
   const yy=cursor-row*49;
   const lines=wrap((name==="steps"?(i+1)+". ":"")+blocks[name][i],font,9,258).slice(0,3);
   for(let j=0;j<lines.length;j++)page.drawText(lines[j],{x,y:yy-j*11,size:9,font,color:rgb(.12,.18,.25)});
  }
  cursor-=Math.ceil(maxRows/2)*49+12;
 }
 const footerHeight=76;
 page.drawRectangle({x:0,y:0,width:612,height:footerHeight,color:accent});
 const ctaLines=wrap(cta,bold,15,548).slice(0,2);
 ctaLines.forEach((line,i)=>page.drawText(line,{x:30,y:55-i*17,size:15,font:bold,color:rgb(1,1,1)}));
 wrap(contact,font,9,548).slice(0,2).forEach((line,i)=>page.drawText(line,{x:30,y:21-i*10,size:9,font,color:rgb(1,1,1)}));
 return doc.save();
}
