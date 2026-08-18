-- OPTIONAL MONITORING ONLY
-- Installs a lightweight audit trigger on legacy bin_items.
-- It does not block or change a legacy write. Use this to prove whether any old client still writes there.
-- Do not run unless you want this monitoring enabled.

begin;

create table if not exists public.sc_legacy_inventory_write_log (
  id bigint generated always as identity primary key,
  relation_name text not null,
  operation text not null,
  row_identifier text,
  actor_role text not null default current_user,
  occurred_at timestamptz not null default now()
);

create or replace function public.sc_log_legacy_inventory_write_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  insert into public.sc_legacy_inventory_write_log(
    relation_name,
    operation,
    row_identifier,
    actor_role
  ) values (
    tg_table_schema || '.' || tg_table_name,
    tg_op,
    coalesce(v_row ->> 'id', v_row ->> 'product_id', v_row ->> 'blank_product_id'),
    current_user
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
begin
  if to_regclass('public.bin_items') is not null
     and not exists (
       select 1 from pg_trigger
       where tgname = 'trg_sc_monitor_legacy_bin_items_v1'
         and tgrelid = 'public.bin_items'::regclass
     ) then
    execute 'create trigger trg_sc_monitor_legacy_bin_items_v1 after insert or update or delete on public.bin_items for each row execute function public.sc_log_legacy_inventory_write_v1()';
  end if;
end $$;

revoke all on public.sc_legacy_inventory_write_log from anon, authenticated;

commit;
