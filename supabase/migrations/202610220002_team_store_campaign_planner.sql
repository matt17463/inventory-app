-- Extend existing team-store workflow coordination record; no parallel campaign tables.
alter table public.sc_team_store_workflows
  add column if not exists coordinator_name text not null default '',
  add column if not exists campaign_kind text not null default 'team_store',
  add column if not exists fulfillment_method text not null default 'Team pickup',
  add column if not exists fundraiser_model text not null default 'none',
  add column if not exists fundraiser_flat_amount numeric(12,2) null,
  add column if not exists fundraiser_percent numeric(6,3) null,
  add column if not exists fundraiser_terms text not null default '',
  add column if not exists store_close_date date null,
  add column if not exists customer_approval_at timestamptz null,
  add column if not exists client_contact_reference text null;

do $$ begin
  alter table public.sc_team_store_workflows
    add constraint sc_team_campaign_kind_ck check (campaign_kind in ('team_store','group_order','fundraiser'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.sc_team_store_workflows
    add constraint sc_team_fundraiser_model_ck check (fundraiser_model in ('none','fixed_per_eligible_item','percent_of_eligible_sales','custom'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.sc_team_store_workflows
    add constraint sc_team_fundraiser_values_ck check (
      (fundraiser_flat_amount is null or fundraiser_flat_amount>=0)
      and (fundraiser_percent is null or (fundraiser_percent>=0 and fundraiser_percent<=100))
      and length(fundraiser_terms)<=4000
    );
exception when duplicate_object then null; end $$;

-- Store planning records may be edited by active owner/marketing/production.
-- Client-facing store pages and shoppers are NEVER granted this internal table.
alter table public.sc_team_store_workflows enable row level security;
revoke all on public.sc_team_store_workflows from public, anon, authenticated;
grant select,insert,update on public.sc_team_store_workflows to authenticated;

create policy sc_team_campaign_read on public.sc_team_store_workflows for select to authenticated
  using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer','marketing'])));
create policy sc_team_campaign_insert on public.sc_team_store_workflows for insert to authenticated
  with check ((select public.sc_internal_access_allowed(array['admin','manager','operator','marketing'])) and created_by=(select auth.uid())
    and stage='request' and status='active');
create policy sc_team_campaign_update on public.sc_team_store_workflows for update to authenticated
  using ((select public.sc_internal_access_allowed(array['admin','manager','operator','marketing'])))
  with check ((select public.sc_internal_access_allowed(array['admin','manager','operator','marketing'])));
