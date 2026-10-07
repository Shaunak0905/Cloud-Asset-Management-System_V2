-- =============================================================================
-- Dashboards (docs/12-dashboard-and-analytics.md, docs/16 Phase 17).
--
-- Dashboard numbers are computed in the database with COUNT / GROUP BY
-- (docs/12 §17, docs/17 §35), never by downloading rows to count them.
-- One call per dashboard:
--
--   admin_dashboard(p_month_start)       admins: assets, maintenance,
--                                        assignments, inventory, workload
--   technician_dashboard(p_month_start)  the caller's assigned work
--   my_dashboard()                       the caller's assets and reports
--
-- All three are SECURITY INVOKER: they run as the caller, so RLS still
-- decides which rows are counted (a technician's or student's numbers can
-- only ever cover their own records). The caller is always auth.uid(); no
-- user id is accepted from the browser (docs/12 §45).
--
-- p_month_start is the start of the current month in campus time, supplied
-- by the app (which owns the campus time zone), for "resolved this month"
-- (docs/12 §39). The filtering itself happens here.
-- =============================================================================

create function public.admin_dashboard(p_month_start timestamptz)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only admins can view the admin dashboard'
      using errcode = 'insufficient_privilege';
  end if;

  return jsonb_build_object(
    -- Every asset, retired included (docs/12 §38 "Total Assets").
    'assets_by_status', (
      select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
      from (select a.status, count(*) as n from public.assets a group by a.status) s
    ),
    'maintenance_by_status', (
      select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
      from (
        select mr.status, count(*) as n
        from public.maintenance_requests mr
        group by mr.status
      ) s
    ),
    -- Unfinished requests (OPEN, ASSIGNED, IN_PROGRESS) by priority.
    'open_by_priority', (
      select coalesce(jsonb_object_agg(s.priority, s.n), '{}'::jsonb)
      from (
        select mr.priority, count(*) as n
        from public.maintenance_requests mr
        where mr.status in ('OPEN', 'ASSIGNED', 'IN_PROGRESS')
        group by mr.priority
      ) s
    ),
    'unassigned_serious', (
      select count(*)
      from public.maintenance_requests mr
      where mr.status = 'OPEN' and mr.priority in ('HIGH', 'CRITICAL')
    ),
    'resolved_this_month', (
      select count(*)
      from public.maintenance_requests mr
      where mr.status = 'RESOLVED' and mr.resolved_at >= p_month_start
    ),
    'active_assignments', (
      select count(*) from public.asset_assignments aa where aa.status = 'ACTIVE'
    ),
    -- docs/12 §40: ACTIVE and past the expected return; no date = not overdue.
    'overdue_assignments', (
      select count(*)
      from public.asset_assignments aa
      where aa.status = 'ACTIVE' and aa.expected_return_at < now()
    ),
    -- Inventory views leave retired assets out.
    'assets_by_category', (
      select coalesce(
        jsonb_agg(jsonb_build_object('key', c.category, 'label', c.category, 'count', c.n)
          order by c.n desc, c.category),
        '[]'::jsonb)
      from (
        select a.category, count(*) as n
        from public.assets a
        where a.status <> 'RETIRED'
        group by a.category
      ) c
    ),
    'assets_by_building', (
      select coalesce(
        jsonb_agg(jsonb_build_object('key', b.id, 'label', b.name, 'count', b.n)
          order by b.n desc, b.name),
        '[]'::jsonb)
      from (
        select bl.id, bl.name, count(*) as n
        from public.assets a
        join public.buildings bl on bl.id = a.registered_building_id
        where a.status <> 'RETIRED'
        group by bl.id, bl.name
      ) b
    ),
    -- docs/12 §11: a guide for assigning work, not a productivity score.
    'technicians', (
      select coalesce(
        jsonb_agg(jsonb_build_object(
          'id', p.id,
          'name', p.full_name,
          'assigned', w.assigned,
          'in_progress', w.in_progress,
          'resolved_this_month', w.resolved
        ) order by p.full_name),
        '[]'::jsonb)
      from public.profiles p
      cross join lateral (
        select
          count(*) filter (where mr.status = 'ASSIGNED') as assigned,
          count(*) filter (where mr.status = 'IN_PROGRESS') as in_progress,
          count(*) filter (
            where mr.status = 'RESOLVED' and mr.resolved_at >= p_month_start
          ) as resolved
        from public.maintenance_requests mr
        where mr.assigned_to = p.id
      ) w
      where p.role = 'TECHNICIAN' and p.is_active
    )
  );
end;
$$;

create function public.technician_dashboard(p_month_start timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'assigned', count(*) filter (where mr.status = 'ASSIGNED'),
    'in_progress', count(*) filter (where mr.status = 'IN_PROGRESS'),
    'serious', count(*) filter (
      where mr.status in ('ASSIGNED', 'IN_PROGRESS')
        and mr.priority in ('HIGH', 'CRITICAL')
    ),
    'resolved_this_month', count(*) filter (
      where mr.status = 'RESOLVED' and mr.resolved_at >= p_month_start
    )
  )
  from public.maintenance_requests mr
  where mr.assigned_to = auth.uid();
$$;

create function public.my_dashboard()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'active_assignments', (
      select count(*)
      from public.asset_assignments aa
      where aa.user_id = auth.uid() and aa.status = 'ACTIVE'
    ),
    'overdue_assignments', (
      select count(*)
      from public.asset_assignments aa
      where aa.user_id = auth.uid()
        and aa.status = 'ACTIVE'
        and aa.expected_return_at < now()
    ),
    'open_reports', (
      select count(*)
      from public.maintenance_requests mr
      where mr.reported_by = auth.uid()
        and mr.status in ('OPEN', 'ASSIGNED', 'IN_PROGRESS')
    )
  );
$$;

revoke execute on function
  public.admin_dashboard(timestamptz),
  public.technician_dashboard(timestamptz),
  public.my_dashboard()
from public, anon;
grant execute on function
  public.admin_dashboard(timestamptz),
  public.technician_dashboard(timestamptz),
  public.my_dashboard()
to authenticated;
