-- Product & Event Center release: additive to existing CRM, material, manufacturing, and traveler tables.
-- No live orders, invoices, artwork, WooCommerce listings, or source recipes are changed by this migration.
create table if not exists public.sc_pdc_opportunities (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 3 and 180),
 category text not null default 'Weddings & Events' check (length(category)<=100),
 audience text not null default '' check (length(audience)<=300),
 description text not null default '' check (length(description)<=4000),
 equipment text[] not null default '{}',
 status text not null default 'idea' check (status in ('idea','researching','sample','validated','live','retired')),
 demand_score integer not null default 0 check (demand_score between 0 and 100),
 customer_fit integer not null default 0 check (customer_fit between 0 and 100),
 production_fit integer not null default 0 check (production_fit between 0 and 100),
 differentiation_score integer not null default 0 check (differentiation_score between 0 and 100),
 cost_model jsonb not null default '{}'::jsonb check (jsonb_typeof(cost_model)='object'),
 material_recipe_id uuid references public.sc_material_recipes(id) on delete set null,
 crm_opportunity_id uuid references public.sc_growth_opportunities(id) on delete set null,
 notes text not null default '' check (length(notes)<=5000),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists sc_pdc_opportunities_status on public.sc_pdc_opportunities(status,updated_at desc);

create table if not exists public.sc_pdc_sources (
 id uuid primary key default gen_random_uuid(),
 opportunity_id uuid not null references public.sc_pdc_opportunities(id) on delete cascade,
 title text not null check(length(trim(title)) between 3 and 200),
 source_url text not null check(source_url ~ '^https://[^ ]{5,1000}$'),
 source_type text not null check(source_type in ('manufacturer','supplier','public_community','marketplace','shop_observation','other')),
 summary text not null default '' check(length(summary)<=4000),
 verified boolean not null default false,
 recorded_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists sc_pdc_sources_by_opportunity on public.sc_pdc_sources(opportunity_id,created_at desc);

create table if not exists public.sc_pdc_trials (
 id uuid primary key default gen_random_uuid(),
 opportunity_id uuid not null references public.sc_pdc_opportunities(id) on delete cascade,
 recipe_id uuid not null references public.sc_material_recipes(id) on delete restrict,
 recipe_version integer not null check(recipe_version>0),
 material_lot text not null default '' check(length(material_lot)<=150),
 result text not null check(result in ('pass','fail','needs_adjustment')),
 observed_settings jsonb not null default '{}'::jsonb check(jsonb_typeof(observed_settings)='object'),
 observations text not null default '' check(length(observations)<=4000),
 photo_url text check(photo_url is null or photo_url ~ '^https://[^ ]{5,1000}$'),
 recorded_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists sc_pdc_trials_lookup on public.sc_pdc_trials(opportunity_id,recipe_id,created_at desc);

create table if not exists public.sc_pdc_events (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 3 and 180),
 event_type text not null check(event_type in ('wedding','coach_recognition','sports_banquet','graduation','corporate','anniversary','other')),
 event_date date,
 guest_count integer not null default 0 check(guest_count between 0 and 100000),
 table_count integer not null default 0 check(table_count between 0 and 10000),
 client_name text not null default '' check(length(client_name)<=250),
 theme jsonb not null default '{}'::jsonb check(jsonb_typeof(theme)='object'),
 account_id uuid references public.sc_growth_accounts(id) on delete set null,
 crm_opportunity_id uuid references public.sc_growth_opportunities(id) on delete set null,
 quote_id bigint,
 production_job_id bigint,
 status text not null default 'draft' check(status in ('draft','quoted','approved','production','fulfilled','cancelled')),
 instructions text not null default '' check(length(instructions)<=5000),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists sc_pdc_event_due on public.sc_pdc_events(event_date,status);

create table if not exists public.sc_pdc_event_items (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.sc_pdc_events(id) on delete cascade,
 opportunity_id uuid references public.sc_pdc_opportunities(id) on delete set null,
 label text not null check(length(trim(label)) between 2 and 200),
 quantity integer not null check(quantity between 1 and 100000),
 unit_cost numeric(12,2) not null default 0 check(unit_cost>=0),
 unit_price numeric(12,2) not null default 0 check(unit_price>=0),
 material_recipe_id uuid references public.sc_material_recipes(id) on delete set null,
 proof_status text not null default 'draft' check(proof_status in ('draft','pending','approved','revision_requested')),
 approved_artwork_revision text not null default '' check(length(approved_artwork_revision)<=150),
 job_reference text not null default '' check(length(job_reference)<=120),
 personalization jsonb not null default '[]'::jsonb check(jsonb_typeof(personalization)='array' and jsonb_array_length(personalization)<=2000),
 notes text not null default '' check(length(notes)<=4000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists sc_pdc_event_items_by_event on public.sc_pdc_event_items(event_id);

create table if not exists public.sc_pdc_launches (
 id uuid primary key default gen_random_uuid(),
 opportunity_id uuid not null references public.sc_pdc_opportunities(id) on delete cascade,
 channel text not null check(channel in ('woocommerce','quote','manual','crm')),
 state text not null default 'draft' check(state in ('draft','ready','published')),
 listing_reference text not null default '' check(length(listing_reference)<=300),
 notes text not null default '' check(length(notes)<=3000),
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 unique (opportunity_id,channel)
);

create table if not exists public.sc_pdc_performance (
 id uuid primary key default gen_random_uuid(),
 opportunity_id uuid not null references public.sc_pdc_opportunities(id) on delete cascade,
 period_month date not null check(period_month=date_trunc('month',period_month)::date),
 units_sold integer not null default 0 check(units_sold>=0),
 sales_revenue numeric(14,2) not null default 0 check(sales_revenue>=0),
 total_variable_cost numeric(14,2) not null default 0 check(total_variable_cost>=0),
 scrapped_units integer not null default 0 check(scrapped_units>=0),
 active_labor_minutes numeric(14,2) not null default 0 check(active_labor_minutes>=0),
 machine_minutes numeric(14,2) not null default 0 check(machine_minutes>=0),
 notes text not null default '' check(length(notes)<=3000),
 recorded_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(opportunity_id,period_month)
);

-- Persisting an unapproved recipe, missing customer proof, or nonexistent external listing
-- must never silently produce a ready-to-manufacture or published record.
create or replace function public.sc_pdc_validate_launch()
returns trigger language plpgsql set search_path = pg_catalog,public as $$
declare selected_recipe uuid; selected_status text; selected_version integer;
begin
 if new.state in ('ready','published') then
   select material_recipe_id,status into selected_recipe,selected_status from public.sc_pdc_opportunities where id=new.opportunity_id;
   if selected_status not in ('validated','live') or selected_recipe is null then
     raise exception 'Validate product opportunity and select an approved recipe first';
   end if;
   select version into selected_version from public.sc_material_recipes
      where id=selected_recipe and status='approved';
   if selected_version is null or not exists (
     select 1 from public.sc_pdc_trials
     where opportunity_id=new.opportunity_id and recipe_id=selected_recipe
       and recipe_version=selected_version and result='pass'
   ) then
     raise exception 'Current approved recipe version requires a passing physical trial';
   end if;
   if new.state='published' and trim(new.listing_reference)='' then
     raise exception 'An external listing reference is required to mark an item published';
   end if;
   new.approved_by=auth.uid(); new.approved_at=now();
 end if;
 return new;
end $$;
drop trigger if exists sc_pdc_launch_gate on public.sc_pdc_launches;
create trigger sc_pdc_launch_gate before insert or update on public.sc_pdc_launches
 for each row execute function public.sc_pdc_validate_launch();

create or replace function public.sc_pdc_validate_event()
returns trigger language plpgsql set search_path = pg_catalog,public as $$
begin
 if new.status in ('production','fulfilled') then
   if not exists(select 1 from public.sc_pdc_event_items where event_id=new.id) then
     raise exception 'Package needs items before production';
   end if;
   if exists (
     select 1 from public.sc_pdc_event_items i
     left join public.sc_material_recipes r on r.id=i.material_recipe_id
     where i.event_id=new.id and
      (i.proof_status<>'approved' or i.approved_artwork_revision='' or r.status is distinct from 'approved')
   ) then
     raise exception 'Each item needs approved proof, artwork revision and approved material recipe';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists sc_pdc_event_gate on public.sc_pdc_events;
create trigger sc_pdc_event_gate before insert or update on public.sc_pdc_events
 for each row execute function public.sc_pdc_validate_event();

-- Lock down the approval triggers so a material change cannot invalidate a running event silently:
-- item changes return the event to review in the UI; production launch must be explicit.
create or replace function public.sc_pdc_touch_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin new.updated_at=now();return new;end $$;
do $$
declare t text;
begin
 foreach t in array array['sc_pdc_opportunities','sc_pdc_events','sc_pdc_event_items','sc_pdc_performance'] loop
   execute format('drop trigger if exists sc_pdc_touch on public.%I',t);
   execute format('create trigger sc_pdc_touch before update on public.%I for each row execute function public.sc_pdc_touch_updated_at()',t);
 end loop;
end $$;

do $$
declare t text;
begin
 foreach t in array array['sc_pdc_opportunities','sc_pdc_sources','sc_pdc_trials','sc_pdc_events','sc_pdc_event_items','sc_pdc_launches','sc_pdc_performance'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy pdc_staff_read on public.%I for select to authenticated using (public.sc_current_app_role() in (''admin'',''manager'',''operator'',''marketing''))',t);
 end loop;
end $$;
-- Business research and event design can be edited by CRM users; manufacturing trial capture by operators;
-- approvals and actual sales results remain admin/manager only.
do $$
declare t text;
begin
 foreach t in array array['sc_pdc_opportunities','sc_pdc_sources','sc_pdc_events','sc_pdc_event_items'] loop
  execute format('grant insert,update on public.%I to authenticated',t);
  execute format('create policy pdc_staff_insert on public.%I for insert to authenticated with check (public.sc_current_app_role() in (''admin'',''manager'',''marketing''))',t);
  execute format('create policy pdc_staff_update on public.%I for update to authenticated using (public.sc_current_app_role() in (''admin'',''manager'',''marketing'')) with check (public.sc_current_app_role() in (''admin'',''manager'',''marketing''))',t);
 end loop;
end $$;
grant insert on public.sc_pdc_trials to authenticated;
create policy pdc_trials_insert on public.sc_pdc_trials for insert to authenticated
 with check(recorded_by=(select auth.uid()) and public.sc_current_app_role() in ('admin','manager','operator'));
grant insert,update on public.sc_pdc_launches,public.sc_pdc_performance to authenticated;
create policy pdc_launch_insert on public.sc_pdc_launches for insert to authenticated
 with check(public.sc_current_app_role() in ('admin','manager'));
create policy pdc_launch_update on public.sc_pdc_launches for update to authenticated
 using(public.sc_current_app_role() in ('admin','manager'))
 with check(public.sc_current_app_role() in ('admin','manager'));
create policy pdc_performance_insert on public.sc_pdc_performance for insert to authenticated
 with check(recorded_by=(select auth.uid()) and public.sc_current_app_role() in ('admin','manager'));
create policy pdc_performance_update on public.sc_pdc_performance for update to authenticated
 using(public.sc_current_app_role() in ('admin','manager'))
 with check(recorded_by=(select auth.uid()) and public.sc_current_app_role() in ('admin','manager'));

-- Machine registry extension: printer-side sublimation recipe is distinct from heat-press recipe.
alter table public.sc_material_recipes drop constraint if exists sc_material_recipes_machine_type_check;
alter table public.sc_material_recipes add constraint sc_material_recipes_machine_type_check
 check(machine_type in ('mopa_fiber','xtool_s1','xtool_p2','xtool_omni','heat_press','sublimation_press','roland_bn2','sawgrass_sg500'));

-- A production/fulfilled package cannot have item specifications changed without reopening it.
create or replace function public.sc_pdc_freeze_event_item()
returns trigger language plpgsql set search_path = pg_catalog,public as $
declare current_state text;
begin
 select status into current_state from public.sc_pdc_events where id=old.event_id;
 if current_state in ('production','fulfilled') then
   raise exception 'Reopen the event to draft and re-approve proofs before altering production items';
 end if;
 if (new.quantity,new.material_recipe_id,new.personalization,new.label,new.unit_price)
    is distinct from (old.quantity,old.material_recipe_id,old.personalization,old.label,old.unit_price)
    and old.proof_status='approved' then
    new.proof_status='draft';
    new.approved_artwork_revision='';
 end if;
 return new;
end $;
drop trigger if exists sc_pdc_event_item_freeze on public.sc_pdc_event_items;
create trigger sc_pdc_event_item_freeze before update on public.sc_pdc_event_items
 for each row execute function public.sc_pdc_freeze_event_item();


-- Append-only sources and trials, no DELETE privilege for staff.
