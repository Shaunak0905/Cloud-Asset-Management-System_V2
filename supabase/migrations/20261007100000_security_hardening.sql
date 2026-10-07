-- =============================================================================
-- Security hardening, Phase 19 (docs/04-rls-security-policies.md; Phase 21
-- in docs/16's numbering).
--
-- Postgres gives EXECUTE on every new function to PUBLIC (which includes
-- `anon`). That default is global, so the per-schema
-- `alter default privileges ... revoke execute ... from public` in the RLS
-- migration does not remove it: each function must revoke it itself. Two
-- functions in that migration only granted to `authenticated`, so anonymous
-- callers could reach them. Their own admin check still refused every call,
-- but anonymous users should not reach them at all.
--
-- tests/db/security.test.ts checks every function's grants, so a future
-- migration that forgets the revoke fails the test suite.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Admin account functions: signed-in callers only (each still checks for an
--    active admin).
-- -----------------------------------------------------------------------------

revoke execute on function
  public.change_user_role(uuid, public.user_role),
  public.set_user_active(uuid, boolean)
from public, anon;

grant execute on function
  public.change_user_role(uuid, public.user_role),
  public.set_user_active(uuid, boolean)
to authenticated;

-- The public QR lookup stays open to everyone, through its explicit grants
-- rather than the PUBLIC default.
revoke execute on function public.get_public_asset(text) from public;
grant execute on function public.get_public_asset(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Internal helpers: no PUBLIC execute on anything in `private`. Only
--    `authenticated` can use the schema; it keeps exactly the helpers that
--    RLS policies, storage policies and invoker-rights triggers call.
--    (Trigger functions need no EXECUTE grant to fire.)
-- -----------------------------------------------------------------------------

revoke execute on all functions in schema private from public;

grant execute on function
  private.current_user_role(),
  private.is_active_user(),
  private.is_admin(),
  private.is_technician(),
  private.current_workflow(),
  private.asset_status_transition_allowed(public.asset_status, public.asset_status),
  private.document_registered(text, text)
to authenticated;
