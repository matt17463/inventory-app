import {jsPDF} from 'jspdf';
import {qrcodegen} from '../vendor/qrcodegen';
import {closeoutReadiness} from './jobCloseout';

const simple=s=>String(s??'').replace(/[^\x20-\x7E]/g,' ').trim();
function qr(doc,url,x,y,size){
 try{
  const q=qrcodegen.QrCode.encodeText(url,qrcodegen.QrCode.Ecc.MEDIUM);
  const quiet=4,module=size/(q.size+2*quiet);
  doc.setFillColor(255,255,255);doc.rect(x,y,size,size,'F');doc.setFillColor(8,22,31);
  for(let r=0;r<q.size;r++)for(let c=0;c<q.size;c++)if(q.getModule(c,r))
   doc.rect(x+(c+quiet)*module,y+(r+quiet)*module,module+0.04,module+0.04,'F');
 }catch{/* Always include a plain text job ID if QR encoding fails. */}
}
const txt=(pdf,value,x,y,width,size=10)=>{
 pdf.setFont('helvetica','normal');pdf.setFontSize(size);pdf.setTextColor(23,42,57);
 const lines=pdf.splitTextToSize(simple(value),width);pdf.text(lines.slice(0,5),x,y);
 return y+Math.min(5,lines.length)*size*1.25;
};
export function downloadJobManifest(e,origin=''){
 const job=e.job||{},state=closeoutReadiness(e);
 const pdf=new jsPDF({unit:'pt',format:'letter',compress:true});
 const id=Number(job.id),created=new Date().toLocaleString();
 let y=53;
 pdf.setFillColor(20,57,63);pdf.rect(0,0,612,94,'F');
 pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(17);
 pdf.text('SKILLED CRAFTING / PACKING MANIFEST',39,48);
 pdf.setFontSize(9);pdf.text('JOB '+id+'  |  '+(state.readyForRelease?'QC / PACKING VERIFIED':'DRAFT - NOT READY FOR RELEASE'),39,73);
 y=116;
 y=txt(pdf,'Customer: '+(job.customer_name||'Confirm customer'),40,y,520,12);
 y=txt(pdf,'Job: '+(job.job_name||id)+' | Order: '+(job.woo_order_number||job.source_invoice_number||job.woocommerce_order_id||id),40,y+7,520,10);
 y=txt(pdf,'Channel: '+(state.isWoo?'WooCommerce storefront':state.isManual?'QuickBooks-invoiced group':'Verify billing source'),40,y+6,520,10);
 y=txt(pdf,'Prepared '+created+' | QC: '+(state.qcPassed?'Passed':'Unverified')+' | Packing: '+(state.packingComplete?'Complete':'Incomplete'),40,y+7,520,10);
 y=txt(pdf,'Handoff: '+state.label,40,y+8,520,10)+12;
 if(state.blockers.length){
  pdf.setTextColor(164,33,33);pdf.setFont('helvetica','bold');pdf.setFontSize(9);
  pdf.text('STOP: '+state.blockers.length+' unresolved check(s). Not permission to release.',40,y);y+=16;
  for(const b of state.blockers.slice(0,5))y=txt(pdf,'- '+b,45,y,510,8)+2;
 }
 function header(){pdf.setFillColor(236,241,243);pdf.rect(38,y,536,25,'F');pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.setTextColor(24,48,56);pdf.text('ITEM / COLOR / SIZE',43,y+16);pdf.text('ORDERED',415,y+16);pdf.text('PACKED',501,y+16);y+=35;}
 y+=8;header();
 for(const item of state.itemRows){
  if(y>730){pdf.addPage();y=55;header();}
  const line=simple(item.label+'  '+item.color+'  '+item.size).slice(0,66);
  y=txt(pdf,line,43,y,360,9);
  pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.text(String(item.required),428,y-12);
  pdf.text(item.packed===null?'-':String(item.packed),511,y-12);
  if(item.note)y=txt(pdf,'PACK NOTE: '+item.note,50,y+2,480,8);
  pdf.setDrawColor(225,232,235);pdf.line(42,y+3,565,y+3);y+=14;
 }
 if(y>700){pdf.addPage();y=55;}
 y=txt(pdf,'Packing totals: '+state.itemRows.reduce((v,x)=>v+x.required,0)+' ordered / '+state.itemRows.reduce((v,x)=>v+(x.packed??0),0)+' verified',40,y+7,520,11);
 y=txt(pdf,'Check against the physical items. Manifest generation does not deduct inventory, buy postage or change job status.',40,y+12,520,9);
 if(origin && /^https:\/\//.test(origin)){qr(pdf,origin+'/work-hub?job='+id,474,634,92);txt(pdf,'Scan to review',465,740,105,8);}
 pdf.save('SC-Job-'+id+'-Packing-Manifest.pdf');
}
export function downloadPackageLabels(e,{count=1,origin='',method='pickup'}={}){
 const job=e.job||{},state=closeoutReadiness(e),number=Number(count);
 if(!Number.isSafeInteger(number)||number<1||number>100)
  throw Error('Choose 1–100 printed packages per batch.');
 const pdf=new jsPDF({unit:'pt',format:[288,432],compress:true});
 for(let i=0;i<number;i++){
  if(i>0)pdf.addPage([288,432]);
  pdf.setFillColor(17,57,65);pdf.rect(0,0,288,80,'F');
  pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(16);
  pdf.text('SKILLED CRAFTING',20,34);
  pdf.setFontSize(10);pdf.text(method==='ship'?'SHIPMENT LABEL / INTERNAL':'CUSTOMER PICKUP / INTERNAL',20,53);
  let y=110;
  y=txt(pdf,'Customer: '+(job.customer_name||'Confirm customer'),20,y,248,12);
  y=txt(pdf,'Job #'+job.id+' / '+(job.woo_order_number||job.source_invoice_number||'Production order'),20,y+6,248,10);
  y=txt(pdf,'Package '+(i+1)+' of '+number,20,y+13,240,17);
  y=txt(pdf,'Packed: '+state.itemRows.reduce((sum,x)=>sum+(x.packed||0),0)+' units',20,y+10,230,10);
  y=txt(pdf,'Status: '+state.label,20,y+9,248,9);
  if(!state.readyForRelease){pdf.setTextColor(178,31,31);pdf.setFont('helvetica','bold');pdf.setFontSize(15);pdf.text('NOT READY / HOLD',20,y+27);}
  const url=/^https:\/\//.test(origin)?origin+'/work-hub?job='+Number(job.id):'';
  if(url)qr(pdf,url,90,260,111);
  txt(pdf,'Internal production QR - requires staff login',20,392,248,7);
  txt(pdf,'NOT A CARRIER POSTAGE LABEL',20,408,248,8);
 }
 pdf.save('SC-Job-'+job.id+'-Package-Labels.pdf');
}
