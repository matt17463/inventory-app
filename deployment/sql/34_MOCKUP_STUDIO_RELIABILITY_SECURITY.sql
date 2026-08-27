-- Skilled Crafting Inventory v1.0.9
-- Mockup Studio reliability, approval integrity, storage cleanup, and RLS hardening.
-- Run after 18, 22, 24, and 32_R2_EGRESS_COMPLETION.sql.

begin;

create or replace function public.sc_mockup_active_employee()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.sc_app_user_roles r
    where r.user_id = auth.uid()
      and r.is_active = true
      and lower(r.role) in ('admin', 'manager', 'operator', 'employee')
  );
$function$;

revoke all on function public.sc_mockup_active_employee() from public, anon;
grant execute on function public.sc_mockup_active_employee() to authenticated, service_role;

do $security$
declare
  v_table text;
begin
  foreach v_table in array array[
    'mockup_projects', 'mockup_blank_assets', 'mockup_artwork_assets',
    'mockup_placements', 'mockup_generation_jobs', 'mockup_outputs',
    'mockup_review_tokens', 'mockup_reviews', 'mockup_pricing_items',
    'mockup_woo_exports', 'mockup_production_packets', 'mockup_project_archives'
  ] loop
    if to_regclass(format('public.%I', v_table)) is null then continue; end if;
    execute format('alter table public.%I enable row level security', v_table);
    execute format('drop policy if exists sc_mockup_authenticated_all on public.%I', v_table);
    execute format('drop policy if exists sc_mockup_active_employees on public.%I', v_table);
    execute format(
      'create policy sc_mockup_active_employees on public.%I for all to authenticated using (public.sc_mockup_active_employee()) with check (public.sc_mockup_active_employee())',
      v_table
    );
  end loop;
end
$security$;

create table if not exists public.mockup_storage_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  project_id uuid null,
  storage_provider text not null,
  storage_bucket text not null,
  storage_path text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(storage_provider, storage_bucket, storage_path)
);

alter table public.mockup_storage_cleanup_queue enable row level security;
revoke all privileges on table public.mockup_storage_cleanup_queue from public, anon, authenticated;
grant all privileges on table public.mockup_storage_cleanup_queue to service_role;

create or replace function public.sc_mockup_select_output(
  p_output_id uuid,
  p_selected boolean default true
)
returns public.mockup_outputs
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_output public.mockup_outputs;
begin
  if not public.sc_mockup_active_employee() then raise exception 'Active employee access is required.'; end if;
  select * into v_output from public.mockup_outputs where id = p_output_id;
  if not found then raise exception 'Mockup output was not found.'; end if;

  if coalesce(p_selected, true) then
    update public.mockup_outputs
    set is_selected = false
    where project_id = v_output.project_id
      and placement_id is not distinct from v_output.placement_id;
  end if;

  update public.mockup_outputs
  set is_selected = coalesce(p_selected, true)
  where id = p_output_id
  returning * into v_output;
  return v_output;
end
$function$;

create or replace function public.sc_mockup_internal_review(
  p_output_id uuid,
  p_status text,
  p_selected boolean default null
)
returns public.mockup_outputs
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_output public.mockup_outputs;
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  if not public.sc_mockup_active_employee() then raise exception 'Active employee access is required.'; end if;
  if v_status not in ('pending', 'internal_approved', 'changes_requested', 'rejected') then
    raise exception 'Invalid internal review status.';
  end if;
  select * into v_output from public.mockup_outputs where id = p_output_id for update;
  if not found then raise exception 'Mockup output was not found.'; end if;

  if coalesce(p_selected, false) then
    update public.mockup_outputs set is_selected = false
    where project_id = v_output.project_id
      and placement_id is not distinct from v_output.placement_id;
  end if;

  update public.mockup_outputs
  set approval_status = v_status,
      is_selected = coalesce(p_selected, is_selected),
      approved_at = case when v_status = 'internal_approved' then now() else null end,
      approved_by = case when v_status = 'internal_approved' then auth.uid()::text else null end
  where id = p_output_id
  returning * into v_output;

  update public.mockup_projects
  set status = case
    when v_status = 'internal_approved' then 'approved'
    when v_status = 'changes_requested' then 'changes_requested'
    else 'review'
  end
  where id = v_output.project_id
    and status not in ('published', 'production_ready', 'archived');
  return v_output;
end
$function$;

revoke all on function public.sc_mockup_internal_review(uuid, text, boolean) from public, anon;
grant execute on function public.sc_mockup_internal_review(uuid, text, boolean) to authenticated, service_role;

create or replace function public.sc_mockup_apply_customer_review(
  p_token_id uuid,
  p_project_id uuid,
  p_output_id uuid,
  p_decision text,
  p_reviewer_name text,
  p_reviewer_email text,
  p_notes text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_decision text := lower(trim(coalesce(p_decision, '')));
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then raise exception 'Service role is required.'; end if;
  if v_decision not in ('approved', 'changes_requested', 'comment') then raise exception 'Invalid customer review decision.'; end if;
  if not exists (select 1 from public.mockup_outputs where id = p_output_id and project_id = p_project_id) then
    raise exception 'The selected mockup was not found in this review.';
  end if;

  insert into public.mockup_reviews(project_id, output_id, review_token_id, decision, reviewer_name, reviewer_email, notes, metadata)
  values (p_project_id, p_output_id, p_token_id, v_decision, nullif(trim(p_reviewer_name), ''), nullif(trim(p_reviewer_email), ''), nullif(trim(p_notes), ''), coalesce(p_metadata, '{}'::jsonb));

  if v_decision <> 'comment' then
    update public.mockup_outputs
    set approval_status = case when v_decision = 'approved' then 'customer_approved' else 'changes_requested' end,
        approved_at = case when v_decision = 'approved' then now() else null end,
        approved_by = case when v_decision = 'approved' then coalesce(nullif(trim(p_reviewer_email), ''), nullif(trim(p_reviewer_name), ''), 'customer') else null end
    where id = p_output_id;
  end if;

  update public.mockup_projects
  set status = case when v_decision = 'approved' then 'approved' when v_decision = 'changes_requested' then 'changes_requested' else 'review' end
  where id = p_project_id;

  update public.mockup_review_tokens
  set status = case
        when v_decision = 'approved' and not exists (
          select 1 from public.mockup_outputs
          where project_id = p_project_id and is_selected and approval_status <> 'customer_approved'
        ) then 'used'
        else 'active'
      end,
      last_accessed_at = now()
  where id = p_token_id;
end
$function$;

revoke all on function public.sc_mockup_apply_customer_review(uuid, uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.sc_mockup_apply_customer_review(uuid, uuid, uuid, text, text, text, text, jsonb) to service_role;

create or replace function public.sc_mockup_mark_production_ready(
  p_project_id uuid,
  p_packet_data jsonb default '{}'::jsonb
)
returns public.mockup_production_packets
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_packet public.mockup_production_packets;
  v_packet_number text;
begin
  if not public.sc_mockup_active_employee() then raise exception 'Active employee access is required.'; end if;
  if not exists (select 1 from public.mockup_blank_assets where project_id = p_project_id) then raise exception 'Production readiness requires at least one blank photo.'; end if;
  if not exists (select 1 from public.mockup_artwork_assets where project_id = p_project_id) then raise exception 'Production readiness requires artwork.'; end if;
  if exists (select 1 from public.mockup_artwork_assets where project_id = p_project_id and preflight_status in ('pending', 'failed')) then raise exception 'Every artwork file must pass preflight or have a reviewed warning.'; end if;
  if not exists (select 1 from public.mockup_placements where project_id = p_project_id and is_active) then raise exception 'Production readiness requires an active placement.'; end if;
  if exists (select 1 from public.mockup_placements where project_id = p_project_id and is_active and coalesce(print_width_inches, 0) <= 0) then raise exception 'Every active placement requires a physical print width.'; end if;
  if not exists (select 1 from public.mockup_outputs where project_id = p_project_id and is_selected) then raise exception 'Select at least one mockup output.'; end if;
  if exists (select 1 from public.mockup_outputs where project_id = p_project_id and is_selected and approval_status not in ('internal_approved', 'customer_approved')) then raise exception 'Every selected mockup must be approved.'; end if;
  if exists (
    select 1 from public.mockup_placements p
    where p.project_id = p_project_id and p.is_active
      and not exists (select 1 from public.mockup_outputs o where o.placement_id = p.id and o.is_selected and o.approval_status in ('internal_approved', 'customer_approved'))
  ) then raise exception 'Every active placement requires a selected approved mockup.'; end if;

  v_packet_number := 'MS-' || upper(substr(p_project_id::text, 1, 8)) || '-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS');
  insert into public.mockup_production_packets(project_id, packet_number, status, packet_data, created_by)
  values (p_project_id, v_packet_number, 'ready', coalesce(p_packet_data, '{}'::jsonb), auth.uid())
  returning * into v_packet;
  update public.mockup_projects set status = 'production_ready' where id = p_project_id;
  return v_packet;
end
$function$;

revoke all on function public.sc_mockup_mark_production_ready(uuid, jsonb) from public, anon;
grant execute on function public.sc_mockup_mark_production_ready(uuid, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
