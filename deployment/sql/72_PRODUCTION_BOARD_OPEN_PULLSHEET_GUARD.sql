-- Skilled Crafting Inventory App v1.4.26
-- Production Board open-pull-sheet completion guard
--
-- Fixes an inconsistency where an open pull sheet (for example jobs.status =
-- queued) disappeared from the active Production Board as soon as every active
-- line was resolved. Resolved lines now move an otherwise-open job to
-- ready_to_ship. Only an explicitly completed/production_complete job enters
-- the Completed column.

begin;

create or replace function public.sc_list_order_status_board_v2(
  p_status text default null,
  p_search text default null,
  p_limit integer default 250
)
returns setof jsonb
language plpgsql
volatile
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
        -- Resolving every active line means production work is done, but an
        -- OPEN pull sheet must remain visible until the job itself is explicitly
        -- completed/cancelled. Move it to Ready to Ship instead of Completed.
        v_effective_status := 'ready_to_ship';
        v_effective_column := 'ready_to_ship';
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
        when v_effective_status = 'ready_to_ship'
          and coalesce(v_summary.total_lines, 0) > 0
          and coalesce(v_summary.unresolved_lines, 0) = 0
          then 'All active pull sheet lines are resolved. The pull sheet remains active until the job is explicitly completed.'
        when v_effective_status = 'production_complete'
          then 'Job is explicitly marked complete.'
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

grant execute on function public.sc_list_order_status_board_v2(text, text, integer) to authenticated;

comment on function public.sc_list_order_status_board_v2(text, text, integer) is
  'Production Board rows corrected from active job_items; resolved lines keep open jobs active in Ready to Ship until the job is explicitly completed.';

commit;
