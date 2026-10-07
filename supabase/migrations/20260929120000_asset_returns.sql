-- =============================================================================
-- Returns and transfers (docs/06-asset-management.md §21–22,
-- docs/11-server-side-logic-edge-functions.md §12).
--
--   return_asset    the assignee (or an admin) ends an ACTIVE assignment;
--                   the asset becomes AVAILABLE again.
--   assign_asset    an admin gives an AVAILABLE asset to a user.
--   transfer_asset  an admin hands an assigned asset to another user (or to a
--                   new usage location). The old assignment is kept as
--                   TRANSFERRED and a new ACTIVE one is created.
--
-- New error codes (see 20260929110000_asset_requests.sql for CA001–CA003):
--   CA004  the assignment is no longer active (already returned/transferred)
--   CA005  the chosen user does not exist or is deactivated
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Assignments are written only by the workflow functions. Direct admin
--    writes could close an assignment without freeing the asset (or open one
--    without marking it ASSIGNED), so they are removed. Reading is unchanged.
-- -----------------------------------------------------------------------------

drop policy asset_assignments_insert_admin on public.asset_assignments;
drop policy asset_assignments_update_admin on public.asset_assignments;
revoke insert, update on public.asset_assignments from authenticated;

-- -----------------------------------------------------------------------------
-- 2. Shared steps. Invoker rights: they run as the owner of the workflow
--    function that calls them, and API roles cannot execute them directly.
-- -----------------------------------------------------------------------------

-- Checks the usage location and expected return time, then opens an ACTIVE
-- assignment. The caller holds the asset row lock.
create function private.open_assignment(
  p_asset_id uuid,
  p_user_id uuid,
  p_usage_building_id uuid,
  p_usage_room_id uuid,
  p_expected_return_at timestamptz,
  p_notes text,
  out assignment_id uuid,
  out usage_building text,
  out usage_room text
)
language plpgsql
set search_path = ''
as $$
begin
  select b.code, r.room_number into usage_building, usage_room
  from public.rooms r
  join public.buildings b on b.id = r.building_id
  where r.id = p_usage_room_id
    and r.building_id = p_usage_building_id
    and r.is_active
    and b.is_active;

  if not found then
    raise exception 'The selected room does not belong to the selected building'
      using errcode = 'CA002';
  end if;

  if p_expected_return_at is not null
    and (p_expected_return_at <= now() or p_expected_return_at > now() + interval '365 days')
  then
    raise exception 'Expected return must be in the future and within a year'
      using errcode = 'CA003';
  end if;

  insert into public.asset_assignments (
    asset_id, user_id, usage_building_id, usage_room_id, expected_return_at, notes
  )
  values (
    p_asset_id,
    p_user_id,
    p_usage_building_id,
    p_usage_room_id,
    p_expected_return_at,
    nullif(btrim(p_notes), '')
  )
  returning id into assignment_id;
end;
$$;

-- Assigns an AVAILABLE asset to a user: used by request_asset (the caller
-- takes it) and assign_asset (an admin gives it to someone).
-- The asset row is locked, so of two simultaneous attempts exactly one
-- succeeds and the other gets CA001; the "one ACTIVE assignment per asset"
-- index is the final backstop. The registered location is never touched.
create function private.assign_available_asset(
  p_asset_id uuid,
  p_user_id uuid,
  p_usage_building_id uuid,
  p_usage_room_id uuid,
  p_expected_return_at timestamptz,
  p_notes text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  asset record;
  opened record;
begin
  select a.id, a.asset_id, a.status into asset
  from public.assets a
  where a.id = p_asset_id
  for update;

  if not found then
    raise exception 'Asset not found' using errcode = 'no_data_found';
  end if;

  if asset.status <> 'AVAILABLE' then
    raise exception 'This asset is not available' using errcode = 'CA001';
  end if;

  -- Marks this transaction as the assignment workflow (allows ASSIGNED).
  perform set_config('app.workflow', 'assignment', true);

  select * into opened
  from private.open_assignment(
    asset.id, p_user_id, p_usage_building_id, p_usage_room_id,
    p_expected_return_at, p_notes
  );

  update public.assets set status = 'ASSIGNED' where id = asset.id;

  insert into public.audit_logs (action, entity_type, entity_id, old_values, new_values, metadata)
  values (
    'ASSET_ASSIGNED',
    'asset',
    asset.id,
    jsonb_build_object('status', 'AVAILABLE'),
    jsonb_build_object('status', 'ASSIGNED'),
    jsonb_build_object(
      'asset_id', asset.asset_id,
      'assignment_id', opened.assignment_id,
      'usage_building', opened.usage_building,
      'usage_room', opened.usage_room,
      'expected_return_at', p_expected_return_at
    )
  );

  return opened.assignment_id;
exception
  -- Backstop: another transaction created an ACTIVE assignment first.
  when unique_violation then
    raise exception 'This asset is not available' using errcode = 'CA001';
end;
$$;

revoke execute on function
  private.open_assignment(uuid, uuid, uuid, uuid, timestamptz, text),
  private.assign_available_asset(uuid, uuid, uuid, uuid, timestamptz, text)
from public;

-- -----------------------------------------------------------------------------
-- 3. request_asset: unchanged behaviour, now built on the shared steps.
--    The assignee is always auth.uid().
-- -----------------------------------------------------------------------------

create or replace function public.request_asset(
  p_asset_id uuid,
  p_usage_building_id uuid,
  p_usage_room_id uuid,
  p_expected_return_at timestamptz default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_active_user() then
    raise exception 'Only signed-in, active users can request assets'
      using errcode = 'insufficient_privilege';
  end if;

  return private.assign_available_asset(
    p_asset_id, auth.uid(), p_usage_building_id, p_usage_room_id,
    p_expected_return_at, p_notes
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. return_asset: the assignee or an admin ends an ACTIVE assignment.
-- -----------------------------------------------------------------------------

create function public.return_asset(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target record;
  asset record;
  assignment_status public.assignment_status;
  new_status public.asset_status;
begin
  if caller is null or not private.is_active_user() then
    raise exception 'Only signed-in, active users can return assets'
      using errcode = 'insufficient_privilege';
  end if;

  -- An assignment's asset and user never change, so they can be read first.
  select aa.asset_id, aa.user_id into target
  from public.asset_assignments aa
  where aa.id = p_assignment_id;

  if not found then
    raise exception 'Assignment not found' using errcode = 'no_data_found';
  end if;

  if target.user_id <> caller and not private.is_admin() then
    raise exception 'You can only return assets assigned to you'
      using errcode = 'insufficient_privilege';
  end if;

  -- Lock the asset first, like every assignment workflow, so concurrent
  -- workflows on the same asset queue instead of deadlocking.
  select a.id, a.asset_id, a.status into asset
  from public.assets a
  where a.id = target.asset_id
  for update;

  select aa.status into assignment_status
  from public.asset_assignments aa
  where aa.id = p_assignment_id
  for update;

  if assignment_status <> 'ACTIVE' then
    raise exception 'This assignment has already been closed'
      using errcode = 'CA004';
  end if;

  perform set_config('app.workflow', 'assignment', true);

  update public.asset_assignments
  set status = 'RETURNED', returned_at = now()
  where id = p_assignment_id;

  -- An ACTIVE assignment always goes with an ASSIGNED asset; anything else is
  -- left as it is rather than guessed.
  new_status := case when asset.status = 'ASSIGNED' then 'AVAILABLE' else asset.status end;
  if new_status is distinct from asset.status then
    update public.assets set status = new_status where id = asset.id;
  end if;

  insert into public.audit_logs (action, entity_type, entity_id, old_values, new_values, metadata)
  values (
    'ASSET_RETURNED',
    'asset',
    asset.id,
    jsonb_build_object('status', asset.status),
    jsonb_build_object('status', new_status),
    jsonb_build_object(
      'asset_id', asset.asset_id,
      'assignment_id', p_assignment_id,
      'returned_at', now()
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. assign_asset: an admin gives an AVAILABLE asset to an active user.
-- -----------------------------------------------------------------------------

create function public.assign_asset(
  p_asset_id uuid,
  p_user_id uuid,
  p_usage_building_id uuid,
  p_usage_room_id uuid,
  p_expected_return_at timestamptz default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only admins can assign assets to other users'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.is_active) then
    raise exception 'Assets can only be assigned to active users'
      using errcode = 'CA005';
  end if;

  return private.assign_available_asset(
    p_asset_id, p_user_id, p_usage_building_id, p_usage_room_id,
    p_expected_return_at, p_notes
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. transfer_asset: an admin moves an ACTIVE assignment to another user or
--    usage location. History is preserved: the old assignment is closed as
--    TRANSFERRED, never overwritten or deleted. The asset stays ASSIGNED.
--    p_assignment_id is the assignment the admin was looking at; if it has
--    been closed meanwhile the transfer is refused (CA004).
-- -----------------------------------------------------------------------------

create function public.transfer_asset(
  p_assignment_id uuid,
  p_to_user_id uuid,
  p_usage_building_id uuid,
  p_usage_room_id uuid,
  p_expected_return_at timestamptz default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_asset uuid;
  asset record;
  assignment_status public.assignment_status;
  opened record;
begin
  if not private.is_admin() then
    raise exception 'Only admins can transfer assets'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_to_user_id and p.is_active) then
    raise exception 'Assets can only be assigned to active users'
      using errcode = 'CA005';
  end if;

  select aa.asset_id into target_asset
  from public.asset_assignments aa
  where aa.id = p_assignment_id;

  if not found then
    raise exception 'Assignment not found' using errcode = 'no_data_found';
  end if;

  select a.id, a.asset_id into asset
  from public.assets a
  where a.id = target_asset
  for update;

  select aa.status into assignment_status
  from public.asset_assignments aa
  where aa.id = p_assignment_id
  for update;

  if assignment_status <> 'ACTIVE' then
    raise exception 'This assignment has already been closed'
      using errcode = 'CA004';
  end if;

  perform set_config('app.workflow', 'assignment', true);

  -- Close first: only one ACTIVE assignment may exist per asset.
  update public.asset_assignments
  set status = 'TRANSFERRED', returned_at = now()
  where id = p_assignment_id;

  select * into opened
  from private.open_assignment(
    asset.id, p_to_user_id, p_usage_building_id, p_usage_room_id,
    p_expected_return_at, p_notes
  );

  insert into public.audit_logs (action, entity_type, entity_id, metadata)
  values (
    'ASSET_TRANSFERRED',
    'asset',
    asset.id,
    jsonb_build_object(
      'asset_id', asset.asset_id,
      'from_assignment_id', p_assignment_id,
      'to_assignment_id', opened.assignment_id,
      'usage_building', opened.usage_building,
      'usage_room', opened.usage_room,
      'expected_return_at', p_expected_return_at
    )
  );

  return opened.assignment_id;
end;
$$;

revoke execute on function
  public.return_asset(uuid),
  public.assign_asset(uuid, uuid, uuid, uuid, timestamptz, text),
  public.transfer_asset(uuid, uuid, uuid, uuid, timestamptz, text)
from public, anon;
grant execute on function
  public.return_asset(uuid),
  public.assign_asset(uuid, uuid, uuid, uuid, timestamptz, text),
  public.transfer_asset(uuid, uuid, uuid, uuid, timestamptz, text)
to authenticated;
