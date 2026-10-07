-- =============================================================================
-- Asset documents: metadata for files held in Supabase Storage.
-- The files themselves never live in PostgreSQL.
-- =============================================================================

create table public.asset_documents (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id),
  maintenance_request_id uuid,
  uploaded_by uuid not null references public.profiles (id),
  bucket_name text not null,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  document_type public.document_type not null,
  created_at timestamptz not null default now(),

  constraint asset_documents_storage_object_key unique (bucket_name, storage_path),
  -- A maintenance file must belong to the same asset as its request.
  constraint asset_documents_maintenance_request_fkey
    foreign key (maintenance_request_id, asset_id)
    references public.maintenance_requests (id, asset_id),
  constraint asset_documents_bucket_valid
    check (bucket_name in ('asset-images', 'maintenance-images', 'maintenance-documents')),
  -- Generated, entity-scoped paths only: no leading slash, no "..", no backslashes.
  constraint asset_documents_storage_path_safe check (
    char_length(storage_path) <= 512
    and storage_path ~ '^[A-Za-z0-9][A-Za-z0-9/_.-]*$'
    and storage_path !~ '\.\.'
    and storage_path !~ '//'
  ),
  constraint asset_documents_original_filename_length
    check (char_length(original_filename) between 1 and 255),
  constraint asset_documents_mime_type_valid
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  -- 10 MB per file (docs/09-storage-file-management.md §14).
  constraint asset_documents_file_size_valid
    check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  -- Each bucket holds one kind of file, attached to the right kind of entity.
  constraint asset_documents_bucket_contents check (
    case bucket_name
      when 'asset-images' then
        document_type = 'ASSET_IMAGE'
        and maintenance_request_id is null
        and mime_type like 'image/%'
      when 'maintenance-images' then
        document_type = 'MAINTENANCE_IMAGE'
        and maintenance_request_id is not null
        and mime_type like 'image/%'
      when 'maintenance-documents' then
        document_type in ('SERVICE_REPORT', 'RECEIPT', 'OTHER')
        and maintenance_request_id is not null
        and mime_type = 'application/pdf'
      else false
    end
  )
);

create index asset_documents_asset_idx on public.asset_documents (asset_id, created_at desc);
create index asset_documents_maintenance_request_idx
  on public.asset_documents (maintenance_request_id, asset_id)
  where maintenance_request_id is not null;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER: reads the parent request to fill asset_id.
create function private.asset_documents_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asset_id is null and new.maintenance_request_id is not null then
    select mr.asset_id into new.asset_id
    from public.maintenance_requests mr
    where mr.id = new.maintenance_request_id;
  end if;

  new.uploaded_by := coalesce(auth.uid(), new.uploaded_by);
  new.created_at := now();
  return new;
end;
$$;

create trigger asset_documents_before_insert
  before insert on public.asset_documents
  for each row execute function private.asset_documents_before_insert();

-- Metadata describes an uploaded object and is never edited; an incorrect
-- file is deleted (by an authorized admin) and re-uploaded instead.
create trigger asset_documents_no_update
  before update on public.asset_documents
  for each row execute function private.prevent_modification();

alter table public.asset_documents enable row level security;
