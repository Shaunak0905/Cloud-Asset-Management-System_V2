-- =============================================================================
-- Asset requests: a signed-in user takes an AVAILABLE asset for use at a
-- chosen building/room (docs/06-asset-management.md §18–19).
--
-- Error codes returned to the app (SQLSTATE, class "CA" = Campus Assets):
--   CA001  asset is not available (not AVAILABLE, or already assigned)
--   CA002  usage room is not an active room of the chosen active building
--   CA003  expected return time is not in the allowed window
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Audit: inside the assignment workflow the workflow writes its own, richer
-- event (ASSET_ASSIGNED / ASSET_RETURNED), so the generic status-change event
-- is skipped there to avoid duplicates. Otherwise unchanged from Phase 7.
-- -----------------------------------------------------------------------------

create or replace function private.assets_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_fields text[];
  old_location jsonb;
  new_location jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (action, entity_type, entity_id, new_values)
    values (
      'ASSET_CREATED',
      'asset',
      new.id,
      jsonb_build_object(
        'asset_id', new.asset_id,
        'name', new.name,
        'category', new.category,
        'status', new.status,
        'registered_building_id', new.registered_building_id,
        'registered_room_id', new.registered_room_id
      )
    );
    return null;
  end if;

  if new.status is distinct from old.status
    and private.current_workflow() is distinct from 'assignment'
  then
    insert into public.audit_logs (action, entity_type, entity_id, old_values, new_values, metadata)
    values (
      case when new.status = 'RETIRED' then 'ASSET_RETIRED' else 'ASSET_STATUS_CHANGED' end,
      'asset',
      new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status),
      jsonb_build_object('asset_id', new.asset_id)
    );
  end if;

  if new.registered_room_id is distinct from old.registered_room_id
    or new.registered_building_id is distinct from old.registered_building_id
  then
    select jsonb_build_object('building_id', b.id, 'building', b.code, 'room_id', r.id, 'room', r.room_number)
      into old_location
    from public.rooms r join public.buildings b on b.id = r.building_id
    where r.id = old.registered_room_id;

    select jsonb_build_object('building_id', b.id, 'building', b.code, 'room_id', r.id, 'room', r.room_number)
      into new_location
    from public.rooms r join public.buildings b on b.id = r.building_id
    where r.id = new.registered_room_id;

    insert into public.audit_logs (action, entity_type, entity_id, old_values, new_values, metadata)
    values (
      'ASSET_REGISTERED_LOCATION_CHANGED',
      'asset',
      new.id,
      old_location,
      new_location,
      jsonb_build_object('asset_id', new.asset_id)
    );
  end if;

  select coalesce(array_agg(n.key order by n.key), '{}')
    into changed_fields
  from jsonb_each(to_jsonb(new)) n
  join jsonb_each(to_jsonb(old)) o using (key)
  where n.value is distinct from o.value
    and n.key in (
      'name', 'category', 'serial_number', 'department',
      'purchase_date', 'warranty_until', 'description'
    );

  if cardinality(changed_fields) > 0 then
    insert into public.audit_logs (action, entity_type, entity_id, metadata)
    values (
      'ASSET_UPDATED',
      'asset',
      new.id,
      jsonb_build_object('asset_id', new.asset_id, 'changed_fields', to_jsonb(changed_fields))
    );
  end if;

  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- request_asset: the only way a user takes an asset for themselves.
-- One transaction: the asset row is locked, so of two simultaneous requests
-- exactly one succeeds and the other gets CA001. The unique "one ACTIVE
-- assignment per asset" index is the final backstop.
-- The assignee is always auth.uid(); the registered location is not touched.
-- -----------------------------------------------------------------------------

create function public.request_asset(
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
declare
  caller uuid := auth.uid();
  asset record;
  location record;
  assignment_id uuid;
begin
  if caller is null or not private.is_active_user() then
    raise exception 'Only signed-in, active users can request assets'
      using errcode = 'insufficient_privilege';
  end if;

  -- Lock the asset: concurrent requests for it queue here.
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

  select b.code as building, r.room_number as room into location
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

  -- Marks this transaction as the assignment workflow (allows ASSIGNED).
  perform set_config('app.workflow', 'assignment', true);

  insert into public.asset_assignments (
    asset_id, user_id, usage_building_id, usage_room_id, expected_return_at, notes
  )
  values (
    asset.id,
    caller,
    p_usage_building_id,
    p_usage_room_id,
    p_expected_return_at,
    nullif(btrim(p_notes), '')
  )
  returning id into assignment_id;

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
      'assignment_id', assignment_id,
      'usage_building', location.building,
      'usage_room', location.room,
      'expected_return_at', p_expected_return_at
    )
  );

  return assignment_id;
exception
  -- Backstop: another transaction created an ACTIVE assignment first.
  when unique_violation then
    raise exception 'This asset is not available' using errcode = 'CA001';
end;
$$;

revoke execute on function public.request_asset(uuid, uuid, uuid, timestamptz, text) from public, anon;
grant execute on function public.request_asset(uuid, uuid, uuid, timestamptz, text) to authenticated;
