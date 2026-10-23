-- Add grouped production travelers without changing existing traveler IDs or stock.
create table if not exists public.sc_job_traveler_lines (
 traveler_id uuid not null references public.sc_job_travelers(id) on delete restrict,
 job_item_id bigint not null references public.job_items(id) on delete restrict,
 quantity bigint not null check (quantity > 0),
 item_snapshot jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 primary key (traveler_id,job_item_id),
 unique (job_item_id)
);
create index if not exists sc_job_traveler_lines_item_idx on public.sc_job_traveler_lines(job_item_id);
alter table public.sc_job_traveler_lines enable row level security;
revoke all on public.sc_job_traveler_lines from public,anon,authenticated;
grant select on public.sc_job_traveler_lines to authenticated;
drop policy if exists sc_jtl_read on public.sc_job_traveler_lines;
create policy sc_jtl_read on public.sc_job_traveler_lines for select to authenticated
 using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer'])));
-- Preserve legacy travelers by mapping their primary job item, including future single-line inserts.
insert into public.sc_job_traveler_lines(traveler_id,job_item_id,quantity,item_snapshot)
select t.id,i.id,greatest(1,i.quantity),jsonb_build_object(
 'sku',coalesce(i.order_sku,i.sku),'size',i.size,'color',i.color,
 'name',coalesce(i.ordered_product_name,i.item_name,i.name),'quantity',i.quantity,
 'brand',i.brand,'product_type',i.product_type,'placement',i.placement)
from public.sc_job_travelers t join public.job_items i on i.id=t.job_item_id
on conflict (job_item_id) do nothing;
create or replace function public.sc_capture_primary_traveler_line()
returns trigger language plpgsql security definer set search_path='' as $$
declare i public.job_items%rowtype;
begin
 select * into i from public.job_items where id=new.job_item_id;
 insert into public.sc_job_traveler_lines(traveler_id,job_item_id,quantity,item_snapshot)
 values(new.id,i.id,greatest(1,i.quantity),jsonb_build_object(
 'sku',coalesce(i.order_sku,i.sku),'size',i.size,'color',i.color,
 'name',coalesce(i.ordered_product_name,i.item_name,i.name),'quantity',i.quantity,
 'brand',i.brand,'product_type',i.product_type,'placement',i.placement));
 return new;
end $$;
drop trigger if exists sc_capture_primary_traveler_line on public.sc_job_travelers;
create trigger sc_capture_primary_traveler_line after insert on public.sc_job_travelers
for each row execute function public.sc_capture_primary_traveler_line();
create or replace function public.sc_create_grouped_traveler(
 p_job_id bigint,p_job_item_ids bigint[],p_recipe_version_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_item bigint; v_primary bigint; v_traveler uuid; v_count integer; v_expected integer;
declare i public.job_items%rowtype;
begin
 if auth.uid() is null or not public.sc_internal_access_allowed(array['admin','manager','operator']) then
  raise exception 'Insufficient permission' using errcode='42501';
 end if;
 if p_job_id is null or p_recipe_version_id is null or p_job_item_ids is null
    or cardinality(p_job_item_ids)=0 or cardinality(p_job_item_ids)>100 then
  raise exception 'Select 1–100 job lines and an approved recipe';
 end if;
 select count(distinct x),count(*) into v_expected,v_count from unnest(p_job_item_ids) x;
 if v_expected<>v_count or v_expected=0 or exists(select 1 from unnest(p_job_item_ids) x where x is null) then
  raise exception 'Duplicate or empty job lines not allowed';
 end if;
 perform 1 from public.jobs where id=p_job_id for update;
 if not found then raise exception 'Production job was not found'; end if;
 if not exists(select 1 from public.sc_manufacturing_recipe_versions
    where id=p_recipe_version_id and status='approved') then
  raise exception 'Select an approved recipe revision';
 end if;
 select count(*) into v_count from public.job_items where job_id=p_job_id and id=any(p_job_item_ids) and quantity>0;
 if v_count<>v_expected then raise exception 'All selected lines must belong to this job and have positive quantities'; end if;
 if exists(select 1 from public.sc_job_traveler_lines where job_item_id=any(p_job_item_ids))
 or exists(select 1 from public.sc_job_travelers where job_item_id=any(p_job_item_ids)) then
  raise exception 'One or more selected lines already have a traveler';
 end if;
 select min(x) into v_primary from unnest(p_job_item_ids) x;
 insert into public.sc_job_travelers(job_id,job_item_id,recipe_version_id,created_by)
 values(p_job_id,v_primary,p_recipe_version_id,auth.uid()) returning id into v_traveler;
 for v_item in select distinct x from unnest(p_job_item_ids) x where x<>v_primary loop
  select * into i from public.job_items where id=v_item;
  insert into public.sc_job_traveler_lines(traveler_id,job_item_id,quantity,item_snapshot)
  values(v_traveler,i.id,i.quantity,jsonb_build_object(
   'sku',coalesce(i.order_sku,i.sku),'size',i.size,'color',i.color,
   'name',coalesce(i.ordered_product_name,i.item_name,i.name),'quantity',i.quantity,
   'brand',i.brand,'product_type',i.product_type,'placement',i.placement));
 end loop;
 return v_traveler;
end $$;
revoke all on function public.sc_create_grouped_traveler(bigint,bigint[],uuid) from public,anon;
grant execute on function public.sc_create_grouped_traveler(bigint,bigint[],uuid) to authenticated;
