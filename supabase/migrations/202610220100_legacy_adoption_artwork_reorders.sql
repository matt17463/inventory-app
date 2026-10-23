-- Legacy adoption 2026-10-22. All writes are additive and scoped.
-- Public-exposed tables: deny anon/authenticated; employee-only Netlify service endpoint gates access.
create table if not exists public.sc_catalog_artwork_links(
 woocommerce_product_id bigint primary key check(woocommerce_product_id>0),
 artwork_asset_id uuid not null references public.mockup_artwork_assets(id) on delete restrict,
 approval_evidence text not null default '',
 review_required boolean not null default true,
 review_reason text not null default 'Awaiting exact artwork / customer approval review',
 reviewed_by uuid,
 reviewed_at timestamptz,
 linked_by uuid not null,
 linked_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint catalog_artwork_review_consistent check(review_required or (reviewed_by is not null and reviewed_at is not null and length(trim(approval_evidence))>=8))
);
create index if not exists sc_catalog_artwork_asset_idx on public.sc_catalog_artwork_links(artwork_asset_id);
create table if not exists public.sc_catalog_artwork_link_events(
 id bigint generated always as identity primary key,
 woocommerce_product_id bigint not null,
 artwork_asset_id uuid,
 action text not null,
 details text not null default '',
 actor_id uuid,
 created_at timestamptz not null default now()
);
create index if not exists sc_catalog_artwork_events_parent on public.sc_catalog_artwork_link_events(woocommerce_product_id,created_at desc);
create table if not exists public.sc_catalog_feature_reviews(
 woocommerce_product_id bigint primary key check(woocommerce_product_id>0),
 pricing_status text not null default 'unreviewed' check(pricing_status in ('unreviewed','verified','needs_review')),
 mockup_status text not null default 'unreviewed' check(mockup_status in ('unreviewed','verified','needs_review')),
 supplier_status text not null default 'unreviewed' check(supplier_status in ('unreviewed','verified','needs_review')),
 review_notes text not null default '',
 reviewed_by uuid not null,
 reviewed_at timestamptz not null default now()
);
create table if not exists public.sc_legacy_client_migration_events(
 id bigint generated always as identity primary key,
 customer_id bigint not null references public.customers(id) on delete restrict,
 account_id uuid not null references public.sc_growth_accounts(id) on delete restrict,
 action text not null check(action in ('link_existing','create_and_link')),
 evidence text not null,
 actor_id uuid not null,
 created_at timestamptz not null default now()
);
create index if not exists sc_legacy_client_events_customer on public.sc_legacy_client_migration_events(customer_id,created_at desc);
create unique index if not exists sc_unique_live_growth_customer_link on public.sc_growth_accounts(customer_id) where customer_id is not null and archived_at is null;
create table if not exists public.sc_catalog_reorder_reviews(
 job_item_id bigint primary key references public.job_items(id) on delete restrict,
 source_traveler_id uuid not null references public.sc_job_travelers(id) on delete restrict,
 comparison_snapshot jsonb not null,
 differences jsonb not null default '[]'::jsonb check(jsonb_typeof(differences)='array'),
 decision text not null default 'review' check(decision in ('review','confirmed','rejected')),
 review_notes text not null default '',
 reviewed_by uuid not null,
 reviewed_at timestamptz not null default now(),
 constraint reorder_review_confirm_notes check(decision<>'confirmed' or length(trim(review_notes)) >= 8)
);
do $$
declare item text;
begin
 foreach item in array array[
 'sc_catalog_artwork_links','sc_catalog_artwork_link_events','sc_catalog_feature_reviews',
 'sc_legacy_client_migration_events','sc_catalog_reorder_reviews'
 ] loop
  execute format('alter table public.%I enable row level security',item);
  execute format('revoke all on public.%I from public,anon,authenticated',item);
  execute format('grant select,insert,update on public.%I to service_role',item);
 end loop;
end $$;
grant usage,select on sequence public.sc_catalog_artwork_link_events_id_seq to service_role;
grant usage,select on sequence public.sc_legacy_client_migration_events_id_seq to service_role;

-- Revision notice is automatic for *any* direct change to the linked source artwork.
-- A new replacement asset must also be explicitly linked through the Review workflow.
create or replace function public.sc_flag_linked_artwork_changes()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.storage_path is distinct from old.storage_path or
     new.prepared_storage_path is distinct from old.prepared_storage_path or
     new.storage_provider is distinct from old.storage_provider or
     new.preflight_status is distinct from old.preflight_status or
     new.exact_artwork_locked is distinct from old.exact_artwork_locked or
     new.artwork_name is distinct from old.artwork_name or
     new.metadata is distinct from old.metadata) then
  update public.sc_catalog_artwork_links
     set review_required=true,review_reason='Linked artwork source changed; confirm new version and client proof',
         reviewed_by=null,reviewed_at=null,updated_at=now()
     where artwork_asset_id=new.id;
 end if;
 return new;
end $$;
revoke all on function public.sc_flag_linked_artwork_changes() from public,anon,authenticated;
drop trigger if exists sc_flag_linked_artwork_changes on public.mockup_artwork_assets;
create trigger sc_flag_linked_artwork_changes after update on public.mockup_artwork_assets
 for each row execute function public.sc_flag_linked_artwork_changes();
