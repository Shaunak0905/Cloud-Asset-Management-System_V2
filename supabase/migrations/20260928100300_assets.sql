-- =============================================================================
-- Assets: physical campus equipment and its registered (home) location.
-- =============================================================================

create sequence private.asset_number_seq;

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  -- Human-readable institutional ID, e.g. AST-2026-00142. Generated.
  asset_id text not null,
  -- Stable identifier used in the QR URL /asset/<public_id>. Generated.
  public_id text not null,
  name text not null,
  category text not null,
  serial_number text,
  department text,
  -- Registered/home location. NEVER changed by temporary use elsewhere;
  -- usage location lives on asset_assignments.
  registered_building_id uuid not null references public.buildings (id),
  registered_room_id uuid not null,
  status public.asset_status not null default 'AVAILABLE',
  purchase_date date,
  warranty_until date,
  description text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint assets_asset_id_key unique (asset_id),
  constraint assets_public_id_key unique (public_id),
  constraint assets_serial_number_key unique (serial_number),
  constraint assets_registered_room_fkey
    foreign key (registered_room_id, registered_building_id)
    references public.rooms (id, building_id),
  constraint assets_asset_id_format check (asset_id ~ '^[A-Z0-9][A-Z0-9-]{2,39}$'),
  constraint assets_public_id_format check (public_id ~ '^[A-Za-z0-9][A-Za-z0-9-]{2,63}$'),
  constraint assets_name_length check (char_length(btrim(name)) between 1 and 200),
  constraint assets_category_valid check (category in (
    'Projector',
    'Laptop',
    'Desktop',
    'Camera',
    'Oscilloscope',
    'Arduino Kit',
    'Raspberry Pi',
    'Printer',
    'Networking Equipment',
    'Lab Equipment',
    'Other'
  )),
  constraint assets_serial_number_length
    check (serial_number is null or char_length(btrim(serial_number)) between 1 and 100),
  constraint assets_department_length check (department is null or char_length(department) <= 100),
  constraint assets_description_length check (description is null or char_length(description) <= 2000),
  constraint assets_warranty_after_purchase
    check (warranty_until is null or purchase_date is null or warranty_until >= purchase_date),
  constraint assets_archived_iff_retired check ((status = 'RETIRED') = (archived_at is not null))
);

create index assets_status_idx on public.assets (status);
create index assets_category_idx on public.assets (category);
create index assets_department_idx on public.assets (department);
create index assets_registered_building_idx on public.assets (registered_building_id);
create index assets_registered_room_idx on public.assets (registered_room_id, registered_building_id);
create index assets_created_at_idx on public.assets (created_at desc);

-- -----------------------------------------------------------------------------
-- Allowed status transitions (docs/06-asset-management.md §16).
-- -----------------------------------------------------------------------------

create function private.asset_status_transition_allowed(
  from_status public.asset_status,
  to_status public.asset_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case from_status
    when 'AVAILABLE' then to_status in ('ASSIGNED', 'IN_MAINTENANCE', 'DAMAGED', 'LOST', 'RETIRED')
    when 'ASSIGNED' then to_status in ('AVAILABLE', 'IN_MAINTENANCE', 'LOST', 'DAMAGED')
    when 'IN_MAINTENANCE' then to_status in ('AVAILABLE', 'DAMAGED', 'RETIRED')
    when 'DAMAGED' then to_status in ('IN_MAINTENANCE', 'AVAILABLE', 'RETIRED')
    when 'LOST' then to_status in ('AVAILABLE', 'RETIRED')
    else false -- RETIRED is terminal
  end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Assigns identifiers and the creator. SECURITY DEFINER so callers need no
-- privilege on the private sequence.
create function private.assets_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asset_id is not null or new.public_id is not null then
    raise exception 'asset_id and public_id are assigned by the database'
      using errcode = 'check_violation';
  end if;

  new.asset_id := private.format_reference('AST', nextval('private.asset_number_seq'), 5);
  new.public_id := new.asset_id;
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;

create function private.assets_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Printed QR codes depend on these never changing.
  if new.asset_id is distinct from old.asset_id or new.public_id is distinct from old.public_id then
    raise exception 'asset_id and public_id cannot be changed'
      using errcode = 'check_violation';
  end if;

  if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'created_by and created_at cannot be changed'
      using errcode = 'check_violation';
  end if;

  if new.status is distinct from old.status then
    if not private.asset_status_transition_allowed(old.status, new.status) then
      raise exception 'Invalid asset status transition: % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    if new.status = 'RETIRED' then
      new.archived_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger assets_before_insert
  before insert on public.assets
  for each row execute function private.assets_before_insert();

create trigger assets_before_update
  before update on public.assets
  for each row execute function private.assets_before_update();

create trigger assets_set_updated_at
  before update on public.assets
  for each row execute function private.set_updated_at();

alter table public.assets enable row level security;
