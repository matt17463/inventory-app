import {jsPDF} from 'jspdf';
import {qrcodegen} from '../vendor/qrcodegen';
import {money,normalizePrintPrefs,canPrintCustomerCopy} from './printModel';

const plain=v=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/[^\x20-\x7E\u00A0-\u00FF]/g,'-').trim();
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
function layoutHeader(doc,source,job,kind,prefs,origin,travelers){
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
export function createInvoicePdf({source,job,travelers=[],prefs={},kind='customer',origin=''}){
  const config=normalizePrintPrefs(prefs);
  if(kind==='customer'&&!canPrintCustomerCopy(source))throw Error('Customer invoice blocked until the source invoice totals are verified.');
  const doc=new jsPDF({unit:'pt',format:'letter',compress:true});
  layoutHeader(doc,source,job,kind,config,origin,travelers);
  let page=1;
  footer(doc,source,kind,page);
  let y=122;
  y=text(doc,'CUSTOMER: '+source.customerName,39,y,420,12,{bold:true})+4;
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
export function createDistributionLabelsPdf({source,job,prefs={},origin='',packageCount}){
  const cfg=normalizePrintPrefs({...prefs,packageCount:packageCount??prefs.packageCount});
  const doc=new jsPDF({unit:'pt',format:[288,432],compress:true});
  for(let i=0;i<cfg.packageCount;i++){
    if(i)doc.addPage([288,432]);
    doc.setFillColor(0);doc.rect(0,0,288,68,'F');
    text(doc,'SKILLED CRAFTING',16,27,256,17,{bold:true,color:[255,255,255]});
    text(doc,'DISTRIBUTION / PACKING',16,48,255,10,{bold:true,color:[255,255,255]});
    let y=91;
    y=text(doc,source.shipName||source.customerName,18,y,250,cfg.labelFont+3,{bold:true})+7;
    if(cfg.labelShowOrder)y=text(doc,'Order '+source.reference+' / Job '+job.id,18,y,250,11,{bold:true})+5;
    if(source.shipAddress)y=text(doc,source.shipAddress,18,y,249,10)+8;
    y=text(doc,'PACKAGE '+(i+1)+' OF '+cfg.packageCount,18,y+4,250,16,{bold:true})+8;
    if(cfg.labelShowItems){
      for(const line of source.lines.slice(0,10)){
        if(y>335)break;
        const info=line.quantity+' x '+line.name;
        y=text(doc,info,18,y,248,9)+3;
      }
      if(source.lines.length>10)y=text(doc,'+'+(source.lines.length-10)+' more lines - see invoice in package',18,y+3,248,8);
    }
    if(cfg.labelShowQR){
      qrCode(doc,origin+'/work-hub?job='+encodeURIComponent(job.id),194,338,75);
      text(doc,'INTERNAL QR / STAFF LOGIN',18,415,250,8,{bold:true});
    }else{
      doc.setDrawColor(180);doc.line(18,401,270,401);
      text(doc,'INTERNAL PACKING LABEL - NOT POSTAGE',18,416,251,9,{bold:true});
    }
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
