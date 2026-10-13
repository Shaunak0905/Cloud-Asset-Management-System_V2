-- =============================================================================
-- Sustainability figures for the admin dashboard (UN SDG 12, Responsible
-- Consumption and Production; target 12.5: less waste through repair and
-- reuse). Read-only: no new tables or columns, only counts of what the
-- workflows already record.
--
--   repairs   finished repairs by the asset's final state, taken from the
--             MAINTENANCE_RESOLVED audit events (final_asset_status):
--             back in service (AVAILABLE, ASSIGNED: it stayed with the
--             person using it, IN_MAINTENANCE: repaired, another serious
--             problem still open), still damaged, or retired
--   sharing   loans (assignments, cancelled ones excluded) and the assets
--             used by more than one person: equipment shared, not bought
--   warranty  problems reported while the asset was under warranty, and
--             unfinished requests on assets still under warranty (worth
--             checking with the supplier)
--
-- SECURITY INVOKER like the other dashboards, so RLS still applies, and
-- admin-only. Totals cover all records. p_time_zone is the campus time zone,
-- supplied by the app (which owns it, as for admin_dashboard): it decides
-- today's date and the local date a problem was reported.
-- =============================================================================

create function public.sustainability_dashboard(p_time_zone text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  today date := (now() at time zone p_time_zone)::date;
begin
  if not private.is_admin() then
    raise exception 'Only admins can view the sustainability figures'
      using errcode = 'insufficient_privilege';
  end if;

  return jsonb_build_object(
    'repairs', (
      select jsonb_build_object(
        'repaired', count(*) filter (
          where o.final_status in ('AVAILABLE', 'ASSIGNED', 'IN_MAINTENANCE')
        ),
        'still_damaged', count(*) filter (where o.final_status = 'DAMAGED'),
        'retired', count(*) filter (where o.final_status = 'RETIRED')
      )
      from (
        select l.metadata ->> 'final_asset_status' as final_status
        from public.audit_logs l
        where l.action = 'MAINTENANCE_RESOLVED'
      ) o
    ),
    'sharing', (
      select jsonb_build_object(
        'loans', coalesce(sum(s.loans), 0),
        'assets_shared', count(*) filter (where s.people > 1)
      )
      from (
        select count(*) as loans, count(distinct aa.user_id) as people
        from public.asset_assignments aa
        where aa.status <> 'CANCELLED'
        group by aa.asset_id
      ) s
    ),
    'warranty', (
      select jsonb_build_object(
        'reported_under_warranty', count(*) filter (
          where mr.status <> 'CANCELLED'
            and (mr.created_at at time zone p_time_zone)::date <= a.warranty_until
        ),
        'open_under_warranty', count(*) filter (
          where mr.status in ('OPEN', 'ASSIGNED', 'IN_PROGRESS')
            and a.warranty_until >= today
        )
      )
      from public.maintenance_requests mr
      join public.assets a on a.id = mr.asset_id
      where a.warranty_until is not null
    )
  );
end;
$$;

revoke execute on function public.sustainability_dashboard(text) from public, anon;
grant execute on function public.sustainability_dashboard(text) to authenticated;
