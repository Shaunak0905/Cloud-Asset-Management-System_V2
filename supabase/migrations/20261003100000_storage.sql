-- =============================================================================
-- Storage (docs/09-storage-file-management.md, docs/16 Phase 14).
--
-- Files live in three PRIVATE Supabase Storage buckets; public.asset_documents
-- holds their metadata. The browser uploads straight to Storage (so files up
-- to 10 MB never pass through the app server), then the app registers the
-- file by inserting its asset_documents row. Files are read through
-- short-lived signed URLs.
--
--   asset-images            assets/<asset uuid>/<uuid>.(jpg|png|webp)
--                           upload: admins. read: every active signed-in user.
--   maintenance-images      maintenance/<request uuid>/<uuid>.(jpg|png|webp)
--   maintenance-documents   maintenance/<request uuid>/<uuid>.pdf
--                           upload: admins, or the assigned technician while
--                           the request is ASSIGNED / IN_PROGRESS.
--                           read: admins and the assigned technician.
--   delete                  admins. An uploader may also remove their own
--                           upload while it is not registered (cleanup after
--                           a failed registration).
--   Objects are never updated or overwritten (no UPDATE policy), and
--   anonymous users have no access at all.
--
-- Storage policies and table RLS are separate systems (docs/09 §21, §46), so
-- the rules for asset_documents are repeated here for storage.objects.
--
-- Registration is anchored to the stored object: the row's path must belong
-- to its asset/request, the object must exist, and its type and size are
-- taken from the object, not from the client.
--
-- New error code (CA001–CA010: see earlier workflow migrations):
--   CA011  the uploaded file was not found in storage
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Buckets: private, 10 MB per file, fixed MIME types (enforced by Storage
--    at upload). Re-running keeps the settings in line with this file.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('asset-images', 'asset-images', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('maintenance-images', 'maintenance-images', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('maintenance-documents', 'maintenance-documents', false, 10485760,
   array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 2. Is this object registered in asset_documents? SECURITY DEFINER so the
--    answer does not depend on which metadata rows the caller may read.
-- -----------------------------------------------------------------------------

create function private.document_registered(p_bucket text, p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.asset_documents d
    where d.bucket_name = p_bucket and d.storage_path = p_path
  );
$$;

revoke execute on function private.document_registered(text, text) from public;
grant execute on function private.document_registered(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Storage policies. Object names are matched against the generated path
--    format, and the entity id in the path must be a real asset/request the
--    caller may work on. (Columns are qualified as objects.name because
--    assets also has a "name" column.)
-- -----------------------------------------------------------------------------

create policy asset_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'asset-images'
    and (select private.is_active_user())
  );

create policy asset_images_insert_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'asset-images'
    and (select private.is_admin())
    and objects.name ~ '^assets/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    and exists (
      select 1 from public.assets a
      where a.id::text = split_part(objects.name, '/', 2)
    )
  );

create policy maintenance_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id in ('maintenance-images', 'maintenance-documents')
    and exists (
      select 1 from public.maintenance_requests mr
      where mr.id::text = split_part(objects.name, '/', 2)
        and (
          (select private.is_admin())
          or (
            (select private.is_active_user())
            and mr.assigned_to = (select auth.uid())
          )
        )
    )
  );

create policy maintenance_files_insert on storage.objects
  for insert to authenticated
  with check (
    (
      (
        bucket_id = 'maintenance-images'
        and objects.name ~ '^maintenance/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
      )
      or (
        bucket_id = 'maintenance-documents'
        and objects.name ~ '^maintenance/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
      )
    )
    and exists (
      select 1 from public.maintenance_requests mr
      where mr.id::text = split_part(objects.name, '/', 2)
        and (
          (select private.is_admin())
          or (
            (select private.is_technician())
            and mr.assigned_to = (select auth.uid())
            and mr.status in ('ASSIGNED', 'IN_PROGRESS')
          )
        )
    )
  );

create policy campus_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('asset-images', 'maintenance-images', 'maintenance-documents')
    and (
      (select private.is_admin())
      or (
        (select private.is_active_user())
        and owner_id = (select auth.uid())::text
        and not private.document_registered(bucket_id, objects.name)
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Registering a file (replaces the Phase 2 trigger function; filling
--    asset_id, uploaded_by and created_at is unchanged).
--    SECURITY DEFINER: reads the parent request and the stored object.
-- -----------------------------------------------------------------------------

create or replace function private.asset_documents_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_prefix text;
  object_metadata jsonb;
begin
  if new.asset_id is null and new.maintenance_request_id is not null then
    select mr.asset_id into new.asset_id
    from public.maintenance_requests mr
    where mr.id = new.maintenance_request_id;
  end if;

  -- The path must belong to the record the file is attached to.
  expected_prefix := case
    when new.maintenance_request_id is not null
      then 'maintenance/' || new.maintenance_request_id
    else 'assets/' || new.asset_id
  end || '/';
  if new.storage_path is null
    or left(new.storage_path, length(expected_prefix)) is distinct from expected_prefix
  then
    raise exception 'The storage path does not belong to this record'
      using errcode = 'check_violation';
  end if;

  select o.metadata into object_metadata
  from storage.objects o
  where o.bucket_id = new.bucket_name and o.name = new.storage_path;

  if not found then
    raise exception 'The uploaded file was not found in storage'
      using errcode = 'CA011';
  end if;

  -- What Storage actually holds wins over what the client claims.
  new.mime_type := coalesce(object_metadata ->> 'mimetype', new.mime_type);
  new.file_size_bytes := coalesce((object_metadata ->> 'size')::bigint, new.file_size_bytes);

  new.uploaded_by := coalesce(auth.uid(), new.uploaded_by);
  new.created_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Audit uploads and deletions (docs/13-audit-logging.md §23, docs/09 §26).
--    Paths and signed URLs are never written to the audit log.
--    SECURITY DEFINER: clients cannot write audit_logs themselves.
-- -----------------------------------------------------------------------------

create function private.asset_documents_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc record;
  asset_code text;
  request_code text;
begin
  if tg_op = 'DELETE' then
    doc := old;
  else
    doc := new;
  end if;

  select a.asset_id into asset_code from public.assets a where a.id = doc.asset_id;
  select mr.request_number into request_code
  from public.maintenance_requests mr
  where mr.id = doc.maintenance_request_id;

  if tg_op = 'DELETE' then
    insert into public.audit_logs (action, entity_type, entity_id, metadata)
    values (
      'DOCUMENT_DELETED',
      'asset_document',
      doc.id,
      jsonb_strip_nulls(jsonb_build_object(
        'asset_id', asset_code,
        'request_number', request_code,
        'document_type', doc.document_type
      ))
    );
  elsif doc.maintenance_request_id is not null then
    insert into public.audit_logs (action, entity_type, entity_id, metadata)
    values (
      'MAINTENANCE_EVIDENCE_UPLOADED',
      'maintenance_request',
      doc.maintenance_request_id,
      jsonb_build_object(
        'request_number', request_code,
        'document_id', doc.id,
        'document_type', doc.document_type,
        'file_type', doc.mime_type
      )
    );
  else
    insert into public.audit_logs (action, entity_type, entity_id, metadata)
    values (
      'ASSET_IMAGE_UPLOADED',
      'asset',
      doc.asset_id,
      jsonb_build_object(
        'asset_id', asset_code,
        'document_id', doc.id,
        'file_type', doc.mime_type
      )
    );
  end if;
  return null;
end;
$$;

revoke execute on function private.asset_documents_audit() from public;

create trigger asset_documents_audit
  after insert or delete on public.asset_documents
  for each row execute function private.asset_documents_audit();
