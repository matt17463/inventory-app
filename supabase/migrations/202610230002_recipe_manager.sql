-- Non-destructive organization metadata for production recipes
create table if not exists public.sc_recipe_folders (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(trim(name)) between 1 and 80),
 parent_id uuid references public.sc_recipe_folders(id) on delete set null,
 position integer not null default 0,
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now()
);
alter table public.sc_manufacturing_recipes
 add column if not exists scope text not null default 'master' check (scope in ('master','client','order')),
 add column if not exists folder_id uuid references public.sc_recipe_folders(id) on delete set null,
 add column if not exists customer_label text not null default '',
 add column if not exists order_reference text not null default '',
 add column if not exists tags text[] not null default '{}',
 add column if not exists is_archived boolean not null default false,
 add column if not exists is_favorite boolean not null default false,
 add column if not exists sort_order integer not null default 0;
create index if not exists sc_recipes_manager_idx on public.sc_manufacturing_recipes(scope,folder_id,is_archived);
alter table public.sc_recipe_folders enable row level security;
revoke all on public.sc_recipe_folders from public,anon,authenticated;
grant select,insert,update on public.sc_recipe_folders to authenticated;
create policy sc_rf_read on public.sc_recipe_folders for select to authenticated using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer'])));
create policy sc_rf_insert on public.sc_recipe_folders for insert to authenticated with check ((select public.sc_internal_access_allowed(array['admin','manager'])) and created_by=(select auth.uid()));
create policy sc_rf_update on public.sc_recipe_folders for update to authenticated using ((select public.sc_internal_access_allowed(array['admin','manager']))) with check ((select public.sc_internal_access_allowed(array['admin','manager'])));
grant update (scope,folder_id,customer_label,order_reference,tags,is_archived,is_favorite,sort_order) on public.sc_manufacturing_recipes to authenticated;
create policy sc_mr_metadata_update on public.sc_manufacturing_recipes for update to authenticated
 using ((select public.sc_internal_access_allowed(array['admin','manager'])))
 with check ((select public.sc_internal_access_allowed(array['admin','manager'])));
