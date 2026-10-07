-- =============================================================================
-- Foundation: private schema, enumerations and shared trigger functions.
-- =============================================================================

-- Internal helper/trigger functions live in `private`. The Supabase Data API
-- only exposes `public`, so clients can never call these directly.
create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Enumerations
-- -----------------------------------------------------------------------------

create type public.user_role as enum ('ADMIN', 'TECHNICIAN', 'STAFF', 'STUDENT');

create type public.asset_status as enum (
  'AVAILABLE',
  'ASSIGNED',
  'IN_MAINTENANCE',
  'LOST',
  'DAMAGED',
  'RETIRED'
);

-- TRANSFERRED closes an assignment whose responsibility moved to another user
-- (the new holder gets a fresh ACTIVE assignment, preserving history).
create type public.assignment_status as enum (
  'ACTIVE',
  'RETURNED',
  'TRANSFERRED',
  'CANCELLED'
);

create type public.maintenance_status as enum (
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CANCELLED'
);

create type public.maintenance_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- Entries in a maintenance request's timeline. Workflow steps (REPORTED,
-- ASSIGNED, STARTED, RESOLVED, CANCELLED) and technician work entries.
create type public.maintenance_action as enum (
  'REPORTED',
  'ASSIGNED',
  'STARTED',
  'INSPECTION',
  'DIAGNOSIS',
  'REPAIR',
  'PART_REPLACEMENT',
  'TESTING',
  'NOTE',
  'RESOLVED',
  'CANCELLED'
);

create type public.document_type as enum (
  'ASSET_IMAGE',
  'MAINTENANCE_IMAGE',
  'SERVICE_REPORT',
  'RECEIPT',
  'OTHER'
);

-- -----------------------------------------------------------------------------
-- Shared trigger functions
-- -----------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Rejects UPDATE/DELETE on append-only tables (history, audit).
create function private.prevent_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only: % is not allowed', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

-- Builds yearly human-readable references, e.g. AST-2026-00142, MR-2026-0017.
-- The number is never truncated once it exceeds min_digits.
create function private.format_reference(prefix text, seq_value bigint, min_digits integer)
returns text
language sql
stable
set search_path = ''
as $$
  select prefix
    || '-' || to_char(now() at time zone 'utc', 'YYYY')
    || '-' || lpad(seq_value::text, greatest(min_digits, length(seq_value::text)), '0');
$$;
