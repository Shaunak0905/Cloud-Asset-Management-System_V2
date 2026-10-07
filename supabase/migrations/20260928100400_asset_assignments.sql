-- =============================================================================
-- Asset assignments: who is using an asset, and WHERE it is being used.
-- The usage location is stored here and is independent of the asset's
-- registered location, which an assignment never changes.
-- =============================================================================

create table public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id),
  user_id uuid not null references public.profiles (id),
  usage_building_id uuid not null references public.buildings (id),
  usage_room_id uuid not null,
  status public.assignment_status not null default 'ACTIVE',
  assigned_at timestamptz not null default now(),
  expected_return_at timestamptz,
  -- When the assignment ended (returned, or handed over in a transfer).
  returned_at timestamptz,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint asset_assignments_usage_room_fkey
    foreign key (usage_room_id, usage_building_id)
    references public.rooms (id, building_id),
  constraint asset_assignments_expected_return_after_assigned
    check (expected_return_at is null or expected_return_at > assigned_at),
  constraint asset_assignments_returned_after_assigned
    check (returned_at is null or returned_at >= assigned_at),
  constraint asset_assignments_returned_at_matches_status check (
    case status
      when 'ACTIVE' then returned_at is null
      when 'RETURNED' then returned_at is not null
      when 'TRANSFERRED' then returned_at is not null
      else true
    end
  ),
  constraint asset_assignments_notes_length check (notes is null or char_length(notes) <= 1000)
);

-- Core concurrency guarantee: at most one ACTIVE assignment per asset. If two
-- users request the same asset at the same moment, one insert fails here.
create unique index asset_assignments_one_active_per_asset
  on public.asset_assignments (asset_id)
  where status = 'ACTIVE';

create index asset_assignments_asset_history_idx on public.asset_assignments (asset_id, assigned_at desc);
create index asset_assignments_user_idx on public.asset_assignments (user_id, status);
create index asset_assignments_usage_building_idx on public.asset_assignments (usage_building_id);
create index asset_assignments_usage_room_idx on public.asset_assignments (usage_room_id, usage_building_id);
create index asset_assignments_overdue_idx
  on public.asset_assignments (expected_return_at)
  where status = 'ACTIVE';

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create function private.asset_assignments_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'ACTIVE' then
    raise exception 'New assignments must be ACTIVE'
      using errcode = 'check_violation';
  end if;

  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;

-- Assignments are historical records: the who/what/where never change, and
-- only an ACTIVE assignment can be closed (RETURNED, TRANSFERRED, CANCELLED).
create function private.asset_assignments_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'ACTIVE' then
    raise exception 'Closed assignments cannot be modified'
      using errcode = 'check_violation';
  end if;

  if new.asset_id is distinct from old.asset_id
    or new.user_id is distinct from old.user_id
    or new.usage_building_id is distinct from old.usage_building_id
    or new.usage_room_id is distinct from old.usage_room_id
    or new.assigned_at is distinct from old.assigned_at
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Assignment asset, user, usage location and creation details cannot be changed'
      using errcode = 'check_violation';
  end if;

  if new.status in ('RETURNED', 'TRANSFERRED') then
    new.returned_at := coalesce(new.returned_at, now());
  end if;

  return new;
end;
$$;

create trigger asset_assignments_before_insert
  before insert on public.asset_assignments
  for each row execute function private.asset_assignments_before_insert();

create trigger asset_assignments_before_update
  before update on public.asset_assignments
  for each row execute function private.asset_assignments_before_update();

create trigger asset_assignments_set_updated_at
  before update on public.asset_assignments
  for each row execute function private.set_updated_at();

alter table public.asset_assignments enable row level security;
