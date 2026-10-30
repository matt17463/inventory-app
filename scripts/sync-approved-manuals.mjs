// Opt-in local manual folder sync (trusted Pi or Mac), not a Netlify function.
// Configure SC_MANUAL_SOURCE_DIR to an explicitly approved business-manuals directory.
// Original files are only read; private PDFs are copied to the R2 knowledge/manuals/ prefix.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {HeadObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
import {r2Client,r2BucketName} from '../netlify/functions/_shared/mockupStorage.js';

const root=String(process.env.SC_MANUAL_SOURCE_DIR||'').trim();
if(process.env.SC_MANUAL_SYNC_ENABLED!=='1'||!root){
  console.error('Manual sync disabled. Set SC_MANUAL_SYNC_ENABLED=1 and SC_MANUAL_SOURCE_DIR to an approved directory.');
  process.exitCode=2;
}else{
  const resolved=await fs.realpath(root);
  if(resolved==='/'||resolved==='/home'||resolved==='/Users'||resolved.endsWith('/..'))
    throw Error('Refusing to scan a broad or unsafe filesystem root.');
  const info=await fs.stat(resolved);if(!info.isDirectory())throw Error('Manual source must be a directory.');
  const max=250,files=[];let visited=0;
  async function scan(dir,depth=0){
    if(depth>6||visited>5000||files.length>=max)return;
    const entries=await fs.readdir(dir,{withFileTypes:true});
    for(const entry of entries){
      if(files.length>=max||visited++>5000)break;
      if(entry.isSymbolicLink()||entry.name.startsWith('.'))continue;
      const abs=path.join(dir,entry.name);
      if(entry.isDirectory())await scan(abs,depth+1);
      else if(entry.isFile()&&/\.pdf$/i.test(entry.name))files.push(abs);
    }
  }
  await scan(resolved);
  let copied=0,unchanged=0,skipped=0;
  for(const file of files){
    const stat=await fs.stat(file);
    if(stat.size<8||stat.size>12*1024*1024){skipped++;continue;}
    const relative=path.relative(resolved,file);
    if(relative.startsWith('..')||path.isAbsolute(relative)){skipped++;continue;}
    const bytes=await fs.readFile(file);
    if(bytes.subarray(0,4).toString()!=='%PDF'){skipped++;continue;}
    const contentHash=crypto.createHash('sha256').update(bytes).digest('hex');
    const pathHash=crypto.createHash('sha256').update(relative).digest('hex').slice(0,24);
    const name=path.basename(file).replace(/\.pdf$/i,'').replace(/[^a-z0-9_-]/gi,'-').slice(0,64)||'manual';
    const key=`knowledge/manuals/${pathHash}/${name}.pdf`;
    try{
      const old=await r2Client().send(new HeadObjectCommand({Bucket:r2BucketName(),Key:key}));
      if(old.Metadata?.sha256===contentHash){unchanged++;continue;}
    }catch(error){
      if(![404,'NotFound','NoSuchKey'].includes(error?.$metadata?.httpStatusCode)&&!['NotFound','NoSuchKey'].includes(error?.name))throw error;
    }
    await r2Client().send(new PutObjectCommand({
      Bucket:r2BucketName(),Key:key,Body:bytes,ContentType:'application/pdf',CacheControl:'private, no-store',
      Metadata:{sha256:contentHash}
    }));
    copied++;
  }
  console.log(JSON.stringify({root_approved:true,files:files.length,copied,unchanged,skipped}));
}
