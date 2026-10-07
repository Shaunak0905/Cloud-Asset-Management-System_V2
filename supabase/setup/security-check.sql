-- =============================================================================
-- Security check for the live project (README → Security). Read-only: paste
-- it into the SQL Editor and run it any time, e.g. after a migration or a
-- change made in the dashboard.
--
-- Each row is a problem; "Success. No rows returned" means every check
-- passed. tests/db/security.test.ts runs this file against the migrations,
-- so it stays in step with the schema.
-- =============================================================================

with fns as (
  select n.nspname || '.' || p.proname as fn, p.oid, p.proacl, p.proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    -- functions that belong to an extension are managed by Supabase
    and not exists (
      select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
    )
)

-- 1. Every table in public has row level security on.
select 'RLS is off' as problem, c.relname::text as object
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity

-- 2. Anonymous visitors cannot read or write any table directly.
union all
select 'anon has ' || privilege_type || ' on table', table_name::text
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'

-- 3. Views would bypass RLS; the schema has none.
union all
select 'view in public schema', c.relname::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v', 'm')

-- 4. Anonymous visitors can call only the public QR lookup.
union all
select 'anon can call function', fn
from fns
where has_function_privilege('anon', oid, 'execute')
  and fn <> 'public.get_public_asset'

-- 5. No function is open to PUBLIC (every role) by default.
union all
select 'function executable by PUBLIC', fn
from fns
where proacl is null
   or exists (
     select 1 from aclexplode(proacl) a
     where a.grantee = 0 and a.privilege_type = 'EXECUTE'
   )

-- 6. Every function pins an empty search_path.
union all
select 'function without search_path = ''''', fn
from fns
where not coalesce(proconfig @> array['search_path=""'], false)

-- 7. Only signed-in users can use the internal helper schema.
union all
select 'anon can use schema', 'private'
where has_schema_privilege('anon', 'private', 'usage')

-- 8. Policies (tables and storage) apply to signed-in users only.
union all
select 'policy applies to ' || array_to_string(roles, ', '),
       schemaname || '.' || tablename || '.' || policyname
from pg_policies
where schemaname in ('public', 'storage')
  and roles <> array['authenticated']::name[]

-- 9. Buckets are private, with a size limit and a list of allowed types.
union all
select 'bucket is public or has no size/type limit', id
from storage.buckets
where public
   or file_size_limit is null
   or coalesce(cardinality(allowed_mime_types), 0) = 0

order by 1, 2;
