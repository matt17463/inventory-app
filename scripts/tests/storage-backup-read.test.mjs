import test from 'node:test';
import assert from 'node:assert/strict';
import { storageBackupAuthorized, storageBackupRequest, storageBackupPage } from '../../netlify/functions/_shared/storageBackupRead.js';

test('backup token is separate, fail-closed, and long enough', () => {
 const secret='a'.repeat(64);
 assert.equal(storageBackupAuthorized(secret,secret),true);
 for(const value of ['', 'short', 'b'.repeat(64),undefined]) assert.equal(storageBackupAuthorized(value,secret),false);
 assert.equal(storageBackupAuthorized(secret,undefined),false);
 assert.equal(storageBackupAuthorized('short','short'),false);
});
test('only fixed storage buckets and bounded safe pagination are accepted',()=>{
 assert.deepEqual(storageBackupRequest({bucket:'sc-private-print-pdfs'}),{bucket:'sc-private-print-pdfs',prefix:'',offset:0});
 for(const change of [{bucket:'other'},{prefix:'../private'},{prefix:'/private'},{prefix:'a\\b'},{offset:-1},{offset:0.5},{offset:1000001}]) assert.throws(()=>storageBackupRequest({bucket:'sc-private-print-pdfs',...change}));
});
test('nested listings sign only files with a short lifetime and propagate failures',async()=>{
 let signed=[];
 const store={list:async(prefix,options)=>{assert.equal(prefix,'folder');assert.equal(options.limit,1000);return {data:[{name:'nested',id:null,metadata:null},{name:'file.pdf',id:'id',metadata:{size:12},updated_at:'date'}]};},createSignedUrls:async(paths,ttl)=>{signed=paths;assert.equal(ttl,1800);return {data:paths.map(path=>({path,signedUrl:'https://example.test/signed'}))};}};
 const client={storage:{from:bucket=>{assert.equal(bucket,'sc-private-print-pdfs');return store;}}};
 const page=await storageBackupPage(client,{bucket:'sc-private-print-pdfs',prefix:'folder'});
 assert.deepEqual(signed,['folder/file.pdf']);assert.deepEqual(page.folders,['folder/nested']);assert.equal(page.files[0].bytes,12);assert.equal(page.next_offset,null);
 store.createSignedUrls=async()=>({error:new Error('failed')});
 await assert.rejects(storageBackupPage(client,{bucket:'sc-private-print-pdfs',prefix:'folder'}),/signing/);
});

test('HTTP route refuses unauthenticated reads and never exposes a write operation',async()=>{
 const {handler}=await import('../../netlify/functions/nas-storage-read.js');
 const previous=process.env.SC_STORAGE_BACKUP_READ_TOKEN;
 process.env.SC_STORAGE_BACKUP_READ_TOKEN='x'.repeat(64);
 try {
  assert.equal((await handler({httpMethod:'GET',headers:{}})).statusCode,405);
  assert.equal((await handler({httpMethod:'POST',headers:{},body:'{}'})).statusCode,403);
  const headers={authorization:'Bearer '+'x'.repeat(64)};
  assert.equal((await handler({httpMethod:'POST',headers,body:'null'})).statusCode,400);
  const list=await handler({httpMethod:'POST',headers,body:JSON.stringify({action:'buckets'})});
  assert.equal(list.statusCode,200);assert.equal(list.headers['Cache-Control'],'no-store, private');
  assert.equal((await handler({httpMethod:'POST',headers,body:JSON.stringify({action:'delete',bucket:'sc-private-print-pdfs'})})).statusCode,400);
 } finally { if(previous===undefined)delete process.env.SC_STORAGE_BACKUP_READ_TOKEN;else process.env.SC_STORAGE_BACKUP_READ_TOKEN=previous; }
});
