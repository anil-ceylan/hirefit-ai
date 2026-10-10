-- NON-ACTIVE DRAFT: provenance-uncertain replay compatibility bootstrap.
-- DRAFTING ONLY authorized. Execution requires separate explicit authorization.
-- Disposable isolated Supabase PostgreSQL 17 project ONLY; NEVER production.
-- This is NOT part of the application baseline or active migration history.
-- Source: production capture + supplemental ensure_rls audit; provenance remains uncertain.
-- See BOOTSTRAP-VERIFICATION.md. No automatic baseline execution follows.

BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $bootstrap_preflight$
BEGIN
  IF current_setting('hirefit.bootstrap_replay_target', true) IS DISTINCT FROM 'isolated-reviewed-target' THEN
    RAISE EXCEPTION 'DRAFT: separately authorized isolated bootstrap replay required';
  END IF;
  IF current_database() <> 'postgres' OR current_user <> 'postgres'
     OR current_setting('server_version_num')::integer / 10000 <> 17 THEN
    RAISE EXCEPTION 'Expected isolated postgres database/role on PostgreSQL 17';
  END IF;
  IF to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'Supabase platform prerequisites missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'Captured API roles missing; do not create or change platform roles';
  END IF;
  -- Reject ANY same-name public routine, including overloads/procedures, not just ().
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) OR EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls') THEN
    RAISE EXCEPTION 'Bootstrap name already present: stop; verify/preserve separately, never replace';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY (ARRAY[
      'analyses', 'career_companion_cases', 'career_companion_outcomes',
      'career_profiles', 'career_progress_snapshots', 'opportunities',
      'opportunity_location_preferences', 'opportunity_locations', 'opportunity_user_states',
      'profiles', 'user_plans', 'user_plans_id_seq', 'waitlist'
    ])
  ) OR to_regprocedure('public.increment_user_plan_analysis(uuid)') IS NOT NULL
    OR to_regprocedure('public.opportunity_radar_touch_updated_at()') IS NOT NULL THEN
    RAISE EXCEPTION 'Expected fresh replay target before application baseline; stop';
  END IF;
END;
$bootstrap_preflight$;

-- Exact captured definition except CREATE instead of CREATE OR REPLACE.
-- Do not change its best-effort exception handling, logging, filters or dynamic SQL.
CREATE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;
ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

-- Normalize ONLY this newly created function's direct ACL to the captured ACL.
-- No default ACLs, platform roles, other functions or schemas are modified.
DO $bootstrap_acl$
DECLARE recipient record;
BEGIN
  FOR recipient IN
    SELECT DISTINCT a.grantee
    FROM pg_proc p,
      LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    WHERE p.oid = 'public.rls_auto_enable()'::regprocedure
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION public.rls_auto_enable() FROM %s',
      CASE WHEN recipient.grantee = 0 THEN 'PUBLIC'
           ELSE quote_ident(pg_get_userbyid(recipient.grantee)) END);
  END LOOP;
END;
$bootstrap_acl$;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable()
  TO PUBLIC, postgres, anon, authenticated, service_role;

-- Event trigger reconstructed from supplemental audit (not present in base capture).
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();
ALTER EVENT TRIGGER ensure_rls OWNER TO postgres;
ALTER EVENT TRIGGER ensure_rls ENABLE;

-- Fail/rollback the entire bootstrap if captured postconditions do not match.
DO $bootstrap_verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
    WHERE p.oid = 'public.rls_auto_enable()'::regprocedure
      AND p.proowner = 'postgres'::regrole
      AND p.prokind = 'f' AND p.pronargs = 0
      AND p.prorettype = 'event_trigger'::regtype AND l.lanname = 'plpgsql'
      AND p.prosecdef AND NOT p.proisstrict AND NOT p.proleakproof
      AND p.provolatile = 'v' AND p.proparallel = 'u'
      AND p.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND (SELECT array_agg(a::text ORDER BY a::text) FROM unnest(p.proacl) a)
        = (SELECT array_agg(a::text ORDER BY a::text)
           FROM unnest('{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]) a)
      -- MD5 is only a definition-comparison checksum, not an authorization/signature mechanism.
      -- Complete pg_get_functiondef from capture, normalizing CRLF to LF only.
      AND md5(replace(pg_get_functiondef(p.oid), chr(13), '')) = '6998ea6b4c2480f5d2e34b5dcf3f8d36'
  ) THEN
    RAISE EXCEPTION 'Captured function definition/security/owner/ACL mismatch; rollback';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_event_trigger e
    WHERE e.evtname = 'ensure_rls' AND e.evtevent = 'ddl_command_end'
      AND e.evtenabled = 'O' AND e.evtowner = 'postgres'::regrole
      AND e.evtfoid = 'public.rls_auto_enable()'::regprocedure
      AND (SELECT array_agg(t ORDER BY t) FROM unnest(e.evttags) t)
        = ARRAY['CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO']::text[]
  ) OR (SELECT count(*) FROM pg_event_trigger
        WHERE evtfoid = 'public.rls_auto_enable()'::regprocedure) <> 1 THEN
    RAISE EXCEPTION 'Captured event trigger mismatch; rollback';
  END IF;
END;
$bootstrap_verify$;

COMMIT;
