-- Server-observed bytes are separate from customer and physical approvals.
-- No existing file is rewritten and no historical approval is manufactured.
create table public.sc_artwork_object_revisions (
 id uuid primary key default gen_random_uuid(),
 artwork_asset_id uuid not null references public.mockup_artwork_assets(id) on delete restrict,
 asset_updated_at timestamptz not null,
 storage_provider text not null,
 storage_bucket text not null,
 storage_path text not null,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 byte_size bigint not null check(byte_size>0 and byte_size<=52428800),
 review_note text not null check(length(trim(review_note))>=12),
 registered_by uuid not null,
 registered_at timestamptz not null default clock_timestamp(),
 unique(artwork_asset_id,asset_updated_at,storage_provider,storage_bucket,storage_path)
);
alter table public.sc_artwork_object_revisions enable row level security;
revoke all on public.sc_artwork_object_revisions from public,anon,authenticated,service_role;
grant select on public.sc_artwork_object_revisions to authenticated,service_role;
create policy employee_read on public.sc_artwork_object_revisions for select to authenticated
 using(public.sc_internal_access_allowed(array['admin','manager','operator','viewer']));
create index sc_artwork_revision_object on public.sc_artwork_object_revisions(storage_provider,storage_bucket,storage_path);
create function sc_certification.immutable_artwork_revision() returns trigger
language plpgsql set search_path='' as $$ begin raise exception 'Artwork revision history is immutable' using errcode='42501'; end $$;
revoke all on function sc_certification.immutable_artwork_revision() from public,anon,authenticated,service_role;
create trigger sc_artwork_revision_immutable before update or delete on public.sc_artwork_object_revisions
 for each row execute function sc_certification.immutable_artwork_revision();
create trigger sc_certification_source_lock before insert on public.sc_artwork_object_revisions
 for each statement execute function sc_certification.lock_sources();

-- Only the authenticated server handler can supply a computed content digest.
create function public.sc_register_artwork_object_revision(p_asset uuid,p_updated_at timestamptz,
 p_provider text,p_bucket text,p_path text,p_sha256 text,p_bytes bigint,p_actor uuid,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.mockup_artwork_assets%rowtype; prior public.sc_artwork_object_revisions%rowtype; result uuid;
begin
 perform pg_advisory_xact_lock(17463,20261027);
 if p_actor is null then raise exception 'Verified manager required'; end if;
 select * into a from public.mockup_artwork_assets where id=p_asset for update;
 if a.id is null or a.updated_at is distinct from p_updated_at
  or a.storage_provider is distinct from p_provider or a.storage_bucket is distinct from p_bucket or a.storage_path is distinct from p_path then
  raise exception 'Artwork changed during verification; refresh and review again';
 end if;
 select * into prior from public.sc_artwork_object_revisions where artwork_asset_id=p_asset
  and asset_updated_at=p_updated_at and storage_provider=p_provider and storage_bucket=p_bucket and storage_path=p_path;
 if prior.id is not null then
  if prior.sha256 is distinct from p_sha256 or prior.byte_size is distinct from p_bytes then
   raise exception 'Registered artwork bytes changed; upload a new revision to a new object key';
  end if;
  return prior.id;
 end if;
 if exists(select 1 from public.sc_artwork_object_revisions where storage_provider=p_provider
  and storage_bucket=p_bucket and storage_path=p_path and sha256<>p_sha256) then
  raise exception 'An existing artwork object cannot be repinned to changed bytes; upload a new object key';
 end if;
 insert into public.sc_artwork_object_revisions(artwork_asset_id,asset_updated_at,storage_provider,storage_bucket,storage_path,sha256,byte_size,registered_by,review_note)
 values(p_asset,p_updated_at,p_provider,p_bucket,p_path,p_sha256,p_bytes,p_actor,p_note) returning id into result;
 insert into public.sc_certification_audit(kind,reason,source_table,details,actor_id)
 values('artwork_integrity_registered',p_note,'sc_artwork_object_revisions',jsonb_build_object('artwork_asset_id',p_asset,'revision_id',result,'sha256',p_sha256),p_actor);
 return result;
end $$;
revoke all on function public.sc_register_artwork_object_revision(uuid,timestamptz,text,text,text,text,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.sc_register_artwork_object_revision(uuid,timestamptz,text,text,text,text,bigint,uuid,text) to service_role;

create function public.sc_report_artwork_integrity_failure(p_asset uuid,p_updated_at timestamptz,p_actor uuid,p_expected text,p_actual text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(17463,20261027);
 -- Do not invalidate a newer revision because an older in-flight request failed.
 update public.mockup_artwork_assets set preflight_status='failed',updated_at=clock_timestamp()
  where id=p_asset and updated_at=p_updated_at;
 if found then
  insert into public.sc_certification_audit(kind,reason,source_table,details,actor_id)
  values('artwork_integrity_failed','Stored artwork bytes differ from the registered revision; restore or upload a new revision and reapprove',
   'mockup_artwork_assets',jsonb_build_object('artwork_asset_id',p_asset,'expected_sha256',p_expected,'actual_sha256',p_actual),p_actor);
 end if;
end $$;
revoke all on function public.sc_report_artwork_integrity_failure(uuid,timestamptz,uuid,text,text) from public,anon,authenticated;
grant execute on function public.sc_report_artwork_integrity_failure(uuid,timestamptz,uuid,text,text) to service_role;

alter function sc_certification.evaluate(uuid) rename to evaluate_before_integrity;
create function sc_certification.evaluate(p_configuration uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v jsonb; e jsonb; a jsonb; revisions jsonb='[]'; pin public.sc_artwork_object_revisions%rowtype; blockers jsonb; snap jsonb;
begin
 v=sc_certification.evaluate_before_integrity(p_configuration);
 blockers=v->'blockers'; snap=v->'snapshot';
 for e in select value from jsonb_array_elements(coalesce(snap->'placements','[]')) loop
  a=e->'artwork';
  select * into pin from public.sc_artwork_object_revisions where artwork_asset_id=(a->>'id')::uuid
   and asset_updated_at=(a->>'updated_at')::timestamptz and storage_provider=a->>'storage_provider'
   and storage_bucket=a->>'storage_bucket' and storage_path=a->>'storage_path';
  if pin.id is null then blockers=blockers||jsonb_build_array('Placement '||(e->>'position')||': register the reviewed artwork object checksum');
  else revisions=revisions||jsonb_build_array(to_jsonb(pin)); end if;
 end loop;
 snap=snap||jsonb_build_object('artwork_object_revisions',revisions);
 return v||jsonb_build_object('ready',jsonb_array_length(blockers)=0,'blockers',blockers,'snapshot',snap,'fingerprint',md5(snap::text));
end $$;
revoke all on function sc_certification.evaluate(uuid),sc_certification.evaluate_before_integrity(uuid) from public,anon,authenticated,service_role;
create trigger sc_certification_source_revalidate after insert on public.sc_artwork_object_revisions
 for each statement execute function sc_certification.revalidate_sources();
-- Any pre-existing certificate must explicitly adopt the additional evidence.
with revoked as (
 update public.sc_variation_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='Artwork object integrity registration requires reviewed recertification'
 where status='certified' returning id,configuration_id
) insert into public.sc_certification_audit(certification_id,configuration_id,kind,reason)
 select id,configuration_id,'revoked','Artwork object integrity registration requires reviewed recertification' from revoked;
