import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {safeManualDirectory,discoverApprovedPdfs,ocrManual} from '../prepare-approved-manuals-ocr.mjs';

test('OCR helper rejects broad or ambiguous roots and never traverses user home',()=>{
 for(const value of ['', '/', '/home', '/Users', '/mnt', os.homedir()]){
  assert.throws(()=>safeManualDirectory(value),/Refusing/);
 }
});

test('local approved-folder OCR defaults to dry run and excludes invalid PDFs and symlinks',async()=>{
 const parent=await fs.mkdtemp(path.join(os.tmpdir(),'skilled-crafting-manual-ocr-test-'));
 const src=path.join(parent,'approved-business-only');
 const dst=path.join(parent,'reviewed-ocr-copies');
 try{
  await fs.mkdir(src,{recursive:true});
  await fs.mkdir(path.join(src,'machine'),{recursive:true});
  await fs.writeFile(path.join(src,'machine','Roland_BN2.pdf'),'%PDF-1.4\nsample fixture');
  await fs.writeFile(path.join(src,'unverified.pdf'),'This is not a PDF');
  await fs.writeFile(path.join(src,'.hidden.pdf'),'%PDF-1.4\nhidden');
  await fs.writeFile(path.join(src,'wrong.txt'),'%PDF-1.4\nwrong extension');
  await fs.symlink(path.join(src,'machine','Roland_BN2.pdf'),path.join(src,'link.pdf'));
  const matches=await discoverApprovedPdfs(await fs.realpath(src));
  assert.deepEqual(matches.map(x=>path.relative(src,x)),[path.join('machine','Roland_BN2.pdf')]);
  const preview=await ocrManual({source:src,output:dst});
  assert.equal(preview.dry_run,true);
  assert.deepEqual(preview.files,[path.join('machine','Roland_BN2.pdf')]);
  assert.equal(await fs.stat(dst).then(()=>true).catch(()=>false),false,'dry run must create no files or output folder');
  await assert.rejects(ocrManual({source:src,output:path.join(src,'ocr')}),/outside/);
  await assert.rejects(ocrManual({source:src,output:src}),/outside/);
  const oldFlag=process.env.SC_MANUAL_OCR_ENABLED;
  try{
   delete process.env.SC_MANUAL_OCR_ENABLED;
   await assert.rejects(ocrManual({source:src,output:dst,execute:true}),/OCR disabled/);
  }finally{
   if(oldFlag===undefined)delete process.env.SC_MANUAL_OCR_ENABLED;
   else process.env.SC_MANUAL_OCR_ENABLED=oldFlag;
  }
 }finally{await fs.rm(parent,{recursive:true,force:true});}
});
