-- Manager-only document approval. Existing draft rows remain unchanged.
create or replace function sc_internal.sc_growth_document_guard_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if old.status <> 'draft' then raise exception 'Approved documents are immutable; create a new version.'; end if;
   if new.id <> old.id or new.account_id <> old.account_id or new.created_by <> old.created_by
      or new.created_at <> old.created_at or new.version <> old.version
   then raise exception 'Protected document fields cannot be modified.'; end if;
   if new.status = 'approved' then
     perform public.sc_require_internal_access(array['admin','manager']);
     if new.content is distinct from old.content or new.template_id <> old.template_id or new.title <> old.title
       then raise exception 'Cannot change document content during approval.'; end if;
     new.approved_by := auth.uid();
     new.approved_at := now();
   else
     if new.status <> 'draft' or new.approved_by is distinct from old.approved_by or
        new.approved_at is distinct from old.approved_at
     then raise exception 'Document approval metadata is protected.'; end if;
   end if;
 else
   if new.status <> 'draft' or new.approved_by is not null or new.approved_at is not null
    then raise exception 'New documents must start as unapproved drafts.';end if;
 end if;
 new.updated_at := clock_timestamp();
 return new;
end $$;
revoke all on function sc_internal.sc_growth_document_guard_v1() from public,anon,authenticated;
create or replace function public.sc_growth_approve_document_v1(p_id uuid,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.sc_growth_documents;begin
 perform public.sc_require_internal_access(array['admin','manager']);
 select * into d from public.sc_growth_documents where id=p_id for update;
 if d.id is null or d.status<>'draft' then raise exception 'Select an active draft.';end if;
 if d.updated_at is distinct from p_expected_updated_at then raise exception 'Document changed. Refresh before approving.';end if;
 update public.sc_growth_documents set status='approved' where id=p_id returning * into d;
 return jsonb_build_object('id',d.id,'status',d.status,'approved_at',d.approved_at);
end $$;
revoke all on function public.sc_growth_approve_document_v1(uuid,timestamptz) from public,anon;
grant execute on function public.sc_growth_approve_document_v1(uuid,timestamptz) to authenticated,service_role;
