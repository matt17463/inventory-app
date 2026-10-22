-- Campaign storefronts use dedicated, published WooCommerce products. Checkout and payment remain in WooCommerce.
-- The existing sc_team_store_workflows is the canonical campaign record.
alter table public.sc_team_store_workflows
  add column if not exists storefront_slug text,
  add column if not exists storefront_description text not null default '',
  add column if not exists published_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists approved_by uuid,
  add column if not exists last_reconciled_at timestamptz,
  add column if not exists scan_started_at timestamptz;

create unique index if not exists sc_team_store_slug_unique on public.sc_team_store_workflows(lower(storefront_slug))
  where storefront_slug is not null;
do $$ begin
  alter table public.sc_team_store_workflows add constraint sc_team_store_slug_format_check
  check (storefront_slug is null or storefront_slug ~ '^[a-z0-9][a-z0-9-]{2,59}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.sc_team_store_workflows add constraint sc_team_store_desc_length_check
  check (char_length(storefront_description) <= 2500);
exception when duplicate_object then null; end $$;

create table if not exists public.sc_team_store_products(
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sc_team_store_workflows(id) on delete restrict,
  woo_product_id bigint not null unique check (woo_product_id > 0),
  product_name text not null,
  product_permalink text not null,
  image_url text,
  display_price numeric(12,2),
  currency text not null default 'USD',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique(campaign_id, woo_product_id),
  constraint sc_team_product_amount check (display_price is null or display_price >= 0)
);
create index if not exists sc_team_store_products_campaign_idx on public.sc_team_store_products(campaign_id);

-- Order lines are synchronized only by the privileged reconciliation function from actual Woo orders.
-- The ledger has no customer names, emails, payment credentials or retail tax/shipping amounts.
create table if not exists public.sc_team_store_order_lines(
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sc_team_store_workflows(id) on delete restrict,
  woo_order_id bigint not null check (woo_order_id>0),
  woo_line_item_id bigint not null check (woo_line_item_id>0),
  woo_product_id bigint not null,
  order_placed_at timestamptz,
  woo_order_status text not null,
  payment_confirmed boolean not null default false,
  quantity integer not null check(quantity>=0),
  refunded_quantity integer not null default 0 check(refunded_quantity>=0),
  net_eligible_sales numeric(12,2) not null default 0 check (net_eligible_sales>=0),
  fundraiser_estimated numeric(12,2) not null default 0 check(fundraiser_estimated>=0),
  refund_requires_review boolean not null default false,
  synced_at timestamptz not null default now(),
  unique (campaign_id,woo_order_id,woo_line_item_id)
);
create index if not exists sc_team_store_order_lines_campaign_idx on public.sc_team_store_order_lines(campaign_id,order_placed_at desc);
create index if not exists sc_team_store_order_lines_order_idx on public.sc_team_store_order_lines(woo_order_id);

-- Roster/packing plans are internal. They are NOT shopper accounts, checkout or payment records.
create table if not exists public.sc_team_store_roster(
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sc_team_store_workflows(id) on delete restrict,
  recipient_name text not null check (char_length(trim(recipient_name)) between 1 and 120),
  jersey_number text not null default '',
  garment_size text not null default '',
  product_note text not null default '',
  group_name text not null default '',
  qty integer not null default 1 check(qty between 1 and 999),
  packing_status text not null default 'pending' check(packing_status in ('pending','packed','handed_off')),
  woo_order_id bigint,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sc_team_store_roster_campaign_idx on public.sc_team_store_roster(campaign_id);

create or replace function public.sc_guard_team_campaign_stage()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare privileged boolean;
begin
  privileged := (public.sc_current_app_role() in ('admin','manager')
                 or coalesce(auth.jwt()->>'role','') = 'service_role');
  if new.customer_approval_at is distinct from old.customer_approval_at
     or new.approved_by is distinct from old.approved_by then
    if not privileged then raise exception 'Campaign approval requires a manager' using errcode='42501'; end if;
  end if;
  if old.stage in ('live','complete') then
    if (new.fundraiser_model,new.fundraiser_flat_amount,new.fundraiser_percent,new.fundraiser_terms)
       is distinct from (old.fundraiser_model,old.fundraiser_flat_amount,old.fundraiser_percent,old.fundraiser_terms) then
      raise exception 'Fundraiser terms locked after publication; reconcile before starting a new campaign' using errcode='42501';
    end if;
  end if;
  if new.stage in ('live','complete') and new.stage is distinct from old.stage then
    if not privileged then raise exception 'Only a manager may publish or close a campaign' using errcode='42501'; end if;
    if new.stage='live' then
      if new.customer_approval_at is null or new.storefront_slug is null
         or new.published_at is null or
         (new.store_close_date is not null and new.store_close_date < current_date) or
         not exists (select 1 from public.sc_team_store_products where campaign_id=new.id)
      then raise exception 'Campaign requires customer approval, a valid slug, an unexpired deadline, and Woo products' using errcode='23514'; end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists sc_guard_team_campaign_stage on public.sc_team_store_workflows;
create trigger sc_guard_team_campaign_stage before update on public.sc_team_store_workflows
for each row execute function public.sc_guard_team_campaign_stage();

create or replace function public.sc_guard_team_store_product()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare stage text;
begin
 select c.stage into stage from public.sc_team_store_workflows c where c.id=coalesce(new.campaign_id,old.campaign_id);
 if stage in ('live','complete') then
   raise exception 'Published campaign products are locked; close or reconfigure a new campaign' using errcode='42501';
 end if;
 return coalesce(new,old);
end $$;
drop trigger if exists sc_guard_team_store_product on public.sc_team_store_products;
create trigger sc_guard_team_store_product before insert or update or delete on public.sc_team_store_products
for each row execute function public.sc_guard_team_store_product();

alter table public.sc_team_store_products enable row level security;
alter table public.sc_team_store_order_lines enable row level security;
alter table public.sc_team_store_roster enable row level security;
revoke all on public.sc_team_store_products,public.sc_team_store_order_lines,public.sc_team_store_roster
  from public,anon,authenticated;
grant select on public.sc_team_store_products,public.sc_team_store_order_lines to authenticated;
grant select,insert,update,delete on public.sc_team_store_roster to authenticated;

create policy sc_team_products_internal_read on public.sc_team_store_products for select to authenticated
using ((select public.sc_internal_access_allowed(array['admin','manager','operator','marketing','viewer'])));
create policy sc_team_sales_internal_read on public.sc_team_store_order_lines for select to authenticated
using ((select public.sc_internal_access_allowed(array['admin','manager','marketing'])));
create policy sc_team_roster_read on public.sc_team_store_roster for select to authenticated
using ((select public.sc_internal_access_allowed(array['admin','manager','operator','marketing'])));
create policy sc_team_roster_add on public.sc_team_store_roster for insert to authenticated
with check ((select public.sc_internal_access_allowed(array['admin','manager','operator','marketing'])) and created_by=(select auth.uid()));
create policy sc_team_roster_update on public.sc_team_store_roster for update to authenticated
using ((select public.sc_internal_access_allowed(array['admin','manager','operator','marketing'])))
with check ((select public.sc_internal_access_allowed(array['admin','manager','operator','marketing'])));
create policy sc_team_roster_delete on public.sc_team_store_roster for delete to authenticated
using ((select public.sc_internal_access_allowed(array['admin','manager','operator','marketing'])));

-- Direct browser writes cannot falsify order revenue, Woo product credentials, or posted financial data.
-- Service functions must verify Woo product identity using the private Woo REST credentials.
