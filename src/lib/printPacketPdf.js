import {normalizeLabelDesign} from './labelDesigner.js';
import {jsPDF} from 'jspdf';
import {qrcodegen} from '../vendor/qrcodegen';
import {money,normalizePrintPrefs,canPrintCustomerCopy} from './printModel';

const plain=v=>Array.from(String(v??'')).map(c=>{const n=c.codePointAt(0);return n<32||n===127?' ':n>255?'-':c;}).join('').trim();
function text(doc,value,x,y,maxWidth,size=10,{bold=false,color=[35,48,59]}={}){
  doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);
  const lines=doc.splitTextToSize(plain(value)||' ',maxWidth);
  const lineHeight=size*1.35;
  doc.text(lines,x,y);return y+lines.length*lineHeight;
}
function qrCode(doc,url,x,y,size){
  if(!/^https:\/\//.test(url))return;
  try{
    const qr=qrcodegen.QrCode.encodeText(url,qrcodegen.QrCode.Ecc.MEDIUM);
    const unit=size/(qr.size+8);doc.setFillColor(255);doc.rect(x,y,size,size,'F');doc.setFillColor(0);
    for(let row=0;row<qr.size;row++)for(let col=0;col<qr.size;col++)
      if(qr.getModule(col,row))doc.rect(x+(col+4)*unit,y+(row+4)*unit,unit+.04,unit+.04,'F');
  }catch{/* Human-readable document reference remains visible. */}
}
const moneyOrBlank=(v,c)=>money(v,c);
function layoutHeader(doc,source,job,kind,prefs,origin){
  doc.setFillColor(kind==='shop'?26:29,kind==='shop'?55:67,kind==='shop'?69:76);
  doc.rect(0,0,612,94,'F');
  text(doc,'SKILLED CRAFTING',39,38,420,prefs.invoiceHeading,{bold:true,color:[255,255,255]});
  text(doc,kind==='shop'?'SHOP COPY / INTERNAL - NOT FOR CUSTOMER':'CUSTOMER INVOICE COPY',39,59,420,11,{bold:true,color:[255,255,255]});
  text(doc,'Order / invoice '+source.reference,39,78,410,10,{color:[255,255,255]});
  if(kind==='shop'){
    const url=origin+'/work-hub?job='+encodeURIComponent(job.id);
    qrCode(doc,url,490,9,83);
  }
}
function footer(doc,source,kind,number){
  doc.setDrawColor(213,222,228);doc.line(39,752,573,752);
  text(doc,(kind==='shop'?'INTERNAL SHOP COPY - STAFF LOGIN REQUIRED':'Customer invoice copy')+' | '+source.source+' '+source.reference,39,767,470,8);
  text(doc,'Page '+number,517,767,65,8);
}
function pageForRows(doc,source,kind,page){
  doc.addPage('letter');footer(doc,source,kind,page);
  text(doc,'Order '+source.reference+' - '+(kind==='shop'?'SHOP COPY':'INVOICE CONTINUED'),39,49,520,12,{bold:true});
  return 78;
}
function appendInvoicePages(doc,{source,job,travelers=[],prefs={},kind='customer',origin=''}){
  const config=normalizePrintPrefs(prefs);
  if(kind==='customer'&&!canPrintCustomerCopy(source))throw Error('Customer invoice blocked until the source invoice totals are verified.');
  layoutHeader(doc,source,job,kind,config,origin);
  let page=1;
  footer(doc,source,kind,page);
  let y=122;
  y=text(doc,'CUSTOMER: '+source.customerName,39,y,420,12,{bold:true})+4;
  if(config.showCustomerPhone&&source.customerPhone)y=text(doc,'PHONE: '+source.customerPhone,39,y,420,9)+3;
  if(source.shipName)y=text(doc,'DELIVER TO: '+source.shipName,39,y,465,10)+2;
  if(source.shipAddress)y=text(doc,source.shipAddress,39,y,465,9)+4;
  y=text(doc,'ORDER SOURCE: '+(source.source==='woocommerce'?'WooCommerce':'QuickBooks / Manual')+
    '     STATUS: '+source.status+(source.paid?' / Payment recorded':' / Payment not confirmed'),39,y+3,535,9)+13;
  if(kind==='shop'){
    y=text(doc,'STAFF QR: scan top-right QR to view this job in Work Hub.',39,y,520,9,{bold:true})+4;
    y=text(doc,'Job #'+job.id+' | Due: '+(job.due_date||'Not specified')+' | Travelers: '+travelers.length,39,y,520,9)+10;
  }
  if(!source.financialVerified){
    y=text(doc,'DRAFT - VERIFY QUICKBOOKS INVOICE NUMBER, TAX, TOTAL AND PAYMENT BEFORE CUSTOMER HANDOFF',39,y,534,10,{bold:true,color:[160,36,36]})+8;
  }
  function header(){
    doc.setFillColor(235,242,244);doc.rect(38,y,536,25,'F');
    text(doc,'ITEM / DETAILS',44,y+16,308,9,{bold:true});
    text(doc,'QTY',396,y+16,35,9,{bold:true});
    text(doc,'AMOUNT',476,y+16,90,9,{bold:true});
    y+=34;
  }
  header();
  for(const line of source.lines){
    const metadata=(config.showPersonalization?line.metadata:[]).map(v=>v.label+': '+v.value);
    const approx=30+Math.min(5,metadata.length)*18;
    if(y+approx>685){y=pageForRows(doc,source,kind,++page);header();}
    const firstY=y;
    y=text(doc,line.name||'Order item',45,y,329,config.invoiceFont,{bold:true});
    if(config.showSku&&line.sku)y=text(doc,'SKU '+line.sku,45,y+2,328,8)+1;
    for(const meta of metadata.slice(0,8)){
      if(y>685){y=pageForRows(doc,source,kind,++page);header();}
      y=text(doc,meta,50,y+1,310,8);
    }
    text(doc,String(line.quantity),400,firstY,50,config.invoiceFont,{bold:true});
    text(doc,moneyOrBlank(line.total,source.currency),470,firstY,97,config.invoiceFont,{bold:true});
    y+=8;doc.setDrawColor(226,231,235);doc.line(44,y,566,y);y+=13;
  }
  if(y>622){y=pageForRows(doc,source,kind,++page);}
  const totals=[['Subtotal',source.subtotal],['Discount',source.discount],['Shipping',source.shipping],['Sales tax',source.tax],['TOTAL',source.total]];
  for(const [label,value] of totals){
    const isTotal=label==='TOTAL';
    text(doc,label,347,y,110,isTotal?11:9,{bold:isTotal});
    text(doc,moneyOrBlank(value,source.currency),470,y,97,isTotal?12:9,{bold:isTotal});
    y+=isTotal?24:17;
  }
  if(source.source==='quickbooks_manual'){
    if(y>650){y=pageForRows(doc,source,kind,++page);}
    for(const [label,value] of [['Payment recorded',source.amountPaid],['BALANCE DUE',source.balance]]){
      text(doc,label,347,y,115,9,{bold:true});
      text(doc,moneyOrBlank(value,source.currency),470,y,97,10,{bold:true});y+=19;
    }
  }
  if(kind==='shop'){
    if(y>693){y=pageForRows(doc,source,kind,++page);}
    text(doc,'PRODUCTION REFERENCE - use item-specific approved QR traveler for actual machine settings.',39,y+3,520,9,{bold:true});y+=18;
    for(const traveler of travelers.slice(0,8)){
      const snap=traveler.recipe_snapshot||{};
      if(y>690){y=pageForRows(doc,source,kind,++page);}
      const line='Item #'+traveler.job_item_id+' / '+(snap.recipe_name||'Production traveler')+' / rev '+(snap.revision||'?')+
        ' / Artwork '+(snap.artwork_asset_id||'NOT LINKED');
      y=text(doc,line,43,y,515,8)+2;
    }
    if(travelers.length>8)y=text(doc,'+'+(travelers.length-8)+' more travelers available in Work Hub',43,y,515,8);
  }else if(source.customerNote){
    if(y>690){y=pageForRows(doc,source,kind,++page);}
    text(doc,'Customer order note: '+source.customerNote,39,y+5,510,8);
  }
  return doc;
}
export function createInvoicePdf(args){
  return appendInvoicePages(new jsPDF({unit:'pt',format:'letter',compress:true}),args);
}
export function createInvoicePairPdf(args){
  if(!canPrintCustomerCopy(args.source))throw Error('Cannot print a customer invoice until financial source totals are verified.');
  const doc=new jsPDF({unit:'pt',format:'letter',compress:true});
  appendInvoicePages(doc,{...args,kind:'customer'});
  doc.addPage('letter');
  appendInvoicePages(doc,{...args,kind:'shop'});
  return doc;
}

const distributionAliases={
 student:'student name|student|child name|recipient name|player name|athlete name',
 teacher:'teacher name|teacher|homeroom teacher|homeroom',
 coach:'coach name|coach|head coach',
 playerNumber:'player number|jersey number|jersey #|number',
 grade:'grade|grade level|year',
 team:'team assignment|team name|team|class|classroom',
 appliedName:'name applied|name on back|personalized name|custom name|player name on back|name text',
 school:'school|school name',
};
const cleanLabel=v=>plain(v).slice(0,120);
export function deriveDistributionFields(source,overrides={}){
 const found={};
 for(const [field,aliases] of Object.entries(distributionAliases)){
  const keys=aliases.split('|');
  const values=new Set();
  for(const line of source?.lines||[])for(const meta of line.metadata||[]){
   if(keys.includes(String(meta.label||'').trim().toLowerCase()))values.add(cleanLabel(meta.value));
  }
  const unique=[...values].filter(Boolean);
  found[field]=cleanLabel(overrides[field]|| (unique.length===1?unique[0]:unique.length>1?'MULTIPLE - SEE PACKING LIST':''));
 }
 return found;
}
function cropLine(doc,value,x,y,width,size=10,bold=false){
 const raw=plain(value);
 if(!raw)return y;
 doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);
 let visible=raw;
 while(visible.length>1&&doc.getTextWidth(visible)>width)visible=visible.slice(0,-2);
 if(visible!==raw)visible=visible.trimEnd()+'...';
 doc.text(visible,x,y);return y+size+6;
}
export function createDistributionLabelsPdf({source,job,prefs={},origin='',packageCount,labelFields={},logoData='',labelDesign={}}) {
 const cfg=normalizePrintPrefs({...prefs,packageCount:packageCount??prefs.packageCount});
 const doc=new jsPDF({unit:'pt',format:[288,432],compress:true});
 const info=deriveDistributionFields(source,labelFields);
 const design=normalizeLabelDesign(labelDesign);
 const fields=design.order.filter(key=>design.visible.includes(key)).map(key=>[design.labels[key].toUpperCase(),info[key]]);
 for(let i=0;i<cfg.packageCount;i++){
  if(i)doc.addPage([288,432]);
  doc.setFillColor(255);doc.rect(0,0,288,432,'F');
  doc.setFillColor(21,34,42);doc.rect(0,0,288,76,'F');
  if(logoData&&design.showLogo){
   try{
    const format=logoData.startsWith('data:image/jpeg')?'JPEG':'PNG';
    const props=doc.getImageProperties(logoData);
    const scale=Math.min(design.logoSize/props.width,design.logoSize/props.height);
    doc.setFillColor(255);doc.roundedRect(10,9,65,56,5,5,'F');
    doc.addImage(logoData,format,42.5-props.width*scale/2,37-props.height*scale/2,props.width*scale,props.height*scale,undefined,'FAST');
   }catch{/* Wordmark remains as branding if the image cannot be rendered. */}
  }
  text(doc,'SKILLED',logoData&&design.showLogo?84:16,31,192,20,{bold:true,color:[255,255,255]});
  text(doc,'CRAFTING',logoData&&design.showLogo?84:16,49,192,20,{bold:true,color:[255,255,255]});
  doc.setFillColor(233,238,240);doc.rect(0,76,288,23,'F');
  text(doc,'DISTRIBUTION / PACKING',12,91,183,9,{bold:true});
  text(doc,'BAG '+(i+1)+' / '+cfg.packageCount,204,91,75,10,{bold:true});
  let y=116;
  y=cropLine(doc,source.shipName||source.customerName||'Recipient not specified',13,y,261,cfg.labelFont+2,true)+3;
  if(info.school&&design.visible.includes('school')&&!design.order.some(key=>key==='school'))y=cropLine(doc,info.school,13,y,262,9);
  if(cfg.labelShowOrder)y=cropLine(doc,'ORDER '+source.reference+'  |  JOB '+job.id,13,y+1,261,9,true)+3;
  doc.setDrawColor(185,196,200);doc.line(13,y,275,y);y+=15;
  // A template controls field visibility; missing order metadata must not hide the field.
  const rows=fields.slice(0,7);
  for(const [label,value] of rows){
   if(y>291)break;
   text(doc,label,13,y,103,7,{bold:true,color:[70,78,83]});
   cropLine(doc,value||'NOT PROVIDED',111,y+1,163,label==='STUDENT / PLAYER'?design.fontSize+1:design.fontSize,true);
   y+=23;
  }
  if(!fields.length){
   y=cropLine(doc,'Recipient details: verify with packing record',13,y+7,262,9)+8;
  }
  const itemStart=Math.max(294,Math.min(316,y+5));
  doc.setFillColor(245,247,248);doc.roundedRect(10,itemStart,268,82,4,4,'F');
  text(doc,cfg.labelShowItems?'PACKAGE CONTENTS / VERIFICATION':'FULFILLMENT CHECK',18,itemStart+15,249,8,{bold:true});
  let lineY=itemStart+31;
  if(cfg.labelShowItems&&cfg.packageCount===1){
   for(const line of (source.lines||[]).slice(0,2)){
    cropLine(doc,String(line.quantity)+' x '+line.name,18,lineY,cfg.labelShowQR?182:252,9);
    lineY+=16;
   }
   if((source.lines||[]).length>2)cropLine(doc,'+ '+(source.lines.length-2)+' more; see packing list',18,lineY,cfg.labelShowQR?180:252,8);
  }else{
   cropLine(doc,cfg.packageCount>1?'Contents not allocated. Verify bag.':'Verify against order before handoff.',18,lineY,cfg.labelShowQR?180:252,8);
  }
  if(cfg.labelShowQR){
   qrCode(doc,origin+'/work-hub?job='+encodeURIComponent(job.id),218,itemStart+26,52);
   text(doc,'STAFF QR',222,itemStart+79,49,6,{bold:true});
  }
  doc.setDrawColor(30,46,52);doc.line(11,406,cfg.labelShowQR?210:277,406);
  text(doc,'INTERNAL DISTRIBUTION LABEL - NOT POSTAGE',12,421,cfg.labelShowQR?200:265,7,{bold:true});
 }
 return doc;
}
function sizeDetail(doc,snap,y){
  for(const p of Array.isArray(snap.placements)?snap.placements:[]){
    if(y>680)break;
    doc.setDrawColor(90,105,120);doc.rect(43,y,120,89);
    // Placement guide is illustrative, NOT a scale drawing.
    doc.line(103,y+8,103,y+81);doc.line(50,y+34,155,y+34);
    const points=[('Position: '+(p.placement_name||'unknown')),
      ('Size: '+(p.print_width_inches??'?')+' x '+(p.print_height_inches??'?')+' in'),
      ('Top offset: '+(p.top_offset_inches??'?')+' in from '+(p.reference_landmark||'unverified')),
      ('Horizontal: '+(p.center_offset_inches??'?')+' in')];
    let lineY=y+13;for(const line of points)lineY=text(doc,line,175,lineY,378,9)+5;
    y=Math.max(y+102,lineY);
  }
  return y;
}
export function createProductionPacketPdf({source,job,travelers=[],origin='',artworkImages={}}){
  if(!travelers.length)throw Error('No approved traveler available; create an approved manufacturing recipe traveler first.');
  const doc=new jsPDF({unit:'pt',format:'letter',compress:true});
  travelers.forEach((traveler,index)=>{
    if(index)doc.addPage('letter');
    const snap=traveler.recipe_snapshot||{};
    doc.setFillColor(25,58,68);doc.rect(0,0,612,86,'F');
    text(doc,'SKILLED CRAFTING / PRODUCTION PACKET',38,38,530,16,{bold:true,color:[255,255,255]});
    text(doc,'Job '+job.id+' | Item '+traveler.job_item_id+' | '+source.reference,39,65,510,10,{color:[255,255,255]});
    qrCode(doc,origin+'/production-travelers/'+encodeURIComponent(traveler.id),478,96,92);
    let y=114;
    y=text(doc,snap.recipe_name||'Approved manufacturing traveler',38,y,411,16,{bold:true})+8;
    y=text(doc,'Revision '+(snap.revision||'?')+' | Quantity '+(traveler.ordered_quantity||'?')+
      ' | Method '+(snap.decoration_method||'Unspecified'),38,y,430,10)+7;
    const blank=snap.blank||{};
    y=text(doc,'Garment/material: '+[blank.brand,blank.style,blank.color,blank.size].filter(Boolean).join(' / '),38,y,430,10)+7;
    y=text(doc,'Approved artwork ID: '+(snap.artwork_asset_id||'NOT LINKED'),38,y,435,9)+13;
    const artwork=artworkImages[String(snap.artwork_asset_id||'')];
    if(artwork){
      try{
        const fmt=artwork.startsWith('data:image/jpeg')?'JPEG':'PNG';
        doc.addImage(artwork,fmt,38,y,130,105,undefined,'FAST');
        text(doc,'Artwork preview - verify file revision',179,y+25,280,9);
        y+=114;
      }catch{y=text(doc,'Artwork preview could not be embedded - scan traveler to verify.',38,y,520,9)+14;}
    }else y=text(doc,'Artwork preview unavailable - scan QR to verify approved file.',38,y,515,9)+14;
    y=sizeDetail(doc,snap,y+4)+8;
    if(y>665){doc.addPage('letter');y=48;}
    y=text(doc,'MEASURED PLACEMENT GUIDE - NOT TO SCALE',38,y,530,9,{bold:true})+12;
    const setting=snap.machine_settings||{};
    y=text(doc,'Machine/material: '+[setting.machine_model,setting.material_name,setting.operation].filter(Boolean).join(' / '),38,y,535,9)+4;
    for(const [key,val] of Object.entries(setting.settings||{}).slice(0,12)){
      if(y>710){doc.addPage('letter');y=48;}
      y=text(doc,key+': '+(typeof val==='object'?JSON.stringify(val):String(val)),42,y,518,9)+2;
    }
    if(!Object.keys(setting.settings||{}).length)y=text(doc,'No approved machine settings linked: consult approved material specifications.',38,y,530,9)+5;
    for(const step of (snap.process_steps||[])){
      if(y>695){doc.addPage('letter');y=48;}
      y=text(doc,(step.label||'Step')+': '+(step.instruction||''),42,y,520,9)+5;
    }
    if(y>705){doc.addPage('letter');y=48;}
    text(doc,'Pack: '+(snap.packaging?.method||'Verify with order')+' | '+(snap.packaging?.labeling||''),38,y,520,9);
  });
  return doc;
}
