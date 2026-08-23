-- Skilled Crafting Inventory v0.8.12
-- Controlled color cleanup and remembered import aliases.
-- Safe to run more than once in Supabase SQL Editor.

begin;

alter table public.colors
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

create index if not exists ix_colors_active_name
  on public.colors (is_active, name);

create or replace view public.sc_active_colors
with (security_invoker = true)
as
select *
from public.colors
where is_active is true;

grant select on public.sc_active_colors to authenticated, service_role;

create table if not exists public.sc_import_color_aliases (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_value text not null,
  source_key text not null,
  canonical_color_id_text text not null,
  canonical_color_name text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system, source_key)
);

create index if not exists ix_sc_import_color_aliases_canonical
  on public.sc_import_color_aliases (canonical_color_id_text);

create table if not exists public.sc_color_cleanup_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  color_id_text text,
  color_name text,
  woo_term_id bigint,
  details jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.sc_import_color_aliases enable row level security;
alter table public.sc_color_cleanup_log enable row level security;
revoke all on public.sc_import_color_aliases from anon, authenticated;
revoke all on public.sc_color_cleanup_log from anon, authenticated;
grant all on public.sc_import_color_aliases to service_role;
grant all on public.sc_color_cleanup_log to service_role;

create or replace function public.sc_reactivate_referenced_color()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.color_id is not null then
    update public.colors
       set is_active = true,
           archived_at = null,
           archived_reason = null
     where id::text = new.color_id::text
       and is_active is false;
  end if;
  return new;
end;
$$;

drop trigger if exists sc_products_reactivate_color on public.products;
create trigger sc_products_reactivate_color
after insert or update of color_id on public.products
for each row execute function public.sc_reactivate_referenced_color();

drop trigger if exists sc_blank_products_reactivate_color on public.blank_products;
create trigger sc_blank_products_reactivate_color
after insert or update of color_id on public.blank_products
for each row execute function public.sc_reactivate_referenced_color();

commit;

select
  count(*) filter (where is_active) as active_colors,
  count(*) filter (where not is_active) as archived_colors,
  to_regclass('public.sc_import_color_aliases') is not null as import_aliases_ready
from public.colors;
