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
returns trigger language plpgsql security definer set search_path = '' as $tag$
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
end $tag$;
drop trigger if exists sc_guard_team_order_channel on public.sc_team_store_workflows;
create trigger sc_guard_team_order_channel before update on public.sc_team_store_workflows
for each row execute function public.sc_guard_team_order_channel();


-- Internal summary RPC, avoids broad browser SELECT grants on all public client orders.
create or replace function public.sc_group_campaign_requests(p_campaign_id uuid)
returns table(id uuid,order_number text,submitted_at timestamptz,organization text,
  contact_name text,status text,external_invoice_number text,manual_order_id bigint,
  generated_job_id bigint,payment_received_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.sc_internal_access_allowed(array['admin','manager','operator','marketing']) then
    raise exception 'Group order access denied' using errcode='42501';
  end if;
  return query
    select o.id,o.order_number,o.submitted_at,o.organization,o.contact_name,o.status,
           o.external_invoice_number,o.manual_order_id,o.generated_job_id,o.payment_received_at
    from public.sc_client_order_requests o
    join public.sc_team_store_workflows w on w.id=o.campaign_id
    where o.campaign_id=p_campaign_id and w.order_channel='quickbooks_invoice'
    order by o.submitted_at desc limit 250;
end $$;
revoke all on function public.sc_group_campaign_requests(uuid) from public,anon;
grant execute on function public.sc_group_campaign_requests(uuid) to authenticated;
