-- Limit external review response abuse by denying revoked/used/expired token updates at the DB layer.
create function sc_internal.sc_growth_review_response_guard_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.revoked_at is not null or old.decision is not null or old.expires_at<=now() then
   raise exception 'Review link is no longer active.';
 end if;
 if new.document_id is distinct from old.document_id or
    new.token_hash is distinct from old.token_hash or
    new.expires_at is distinct from old.expires_at or
    new.created_by is distinct from old.created_by or
    new.created_at is distinct from old.created_at then
   raise exception 'Review identity is immutable.';
 end if;
 if new.decision is distinct from old.decision then
   if new.decision not in ('approved','changes_requested') then
     raise exception 'Invalid review decision.';
   end if;
   if new.decision='changes_requested' and nullif(btrim(new.feedback),'') is null then
     raise exception 'Describe requested changes.';
   end if;
 end if;
 return new;
end $$;
revoke all on function sc_internal.sc_growth_review_response_guard_v1() from public,anon,authenticated;
create trigger sc_growth_review_response_guard
before update on public.sc_growth_document_reviews
for each row execute function sc_internal.sc_growth_review_response_guard_v1();
