import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
const recipeSql=read('../../supabase/migrations/202610220001_manufacturing_recipes_travelers.sql');
const teamSql=read('../../supabase/migrations/202610220002_team_store_campaign_planner.sql');

test('recipe and job traveler migrations preserve one authoritative job/inventory source',()=>{
  for(const v of ['sc_manufacturing_recipes','sc_manufacturing_recipe_versions','sc_job_travelers','sc_job_traveler_events'])
    assert.match(recipeSql,new RegExp(v));
  assert.match(recipeSql,/job_id bigint not null references public\.jobs\(id\)/);
  assert.match(recipeSql,/job_item_id bigint not null references public\.job_items\(id\)/);
  assert.match(recipeSql,/unique\(job_item_id\)/);
  assert.match(recipeSql,/recipe_snapshot := jsonb_build_object/);
  assert.match(recipeSql,/status='approved'/);
  assert.match(recipeSql,/A verified and approved recipe version is required/);
  assert.doesNotMatch(recipeSql,/\bupdate public\.(?:jobs|job_items|inventory_movements)\b/i);
  assert.doesNotMatch(recipeSql,/\bcreate\s+table\s+.*\b(?:jobs|job_items)\b/i);
});

test('no anonymous permissions or public travelers; recipe revisions remain immutable',()=>{
  assert.match(recipeSql,/revoke all .* from public, anon, authenticated/);
  assert.match(recipeSql,/create policy sc_jt_read .* to authenticated/);
  assert.match(recipeSql,/sc_internal_access_allowed\(array\['admin','manager','operator','viewer'\]\)/);
  assert.match(recipeSql,/Recipe version is immutable/);
  assert.match(recipeSql,/new\.approved_by is distinct from auth\.uid\(\)/);
  assert.match(recipeSql,/actor_id=\(select auth\.uid\(\)\)/);
  assert.doesNotMatch(recipeSql,/grant .* to anon;/i);
});

test('team campaign augments existing table with grants restricted from public',()=>{
  assert.match(teamSql,/alter table public\.sc_team_store_workflows/);
  assert.match(teamSql,/fundraiser_percent/);
  assert.match(teamSql,/fundraiser_flat_amount/);
  assert.match(teamSql,/revoke all .* from public, anon, authenticated/);
  assert.match(teamSql,/sc_internal_access_allowed\(array\['admin','manager','operator','marketing'\]\)/);
  assert.doesNotMatch(teamSql,/grant .* to anon;/i);
});

test('recipe and traveler pages are connected to operation routes and Work Hub',()=>{
  const app=read('../../src/App.jsx');
  const nav=read('../../src/navigationConfig.js');
  const hub=read('../../src/WorkHub.jsx');
  const travel=read('../../src/ProductionTravelers.jsx');
  for(const path of ['/manufacturing-recipes','/production-travelers','/production-travelers/:travelerId'])assert(app.includes('path="'+path+'"'));
  assert(nav.includes('QR Job Travelers'));assert(nav.includes('Production Recipe Library'));
  assert(hub.includes("deriveGuidedProgress"));
  assert(hub.includes("Open the correct tool"));
  assert(read('../../src/lib/guidedJobProgress.js').includes("/production-travelers"));
  assert(travel.includes('recipe_snapshot'));
  assert(travel.includes('signedAssetUrl'));
  assert(travel.includes('LocalQrCode'));
  assert(travel.includes('GarmentPlacementGuide'));
});

test('preflight stores original and approved-for-review derivative in existing R2 mockup records',()=>{
  const file=read('../../src/ArtworkPreflight.jsx');
  assert(file.includes("addArtworkAsset"));
  assert(file.includes("preflight_status:'warning'"));
  assert(file.includes("source_artwork_asset_id:sourceId"));
  assert(file.includes("file_role:'original'"));
  assert(!file.includes("preflight_status:'passed'"));
});
test('team campaign saves and loads existing sc_team_store_workflows with numeric fundraiser controls',()=>{
  const file=read('../../src/TeamStoreLaunchpad.jsx');
  assert(file.includes("sc_team_store_workflows"));
  assert(file.includes("fundraiser_flat_amount"));
  assert(file.includes("fundraiser_percent"));
  assert(file.includes("stage:'request'"));
  assert(file.includes("status:'active'"));
});
