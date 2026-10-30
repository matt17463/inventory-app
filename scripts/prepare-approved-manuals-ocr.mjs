// Optional, local-only OCR for approved business manuals.
// Source files stay unchanged; never scans an entire NAS automatically.
// OCR uses an installed local ocrmypdf executable, not a cloud or paid API.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const MAX_BYTES=12*1024*1024,MAX_PAGES=400;
function contained(root,file){
 const relative=path.relative(root,file);
 return Boolean(relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));
}
export function safeManualDirectory(input){
 const full=path.resolve(String(input||''));
 const bad=new Set(['/',path.parse(full).root,'/home','/Users','/mnt','/media','/Volumes',os.homedir()]);
 if(!input||bad.has(full)||full.length<9)throw Error('Refusing broad/empty manual directory');
 return full;
}
async function directoryReal(p){
 const full=safeManualDirectory(p);
 const st=await fs.lstat(full);
 if(!st.isDirectory()||st.isSymbolicLink())throw Error('Manual directory must be a real folder, not a symlink');
 return await fs.realpath(full);
}
export async function discoverApprovedPdfs(root,max=50){
 const files=[];let visited=0;
 async function walk(dir,depth=0){
  if(depth>6||files.length>=max||visited>5000)return;
  for(const e of await fs.readdir(dir,{withFileTypes:true})){
   if(files.length>=max||visited++>5000)break;
   if(e.name.startsWith('.')||e.isSymbolicLink())continue;
   const full=path.join(dir,e.name);
   if(e.isDirectory())await walk(full,depth+1);
   else if(e.isFile()&&/\\.pdf$/i.test(e.name)){
    const st=await fs.lstat(full);
    if(!st.isSymbolicLink()&&st.size>8&&st.size<=MAX_BYTES&&contained(root,full)){
     const f=await fs.open(full,'r');
     try{const bytes=Buffer.alloc(4);await f.read(bytes,0,4,0);if(bytes.toString()==='%PDF')files.push(full);}finally{await f.close();}
    }
   }
  }
 }
 await walk(root);
 return files;
}
function execFile(cmd,args,timeoutMs=120000){
 return new Promise((resolve,reject)=>{
  const child=spawn(cmd,args,{shell:false,stdio:['ignore','pipe','pipe']});
  let out='',err='';
  const t=setTimeout(()=>{child.kill('SIGKILL');reject(Error(cmd+' timed out'));},timeoutMs);
  child.stdout.on('data',b=>{out=(out+b.toString()).slice(-25000);});
  child.stderr.on('data',b=>{err=(err+b.toString()).slice(-4000);});
  child.once('error',e=>{clearTimeout(t);reject(e);});
  child.once('close',code=>{clearTimeout(t);if(code===0)resolve(out);else reject(Error(cmd+' failed ('+code+'): '+err.slice(-400)));});
 });
}
export async function ocrManual({source,output,execute=false,maxFiles=25}={}){
 const root=await directoryReal(source);
 const destination=safeManualDirectory(output);
 // Do not put output under source: a second run must never ingest prior derivatives.
 if(destination===root||contained(root,destination)||contained(destination,root))throw Error('OCR output must be outside the approved source hierarchy');
 const files=await discoverApprovedPdfs(root,Math.min(100,Math.max(1,Number(maxFiles)||25)));
 if(!execute)return {dry_run:true,files:files.map(p=>path.relative(root,p)),message:'Run with --execute and SC_MANUAL_OCR_ENABLED=1 on a trusted host to generate reviewed OCR copies'};
 if(process.env.SC_MANUAL_OCR_ENABLED!=='1')throw Error('OCR disabled. Set SC_MANUAL_OCR_ENABLED=1 on the trusted host.');
 const dstStat=await fs.lstat(destination).catch(()=>null);
 if(dstStat&&(!dstStat.isDirectory()||dstStat.isSymbolicLink()))throw Error('Output must be a real directory');
 await fs.mkdir(destination,{recursive:true});
 const realDest=await directoryReal(destination);
 const results=[];
 for(const file of files){
  const relative=path.relative(root,file);
  const target=path.join(realDest,relative.replace(/\\.pdf$/i,'.ocr.pdf'));
  if(!contained(realDest,target))throw Error('Unexpected output path');
  await fs.mkdir(path.dirname(target),{recursive:true});
  if(await fs.lstat(target).then(()=>true).catch(()=>false)){results.push({file:relative,status:'existing-reviewed-copy'});continue;}
  const info=await execFile('pdfinfo',[file],20000);
  const pages=Number(info.match(/^Pages:\\s*(\\d+)/m)?.[1]||0);
  if(!pages||pages>MAX_PAGES){results.push({file:relative,status:'page-limit'});continue;}
  const temp=target+'.partial-'+process.pid;
  try{
   // --skip-text means already searchable pages are preserved; original is immutable.
   await execFile('ocrmypdf',['--skip-text','--rotate-pages','--deskew','--jobs','1','--output-type','pdf','--optimize','0',file,temp],600000);
   const st=await fs.stat(temp);
   const handle=await fs.open(temp,'r');
   let valid=false;try{const b=Buffer.alloc(4);await handle.read(b,0,4,0);valid=b.toString()==='%PDF';}finally{await handle.close();}
   if(!valid||st.size>MAX_BYTES||st.size<8)throw Error('OCR result failed PDF/size verification');
   await fs.rename(temp,target);
   results.push({file:relative,status:'generated-for-human-review'});
  }catch(error){
   results.push({file:relative,status:'error',reason:String(error.message||error).slice(0,180)});
   await fs.rm(temp,{force:true});
  }
 }
 return {dry_run:false,files:results,note:'Review OCR text, then set SC_MANUAL_SOURCE_DIR to the approved output folder and use existing manual-sync; no upload is automatic'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 const get=flag=>{const i=args.indexOf(flag);return i<0?'':args[i+1];};
 ocrManual({source:get('--source'),output:get('--output'),execute:args.includes('--execute'),maxFiles:Number(get('--max-files')||25)})
  .then(result=>console.log(JSON.stringify(result,null,2)))
  .catch(error=>{console.error(error.message);process.exitCode=2;});
}
