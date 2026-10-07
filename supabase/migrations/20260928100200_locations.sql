-- =============================================================================
-- Campus locations: buildings and the rooms inside them.
-- =============================================================================

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint buildings_name_key unique (name),
  constraint buildings_code_key unique (code),
  constraint buildings_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint buildings_code_format check (code ~ '^[A-Z0-9]{1,10}$'),
  constraint buildings_description_length check (description is null or char_length(description) <= 500)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete restrict,
  room_number text not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rooms_building_room_number_key unique (building_id, room_number),
  -- Target for composite foreign keys (room_id, building_id) on assets and
  -- assignments: the database itself guarantees a room belongs to the building
  -- it is paired with, so "Vyas + VK404" can never be stored.
  constraint rooms_id_building_id_key unique (id, building_id),
  constraint rooms_room_number_format check (room_number ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{0,19}$'),
  constraint rooms_display_name_length check (display_name is null or char_length(display_name) <= 100)
);

comment on constraint rooms_id_building_id_key on public.rooms is
  'Enables composite FKs that enforce room-belongs-to-building.';

create trigger buildings_set_updated_at
  before update on public.buildings
  for each row execute function private.set_updated_at();

create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function private.set_updated_at();

alter table public.buildings enable row level security;
alter table public.rooms enable row level security;
