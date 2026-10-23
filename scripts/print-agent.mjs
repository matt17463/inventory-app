// Raspberry Pi 5 / Linux outbound polling agent (Node.js 20+).
// No inbound ports, no browser printer permission, no Supabase service key on the Pi.
// IMPORTANT: A successful `lp` means spool acceptance, not physical printing.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const exec=promisify(execFile);
const base=String(process.env.SC_APP_URL||'').replace(/\/+$/,'');
const token=String(process.env.SC_PRINT_AGENT_TOKEN||'');
const letter=String(process.env.SC_PRINT_EPSON_QUEUE||'');
const thermal=String(process.env.SC_PRINT_MUNBYN_QUEUE||'');
const safeName=s=>/^[a-zA-Z0-9_.-]+$/.test(s);
if(!base.startsWith('https://')||token.length<32||!safeName(letter)) {
 console.error('Configure secure SC_APP_URL, SC_PRINT_AGENT_TOKEN (32+ chars), and SC_PRINT_EPSON_QUEUE.');
 process.exit(2);
}
const queueMap={letter, ...(safeName(thermal)?{thermal}: {})};
const interval=Math.max(10000,Math.min(180000,Number(process.env.SC_PRINT_POLL_MS)||30000));
const endpoint=base+'/.netlify/functions/print-dispatch';
async function request(data){
 const res=await fetch(endpoint,{method:'POST',headers:{
   'Content-Type':'application/json','x-sc-print-agent-token':token,
  },body:JSON.stringify(data),signal:AbortSignal.timeout(30000)});
 const body=await res.json().catch(()=>({}));
 if(!res.ok||!body.success)throw Error(body.error||'Print API response '+res.status);
 return body;
}
async function spool(doc){
 const dest=queueMap[doc.queue_name];
 if(!dest)throw Error('No CUPS queue is configured for '+doc.queue_name);
 const pdf=Buffer.from(String(doc.pdf_base64||''),'base64');
 if(pdf.length>7000000||pdf.subarray(0,5).toString('ascii')!=='%PDF-')throw Error('Invalid incoming PDF.');
 const dir=await mkdtemp(join(tmpdir(),'sc-print-'));
 try{
  const path=join(dir,'document.pdf');
  await writeFile(path,pdf,{mode:0o600,flag:'wx'});
  const media=doc.queue_name==='thermal'?'Custom.4x6in':'Letter';
  const {stdout}=await exec('lp',['-d',dest,'-o','media='+media,
    '-o','fit-to-page','-o','sides=one-sided',path],{timeout:30000,maxBuffer:4096});
  return stdout.trim().slice(0,160);
 }finally{await rm(dir,{force:true,recursive:true});}
}
async function tick(){
 const {job}=await request({action:'lease',queues:Object.keys(queueMap)});
 if(!job)return;
 try{
  const cups=await spool(job);
  await request({action:'ack',id:job.id,leaseId:job.lease_id,spooled:true,cupsJobReference:cups});
  console.log(new Date().toISOString(),'spooled',job.id,job.queue_name,cups);
 }catch(e){
  console.error(new Date().toISOString(),'spool failed',job.id,e.message);
  try{await request({action:'ack',id:job.id,leaseId:job.lease_id,spooled:false,error:e.message});}
  catch(err){console.error('Could not report print failure:',err.message);}
 }
}
console.log('Skilled Crafting print agent started: configured queues',Object.keys(queueMap).join(', '));
let lastPurge=0;
while(true){
 try{
   if(Date.now()-lastPurge>24*60*60*1000){
    await request({action:'purge'});
    lastPurge=Date.now();
   }
   await tick();
  }catch(e){console.error(new Date().toISOString(),'poll unavailable:',e.message);}
 await new Promise(resolve=>setTimeout(resolve,interval));
}
