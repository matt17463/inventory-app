-- Release hardening: permit manager approval updates through RLS without giving general writers approval rights.
drop policy if exists growth_docs_update on public.sc_growth_documents;
create policy growth_docs_update on public.sc_growth_documents for update to authenticated
 using (status='draft' and (select public.sc_internal_access_allowed(array['admin','manager','operator','marketing'])))
 with check ((status='draft' and (select public.sc_internal_access_allowed(array['admin','manager','operator','marketing'])))
   or (status='approved' and (select public.sc_internal_access_allowed(array['admin','manager']))));
-- The trigger still prevents changing the underlying document content when approving.
-- Revocation is permitted for an unanswered, expired link, but never after a recorded decision.
create or replace function sc_internal.sc_growth_review_response_guard_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.decision is not null then raise exception 'A completed client review is immutable.';end if;
 if new.document_id is distinct from old.document_id or new.token_hash is distinct from old.token_hash
   or new.expires_at is distinct from old.expires_at or new.created_by is distinct from old.created_by
   or new.created_at is distinct from old.created_at then
   raise exception 'Review identity is immutable.';
 end if;
 if new.decision is distinct from old.decision or new.feedback is distinct from old.feedback
   or new.responded_at is distinct from old.responded_at then
   if old.revoked_at is not null or old.expires_at<=now() then
      raise exception 'Review link is no longer active.';
   end if;
   if new.decision not in ('approved','changes_requested') then raise exception 'Invalid review decision.';end if;
   if new.decision='changes_requested' and nullif(btrim(new.feedback),'') is null then
      raise exception 'Describe requested changes.';
   end if;
 end if;
 if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'Review revocation cannot be reversed.';
 end if;
 return new;
end $$;
