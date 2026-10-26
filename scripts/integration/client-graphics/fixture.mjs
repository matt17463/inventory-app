import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export const root=fileURLToPath(new URL('../../../',import.meta.url));
export const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read=p=>readFile(root+p,'utf8');
function table(sql,name){const start=sql.indexOf('create table if not exists public.'+name+' (');if(start<0)throw Error(name);return sql.slice(start,sql.indexOf('\n);',start)+4)}
function fn(sql,name){const start=sql.indexOf('create or replace function public.'+name+'(');const end=sql.indexOf('$$;',start);return sql.slice(start,end+3)}
export const graphicsMigrations=['202610250001_client_graphics_foundation.sql','202610250002_order_graphics_job_line_link.sql','202610250003_traveler_graphics_guard.sql','202610250004_woo_graphic_capture_states.sql'];
export async function fixture(){
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;`);
 await db.exec(await read('scripts/integration/client-graphics/base-tables.sql'));
 await db.exec(await read('supabase/migrations/202607250301_step4_employee_roles_and_security_audit.sql'));
 await db.exec(fn(await read('supabase/migrations/20261016155956_internal_access_and_sync_boundaries.sql'),'sc_internal_access_allowed'));
 await db.exec('revoke all on function public.sc_internal_access_allowed(text[]) from public,anon;grant execute on function public.sc_internal_access_allowed(text[]) to authenticated,service_role');
 const mockups=await read('supabase/migrations/202608180100_mockup_studio_all_phases.sql');
 await db.exec(table(mockups,'mockup_projects'));await db.exec(table(mockups,'mockup_artwork_assets'));
 await db.exec(table(await read('supabase/migrations/202610200001_uv_studio_material_recipes.sql'),'sc_material_recipes'));
 // gen_random_uuid is built into PostgreSQL; PGlite does not ship pgcrypto.
 for(const p of ['202610220001_manufacturing_recipes_travelers.sql','202610230001_grouped_production_travelers.sql','202610230002_recipe_manager.sql',...graphicsMigrations]){
  await db.exec((await read('supabase/migrations/'+p)).replace('create extension if not exists pgcrypto;',''));console.log('APPLIED',p);
 }
 for(const p of graphicsMigrations)await db.exec(await read('supabase/migrations/'+p));
 console.log('REAPPLIED all four graphics migrations');
 for(const [n,role] of [[1,'admin'],[2,'manager'],[3,'operator'],[4,'viewer']])await db.exec(`insert into auth.users values('${uid(n)}');insert into sc_app_user_roles(user_id,role) values('${uid(n)}','${role}')`);
 await db.exec(`insert into mockup_projects(id,project_name) values('${uid(10)}','Isolated school');insert into mockup_artwork_assets(id,project_id,artwork_name,storage_path,preflight_status,mime_type) values('${uid(11)}','${uid(10)}','Test front','fixtures/front.png','passed','image/png'),('${uid(12)}','${uid(10)}','Test youth','fixtures/youth.png','passed','image/png'),('${uid(13)}','${uid(10)}','Failed file','fixtures/failed.png','failed','image/png');
 insert into sc_client_graphic_families(id,name,state) values('${uid(20)}','School A','approved'),('${uid(21)}','School B','approved'),('${uid(22)}','School C','approved');
 insert into sc_manufacturing_recipes(id,name,created_by) values('${uid(30)}','School hoodie','${uid(2)}');
 insert into sc_manufacturing_recipe_versions(id,recipe_id,revision,placements,artwork_asset_id,verified_sample,status,approved_by,approved_at,created_by) values('${uid(31)}','${uid(30)}',1,'[{"placement_name":"full_front","artwork_asset_id":"${uid(11)}","print_width_inches":10,"print_height_inches":10,"top_offset_inches":3,"center_offset_inches":0,"reference_landmark":"neckline","size_group":"adult"}]','${uid(11)}',true,'approved','${uid(2)}',now(),'${uid(2)}');
 insert into sc_client_graphic_variants(id,family_id,artwork_asset_id,label,state,width_inches,height_inches) values('${uid(40)}','${uid(20)}','${uid(11)}','Adult','approved',10,10),('${uid(41)}','${uid(20)}','${uid(12)}','Youth','approved',8,8);
 insert into sc_client_graphic_rules(id,family_id,variant_id,priority,size_group,placement_name,enabled) values('${uid(50)}','${uid(20)}','${uid(40)}',100,'adult','full_front',true),('${uid(51)}','${uid(20)}','${uid(41)}',100,'youth','full_front',true);
 insert into sc_client_graphic_product_bindings(woo_product_id,graphic_family_id,mode,allowed,verified_at) values(700,'${uid(20)}','selectable',true,now());`);
 return db;
}
export async function asRole(db,role,run){await db.exec('begin');try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[role==='anon'?'':uid({admin:1,manager:2,operator:3,viewer:4}[role])]);await db.exec('set local role '+(role==='anon'?'anon':'authenticated'));const r=await run();await db.exec('commit');return r}catch(e){await db.exec('rollback');throw e}}
export async function job(db,n,{woo=true,quantity=10}={}){await db.query('insert into jobs(id,customer_name,job_name,woocommerce_order_id,source_invoice_number) values($1,$2,$3,$4,$5)',[n,'Fictional school','Isolated job '+n,woo?10000+n:null,woo?null:'INV-'+n]);await db.query('insert into job_items(id,job_id,quantity,woocommerce_line_item_id,color,size,selected_color,selected_size,ordered_product_name) values($1,$2,$3,$4,$5,$6,$5,$6,$7)',[n*10,n,quantity,woo?20000+n:null,'Black','M','Soccer hoodie']);return n*10}
export async function selection(db,n,{art=uid(11),status='resolved',placement='full_front',linked=false}={}){await db.query(`insert into sc_order_graphic_selections(source,external_order_id,external_line_id,job_item_id,family_id,selected_label,selected_payload,resolution_snapshot) values($1,$2,$3,$4,$5,'School A',$6,$7)`,[linked?'quickbooks':'woocommerce',linked?'INV-'+n:String(10000+n),linked?'QBO-LINE-1':String(20000+n),linked?n*10:null,uid(20),{placement_name:placement},{status,artworkAssetId:art,variantId:uid(40),dimensions:{width_inches:10,height_inches:10},process:'DTF'}])}
export const rpc=(db,n,items=[n*10])=>db.query('select sc_create_grouped_traveler($1,$2,$3) as id',[n,items,uid(31)]);
