import {deriveDistributionFields,distributionLabelRows,distributeOrderLines} from './distributionMetadata.js';
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
function layoutHeader(doc,source,job,kind,prefs,origin,logoData=''){
 const customer=kind!=='shop';
 doc.setFillColor(customer?19:26,customer?49:55,customer?64:69);
 doc.rect(0,0,612,customer?113:94,'F');
 if(customer){
  if(logoData){
   try{
    const type=logoData.startsWith('data:image/jpeg')?'JPEG':'PNG';
    const info=doc.getImageProperties(logoData),scale=Math.min(76/info.width,62/info.height);
    doc.setFillColor(255);doc.roundedRect(35,18,89,77,8,8,'F');
    doc.addImage(logoData,type,79.5-info.width*scale/2,56-info.height*scale/2,info.width*scale,info.height*scale,undefined,'FAST');
   }catch{/* Keep the business wordmark visible if the asset is unavailable. */}
  }
  const headingX=logoData?136:39;
  text(doc,prefs.businessName||'Skilled Crafting',headingX,43,420,23,{bold:true,color:[255,255,255]});
  text(doc,'CUSTOMER INVOICE',headingX,66,360,11,{bold:true,color:[163,222,212]});
  text(doc,'ORDER #'+source.reference,headingX,89,370,11,{color:[255,255,255]});
  doc.setFillColor(55,179,150);doc.rect(0,109,612,4,'F');
 }else{
  text(doc,'SKILLED CRAFTING',39,38,420,prefs.invoiceHeading,{bold:true,color:[255,255,255]});
  text(doc,'SHOP COPY / INTERNAL - NOT FOR CUSTOMER',39,59,420,11,{bold:true,color:[255,255,255]});
  text(doc,'Order / invoice '+source.reference,39,78,410,10,{color:[255,255,255]});
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
function appendInvoicePages(doc,{source,job,travelers=[],prefs={},kind='customer',origin='',logoData=''}){
  const config=normalizePrintPrefs(prefs);
  if(kind==='customer'&&!canPrintCustomerCopy(source))throw Error('Customer invoice blocked until the source invoice totals are verified.');
  layoutHeader(doc,source,job,kind,config,origin,logoData);
  let page=1;
  footer(doc,source,kind,page);
  const visible=new Set(kind==='shop'?config.shopInvoiceFields:config.customerInvoiceFields);
  let y=kind==='customer'?137:122;
  if(kind==='customer'){
   const contacts=[["businessAddress",config.businessAddress],["businessPhone",config.businessPhone],["businessWebsite",config.businessWebsite]].filter(([key,value])=>visible.has(key)&&value).map(([,value])=>value);
   if(contacts.length){
    doc.setFillColor(246,249,250);doc.roundedRect(38,y,536,Math.max(34,contacts.length*13+16),7,7,'F');
    let cy=y+17;
    for(const contact of contacts){cy=text(doc,contact,51,cy,509,9,{color:[58,78,84]})+1;}
    y+=Math.max(34,contacts.length*13+16)+17;
   }
   if(visible.has('orderStatus')){doc.setFillColor(231,244,241);doc.roundedRect(38,y-6,536,33,7,7,'F');
   text(doc,source.paid?'PAYMENT RECORDED':'PAYMENT STATUS: '+source.status.toUpperCase(),49,y+14,365,10,{bold:true,color:[17,88,75]});y+=48;}
  }else{
   for(const [key,value] of [['businessAddress',config.businessAddress],['businessPhone',config.businessPhone],['businessWebsite',config.businessWebsite]]){
    if(visible.has(key)&&value)y=text(doc,value,39,y,520,9)+4;
   }
  }
  y=text(doc,(kind==='customer'?'BILL TO: ':'CUSTOMER: ')+source.customerName,39,y,420,12,{bold:true})+4;
  if(visible.has('invoiceDate')&&source.date)y=text(doc,'INVOICE DATE: '+String(source.date).slice(0,10),39,y,520,9)+4;
  if(visible.has('paymentMethod')&&source.paymentMethod)y=text(doc,'PAYMENT METHOD: '+source.paymentMethod,39,y,520,9)+4;
  if(visible.has('billingAddress')&&source.billingAddress)y=text(doc,'BILLING ADDRESS: '+source.billingAddress,39,y,520,9)+4;
  if(visible.has('customerPhone')&&source.customerPhone)y=text(doc,'PHONE: '+source.customerPhone,39,y,420,9)+3;
  if(visible.has('shippingAddress')&&source.shipName)y=text(doc,'DELIVER TO: '+source.shipName,39,y,465,10)+2;
  if(visible.has('shippingAddress')&&source.shipAddress)y=text(doc,source.shipAddress,39,y,465,9)+4;
  if(visible.has('orderStatus'))y=text(doc,'ORDER SOURCE: '+(source.source==='woocommerce'?'WooCommerce':'QuickBooks / Manual')+
    '     STATUS: '+source.status+(source.paid?' / Payment recorded':' / Payment not confirmed'),39,y+3,535,9)+13;
  if(kind==='shop'&&visible.has('productionInfo')){
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
    const metadata=(config.showPersonalization&&visible.has('personalization')?line.metadata:[]).map(v=>v.label+': '+v.value);
    const approx=(kind==='customer'?58:30)+Math.min(8,metadata.length)*12;
    if(y+approx>685){y=pageForRows(doc,source,kind,++page);header();}
    const firstY=y;
    const hasThumbnail=kind==='customer'&&Boolean(line.thumbnailData);
    if(hasThumbnail){
     try{
      const format=line.thumbnailData.startsWith('data:image/jpeg')?'JPEG':'PNG';
      const info=doc.getImageProperties(line.thumbnailData);
      const scale=Math.min(46/info.width,46/info.height);
      doc.setFillColor(248,250,250);doc.roundedRect(44,y-9,52,52,6,6,'F');
      doc.addImage(line.thumbnailData,format,70-info.width*scale/2,y+17-info.height*scale/2,info.width*scale,info.height*scale,undefined,'FAST');
     }catch{/* Do not substitute an incorrect product picture. */}
    }
    const itemX=hasThumbnail?107:45;
    y=text(doc,line.name||'Order item',itemX,y,hasThumbnail?261:329,config.invoiceFont,{bold:true});
    if(config.showSku&&visible.has('sku')&&line.sku)y=text(doc,'SKU '+line.sku,itemX,y+2,hasThumbnail?262:328,8)+1;
    for(const meta of metadata.slice(0,8)){
      if(y>685){y=pageForRows(doc,source,kind,++page);header();}
      y=text(doc,meta,hasThumbnail?110:50,y+1,hasThumbnail?253:310,8);
    }
    text(doc,String(line.quantity),400,firstY,50,config.invoiceFont,{bold:true});
    text(doc,moneyOrBlank(line.total,source.currency),470,firstY,97,config.invoiceFont,{bold:true});
    if(hasThumbnail)y=Math.max(y,firstY+49);
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
  if(kind==='shop'&&visible.has('productionInfo')){
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
  }else if(visible.has('orderNotes')&&source.customerNote){
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
 const design=normalizeLabelDesign(labelDesign);
 const groups=distributeOrderLines(source);
 const pages=groups.flatMap((group,g)=>Array.from({length:Math.max(1,Math.ceil(group.lines.length/2))},(_,part)=>({group,groupNumber:g+1,part,partCount:Math.max(1,Math.ceil(group.lines.length/2))})));
 for(let copy=0;copy<cfg.packageCount;copy++)for(let i=0;i<pages.length;i++){
  const {group,groupNumber,part,partCount}=pages[i];
  const info=deriveDistributionFields(group,labelFields);
  const determined=distributionLabelRows(group,labelFields,design);
  const fields=determined.rows.slice(0,7).map(row=>[row.label,row.value]);
  if(i||copy)doc.addPage([288,432]);
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
  if(cfg.businessWebsite)text(doc,cfg.businessWebsite,logoData&&design.showLogo?84:16,64,187,8,{color:[195,231,225]});
  doc.setFillColor(233,238,240);doc.rect(0,76,288,23,'F');
  text(doc,'DISTRIBUTION / PACKING',12,91,183,9,{bold:true});
  text(doc,'SET '+groupNumber+'/'+groups.length+' · '+(part+1)+'/'+partCount,190,91,94,8,{bold:true});
  let y=116;
  y=cropLine(doc,group.shipName||group.customerName||'Recipient not specified',13,y,261,cfg.labelFont+2,true)+3;
  if(info.school&&design.visible.includes('school')&&!design.order.some(key=>key==='school'))y=cropLine(doc,info.school,13,y,262,9);
  if(cfg.labelShowOrder)y=cropLine(doc,'ORDER '+group.reference+'  |  JOB '+job.id,13,y+1,261,9,true)+3;
  doc.setDrawColor(185,196,200);doc.line(13,y,275,y);y+=15;
  // Show actual supplied Woo item data, not empty placeholders from a saved template.
  // A 4x6 label has seven detail rows; never silently claim a blank value was supplied.
  const rows=fields;
  let renderedCount=0;
  for(const [label,value] of rows){
   if(y>278)break;
   text(doc,label,13,y,103,7,{bold:true,color:[70,78,83]});
   cropLine(doc,value,111,y+1,163,label==='STUDENT / PLAYER'?design.fontSize+1:design.fontSize,true);
   y+=23;renderedCount++;
  }
  if(!fields.length){
   y=cropLine(doc,'No recipient details in order. Verify before packing.',13,y+7,262,9)+8;
  }
  if(determined.totalAvailable>renderedCount){
   cropLine(doc,'+'+(determined.totalAvailable-renderedCount)+' MORE ORDER FIELDS - SEE INVOICE',13,Math.min(301,y+2),260,7,true);
  }
  const itemStart=Math.max(294,Math.min(316,y+5));
  doc.setFillColor(245,247,248);doc.roundedRect(10,itemStart,268,82,4,4,'F');
  text(doc,cfg.labelShowItems?'PACKAGE CONTENTS / VERIFICATION':'FULFILLMENT CHECK',18,itemStart+15,249,8,{bold:true});
  let lineY=itemStart+31;
  if(cfg.labelShowItems){
   for(const line of (group.lines||[]).slice(part*2,part*2+2)){
    cropLine(doc,String(line.quantity)+' x '+line.name,18,lineY,cfg.labelShowQR?182:252,9);
    lineY+=16;
   }
   if(cfg.packageCount>1)cropLine(doc,'PACKAGE ALLOCATION NOT VERIFIED',18,lineY,cfg.labelShowQR?180:252,7,true);
  }else{
   cropLine(doc,'Verify package contents against order.',18,lineY,cfg.labelShowQR?180:252,8);
  }
  if(cfg.labelShowQR){
   qrCode(doc,origin+'/work-hub?job='+encodeURIComponent(job.id),218,itemStart+26,52);
   text(doc,'STAFF QR',222,itemStart+79,49,6,{bold:true});
  }
  doc.setDrawColor(30,46,52);doc.line(11,406,cfg.labelShowQR?210:277,406);
  text(doc,(cfg.labelQuestions?'QUESTIONS: '+cfg.labelQuestions:'INTERNAL DISTRIBUTION LABEL - NOT POSTAGE'),12,421,cfg.labelShowQR?200:265,7,{bold:true});
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
    }else if(snap.artwork_asset_id)throw Error('Approved artwork preview missing; printing blocked to avoid incomplete traveler.');
    const groupLines=traveler.lines||[];
    if(groupLines.length){
      if(y>640){doc.addPage('letter');y=48;}
      y=text(doc,'GROUPED ORDER LINES — '+groupLines.length+' DISTINCT LINE(S)',38,y,530,10,{bold:true})+7;
      for(const line of groupLines){
        if(y>686){doc.addPage('letter');y=48;}
        const item=line.item_snapshot||{};
        y=text(doc,'Line #'+line.job_item_id+' | Quantity '+line.quantity+' | '+(item.ordered_product_name||item.item_name||item.name||'Ordered garment'),42,y,514,9,{bold:true})+2;
        const attrs=[item.color||item.selected_color,item.size||item.selected_size,item.order_sku||item.sku].filter(Boolean).join(' / ');
        if(attrs)y=text(doc,attrs,42,y,510,8)+4;
      }
    }
    const placementArts=[...new Set([...(snap.placements||[]).map(p=>p.artwork_asset_id),...groupLines.flatMap(l=>(l.item_snapshot?.approved_placement_artwork||[]).map(a=>a.artwork_asset_id))].filter(Boolean).map(String))];
    for(const id of placementArts.filter(id=>id!==String(snap.artwork_asset_id||''))){
      if(y>560){doc.addPage('letter');y=48;}
      const pic=artworkImages[id];
      if(!pic)throw Error('Required placement artwork image missing from printable traveler: '+id);
      try{
        doc.addImage(pic,pic.startsWith('data:image/jpeg')?'JPEG':'PNG',38,y,110,95,undefined,'FAST');
        text(doc,'Approved placement artwork '+id,158,y+18,390,9);y+=108;
      }catch{throw Error('Could not embed required placement artwork image '+id);}
    }
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
