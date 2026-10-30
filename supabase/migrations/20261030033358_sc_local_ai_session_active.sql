-- Read only the current caller's session; never expose auth.sessions to clients.
create schema if not exists sc_local_ai_private;
revoke all on schema sc_local_ai_private from public, anon, authenticated;
grant usage on schema sc_local_ai_private to authenticated;

create or replace function sc_local_ai_private.session_active()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce(auth.jwt()->>'role', '') = 'authenticated'
    and exists (
      select 1 from auth.sessions s
      where s.id::text = auth.jwt()->>'session_id'
        and s.user_id = auth.uid()
        and (s.not_after is null or s.not_after > now())
    );
$$;
revoke all on function sc_local_ai_private.session_active() from public, anon, authenticated;
grant execute on function sc_local_ai_private.session_active() to authenticated;

-- The public RPC is an invoker wrapper around the guarded, private helper.
create or replace function public.sc_local_ai_session_active()
returns boolean
language sql stable security invoker
set search_path = ''
as $$ select sc_local_ai_private.session_active(); $$;
revoke all on function public.sc_local_ai_session_active() from public, anon, authenticated;
grant execute on function public.sc_local_ai_session_active() to authenticated;
