-- =============================================================================
-- Row Level Security: grants, role helpers, policies, and the public QR read
-- path. Authorization matrix: docs/04-rls-security-policies.md §42.
--
-- Layering:
--   1. Table/column GRANTs decide which operations and columns an API role can
--      touch at all (e.g. nobody can write profiles.role or assets.asset_id).
--   2. RLS policies decide which rows, based on the caller's active profile.
--   3. Triggers (previous migrations) enforce data integrity and workflows.
--   4. SECURITY DEFINER functions implement the few privileged workflows.
--
-- Anonymous users get no table access; the public QR page uses
-- public.get_public_asset(), which returns one asset's safe fields.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Grants: start from nothing, then grant exactly what is needed.
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

-- Objects created in future migrations are private until explicitly granted.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;

-- Reference data
grant select on public.buildings, public.rooms to authenticated;
grant insert (name, code, description, is_active),
      update (name, code, description, is_active)
  on public.buildings to authenticated;
grant insert (building_id, room_number, display_name, is_active),
      update (room_number, display_name, is_active)
  on public.rooms to authenticated;

-- Profiles: users may edit only their own contact details. role, is_active
-- and email change only through the admin functions below.
grant select on public.profiles to authenticated;
grant update (full_name, department, phone) on public.profiles to authenticated;

-- Assets: identifiers, creator and timestamps are set by the database.
grant select on public.assets to authenticated;
grant insert (name, category, serial_number, department, registered_building_id,
              registered_room_id, purchase_date, warranty_until, description)
  on public.assets to authenticated;
grant update (name, category, serial_number, department, registered_building_id,
              registered_room_id, purchase_date, warranty_until, description, status)
  on public.assets to authenticated;

-- Assignments
grant select on public.asset_assignments to authenticated;
grant insert (asset_id, user_id, usage_building_id, usage_room_id, expected_return_at, notes)
  on public.asset_assignments to authenticated;
grant update (status, expected_return_at, notes) on public.asset_assignments to authenticated;

-- Maintenance: the reporter is always the caller (set by trigger).
grant select on public.maintenance_requests to authenticated;
grant insert (asset_id, description, priority) on public.maintenance_requests to authenticated;
grant update (assigned_to, status, priority, resolution_notes, cancellation_reason)
  on public.maintenance_requests to authenticated;

grant select on public.maintenance_history to authenticated;
grant insert (maintenance_request_id, action, notes) on public.maintenance_history to authenticated;

-- Documents: metadata is insert-only; admins may delete (cleanup).
grant select, delete on public.asset_documents to authenticated;
grant insert (asset_id, maintenance_request_id, bucket_name, storage_path,
              original_filename, mime_type, file_size_bytes, document_type)
  on public.asset_documents to authenticated;

-- Audit: read-only for clients; events are written by trusted workflows.
grant select on public.audit_logs to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Role helpers used by policies.
-- SECURITY DEFINER so they can read profiles without triggering profiles RLS
-- (no recursion). An inactive user has no role, so every check fails for them.
-- -----------------------------------------------------------------------------

create function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active;
$$;

create function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_user_role() is not null;
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_role() = 'ADMIN', false);
$$;

create function private.is_technician()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_role() = 'TECHNICIAN', false);
$$;

-- Policies and invoker-rights triggers run as the API role, so it needs access
-- to exactly these helpers. `private` is still not exposed by the Data API.
revoke all on all functions in schema private from public;
grant usage on schema private to authenticated;
grant execute on function
  private.current_user_role(),
  private.is_active_user(),
  private.is_admin(),
  private.is_technician(),
  private.asset_status_transition_allowed(public.asset_status, public.asset_status)
to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Policies. `(select fn())` lets Postgres evaluate each helper once per
-- statement instead of once per row.
-- -----------------------------------------------------------------------------

-- profiles --------------------------------------------------------------------

-- Own profile is always readable (even when inactive, so the app can explain).
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using ((select private.is_admin()));

-- A technician can see who reported their assigned requests, and a reporter
-- can see which technician is handling their request.
create policy profiles_select_maintenance_participants on public.profiles
  for select to authenticated
  using (
    (select private.is_active_user())
    and exists (
      select 1
      from public.maintenance_requests mr
      where (mr.assigned_to = (select auth.uid()) and mr.reported_by = profiles.id)
         or (mr.reported_by = (select auth.uid()) and mr.assigned_to = profiles.id)
    )
  );

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select private.is_active_user()))
  with check (id = (select auth.uid()));

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- buildings & rooms -------------------------------------------------------------

create policy buildings_select_active_users on public.buildings
  for select to authenticated
  using ((select private.is_active_user()));

create policy buildings_insert_admin on public.buildings
  for insert to authenticated
  with check ((select private.is_admin()));

create policy buildings_update_admin on public.buildings
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy rooms_select_active_users on public.rooms
  for select to authenticated
  using ((select private.is_active_user()));

create policy rooms_insert_admin on public.rooms
  for insert to authenticated
  with check ((select private.is_admin()));

create policy rooms_update_admin on public.rooms
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- assets ------------------------------------------------------------------------

create policy assets_select_active_users on public.assets
  for select to authenticated
  using ((select private.is_active_user()));

create policy assets_insert_admin on public.assets
  for insert to authenticated
  with check ((select private.is_admin()));

create policy assets_update_admin on public.assets
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- asset_assignments ---------------------------------------------------------------
-- Students/staff create and return assignments through dedicated workflow
-- functions (Phase 9/10); direct writes are admin-only.

create policy asset_assignments_select on public.asset_assignments
  for select to authenticated
  using (
    (select private.is_admin())
    or (user_id = (select auth.uid()) and (select private.is_active_user()))
  );

create policy asset_assignments_insert_admin on public.asset_assignments
  for insert to authenticated
  with check ((select private.is_admin()));

create policy asset_assignments_update_admin on public.asset_assignments
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- maintenance_requests --------------------------------------------------------------

create policy maintenance_requests_select on public.maintenance_requests
  for select to authenticated
  using (
    (select private.is_admin())
    or (
      (select private.is_active_user())
      and (reported_by = (select auth.uid()) or assigned_to = (select auth.uid()))
    )
  );

-- Any active user may report a problem on a non-retired asset, as themselves.
create policy maintenance_requests_insert_active_users on public.maintenance_requests
  for insert to authenticated
  with check (
    (select private.is_active_user())
    and reported_by = (select auth.uid())
    and exists (
      select 1 from public.assets a
      where a.id = maintenance_requests.asset_id and a.status <> 'RETIRED'
    )
  );

-- Technician status changes go through workflow functions (Phase 12/13).
create policy maintenance_requests_update_admin on public.maintenance_requests
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- maintenance_history ---------------------------------------------------------------
-- Reporters see request status/resolution, not internal repair notes.

create policy maintenance_history_select on public.maintenance_history
  for select to authenticated
  using (
    (select private.is_admin())
    or (
      (select private.is_active_user())
      and exists (
        select 1 from public.maintenance_requests mr
        where mr.id = maintenance_history.maintenance_request_id
          and mr.assigned_to = (select auth.uid())
      )
    )
  );

-- Direct inserts are work notes on open requests; workflow entries (REPORTED,
-- ASSIGNED, STARTED, RESOLVED, CANCELLED) are written by workflow functions.
create policy maintenance_history_insert on public.maintenance_history
  for insert to authenticated
  with check (
    action in ('INSPECTION', 'DIAGNOSIS', 'REPAIR', 'PART_REPLACEMENT', 'TESTING', 'NOTE')
    and performed_by = (select auth.uid())
    and exists (
      select 1 from public.maintenance_requests mr
      where mr.id = maintenance_history.maintenance_request_id
        and mr.status in ('ASSIGNED', 'IN_PROGRESS')
        and (
          (select private.is_admin())
          or ((select private.is_technician()) and mr.assigned_to = (select auth.uid()))
        )
    )
  );

-- asset_documents -------------------------------------------------------------------

create policy asset_documents_select on public.asset_documents
  for select to authenticated
  using (
    (select private.is_admin())
    or (
      (select private.is_active_user())
      and (
        document_type = 'ASSET_IMAGE'
        or exists (
          select 1 from public.maintenance_requests mr
          where mr.id = asset_documents.maintenance_request_id
            and mr.assigned_to = (select auth.uid())
        )
      )
    )
  );

create policy asset_documents_insert on public.asset_documents
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and (
      (select private.is_admin())
      or (
        (select private.is_technician())
        and maintenance_request_id is not null
        and exists (
          select 1 from public.maintenance_requests mr
          where mr.id = asset_documents.maintenance_request_id
            and mr.assigned_to = (select auth.uid())
            and mr.status in ('ASSIGNED', 'IN_PROGRESS')
        )
      )
    )
  );

create policy asset_documents_delete_admin on public.asset_documents
  for delete to authenticated
  using ((select private.is_admin()));

-- audit_logs ------------------------------------------------------------------------

create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- 4. Public QR read path.
-- Returns only safe fields for ONE asset, so the full asset list cannot be
-- enumerated anonymously. No serial numbers, assignments, maintenance data,
-- internal IDs or creator information.
-- -----------------------------------------------------------------------------

create function public.get_public_asset(p_public_id text)
returns table (
  public_id text,
  asset_id text,
  name text,
  category text,
  status public.asset_status,
  department text,
  building_name text,
  building_code text,
  room_number text,
  room_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.public_id,
    a.asset_id,
    a.name,
    a.category,
    a.status,
    a.department,
    b.name,
    b.code,
    r.room_number,
    r.display_name
  from public.assets a
  join public.buildings b on b.id = a.registered_building_id
  join public.rooms r on r.id = a.registered_room_id
  where a.public_id = p_public_id;
$$;

grant execute on function public.get_public_asset(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Admin-only account workflows (role and activation changes are audited).
-- -----------------------------------------------------------------------------

create function public.change_user_role(target_user_id uuid, new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_role public.user_role;
begin
  if not private.is_admin() then
    raise exception 'Only administrators can change roles'
      using errcode = 'insufficient_privilege';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Administrators cannot change their own role'
      using errcode = 'check_violation';
  end if;

  select p.role into old_role
  from public.profiles p
  where p.id = target_user_id
  for update;

  if not found then
    raise exception 'User not found' using errcode = 'no_data_found';
  end if;

  if old_role = new_role then
    return;
  end if;

  if old_role = 'TECHNICIAN' and exists (
    select 1 from public.maintenance_requests mr
    where mr.assigned_to = target_user_id
      and mr.status in ('ASSIGNED', 'IN_PROGRESS')
  ) then
    raise exception 'Reassign this technician''s open maintenance requests first'
      using errcode = 'check_violation';
  end if;

  update public.profiles set role = new_role where id = target_user_id;

  insert into public.audit_logs (action, entity_type, entity_id, old_values, new_values)
  values (
    'ROLE_CHANGED',
    'profile',
    target_user_id,
    jsonb_build_object('role', old_role),
    jsonb_build_object('role', new_role)
  );
end;
$$;

create function public.set_user_active(target_user_id uuid, active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  was_active boolean;
  target_role public.user_role;
begin
  if not private.is_admin() then
    raise exception 'Only administrators can activate or deactivate accounts'
      using errcode = 'insufficient_privilege';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Administrators cannot change their own account status'
      using errcode = 'check_violation';
  end if;

  select p.is_active, p.role into was_active, target_role
  from public.profiles p
  where p.id = target_user_id
  for update;

  if not found then
    raise exception 'User not found' using errcode = 'no_data_found';
  end if;

  if was_active = active then
    return;
  end if;

  if not active and target_role = 'TECHNICIAN' and exists (
    select 1 from public.maintenance_requests mr
    where mr.assigned_to = target_user_id
      and mr.status in ('ASSIGNED', 'IN_PROGRESS')
  ) then
    raise exception 'Reassign this technician''s open maintenance requests first'
      using errcode = 'check_violation';
  end if;

  update public.profiles set is_active = active where id = target_user_id;

  insert into public.audit_logs (action, entity_type, entity_id, old_values, new_values)
  values (
    case when active then 'ACCOUNT_ACTIVATED' else 'ACCOUNT_DEACTIVATED' end,
    'profile',
    target_user_id,
    jsonb_build_object('is_active', was_active),
    jsonb_build_object('is_active', active)
  );
end;
$$;

grant execute on function public.change_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.set_user_active(uuid, boolean) to authenticated;
