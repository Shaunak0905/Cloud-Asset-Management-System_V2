-- =============================================================================
-- Asset management: workflow-guarded status, automatic asset audit trail,
-- and department suggestions for forms and filters.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Workflow marker
-- Multi-step workflows (e.g. requesting/returning an asset) run in database
-- functions that mark the transaction with the workflow's name. Clients cannot
-- set this: PostgREST only exposes functions in `public`, and set_config() is
-- not one of them.
-- -----------------------------------------------------------------------------

create function private.current_workflow()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('app.workflow', true), '');
$$;

grant execute on function private.current_workflow() to authenticated;

-- -----------------------------------------------------------------------------
-- Asset status: ASSIGNED is entered and left only by the assignment workflow,
-- so an asset can never look assigned without a matching assignment record.
-- (Replaces the Phase 2 version; all earlier rules are unchanged.)
-- -----------------------------------------------------------------------------

create or replace function private.assets_before_update()
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

    if (old.status = 'ASSIGNED' or new.status = 'ASSIGNED')
      and private.current_workflow() is distinct from 'assignment'
    then
      raise exception 'Assigned status is managed by the assignment workflow'
        using errcode = 'check_violation';
    end if;

    if new.status = 'RETIRED' then
      new.archived_at := now();
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Asset audit trail (docs/13-audit-logging.md §8–15).
-- Written by the database in the same transaction as the change, so an asset
-- change can never be committed without its audit event. The actor is the
-- signed-in user (audit_logs trigger). SECURITY DEFINER: clients have no
-- INSERT privilege on audit_logs.
-- -----------------------------------------------------------------------------

create function private.assets_audit()
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

  if new.status is distinct from old.status then
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

create trigger assets_audit
  after insert or update on public.assets
  for each row execute function private.assets_audit();

-- -----------------------------------------------------------------------------
-- Department suggestions for the asset form and list filter.
-- SECURITY INVOKER: returns only departments of assets the caller can read.
-- -----------------------------------------------------------------------------

create function public.list_asset_departments()
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(distinct a.department order by a.department), '{}')
  from public.assets a
  where a.department is not null;
$$;

revoke execute on function public.list_asset_departments() from public;
grant execute on function public.list_asset_departments() to authenticated;
