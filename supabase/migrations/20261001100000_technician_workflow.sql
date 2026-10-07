-- =============================================================================
-- Technician workflow (docs/08-maintenance-system.md §14–20, §34–35, §48–49,
-- docs/16-implementation-roadmap.md Phase 12).
--
--   assign_technician  an admin assigns an open request to an active
--                      technician (OPEN -> ASSIGNED), or hands an unfinished
--                      request to a different technician.
--   start_maintenance  the assigned technician (or an admin) starts work
--                      (ASSIGNED -> IN_PROGRESS).
--   work notes         the assigned technician (or an admin) adds inspection,
--                      diagnosis, repair, part, testing or general notes to
--                      an unfinished request by inserting into
--                      maintenance_history (policy from the RLS migration);
--                      every note is audited.
--
-- Resolution and cancellation follow in the next phase.
--
-- Each workflow step writes its own history entry and audit event (with the
-- old/new status), so no separate MAINTENANCE_STATUS_CHANGED event is needed.
--
-- New error codes (CA001–CA006: see the asset request/return and maintenance
-- reporting migrations):
--   CA007  the maintenance request is closed (resolved or cancelled)
--   CA008  the chosen user is not an active technician
--   CA009  the request is not at the right step (e.g. starting work on a
--          request that has no technician yet)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Requests change only through workflow functions, so every change gets
--    its history entry and audit event. A direct admin UPDATE could, for
--    example, cancel a HIGH-priority request without releasing its asset.
-- -----------------------------------------------------------------------------

drop policy maintenance_requests_update_admin on public.maintenance_requests;
revoke update on public.maintenance_requests from authenticated;

-- -----------------------------------------------------------------------------
-- 2. Work notes must say something. Workflow entries (REPORTED, ASSIGNED,
--    STARTED, RESOLVED, CANCELLED) may have no notes.
-- -----------------------------------------------------------------------------

alter table public.maintenance_history
  add constraint maintenance_history_work_notes_required check (
    action in ('REPORTED', 'ASSIGNED', 'STARTED', 'RESOLVED', 'CANCELLED')
    or char_length(btrim(coalesce(notes, ''))) > 0
  );

-- -----------------------------------------------------------------------------
-- 3. Display name used in history notes ("Assigned to Ravi Kumar").
-- -----------------------------------------------------------------------------

create function private.profile_display_name(p_profile_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(btrim(p.full_name), ''), p.email, 'a former user')
  from public.profiles p
  where p.id = p_profile_id;
$$;

revoke execute on function private.profile_display_name(uuid) from public;

-- -----------------------------------------------------------------------------
-- 4. assign_technician
-- -----------------------------------------------------------------------------

create function public.assign_technician(p_request_id uuid, p_technician_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request record;
  new_status public.maintenance_status;
  technician_name text;
begin
  if not private.is_admin() then
    raise exception 'Only admins can assign technicians'
      using errcode = 'insufficient_privilege';
  end if;

  select mr.id, mr.request_number, mr.status, mr.assigned_to, a.asset_id into request
  from public.maintenance_requests mr
  join public.assets a on a.id = mr.asset_id
  where mr.id = p_request_id
  for update of mr;

  if not found then
    raise exception 'Maintenance request not found' using errcode = 'no_data_found';
  end if;

  if request.status in ('RESOLVED', 'CANCELLED') then
    raise exception 'This maintenance request is closed' using errcode = 'CA007';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_technician_id and p.role = 'TECHNICIAN' and p.is_active
  ) then
    raise exception 'Maintenance can only be assigned to an active technician'
      using errcode = 'CA008';
  end if;

  -- Assigning the same technician again (e.g. a double submit) changes nothing.
  if request.assigned_to = p_technician_id then
    return;
  end if;

  -- An unfinished request keeps its status when it changes hands.
  new_status := case when request.status = 'OPEN' then 'ASSIGNED' else request.status end;

  -- The table trigger sets assigned_at.
  update public.maintenance_requests
  set assigned_to = p_technician_id, status = new_status
  where id = request.id;

  technician_name := private.profile_display_name(p_technician_id);
  insert into public.maintenance_history (maintenance_request_id, action, notes)
  values (
    request.id,
    'ASSIGNED',
    case
      when request.assigned_to is null then 'Assigned to ' || technician_name
      else 'Reassigned to ' || technician_name
        || ' (previously ' || private.profile_display_name(request.assigned_to) || ')'
    end
  );

  insert into public.audit_logs (action, entity_type, entity_id, old_values, new_values, metadata)
  values (
    'MAINTENANCE_ASSIGNED',
    'maintenance_request',
    request.id,
    jsonb_build_object('status', request.status, 'assigned_to', request.assigned_to),
    jsonb_build_object('status', new_status, 'assigned_to', p_technician_id),
    jsonb_build_object(
      'request_number', request.request_number,
      'asset_id', request.asset_id,
      'technician_id', p_technician_id
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. start_maintenance. The asset's status is left as it is: serious
--    problems already took it out of service when reported, and the
--    resolution step decides what state it returns to.
-- -----------------------------------------------------------------------------

create function public.start_maintenance(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  request record;
begin
  if caller is null or not private.is_active_user() then
    raise exception 'Only signed-in, active users can start maintenance work'
      using errcode = 'insufficient_privilege';
  end if;

  select mr.id, mr.request_number, mr.status, mr.assigned_to, a.asset_id into request
  from public.maintenance_requests mr
  join public.assets a on a.id = mr.asset_id
  where mr.id = p_request_id
  for update of mr;

  if not found then
    raise exception 'Maintenance request not found' using errcode = 'no_data_found';
  end if;

  if not private.is_admin()
    and not (private.is_technician() and request.assigned_to = caller)
  then
    raise exception 'Only the assigned technician or an admin can start this work'
      using errcode = 'insufficient_privilege';
  end if;

  if request.status in ('RESOLVED', 'CANCELLED') then
    raise exception 'This maintenance request is closed' using errcode = 'CA007';
  end if;

  if request.status = 'OPEN' then
    raise exception 'Assign a technician before starting work' using errcode = 'CA009';
  end if;

  -- Already started (e.g. a double click): nothing to do.
  if request.status = 'IN_PROGRESS' then
    return;
  end if;

  update public.maintenance_requests set status = 'IN_PROGRESS' where id = request.id;

  insert into public.maintenance_history (maintenance_request_id, action)
  values (request.id, 'STARTED');

  insert into public.audit_logs (action, entity_type, entity_id, old_values, new_values, metadata)
  values (
    'MAINTENANCE_STARTED',
    'maintenance_request',
    request.id,
    jsonb_build_object('status', 'ASSIGNED'),
    jsonb_build_object('status', 'IN_PROGRESS'),
    jsonb_build_object(
      'request_number', request.request_number,
      'asset_id', request.asset_id
    )
  );
end;
$$;

revoke execute on function
  public.assign_technician(uuid, uuid),
  public.start_maintenance(uuid)
from public, anon;
grant execute on function
  public.assign_technician(uuid, uuid),
  public.start_maintenance(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Audit work notes (docs/13-audit-logging.md §20). The note text stays in
--    the history; the audit event records who added which kind of entry.
--    SECURITY DEFINER: clients cannot write audit_logs themselves.
-- -----------------------------------------------------------------------------

create function private.audit_work_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (action, entity_type, entity_id, metadata)
  select
    'MAINTENANCE_HISTORY_ADDED',
    'maintenance_request',
    new.maintenance_request_id,
    jsonb_build_object(
      'request_number', mr.request_number,
      'history_entry_id', new.id,
      'history_type', new.action
    )
  from public.maintenance_requests mr
  where mr.id = new.maintenance_request_id;
  return null;
end;
$$;

revoke execute on function private.audit_work_note() from public;

create trigger maintenance_history_audit_work_note
  after insert on public.maintenance_history
  for each row
  when (new.action in ('INSPECTION', 'DIAGNOSIS', 'REPAIR', 'PART_REPLACEMENT', 'TESTING', 'NOTE'))
  execute function private.audit_work_note();
