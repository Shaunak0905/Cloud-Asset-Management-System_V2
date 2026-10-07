-- =============================================================================
-- Audit logs: append-only record of important actions (who, what, when).
-- =============================================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- Always the authenticated user when called through the API; NULL only for
  -- trusted system/maintenance operations run directly in the database.
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb,
  created_at timestamptz not null default now(),

  -- Action names are defined centrally in application code (e.g. ASSET_CREATED).
  constraint audit_logs_action_format check (action ~ '^[A-Z][A-Z_]{2,63}$'),
  constraint audit_logs_entity_type_valid check (entity_type in (
    'asset',
    'asset_assignment',
    'maintenance_request',
    'maintenance_history',
    'asset_document',
    'profile',
    'building',
    'room'
  )),
  -- Keep payloads compact (docs/13-audit-logging.md §28).
  constraint audit_logs_payload_size check (
    coalesce(pg_column_size(old_values), 0)
      + coalesce(pg_column_size(new_values), 0)
      + coalesce(pg_column_size(metadata), 0) <= 16384
  )
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- The actor and timestamp come from the database, so an event can never be
-- attributed to someone else or backdated.
create function private.audit_logs_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actor_id := coalesce(auth.uid(), new.actor_id);
  new.created_at := now();
  return new;
end;
$$;

create trigger audit_logs_before_insert
  before insert on public.audit_logs
  for each row execute function private.audit_logs_before_insert();

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.prevent_modification();

alter table public.audit_logs enable row level security;
