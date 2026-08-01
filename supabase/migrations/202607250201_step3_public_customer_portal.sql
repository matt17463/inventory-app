-- Step 3: narrow, public customer portal RPC.
-- Additive only. Existing tables, tokens, events, and phase6_customer_portal_data remain untouched.

create or replace function public.sc_customer_portal_data_v2(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_token public.sc_customer_portal_tokens%rowtype;
  v_events jsonb;
begin
  if nullif(btrim(p_token), '') is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'This customer portal link is incomplete.'
    );
  end if;

  select t.*
    into v_token
  from public.sc_customer_portal_tokens t
  where t.token = btrim(p_token)
    and coalesce(t.is_active, false) = true
    and (t.expires_at is null or t.expires_at > now())
  order by t.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'message', 'This customer portal link is invalid, expired, or no longer active.'
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'event_type', e.event_type,
        'title', e.title,
        'status', e.status,
        'due_date', e.due_date,
        'message', e.message,
        'public_note', e.public_note,
        'created_at', e.created_at
      ) order by e.created_at asc
    ),
    '[]'::jsonb
  )
  into v_events
  from public.sc_customer_portal_events e
  where e.portal_token_id = v_token.id
    and coalesce(e.is_customer_visible, true) = true;

  return jsonb_build_object(
    'ok', true,
    'customer', jsonb_build_object(
      'id', v_token.id,
      'customer_name', v_token.customer_name,
      'organization', v_token.organization
    ),
    'events', v_events
  );
end;
$function$;

revoke all on function public.sc_customer_portal_data_v2(text) from public;
grant execute on function public.sc_customer_portal_data_v2(text) to anon, authenticated;

comment on function public.sc_customer_portal_data_v2(text) is
  'Public token-scoped portal response. Returns only customer name/organization and customer-visible event fields; never returns token, email, phone, notes, private_note, or unrelated records.';
