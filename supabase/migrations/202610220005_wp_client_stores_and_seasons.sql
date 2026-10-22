-- Client WordPress storefront publishing, approved seasonal cloning and read-only team purchasing.
-- Existing sc_team_store_workflows remains authoritative; Woo and QBO order records are unchanged.
alter table public.sc_team_store_workflows
 add column if not exists wp_category_id bigint,
 add column if not exists wp_store_post_id bigint,
 add column if not exists wp_store_url text,
 add column if not exists wp_template text not null default 'athletics',
 add column if not exists wp_primary_color text not null default '#16443b',
 add column if not exists wp_secondary_color text not null default '#f0b83a',
 add column if not exists wp_accent_color text not null default '#f6f9fb',
 add column if not exists wp_logo_media_id bigint,
 add column if not exists wp_headline text not null default '',
 add column if not exists ordering_instructions text not null default '',
 add column if not exists delivery_instructions text not null default '',
 add column if not exists season_label text not null default '',
 add column if not exists cloned_from_campaign_id uuid references public.sc_team_store_workflows(id) on delete set null,
 add column if not exists wp_draft_created_at timestamptz,
 add column if not exists wp_published_at timestamptz;

do $$ begin
 alter table public.sc_team_store_workflows add constraint scs_wp_theme_enum
 check (wp_template in ('athletics','scholastic','business','fundraising'));
exception when duplicate_object then null; end $$;
do $$ begin
 alter table public.sc_team_store_workflows add constraint scs_wp_color_hex
 check (wp_primary_color ~ '^#[0-9a-fA-F]{6}$'
  and wp_secondary_color ~ '^#[0-9a-fA-F]{6}$'
  and wp_accent_color ~ '^#[0-9a-fA-F]{6}$');
exception when duplicate_object then null; end $$;
do $$ begin
 alter table public.sc_team_store_workflows add constraint scs_wp_category_channel
 check (order_channel='woocommerce' or wp_category_id is null);
exception when duplicate_object then null; end $$;
create index if not exists scs_wp_category_idx on public.sc_team_store_workflows(wp_category_id)
 where wp_category_id is not null;

-- Coordinator token is a high-entropy bearer secret, stored only as a SHA256 digest.
-- No anonymous table access and no customer PII in the response.
create table if not exists public.sc_team_coordinator_access (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.sc_team_store_workflows(id) on delete cascade,
 token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
 created_by uuid not null,
 expires_at timestamptz not null,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists scs_coordinator_campaign_idx on public.sc_team_coordinator_access(campaign_id);
alter table public.sc_team_coordinator_access enable row level security;
revoke all on public.sc_team_coordinator_access from public,anon,authenticated;

-- Group both billing channels by real production jobs; do not count unconverted forms
-- or paid order lines that have no mapped production job.
create or replace function public.sc_team_campaign_purchasing(p_campaign_id uuid)
returns table(blank_product_id uuid, sku text, style text, brand text, color text,
 size text, open_job_lines bigint, open_units numeric, catalog_available numeric,
 purchasing_note text)
language plpgsql security definer set search_path = ''
as $fn$
begin
 if not public.sc_internal_access_allowed(array['admin','manager','operator','marketing']) then
  raise exception 'Production purchasing permission required' using errcode='42501';
 end if;
 return query
 with campaign as (
  select id,order_channel from public.sc_team_store_workflows where id=p_campaign_id
 ), source_item_ids as (
  select distinct i.id from public.job_items i
  join public.jobs j on j.id=i.job_id
  join campaign c on c.order_channel='woocommerce'
  join public.sc_team_store_order_lines l on l.campaign_id=c.id
   and l.woo_order_id=j.woocommerce_order_id
   and l.woo_line_item_id=i.woocommerce_line_item_id
   and l.payment_confirmed=true and l.quantity>l.refunded_quantity
  union
  select distinct i.id from public.job_items i
  join public.jobs j on j.id=i.job_id
  join public.sc_client_order_requests o on o.generated_job_id=j.id
  join campaign c on c.order_channel='quickbooks_invoice' and o.campaign_id=c.id
  where o.payment_received_at is not null
 ),
 demand as (
  select i.blank_product_id,coalesce(nullif(i.order_sku,''),nullif(i.sku,''),'Unmapped') demand_sku,
    max(coalesce(i.selected_style,i.name,i.item_name,'')) demand_style,
    max(coalesce(i.selected_brand,i.brand,'')) demand_brand,
    coalesce(i.selected_color,i.color,'') demand_color,
    coalesce(i.selected_size,i.size,'') demand_size,
    count(*) line_count,sum(greatest(0,i.quantity)) unit_count
  from public.job_items i
  join source_item_ids s on s.id=i.id
  where lower(coalesce(i.status,'')) not in
  ('complete','completed','cancelled','canceled','void','voided','returned','consumed','removed','released')
    and coalesce(i.inventory_required,true)=true
  group by i.blank_product_id,coalesce(nullif(i.order_sku,''),nullif(i.sku,''),'Unmapped'),
    coalesce(i.selected_color,i.color,''),coalesce(i.selected_size,i.size,'')
 ), available as (
  select v.blank_product_id,max(v.available_quantity) as qty
  from public.app_synced_inventory_catalog_v1 v
  where v.blank_product_id is not null group by v.blank_product_id
 )
 select d.blank_product_id,d.demand_sku,d.demand_style,d.demand_brand,d.demand_color,d.demand_size,
   d.line_count,d.unit_count,a.qty,
   case when d.blank_product_id is null then 'Not paired: resolve product mapping'
    when a.qty is null then 'Inventory availability unknown: verify'
    else 'Demand only; verify existing reservations and Purchasing Report before ordering' end
 from demand d left join available a on a.blank_product_id=d.blank_product_id
 order by d.demand_brand,d.demand_style,d.demand_color,d.demand_size;
end $fn$;
revoke all on function public.sc_team_campaign_purchasing(uuid) from public,anon;
grant execute on function public.sc_team_campaign_purchasing(uuid) to authenticated;


-- Protect published layout/category settings from direct browser writes.
create or replace function public.scs_guard_published_wp_details()
returns trigger language plpgsql security invoker set search_path='' as $scs$
begin
 if old.stage in ('live','complete') and
  (new.wp_category_id,new.wp_store_post_id,new.wp_store_url,new.wp_template,new.wp_primary_color,
   new.wp_secondary_color,new.wp_accent_color,new.wp_logo_media_id,new.wp_headline,
   new.ordering_instructions,new.delivery_instructions,new.season_label)
  is distinct from
  (old.wp_category_id,old.wp_store_post_id,old.wp_store_url,old.wp_template,old.wp_primary_color,
   old.wp_secondary_color,old.wp_accent_color,old.wp_logo_media_id,old.wp_headline,
   old.ordering_instructions,old.delivery_instructions,old.season_label)
  and coalesce(auth.jwt()->>'role','') <> 'service_role'
 then raise exception 'Published WordPress designs require the verified server workflow' using errcode='42501';
 end if;
 return new;
end $scs$;
drop trigger if exists scs_guard_published_wp_details on public.sc_team_store_workflows;
create trigger scs_guard_published_wp_details before update on public.sc_team_store_workflows
for each row execute function public.scs_guard_published_wp_details();
