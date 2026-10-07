-- =============================================================================
-- Maintenance reporting (docs/08-maintenance-system.md §2–10, §30–32).
--
--   report_problem         any signed-in, active user reports a problem with
--                          an asset. The reporter is always auth.uid().
--   list_open_maintenance  request numbers and statuses of an asset's open
--                          reports, so people can avoid duplicates (§30)
--                          without seeing other people's reports.
--
-- Out-of-service rule (§10, §31): a HIGH or CRITICAL report means the asset
-- should not be used. An AVAILABLE asset goes straight to IN_MAINTENANCE; an
-- asset someone is using stays with them (the assignment is never silently
-- closed) and goes to IN_MAINTENANCE instead of AVAILABLE when returned.
-- LOW and MEDIUM reports leave the asset in use.
--
-- New error code (CA001–CA005: see the asset request/return migrations):
--   CA006  the asset is retired and cannot receive problem reports
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Reports are created only through report_problem, so every report gets
--    its history entry, audit event and asset status handling.
-- -----------------------------------------------------------------------------

drop policy maintenance_requests_insert_active_users on public.maintenance_requests;
revoke insert on public.maintenance_requests from authenticated;

-- -----------------------------------------------------------------------------
-- 2. Does the asset have an open problem serious enough to stop using it?
-- -----------------------------------------------------------------------------

create function private.asset_needs_service(p_asset_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.maintenance_requests mr
    where mr.asset_id = p_asset_id
      and mr.status in ('OPEN', 'ASSIGNED', 'IN_PROGRESS')
      and mr.priority in ('HIGH', 'CRITICAL')
  );
$$;

revoke execute on function private.asset_needs_service(uuid) from public;

-- -----------------------------------------------------------------------------
-- 3. report_problem
-- -----------------------------------------------------------------------------

create function public.report_problem(
  p_asset_id uuid,
  p_description text,
  p_priority public.maintenance_priority
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  asset record;
  report record;
begin
  if caller is null or not private.is_active_user() then
    raise exception 'Only signed-in, active users can report problems'
      using errcode = 'insufficient_privilege';
  end if;

  -- Lock the asset like the assignment workflows do: its status may change.
  select a.id, a.asset_id, a.status into asset
  from public.assets a
  where a.id = p_asset_id
  for update;

  if not found then
    raise exception 'Asset not found' using errcode = 'no_data_found';
  end if;

  if asset.status = 'RETIRED' then
    raise exception 'Retired assets cannot receive problem reports'
      using errcode = 'CA006';
  end if;

  -- Number, OPEN status and timestamps are set by the table's trigger.
  insert into public.maintenance_requests (asset_id, reported_by, description, priority)
  values (asset.id, caller, btrim(p_description), p_priority)
  returning id, request_number, priority into report;

  insert into public.maintenance_history (maintenance_request_id, asset_id, action)
  values (report.id, asset.id, 'REPORTED');

  insert into public.audit_logs (action, entity_type, entity_id, new_values, metadata)
  values (
    'MAINTENANCE_CREATED',
    'maintenance_request',
    report.id,
    jsonb_build_object('status', 'OPEN', 'priority', report.priority),
    jsonb_build_object(
      'request_number', report.request_number,
      'asset_id', asset.asset_id
    )
  );

  if asset.status = 'AVAILABLE' and private.asset_needs_service(asset.id) then
    update public.assets set status = 'IN_MAINTENANCE' where id = asset.id;
  end if;

  return report.request_number;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. list_open_maintenance: only the request number, status and date, never
--    the description or the reporter.
-- -----------------------------------------------------------------------------

create function public.list_open_maintenance(p_asset_id uuid)
returns table (
  request_number text,
  status public.maintenance_status,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select mr.request_number, mr.status, mr.created_at
  from public.maintenance_requests mr
  where mr.asset_id = p_asset_id
    and mr.status in ('OPEN', 'ASSIGNED', 'IN_PROGRESS')
    and private.is_active_user()
  order by mr.created_at desc
  limit 10;
$$;

-- -----------------------------------------------------------------------------
-- 5. return_asset: unchanged, except that an asset with an open HIGH or
--    CRITICAL problem goes to IN_MAINTENANCE instead of back to the pool.
-- -----------------------------------------------------------------------------

create or replace function public.return_asset(p_assignment_id uuid)
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
  new_status := case
    when asset.status <> 'ASSIGNED' then asset.status
    when private.asset_needs_service(asset.id) then 'IN_MAINTENANCE'
    else 'AVAILABLE'
  end;
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

revoke execute on function
  public.report_problem(uuid, text, public.maintenance_priority),
  public.list_open_maintenance(uuid)
from public, anon;
grant execute on function
  public.report_problem(uuid, text, public.maintenance_priority),
  public.list_open_maintenance(uuid)
to authenticated;
