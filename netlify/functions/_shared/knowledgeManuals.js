import crypto from 'node:crypto';
import {GetObjectCommand,HeadObjectCommand,ListObjectsV2Command,PutObjectCommand} from '@aws-sdk/client-s3';
import {r2Client,r2BucketName} from './mockupStorage.js';
import {extractPdfTextPages} from './pdfTextExtractor.js';

export const MANUAL_PREFIX='knowledge/manuals/';
export const MANUAL_MAX_BYTES=12*1024*1024;
const text=(v,max=250)=>String(v||'').trim().slice(0,max);
export function allowlistedPdfKey(key){
  return typeof key==='string' && key.startsWith(MANUAL_PREFIX) &&
    key.length<700 && !key.includes('..') && !key.includes('\\') &&
    /^[a-zA-Z0-9/_-]+\.pdf$/i.test(key);
}
export function splitManualText(input,maxChars=2300){
  const clean=String(input||'').replace(/\0/g,'').replace(/\s+/g,' ').trim();
  if(!clean)return [];
  const chunks=[];
  for(let offset=0;offset<clean.length;offset+=maxChars-180){
    const part=clean.slice(offset,offset+maxChars).trim();
    if(part)chunks.push(part);
    if(offset+maxChars>=clean.length)break;
  }
  return chunks;
}
export function normalizedPageText(page){
  return (page?.cells||[]).filter(cell=>typeof cell.str==='string')
    .map(cell=>cell.str).join(' ').replace(/\s+/g,' ').trim();
}
async function objectBuffer(key){
  const client=r2Client(),Bucket=r2BucketName();
  const head=await client.send(new HeadObjectCommand({Bucket,Key:key}));
  if(!Number(head.ContentLength)||Number(head.ContentLength)>MANUAL_MAX_BYTES)
    throw Error('PDF is empty or exceeds the 12 MB processing limit.');
  const object=await client.send(new GetObjectCommand({Bucket,Key:key}));
  const buffer=Buffer.from(await object.Body.transformToByteArray());
  if(buffer.length>MANUAL_MAX_BYTES||buffer.subarray(0,4).toString()!=='%PDF')throw Error('Not a valid small PDF.');
  return {buffer,etag:String(head.ETag||'').replaceAll('"','')};
}
export async function ingestManual(db,key,{title='',category='machine manual'}={}){
  if(!allowlistedPdfKey(key))throw Error('Manual must have an allowlisted PDF storage key.');
  const {buffer,etag}=await objectBuffer(key);
  const digest=crypto.createHash('sha256').update(buffer).digest('hex');
  const existing=await db.from('sc_knowledge_sources').select('id,sha256,status').eq('source_key',key).maybeSingle();
  if(existing.error)throw existing.error;
  if(existing.data?.status==='indexed'&&existing.data.sha256===digest)return {source_id:existing.data.id,status:'unchanged'};
  const record={
    source_key:key,title:text(title||key.split('/').at(-1).replace(/\.pdf$/i,'').replace(/[_-]/g,' '),240),
    category:text(category,80)||'machine manual',source_kind:'r2_pdf',object_etag:etag,
    sha256:digest,bytes:buffer.length,status:'indexing',error_message:null,updated_at:new Date().toISOString(),
  };
  const upsert=await db.from('sc_knowledge_sources').upsert(record,{onConflict:'source_key'}).select('id').single();
  if(upsert.error)throw upsert.error;
  const id=upsert.data.id;
  try{
    const pages=await extractPdfTextPages(buffer);
    if(pages.length>400)throw Error('Manual exceeds 400-page indexing limit; split into smaller volumes.');
    const rows=[];
    for(const page of pages){
      const words=normalizedPageText(page);
      const chunks=splitManualText(words);
      for(let i=0;i<chunks.length;i++){
        rows.push({source_id:id,page_number:page.pageNumber,chunk_number:i+1,content:chunks[i]});
      }
    }
    if(rows.length>3000)throw Error('Too many text sections; split this document.');
    const del=await db.from('sc_knowledge_chunks').delete().eq('source_id',id);if(del.error)throw del.error;
    for(let i=0;i<rows.length;i+=80){
      const saved=await db.from('sc_knowledge_chunks').insert(rows.slice(i,i+80));if(saved.error)throw saved.error;
    }
    const status=rows.length?'indexed':'needs_ocr';
    const updated=await db.from('sc_knowledge_sources').update({
      status,page_count:pages.length,error_message:rows.length?null:'No extractable text. OCR required.',
      indexed_at:new Date().toISOString(),updated_at:new Date().toISOString()
    }).eq('id',id);
    if(updated.error)throw updated.error;
    return {source_id:id,status,pages:pages.length,chunks:rows.length};
  }catch(err){
    await db.from('sc_knowledge_sources').update({status:'error',error_message:String(err.message||'Index failed').slice(0,500)}).eq('id',id);
    throw err;
  }
}
export async function storeUploadedManual(buffer,filename){
  if(!Buffer.isBuffer(buffer)||buffer.length<8||buffer.length>MANUAL_MAX_BYTES||buffer.subarray(0,4).toString()!=='%PDF')throw Error('Choose a PDF under 12 MB.');
  const stem=String(filename||'manual').replace(/\.pdf$/i,'').replace(/[^a-z0-9_-]/gi,'-').slice(0,70);
  const key=MANUAL_PREFIX+crypto.randomUUID()+'-'+stem+'.pdf';
  await r2Client().send(new PutObjectCommand({Bucket:r2BucketName(),Key:key,Body:buffer,ContentType:'application/pdf',CacheControl:'private, no-store'}));
  return key;
}
export async function scanManualPrefix(db,{limit=3}={}){
  const items=[];let cursor;
  do{
    const page=await r2Client().send(new ListObjectsV2Command({Bucket:r2BucketName(),Prefix:MANUAL_PREFIX,MaxKeys:250,ContinuationToken:cursor}));
    for(const object of page.Contents||[]){
      if(!allowlistedPdfKey(object.Key)||Number(object.Size)>MANUAL_MAX_BYTES)continue;
      items.push({key:object.Key,etag:String(object.ETag||'').replaceAll('"','')});
    }
    cursor=page.IsTruncated?page.NextContinuationToken:undefined;
  }while(cursor&&items.length<600);
  const known=await db.from('sc_knowledge_sources').select('source_key,object_etag,status').gte('updated_at','1970-01-01').limit(1000);
  if(known.error)throw known.error;
  const byKey=new Map((known.data||[]).map(r=>[r.source_key,r]));
  let processed=0;const results=[];
  for(const object of items){
    if(processed>=limit)break;
    const key=object.key;
    const existing=byKey.get(key);
    // Every scan refreshes entries with errors, but avoids reprocessing unchanged indexed items;
    // content digest is verified when the candidate runs.
    if(existing?.status==='indexed'&&existing.object_etag===object.etag)continue;
    try{results.push({key,...await ingestManual(db,key)});}catch(e){results.push({key,status:'error',message:String(e.message||'Index failed').slice(0,200)});}
    processed++;
  }
  return {checked:items.length,processed,results};
}
