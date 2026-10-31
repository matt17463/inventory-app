import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const migration=await fs.readFile(new URL('../../supabase/migrations/20261031000643_blank_photo_provenance.sql',import.meta.url),'utf8');
const actor='00000000-0000-4000-8000-000000000001';
const id='00000000-0000-4000-8000-000000000002';
const other='00000000-0000-4000-8000-000000000003';
async function database(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;create function public.sc_internal_access_allowed(text[]) returns boolean language sql as 'select true';
 create table public.sc_app_user_roles(user_id uuid,role text,is_active boolean);
 insert into public.sc_app_user_roles values('${actor}','admin',true);
 create table public.blank_products(id uuid primary key,brand_id bigint,product_type_id bigint,color_id bigint,sc_is_archived boolean default false,image_url text,image_storage_provider text,image_storage_bucket text,image_storage_path text,image_file_size_bytes bigint,image_mime_type text,image_preview_storage_provider text,image_preview_storage_bucket text,image_preview_storage_path text,image_preview_size_bytes bigint);
 insert into public.blank_products(id,brand_id,product_type_id,color_id) values('${id}',1,1,1),('${other}',2,1,1);`);
 await db.exec(migration);return db;
}
async function save(db,{ids=[id],patch={},source={},manual=false,who=null,approve=false}={}){
 return (await db.query('select public.sc_save_blank_photo($1,$2,$3,$4,$5,$6) n',[ids,JSON.stringify(patch),JSON.stringify(source),manual,who,approve])).rows[0].n;
}
test('manual clear is durable against future supplier sync and is atomic with evidence',async()=>{
 const db=await database();try{
  assert.equal(await save(db,{patch:{image_url:'https://supplier.test/black.jpg'},source:{capture_type:'direct',match_confidence:'exact'}}),1);
  assert.equal(await save(db,{patch:{image_url:null},manual:true,who:actor}),1);
  assert.equal(await save(db,{patch:{image_url:'https://supplier.test/reintroduced.jpg'}}),0);
  const {rows}=await db.query('select p.image_url,s.locked_manual_override,s.review_status from blank_products p join sc_blank_photo_sources s on p.id=s.blank_id');
  assert.deepEqual(rows,[{image_url:null,locked_manual_override:true,review_status:'cleared'}]);
 }finally{await db.close()}
});
test('scope, authorization and metadata errors cannot partially replace photos',async()=>{
 const db=await database();try{
  await assert.rejects(save(db,{ids:[id,other]}),/crosses/);
  await assert.rejects(save(db,{manual:true}),/Authorized/);
  await assert.rejects(save(db,{patch:{image_url:'https://supplier.test/photo.jpg'},source:{capture_type:'invalid'}}));
  assert.equal((await db.query('select image_url from blank_products where id=$1',[id])).rows[0].image_url,null);
  assert.equal(await save(db,{patch:{image_url:'https://supplier.test/photo.jpg'}}),1);
  assert.equal(await save(db,{patch:{image_url:'https://supplier.test/replace.jpg'}}),0);
  assert.equal(await save(db,{manual:true,who:actor,approve:true}),1);
 }finally{await db.close()}
});
test('likely and provisional images cannot masquerade as exact or propagate to other colors',async()=>{
 const {referenceIndex,referenceFor}=await import('../../src/lib/blankGuidePhotos.js');
 const row={brand:'Adidas',style:'AT203',color:'Black',savedPhoto:'https://supplier.test/a.jpg',photoEvidence:{match_confidence:'likely'}};
 assert.equal(referenceFor(row,new Map()).exactPhoto,'');assert.equal(referenceFor(row,new Map()).kind,'likely');
 assert.equal(referenceIndex([row]).size,0);
 assert.equal(referenceFor({...row,photoEvidence:{review_status:'cleared'}},new Map()).photo,'');
});
test('supplier content validation rejects redirects, non-images and undecodable content',async()=>{
 const {usableImage}=await import('../../netlify/functions/supplier-photo-sync.js');
 const before=globalThis.fetch;
 try{
  globalThis.fetch=async(_url,options)=>{assert.equal(options.redirect,'error');return new Response('html',{headers:{'content-type':'text/html'}})};
  assert.equal(await usableImage('https://sanmarsports.com/photo.jpg'),false);
  globalThis.fetch=async()=>new Response('not a jpeg',{headers:{'content-type':'image/jpeg'}});
  await assert.rejects(usableImage('https://sanmarsports.com/photo.jpg'));
 }finally{globalThis.fetch=before}
});
test('supplier identity checks reject adult/youth and style suffix collisions',async()=>{
 const {suitableTitle,validImage}=await import('../../netlify/functions/supplier-photo-sync.js');
 assert.equal(suitableTitle({title:'Gildan Youth 18500B',vendor:'Gildan'},'Gildan','18500'),false);
 assert.equal(suitableTitle({title:'BELLA+CANVAS 3001CVC',vendor:'Bella Canvas'},'Bella Canvas','3001'),false);
 assert.equal(validImage('https://user:secret@sanmarsports.com/18500.jpg'),'');
 assert.equal(validImage('https://sanmarsports.com:8443/18500.jpg'),'');
});
