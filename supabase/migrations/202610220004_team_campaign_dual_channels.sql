-- Two distinct customer engagement channels:
-- recurring team/school storefront -> WooCommerce;
-- occasional group order -> public intake form, QuickBooks invoice, manual production.
alter table public.sc_team_store_workflows
  add column if not exists order_channel text not null default 'woocommerce',
  add column if not exists public_order_code uuid not null default gen_random_uuid();
create unique index if not exists sc_team_workflows_public_order_code_unique
  on public.sc_team_store_workflows(public_order_code);
do $$ begin
  alter table public.sc_team_store_workflows
  add constraint sc_team_order_channel_ck check(order_channel in ('woocommerce','quickbooks_invoice'));
exception when duplicate_object then null; end $$;

alter table public.sc_client_order_requests
  add column if not exists campaign_id uuid references public.sc_team_store_workflows(id) on delete set null;
create index if not exists sc_client_order_requests_campaign_idx on public.sc_client_order_requests(campaign_id);

-- Prevent turning a group-invoice campaign into a storefront after intake, or
-- converting an existing Woo live storefront into invoice intake.
create or replace function public.sc_guard_team_order_channel()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.order_channel is distinct from old.order_channel then
    if old.stage in ('live','complete')
      or exists(select 1 from public.sc_client_order_requests where campaign_id=old.id)
      or exists(select 1 from public.sc_team_store_order_lines where campaign_id=old.id)
    then
      raise exception 'Cannot switch billing channel after ordering starts; create a new campaign instead'
        using errcode='42501';
    end if;
  end if;
  if new.order_channel='quickbooks_invoice' and new.stage in ('live','ready_to_publish','woocommerce_draft') then
    raise exception 'Invoice-only group orders do not publish a WooCommerce storefront'
      using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists sc_guard_team_order_channel on public.sc_team_store_workflows;
create trigger sc_guard_team_order_channel before update on public.sc_team_store_workflows
for each row execute function public.sc_guard_team_order_channel();
