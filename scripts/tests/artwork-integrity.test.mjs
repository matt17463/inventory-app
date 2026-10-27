import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {S3Client,HeadObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import {artworkDigest,matchingRevision,verifyRegisteredArtwork} from '../../netlify/functions/_shared/artworkIntegrity.js';
import {putMockupObject,presignedR2Put} from '../../netlify/functions/_shared/mockupStorage.js';
import {operationalStorageHealth} from '../../netlify/functions/_shared/operationalStorage.js';
process.env.R2_ACCOUNT_ID='fictional';process.env.R2_ACCESS_KEY_ID='fictional';process.env.R2_SECRET_ACCESS_KEY='fictional';process.env.R2_BUCKET_NAME='fictional';
const asset={id:'fixture',updated_at:'2026-01-01T00:00:00Z',storage_provider:'r2',storage_bucket:'fictional',storage_path:'isolated/file.png'};
test('integrity reads exact bytes with conditional GET and rejects silent overwrite',async()=>{
 const original=Buffer.from('FICTIONAL ORIGINAL ART');let bytes=original;
 const calls=[];
 const stub=mock.method(S3Client.prototype,'send',async command=>{calls.push(command);return command instanceof HeadObjectCommand?{ContentLength:bytes.length,ETag:'"fixture-etag"'}:{Body:[bytes]};});
 try{
  const expected=createHash('sha256').update(original).digest('hex');
  assert.deepEqual(await artworkDigest({},asset),{sha256:expected,bytes:original.length});
  assert(calls[1] instanceof GetObjectCommand);assert.equal(calls[1].input.IfMatch,'"fixture-etag"');
  const pin={artwork_asset_id:asset.id,asset_updated_at:asset.updated_at,...asset,sha256:expected,byte_size:original.length};
  assert.equal(matchingRevision(asset,[pin]),pin);
  const failures=[];const db={rpc:async(name,args)=>{failures.push({name,args});return {error:null};}};
  await verifyRegisteredArtwork(db,asset,pin,'fixture-manager');assert.equal(failures.length,0);
  bytes=Buffer.from('FICTIONAL CHANGED ART');
  await assert.rejects(verifyRegisteredArtwork(db,asset,pin,'fixture-manager'),/bytes differ/);
  assert.equal(failures[0].name,'sc_report_artwork_integrity_failure');assert.equal(failures[0].args.p_expected,expected);
  await assert.rejects(artworkDigest({},{...asset,storage_bucket:'foreign'}),/bucket mismatch/);
 }finally{stub.mock.restore();}
});
test('CORS fallback observes protected upload policy with OPTIONS and never sends object bytes',async()=>{
 process.env.ASSET_STORAGE_PROVIDER='r2';const network=[];
 const sdk=mock.method(S3Client.prototype,'send',async c=>{if(c.constructor.name==='GetBucketCorsCommand')throw Error('No bucket-admin permission');return {KeyCount:0};});
 const request=mock.method(globalThis,'fetch',async(url,options)=>{network.push({url,options});return new Response(null,{status:200,headers:{'access-control-allow-origin':'https://inventory.skilledcrafting.com','access-control-allow-methods':'GET, PUT','access-control-allow-headers':'content-type, if-none-match'}});});
 try{assert.equal((await operationalStorageHealth()).conditional_upload_cors,'permitted');assert.equal(network.length,1);assert.equal(network[0].options.method,'OPTIONS');assert.equal(network[0].options.body,undefined);}
 finally{sdk.mock.restore();request.mock.restore();}
});
test('new application objects use atomic create-only writes and signed upload protection',async()=>{
 process.env.MOCKUP_STORAGE_PROVIDER='r2';const writes=[];
 const stub=mock.method(S3Client.prototype,'send',async command=>{writes.push(command.input);return {};});
 try{
  await putMockupObject(null,{key:'fictional/new.png',bytes:Buffer.from('fictional'),contentType:'image/png',makePreview:false});
  assert.equal(writes[0].IfNoneMatch,'*');
  const signed=new URL(await presignedR2Put({key:'fictional/new.png',contentType:'image/png',createOnly:true}));
  assert(signed.searchParams.get('X-Amz-SignedHeaders').split(';').includes('if-none-match'));
 }finally{stub.mock.restore();}
});
