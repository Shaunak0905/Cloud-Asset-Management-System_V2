-- =============================================================================
-- Maintenance resolution and cancellation (docs/08-maintenance-system.md
-- §26–29, docs/04-rls-security-policies.md §44, docs/11 §13–14,
-- docs/16-implementation-roadmap.md Phase 13).
--
--   resolve_maintenance  the assigned technician (or an admin) closes an
--                        IN_PROGRESS request with resolution notes and the
--                        asset's final state.
--   cancel_maintenance   an admin closes an OPEN or ASSIGNED request (e.g. a
--                        duplicate) with a reason the reporter can read.
--
-- Asset final state on resolution (docs/08 §27: never blindly AVAILABLE):
--   AVAILABLE  repaired. If another HIGH/CRITICAL problem is still open the
--              asset stays (or goes) IN_MAINTENANCE instead.
--   DAMAGED    work finished but the asset is still not usable.
--   RETIRED    beyond repair. Admins only: retirement cannot be undone, so a
--              technician marks the asset DAMAGED and an admin retires it.
-- An asset someone is using stays ASSIGNED (it returns to service when handed
-- back), and a LOST or RETIRED asset keeps its status: for these the final
-- state must be left empty. The app offers the same choices
-- (src/lib/maintenance/resolution.ts, tests/db/resolution.test.ts).
--
-- Cancelling a HIGH/CRITICAL request releases an asset that it took out of
-- service, unless another serious problem is still open (the reverse of the
-- rule in report_problem).
--
-- New error code (CA001–CA009: see earlier workflow migrations):
--   CA010  the chosen final asset state is not possible for this asset
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Which final states can be chosen for an asset in a given status.
--    NULL in the result means "leave the asset as it is" is the only option.
-- -----------------------------------------------------------------------------

create function private.resolution_asset_states(
  p_asset_status public.asset_status,
  p_is_admin boolean
)
returns public.asset_status[]
language sql
immutable
set search_path = ''
as $$
  select case
    when p_asset_status in ('AVAILABLE', 'IN_MAINTENANCE', 'DAMAGED') then
      case
        when p_is_admin then array['AVAILABLE', 'DAMAGED', 'RETIRED']::public.asset_status[]
        else array['AVAILABLE', 'DAMAGED']::public.asset_status[]
      end
    else null -- ASSIGNED, LOST, RETIRED: unchanged
  end;
$$;

revoke execute on function
  private.resolution_asset_states(public.asset_status, boolean)
from public;

-- -----------------------------------------------------------------------------
-- 2. resolve_maintenance
-- -----------------------------------------------------------------------------

create function public.resolve_maintenance(
  p_request_id uuid,
  p_resolution_notes text,
  p_asset_status public.asset_status default null
)
returns public.asset_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  is_admin boolean := private.is_admin();
  target_asset uuid;
  asset record;
  request record;
  choices public.asset_status[];
  final_status public.asset_status;
  notes text := btrim(coalesce(p_resolution_notes, ''));
begin
  if caller is null or not private.is_active_user() then
    raise exception 'Only signed-in, active users can resolve maintenance'
      using errcode = 'insufficient_privilege';
  end if;

  -- A request's asset never changes, so it can be read before locking.
  select mr.asset_id into target_asset
  from public.maintenance_requests mr
  where mr.id = p_request_id;

  if not found then
    raise exception 'Maintenance request not found' using errcode = 'no_data_found';
  end if;

  -- Lock the asset first, like every workflow that may change its status,
  -- then the request.
  select a.id, a.asset_id, a.status into asset
  from public.assets a
  where a.id = target_asset
  for update;

  select mr.id, mr.request_number, mr.status, mr.assigned_to into request
  from public.maintenance_requests mr
  where mr.id = p_request_id
  for update;

  if not is_admin
    and not (private.is_technician() and request.assigned_to = caller)
  then
    raise exception 'Only the assigned technician or an admin can resolve this request'
      using errcode = 'insufficient_privilege';
  end if;

  if request.status in ('RESOLVED', 'CANCELLED') then
    raise exception 'This maintenance request is closed' using errcode = 'CA007';
  end if;

  if request.status <> 'IN_PROGRESS' then
    raise exception 'Start work before resolving the request' using errcode = 'CA009';
  end if;

  if notes = '' then
    raise exception 'Describe what was done' using errcode = 'check_violation';
  end if;

  choices := private.resolution_asset_states(asset.status, is_admin);
  if p_asset_status = 'RETIRED' and not is_admin
    and asset.status in ('AVAILABLE', 'IN_MAINTENANCE', 'DAMAGED')
  then
    raise exception 'Only admins can retire assets' using errcode = 'insufficient_privilege';
  end if;
  if (choices is null and p_asset_status is not null)
    or (choices is not null and (p_asset_status is null or not p_asset_status = any (choices)))
  then
    raise exception 'This final state is not possible for the asset (%)', asset.status
      using errcode = 'CA010';
  end if;

  update public.maintenance_requests
  set status = 'RESOLVED', resolution_notes = notes
  where id = request.id;

  -- Decided after this request is closed, so it no longer counts as open.
  final_status := case
    when p_asset_status is null then asset.status
    when p_asset_status = 'AVAILABLE' and private.asset_needs_service(asset.id)
      then 'IN_MAINTENANCE'
    else p_asset_status
  end;
  if final_status is distinct from asset.status then
    -- The assets trigger audits the change (ASSET_STATUS_CHANGED / ASSET_RETIRED).
    update public.assets set status = final_status where id = asset.id;
  end if;

  insert into public.maintenance_history (maintenance_request_id, action, notes)
  values (
    request.id,
    'RESOLVED',
    case
      when asset.status = 'ASSIGNED' then
        'The asset stays with the person using it.'
      when p_asset_status is null then
        'The asset''s status was not changed.'
      when final_status = 'AVAILABLE' then 'The asset is back in service.'
      when final_status = 'IN_MAINTENANCE' then
        'Repaired, but the asset stays in maintenance: another serious problem is still open.'
      when final_status = 'DAMAGED' then 'The asset is still damaged.'
      else 'The asset was retired.'
    end
  );

  insert into public.audit_logs (action, entity_type, entity_id, old_values, new_values, metadata)
  values (
    'MAINTENANCE_RESOLVED',
    'maintenance_request',
    request.id,
    jsonb_build_object('status', 'IN_PROGRESS'),
    jsonb_build_object('status', 'RESOLVED'),
    jsonb_build_object(
      'request_number', request.request_number,
      'asset_id', asset.asset_id,
      'final_asset_status', final_status,
      'resolved_at', now()
    )
  );

  return final_status;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. cancel_maintenance
-- -----------------------------------------------------------------------------

create function public.cancel_maintenance(p_request_id uuid, p_reason text)
returns public.asset_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_asset uuid;
  asset record;
  request record;
  final_status public.asset_status;
  reason text := btrim(coalesce(p_reason, ''));
begin
  if not private.is_admin() then
    raise exception 'Only admins can cancel maintenance requests'
      using errcode = 'insufficient_privilege';
  end if;

  select mr.asset_id into target_asset
  from public.maintenance_requests mr
  where mr.id = p_request_id;

  if not found then
    raise exception 'Maintenance request not found' using errcode = 'no_data_found';
  end if;

  select a.id, a.asset_id, a.status into asset
  from public.assets a
  where a.id = target_asset
  for update;

  select mr.id, mr.request_number, mr.status, mr.priority into request
  from public.maintenance_requests mr
  where mr.id = p_request_id
  for update;

  if request.status in ('RESOLVED', 'CANCELLED') then
    raise exception 'This maintenance request is closed' using errcode = 'CA007';
  end if;

  if request.status = 'IN_PROGRESS' then
    raise exception 'Work has started: resolve the request instead' using errcode = 'CA009';
  end if;

  if reason = '' then
    raise exception 'Give a reason for cancelling' using errcode = 'check_violation';
  end if;

  -- The table's constraint limits the reason to 500 characters.
  update public.maintenance_requests
  set status = 'CANCELLED', cancellation_reason = reason
  where id = request.id;

  final_status := case
    when asset.status = 'IN_MAINTENANCE'
      and request.priority in ('HIGH', 'CRITICAL')
      and not private.asset_needs_service(asset.id)
      then 'AVAILABLE'
    else asset.status
  end;
  if final_status is distinct from asset.status then
    update public.assets set status = final_status where id = asset.id;
  end if;

  insert into public.maintenance_history (maintenance_request_id, action, notes)
  values (request.id, 'CANCELLED', reason);

  insert into public.audit_logs (action, entity_type, entity_id, old_values, new_values, metadata)
  values (
    'MAINTENANCE_CANCELLED',
    'maintenance_request',
    request.id,
    jsonb_build_object('status', request.status),
    jsonb_build_object('status', 'CANCELLED'),
    jsonb_build_object(
      'request_number', request.request_number,
      'asset_id', asset.asset_id,
      'final_asset_status', final_status
    )
  );

  return final_status;
end;
$$;

revoke execute on function
  public.resolve_maintenance(uuid, text, public.asset_status),
  public.cancel_maintenance(uuid, text)
from public, anon;
grant execute on function
  public.resolve_maintenance(uuid, text, public.asset_status),
  public.cancel_maintenance(uuid, text)
to authenticated;
