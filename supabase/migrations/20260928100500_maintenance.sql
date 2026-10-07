-- =============================================================================
-- Maintenance: problem reports/requests and their append-only history.
-- =============================================================================

create sequence private.maintenance_request_number_seq;

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  -- Human-readable reference, e.g. MR-2026-0017. Generated.
  request_number text not null,
  asset_id uuid not null references public.assets (id),
  reported_by uuid not null references public.profiles (id),
  assigned_to uuid references public.profiles (id),
  description text not null,
  priority public.maintenance_priority not null default 'MEDIUM',
  status public.maintenance_status not null default 'OPEN',
  resolution_notes text,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  resolved_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint maintenance_requests_request_number_key unique (request_number),
  -- Target for composite FKs that keep history/documents on the same asset.
  constraint maintenance_requests_id_asset_id_key unique (id, asset_id),
  constraint maintenance_requests_description_length
    check (char_length(btrim(description)) between 1 and 2000),
  constraint maintenance_requests_resolution_notes_length
    check (resolution_notes is null or char_length(resolution_notes) <= 4000),
  constraint maintenance_requests_cancellation_reason_length
    check (cancellation_reason is null or char_length(cancellation_reason) <= 500),
  constraint maintenance_requests_technician_matches_status check (
    case status
      when 'OPEN' then assigned_to is null
      when 'CANCELLED' then true
      else assigned_to is not null and assigned_at is not null
    end
  ),
  constraint maintenance_requests_resolution_matches_status check (
    (status = 'RESOLVED') = (resolved_at is not null)
    and (status <> 'RESOLVED' or char_length(btrim(coalesce(resolution_notes, ''))) > 0)
  ),
  constraint maintenance_requests_cancellation_matches_status
    check ((status = 'CANCELLED') = (cancelled_at is not null))
);

create index maintenance_requests_asset_idx on public.maintenance_requests (asset_id, created_at desc);
create index maintenance_requests_reported_by_idx on public.maintenance_requests (reported_by, created_at desc);
create index maintenance_requests_assigned_to_idx on public.maintenance_requests (assigned_to, status);
create index maintenance_requests_status_idx on public.maintenance_requests (status, priority);
create index maintenance_requests_created_at_idx on public.maintenance_requests (created_at desc);

create table public.maintenance_history (
  id uuid primary key default gen_random_uuid(),
  maintenance_request_id uuid not null,
  -- Filled from the request when omitted; the composite FK guarantees it
  -- always matches the request's asset.
  asset_id uuid not null references public.assets (id),
  performed_by uuid not null references public.profiles (id),
  action public.maintenance_action not null,
  notes text,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint maintenance_history_request_fkey
    foreign key (maintenance_request_id, asset_id)
    references public.maintenance_requests (id, asset_id),
  constraint maintenance_history_notes_length check (notes is null or char_length(notes) <= 2000)
);

create index maintenance_history_request_idx on public.maintenance_history (maintenance_request_id, performed_at);
create index maintenance_history_asset_idx on public.maintenance_history (asset_id, performed_at desc);

-- -----------------------------------------------------------------------------
-- Allowed request status transitions (docs/08-maintenance-system.md §11).
-- Same-status updates (e.g. priority change, technician reassignment) are OK.
-- -----------------------------------------------------------------------------

create function private.maintenance_status_transition_allowed(
  from_status public.maintenance_status,
  to_status public.maintenance_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select from_status = to_status or case from_status
    when 'OPEN' then to_status in ('ASSIGNED', 'CANCELLED')
    when 'ASSIGNED' then to_status in ('IN_PROGRESS', 'CANCELLED')
    when 'IN_PROGRESS' then to_status = 'RESOLVED'
    else false -- RESOLVED and CANCELLED are terminal
  end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER: uses the private sequence.
create function private.maintenance_requests_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.request_number is not null then
    raise exception 'request_number is assigned by the database'
      using errcode = 'check_violation';
  end if;

  if new.status <> 'OPEN' or new.assigned_to is not null then
    raise exception 'New maintenance requests must be OPEN and unassigned'
      using errcode = 'check_violation';
  end if;

  new.request_number := private.format_reference(
    'MR', nextval('private.maintenance_request_number_seq'), 4
  );
  -- The reporter is always the signed-in user, never a client-supplied value.
  new.reported_by := coalesce(auth.uid(), new.reported_by);
  new.created_at := now();
  new.assigned_at := null;
  new.resolved_at := null;
  new.cancelled_at := null;
  return new;
end;
$$;

-- SECURITY DEFINER: must read the assignee's profile regardless of the
-- caller's row-level access to profiles.
create function private.maintenance_requests_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('RESOLVED', 'CANCELLED') then
    raise exception 'Closed maintenance requests cannot be modified'
      using errcode = 'check_violation';
  end if;

  if new.request_number is distinct from old.request_number
    or new.asset_id is distinct from old.asset_id
    or new.reported_by is distinct from old.reported_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Request number, asset, reporter and creation time cannot be changed'
      using errcode = 'check_violation';
  end if;

  if not private.maintenance_status_transition_allowed(old.status, new.status) then
    raise exception 'Invalid maintenance status transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
    if not exists (
      select 1
      from public.profiles p
      where p.id = new.assigned_to
        and p.role = 'TECHNICIAN'
        and p.is_active
    ) then
      raise exception 'Maintenance can only be assigned to an active technician'
        using errcode = 'check_violation';
    end if;
    new.assigned_at := now();
  else
    new.assigned_at := old.assigned_at;
  end if;

  new.resolved_at := case when new.status = 'RESOLVED' then now() end;
  new.cancelled_at := case when new.status = 'CANCELLED' then now() end;
  return new;
end;
$$;

create trigger maintenance_requests_before_insert
  before insert on public.maintenance_requests
  for each row execute function private.maintenance_requests_before_insert();

create trigger maintenance_requests_before_update
  before update on public.maintenance_requests
  for each row execute function private.maintenance_requests_before_update();

create trigger maintenance_requests_set_updated_at
  before update on public.maintenance_requests
  for each row execute function private.set_updated_at();

-- SECURITY DEFINER: reads the parent request to fill asset_id.
create function private.maintenance_history_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asset_id is null then
    select mr.asset_id into new.asset_id
    from public.maintenance_requests mr
    where mr.id = new.maintenance_request_id;
  end if;

  new.performed_by := coalesce(auth.uid(), new.performed_by);
  new.created_at := now();
  return new;
end;
$$;

create trigger maintenance_history_before_insert
  before insert on public.maintenance_history
  for each row execute function private.maintenance_history_before_insert();

create trigger maintenance_history_append_only
  before update or delete on public.maintenance_history
  for each row execute function private.prevent_modification();

alter table public.maintenance_requests enable row level security;
alter table public.maintenance_history enable row level security;
