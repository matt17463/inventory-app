import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {applyMappingTemplate,buildMigrationPlan,fingerprint,physicalKey,reviewMigrationEvidence} from '../../netlify/functions/_shared/wooLogoMigration.js';
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function isolatedDatabase(){
 if(!process.env.SC_CERTIFICATION_TEST_DATABASE_URL)return new PGlite();
 const admin=new pg.Client({connectionString:process.env.SC_CERTIFICATION_TEST_DATABASE_URL});await admin.connect();
 const name='logo_mapping_'+randomUUID().replaceAll('-','');await admin.query('create database '+name);
 const url=new URL(process.env.SC_CERTIFICATION_TEST_DATABASE_URL);url.pathname='/'+name;
 const client=new pg.Client({connectionString:url.href});await client.connect();
 return {exec:q=>client.query(q),query:(q,p)=>client.query(q,p),close:async()=>{await client.end();await admin.query('drop database '+name+' with (force)');await admin.end();}};
}
function fixture(){
 const product={id:200,type:'variable',name:'NONCUSTOMER fixture',attributes:[{id:0,name:'Logo Choice',variation:true,options:['Home','Away','Third']}]};
 const variations=[],mappings={},canonical={};let n=10;
 for(const [j,choice] of product.attributes[0].options.entries())mappings[choice.toLowerCase()]={family_id:uid(100+j),variant_id:uid(200+j),artwork_asset_id:uid(300+j),recipe_version_id:uid(400+j),label:choice,output_by_image:{}};
 for(const color of ['Black','Blue'])for(const size of ['M','YM'])for(const choice of product.attributes[0].options){
  const v={id:n++,parent_id:200,sku:`NONCUSTOMER-${color}-${size}-${choice}`,attributes:[{name:'Color',option:color},{name:'Size',option:size},{name:'Logo Choice',option:choice}],image:{id:n,src:`https://example.invalid/mockup-${n}.png`},regular_price:'12.00',sale_price:'',manage_stock:false,stock_quantity:null,stock_status:'instock',tax_status:'taxable'};
  variations.push(v);mappings[choice.toLowerCase()].output_by_image[v.image.id]=uid(500+n);canonical[physicalKey(v.attributes)]??=v.id;
 }
 return {product,variations,mappings,canonical};
}
test('three designs share four physical variations, with a complete historic image/ID crosswalk and no deletion',()=>{
 const f=fixture(),p=buildMigrationPlan(f);assert.equal(p.ready,true);assert.deepEqual(p.counts,{before:12,after:4,retained:4,archived:8,deleted:0});
 assert.equal(p.crosswalk.length,12);assert.equal(new Set(p.crosswalk.map(x=>x.legacy_variation_id)).size,12);
 assert.equal(p.options.length,3);for(const o of p.options){assert.equal(o.variation_ids.length,4);assert.equal(Object.keys(o.images).length,4);}
 assert.deepEqual(f,fixture(),'planning must not mutate source or options');
});
test('missing approval inputs do not prevent an incomplete plan being represented as a draft',()=>{
 const p=buildMigrationPlan({...fixture(),mappings:{},canonical:{}});assert.equal(p.ready,false);assert.equal(p.counts.after,4);assert.equal(p.baseline.variations.length,12);assert(p.blockers.some(b=>b.includes('explicitly select')));
});
for(const [name,change] of [
 ['price',f=>f.variations[1].regular_price='13.00'],['tax',f=>f.variations[1].tax_class='reduced'],['stock',f=>f.variations[1].stock_status='outofstock'],
 ['independent logo stock',f=>f.variations.forEach(v=>{v.manage_stock=true;v.stock_quantity=5;})],['foreign parent',f=>f.variations[0].parent_id=999],
 ['wildcard physical attribute',f=>f.variations[0].attributes[0].option=''],['duplicate variation',f=>f.variations.push({...f.variations[0]})],
 ['unreviewed image',f=>f.mappings.home.output_by_image={}],['fee parity',f=>f.mappings.home.fee=3],['duplicate graphic identity',f=>f.mappings.away.family_id=f.mappings.home.family_id]
])test(`cutover planning blocks ${name} while retaining baseline`,()=>{const f=fixture();change(f);const p=buildMigrationPlan(f);assert.equal(p.ready,false);assert(p.blockers.length>0);assert.equal(p.baseline.product.id,200);});
test('truncated pagination never permits a cutover',()=>assert.equal(buildMigrationPlan({...fixture(),complete:false}).ready,false));
test('fingerprints are key-order stable, detect actual source edits and preserve array order',()=>{
 assert.equal(fingerprint({a:1,b:2}),fingerprint({b:2,a:1}));assert.notEqual(fingerprint({a:1}),fingerprint({a:2}));assert.notEqual(fingerprint([1,2]),fingerprint([2,1]));
});
test('shared templates transfer exact reviewed references without cross-product images, approval claims or guessed labels',()=>{
 const target={home:{label:'Home',output_by_image:{7:uid(7)}},'other logo':{label:'Other'}},source={home:{label:'Shared Home',family_id:uid(1),artwork_asset_id:uid(2),variant_id:uid(3),recipe_version_id:uid(4),output_by_image:{9:uid(9)},approved:true},'Home!':{family_id:uid(8)}};
 const result=applyMappingTemplate(target,source);assert.equal(result.home.family_id,uid(1));assert.deepEqual(result.home.output_by_image,{});assert.equal(result.home.approved,undefined);assert.deepEqual(result['other logo'],target['other logo']);assert.equal(target.home.output_by_image[7],uid(7));
});
test('failed evidence reads fail closed rather than treating missing records as approval',async()=>{
 const db={from:()=>{const q=new Proxy({},{get:(_t,p)=>p==='then'?(resolve)=>resolve({data:null,error:{message:'offline'}}):()=>q});return q;}};
 await assert.rejects(reviewMigrationEvidence(db,buildMigrationPlan(fixture())),/Unable to verify/);
});

test('real SQL keeps drafts independent of production approvals, immutable baseline/history and idempotent imported draft families',async()=>{
 const db=await isolatedDatabase();try{
  await db.exec(`do $$ begin
   if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
   if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
   if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;end $$;
   create schema auth;create schema sc_certification;
   create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
   create function public.sc_internal_access_allowed(roles text[]) returns boolean language sql as $$ select coalesce(current_setting('test.role',true)=any(roles),false) $$;
   create function sc_certification.immutable_artwork_revision() returns trigger language plpgsql as $$ begin raise exception 'Immutable history';end $$;
   create table sc_client_graphic_families(id uuid primary key default gen_random_uuid(),name text,internal_name text,storefront_label text,storefront_visibility text,state text);
   create table sc_client_graphic_variants(id uuid primary key default gen_random_uuid(),family_id uuid,artwork_asset_id uuid,label text,process text,state text,width_inches numeric,height_inches numeric);
   create table sc_client_graphic_product_bindings(id uuid default gen_random_uuid(),woo_product_id bigint,graphic_family_id uuid,mode text,allowed boolean,verified_at timestamptz,unique(woo_product_id,graphic_family_id));
   create table sc_client_graphic_transfer_reviews(id uuid default gen_random_uuid(),woo_product_id bigint,source_kind text,source_key text,source_value text,proposed_family_id uuid,evidence jsonb,status text default 'pending',verified_at timestamptz);
   create table sc_variation_certifications(status text,evidence_snapshot jsonb);
   set test.role='manager';set test.actor='${uid(99)}';`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261027145510_woo_logo_mapping_workspace.sql',import.meta.url),'utf8'));
  const plan=(await db.query(`insert into sc_woo_logo_mapping_plans(woo_product_id,source_hash,baseline,mappings,created_by,updated_by) values(200,$1,'{"product":{"id":200}}',$2,$3,$3) returning id`,['a'.repeat(64),JSON.stringify({home:{label:'Home',artwork_asset_id:uid(30)}}),uid(99)])).rows[0].id;
  await db.exec('set role authenticated');
  const a=(await db.query('select sc_create_logo_mapping_family($1,$2,$3) id',[plan,'home','Home'])).rows[0].id;
  const b=(await db.query('select sc_create_logo_mapping_family($1,$2,$3) id',[plan,'home','Home'])).rows[0].id;assert.equal(a,b);
  await assert.rejects(db.query('insert into sc_woo_logo_mapping_plans(woo_product_id,source_hash,baseline,created_by,updated_by) values(1,$1,$2,$3,$3)',['b'.repeat(64),{},uid(99)]),/permission denied/);
  await db.exec("set test.role='operator'");assert.equal((await db.query('select * from sc_woo_logo_mapping_plans')).rows.length,0);await assert.rejects(db.query('select sc_create_logo_mapping_family($1,$2,$3)',[plan,'home','Home']),/Manager/);
  await db.exec('reset role');
  assert.equal((await db.query('select * from sc_client_graphic_families')).rows.length,1);
  const variant=(await db.query('select * from sc_client_graphic_variants')).rows;assert.equal(variant.length,1);assert.equal(variant[0].state,'draft');assert.equal(variant[0].width_inches,null);assert.equal(variant[0].process,'Unspecified');
  assert.equal((await db.query('select * from sc_client_graphic_product_bindings')).rows.length,0,'draft association never mutates live certification bindings');
  assert.equal((await db.query('select status from sc_client_graphic_transfer_reviews')).rows[0].status,'pending');
  await assert.rejects(db.query("update sc_woo_logo_mapping_plans set baseline='{}' where id=$1",[plan]),/Baseline is immutable/);
  await assert.rejects(db.exec('delete from sc_woo_logo_mapping_events'),/Immutable/);
  await assert.rejects(db.exec('delete from sc_woo_logo_mapping_plans'),/preserved/);
  await db.exec(`set test.role='manager';insert into sc_variation_certifications values('certified','{"placements":[{"artwork":{"id":"${uid(31)}"}}]}');`);
  const protectedPlan=(await db.query(`insert into sc_woo_logo_mapping_plans(woo_product_id,source_hash,baseline,mappings,created_by,updated_by) values(201,$1,'{"product":{"id":201}}',$2,$3,$3) returning id`,['c'.repeat(64),JSON.stringify({home:{label:'Protected source',artwork_asset_id:uid(31)}}),uid(99)])).rows[0].id;
  await db.exec('set role authenticated');await db.query('select sc_create_logo_mapping_family($1,$2,$3)',[protectedPlan,'home','Protected source']);await db.exec('reset role');
  assert.equal((await db.query('select * from sc_client_graphic_variants')).rows.length,1,'certified source receives no new draft revision');
  assert.equal((await db.query('select status from sc_variation_certifications')).rows[0].status,'certified');
  await db.exec("set role anon");await assert.rejects(db.exec('select * from sc_woo_logo_mapping_plans'),/permission denied/);
 }finally{await db.close();}
});
