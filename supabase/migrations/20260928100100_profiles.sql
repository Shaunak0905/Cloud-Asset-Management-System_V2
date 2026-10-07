-- =============================================================================
-- Profiles: application data for each Supabase Auth user (1:1 with auth.users).
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text,
  role public.user_role not null default 'STUDENT',
  department text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_email_key unique (email),
  constraint profiles_full_name_length check (char_length(btrim(full_name)) between 1 and 200),
  constraint profiles_department_length check (department is null or char_length(department) <= 100),
  constraint profiles_phone_length check (phone is null or char_length(phone) <= 30)
);

comment on table public.profiles is
  'Application profile and role for each auth user. Role is authoritative for authorization.';

create index profiles_role_idx on public.profiles (role) where is_active;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;

-- -----------------------------------------------------------------------------
-- Onboarding: every new auth user gets a STUDENT profile.
-- The role is NEVER read from user metadata (users control their own metadata);
-- elevated roles are granted only by an administrator.
-- -----------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(split_part(new.email, '@', 1), ''),
        'New user'
      ),
      200
    ),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Backfill profiles for users created before this migration ran.
insert into public.profiles (id, full_name, email)
select
  u.id,
  left(
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(u.email, '@', 1), ''),
      'New user'
    ),
    200
  ),
  u.email
from auth.users u
on conflict (id) do nothing;
