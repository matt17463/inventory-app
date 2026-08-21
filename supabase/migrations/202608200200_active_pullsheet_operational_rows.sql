-- Skilled Crafting Inventory App v0.8.3
-- Active pull-sheet operational rows
--
-- Cancelled/voided job_items are retained as audit history but must not be
-- counted as current pull-sheet work, missing pairings, or production blockers.

begin;

create or replace function public.sc_job_item_is_operational_v1(p_status text)
returns boolean
language sql
immutable
parallel safe
as $$
  select lower(trim(coalesce(p_status, ''))) not in (
    'cancelled',
    'canceled',
    'voided',
    'void',
    'deleted',
    'removed'
  );
$$;

create or replace function public.sc_active_job_item_summary_v1(
  p_job_ids bigint[] default null
)
returns table (
  job_id bigint,
  total_lines bigint,
  total_quantity numeric,
  inventory_required_lines bigint,
  non_inventory_lines bigint,
  paired_required_lines bigint,
  unpaired_required_lines bigint,
  reserved_required_lines bigint,
  resolved_lines bigint,
  unresolved_lines bigint,
  open_lines bigint,
  cancelled_history_lines bigint,
  cancelled_history_quantity numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with selected_jobs as (
    select distinct j.id::bigint as job_id
    from public.jobs j
    where p_job_ids is null or j.id = any(p_job_ids)
  ),
  active as (
    select ji.*
    from public.job_items ji
    join selected_jobs sj on sj.job_id = ji.job_id
    where public.sc_job_item_is_operational_v1(ji.status)
  ),
  active_summary as (
    select
      a.job_id::bigint as job_id,
      count(*)::bigint as total_lines,
      coalesce(sum(coalesce(a.quantity, 0)), 0)::numeric as total_quantity,
      count(*) filter (where coalesce(a.inventory_required, true))::bigint as inventory_required_lines,
      count(*) filter (where not coalesce(a.inventory_required, true))::bigint as non_inventory_lines,
      count(*) filter (
        where coalesce(a.inventory_required, true)
          and a.blank_product_id is not null
      )::bigint as paired_required_lines,
      count(*) filter (
        where coalesce(a.inventory_required, true)
          and a.blank_product_id is null
      )::bigint as unpaired_required_lines,
      count(*) filter (
        where coalesce(a.inventory_required, true)
          and a.blank_product_id is not null
          and a.selected_bin_id is not null
      )::bigint as reserved_required_lines,
      count(*) filter (
        where lower(trim(coalesce(a.status, ''))) in (
          'complete',
          'completed',
          'closed',
          'deducted',
          'ready_to_ship',
          'ready to ship',
          'shipped',
          'done',
          'fulfilled'
        )
      )::bigint as resolved_lines
    from active a
    group by a.job_id
  ),
  history_summary as (
    select
      ji.job_id::bigint as job_id,
      count(*)::bigint as cancelled_history_lines,
      coalesce(sum(coalesce(ji.quantity, 0)), 0)::numeric as cancelled_history_quantity
    from public.job_items ji
    join selected_jobs sj on sj.job_id = ji.job_id
    where not public.sc_job_item_is_operational_v1(ji.status)
    group by ji.job_id
  )
  select
    sj.job_id,
    coalesce(a.total_lines, 0)::bigint,
    coalesce(a.total_quantity, 0)::numeric,
    coalesce(a.inventory_required_lines, 0)::bigint,
    coalesce(a.non_inventory_lines, 0)::bigint,
    coalesce(a.paired_required_lines, 0)::bigint,
    coalesce(a.unpaired_required_lines, 0)::bigint,
    coalesce(a.reserved_required_lines, 0)::bigint,
    coalesce(a.resolved_lines, 0)::bigint,
    greatest(coalesce(a.total_lines, 0) - coalesce(a.resolved_lines, 0), 0)::bigint as unresolved_lines,
    greatest(coalesce(a.total_lines, 0) - coalesce(a.resolved_lines, 0), 0)::bigint as open_lines,
    coalesce(h.cancelled_history_lines, 0)::bigint,
    coalesce(h.cancelled_history_quantity, 0)::numeric
  from selected_jobs sj
  left join active_summary a on a.job_id = sj.job_id
  left join history_summary h on h.job_id = sj.job_id
  order by sj.job_id;
$$;

create or replace function public.sc_existing_pull_sheets_v2()
returns setof jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with base_rows as (
    select to_jsonb(p) as row_data
    from public.sc_existing_pull_sheets() p
  ),
  job_ids as (
    select array_agg(distinct (row_data->>'id')::bigint) as ids
    from base_rows
    where coalesce(row_data->>'id', '') ~ '^[0-9]+$'
  ),
  summaries as (
    select s.*
    from job_ids j
    cross join lateral public.sc_active_job_item_summary_v1(j.ids) s
  )
  select
    b.row_data || jsonb_build_object(
      'item_count', coalesce(s.total_lines, 0),
      'active_line_count', coalesce(s.total_lines, 0),
      'total_quantity', coalesce(s.total_quantity, 0),
      'active_unpaired_count', coalesce(s.unpaired_required_lines, 0),
      'cancelled_history_count', coalesce(s.cancelled_history_lines, 0)
    )
  from base_rows b
  left join summaries s
    on coalesce(b.row_data->>'id', '') ~ '^[0-9]+$'
   and s.job_id = (b.row_data->>'id')::bigint;
$$;

create or replace function public.sc_pull_sheet_items_active_v1(p_job_id bigint)
returns setof jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select to_jsonb(p)
  from public.sc_pull_sheet_items(p_job_id) p
  where public.sc_job_item_is_operational_v1(
    coalesce(
      to_jsonb(p)->>'item_status',
      to_jsonb(p)->>'job_item_status',
      to_jsonb(p)->>'line_status',
      to_jsonb(p)->>'status'
    )
  );
$$;

create or replace function public.sc_list_order_status_board_v2(
  p_status text default null,
  p_search text default null,
  p_limit integer default 250
)
returns setof jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_base jsonb;
  v_result jsonb;
  v_job_id bigint;
  v_summary record;
  v_saved_status text;
  v_effective_status text;
  v_effective_column text;
  v_effective_label text;
  v_reason text;
  v_issues jsonb;
  v_manual boolean;
  v_returned integer := 0;
  v_fetch_limit integer := least(greatest(coalesce(p_limit, 250) * 4, 1000), 5000);
begin
  for v_base in
    select to_jsonb(b)
    from public.sc_list_order_status_board(
      p_status => null,
      p_search => p_search,
      p_limit => v_fetch_limit
    ) b
  loop
    v_result := v_base;
    v_job_id := null;
    v_saved_status := '';
    v_manual := false;

    if coalesce(v_base->>'job_id', '') ~ '^[0-9]+$' then
      v_job_id := (v_base->>'job_id')::bigint;

      select *
      into v_summary
      from public.sc_active_job_item_summary_v1(array[v_job_id]);

      select lower(trim(coalesce(j.status, '')))
      into v_saved_status
      from public.jobs j
      where j.id = v_job_id;

      v_saved_status := coalesce(v_saved_status, '');
      v_manual := v_saved_status in (
        'ready_to_produce',
        'in_production',
        'qc',
        'ready_to_ship',
        'production_complete',
        'completed',
        'on_hold',
        'cancelled',
        'canceled'
      );

      select coalesce(jsonb_agg(issue), '[]'::jsonb)
      into v_issues
      from jsonb_array_elements(
        case
          when jsonb_typeof(v_base->'blocking_issues') = 'array'
            then v_base->'blocking_issues'
          else '[]'::jsonb
        end
      ) issue
      where coalesce(issue->>'type', '') <> 'missing_blank_pairing';

      if coalesce(v_summary.unpaired_required_lines, 0) > 0 then
        v_issues := v_issues || jsonb_build_array(jsonb_build_object(
          'type', 'missing_blank_pairing',
          'count', v_summary.unpaired_required_lines,
          'message', 'Active inventory-required line items need blank pairing before the pull sheet can be safely completed.'
        ));
      end if;

      if v_manual then
        v_effective_status := case
          when v_saved_status in ('completed', 'production_complete') then 'production_complete'
          when v_saved_status in ('cancelled', 'canceled') then 'cancelled'
          else v_saved_status
        end;
        v_effective_column := case
          when v_saved_status in ('completed', 'production_complete') then 'completed'
          when v_saved_status in ('cancelled', 'canceled') then 'cancelled'
          else v_saved_status
        end;
      elsif coalesce(v_summary.unpaired_required_lines, 0) > 0 then
        v_effective_status := 'needs_attention';
        v_effective_column := 'needs_attention';
      elsif coalesce(v_summary.total_lines, 0) > 0
        and coalesce(v_summary.unresolved_lines, 0) = 0 then
        v_effective_status := 'production_complete';
        v_effective_column := 'completed';
      else
        v_effective_status := coalesce(nullif(v_base->>'production_status', ''), 'new_order');
        v_effective_column := coalesce(nullif(v_base->>'board_column', ''), 'new_order');

        if v_effective_status = 'needs_attention'
          and jsonb_array_length(v_issues) = 0 then
          v_effective_status := case
            when coalesce(v_summary.paired_required_lines, 0) > 0 then 'ready_to_produce'
            else 'new_order'
          end;
          v_effective_column := v_effective_status;
        end if;
      end if;

      v_effective_label := case v_effective_status
        when 'new_order' then 'New Order'
        when 'needs_attention' then 'Needs Attention'
        when 'on_hold' then 'On Hold'
        when 'ready_to_produce' then 'Ready to Produce'
        when 'in_production' then 'In Production'
        when 'qc' then 'QC'
        when 'ready_to_ship' then 'Ready to Ship'
        when 'production_complete' then 'Production Complete'
        when 'cancelled' then 'Cancelled'
        else initcap(replace(v_effective_status, '_', ' '))
      end;

      v_reason := case
        when coalesce(v_summary.unpaired_required_lines, 0) > 0
          then 'One or more active inventory-required pull sheet lines are missing a blank pairing.'
        when v_manual and jsonb_array_length(v_issues) > 0
          then 'Manual production status selected. Active blocker warnings still require review.'
        when v_manual
          then 'Manual production status selected.'
        when v_effective_status = 'production_complete'
          then 'All active pull sheet lines are resolved.'
        when coalesce(v_base->>'production_status_reason', '') ilike '%pairing%'
          then null
        else nullif(v_base->>'production_status_reason', '')
      end;

      v_result := v_base || jsonb_build_object(
        'saved_job_status', v_saved_status,
        'total_lines', coalesce(v_summary.total_lines, 0),
        'total_quantity', coalesce(v_summary.total_quantity, 0),
        'inventory_required_lines', coalesce(v_summary.inventory_required_lines, 0),
        'non_inventory_lines', coalesce(v_summary.non_inventory_lines, 0),
        'paired_required_lines', coalesce(v_summary.paired_required_lines, 0),
        'unpaired_required_lines', coalesce(v_summary.unpaired_required_lines, 0),
        'reserved_required_lines', coalesce(v_summary.reserved_required_lines, 0),
        'resolved_lines', coalesce(v_summary.resolved_lines, 0),
        'unresolved_lines', coalesce(v_summary.unresolved_lines, 0),
        'open_lines', coalesce(v_summary.open_lines, 0),
        'cancelled_history_lines', coalesce(v_summary.cancelled_history_lines, 0),
        'blocking_issues', v_issues,
        'production_status', v_effective_status,
        'production_status_label', v_effective_label,
        'production_status_reason', v_reason,
        'board_column', v_effective_column,
        'board_column_label', v_effective_label
      );
    end if;

    if nullif(trim(coalesce(p_status, '')), '') is null
      or v_result->>'board_column' = p_status then
      return next v_result;
      v_returned := v_returned + 1;
      exit when v_returned >= greatest(coalesce(p_limit, 250), 1);
    end if;
  end loop;

  return;
end;
$$;

grant execute on function public.sc_job_item_is_operational_v1(text) to authenticated;
grant execute on function public.sc_active_job_item_summary_v1(bigint[]) to authenticated;
grant execute on function public.sc_existing_pull_sheets_v2() to authenticated;
grant execute on function public.sc_pull_sheet_items_active_v1(bigint) to authenticated;
grant execute on function public.sc_list_order_status_board_v2(text, text, integer) to authenticated;

comment on function public.sc_active_job_item_summary_v1(bigint[]) is
  'Counts active pull-sheet rows while retaining cancelled/voided job_items as audit history.';

comment on function public.sc_list_order_status_board_v2(text, text, integer) is
  'Production Board rows corrected from active job_items; manual job status controls the card column.';

commit;
