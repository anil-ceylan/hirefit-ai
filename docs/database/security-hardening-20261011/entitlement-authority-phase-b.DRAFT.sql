-- NON-ACTIVE DRAFT: Phase B, only after Phase A + all servers/clients cut over.
-- No history writes. No data repair/backfill here. Original v1 draft MUST NOT be stacked.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $guard$
DECLARE actual jsonb; expected jsonb; fn regprocedure; t text; history_matches boolean;
BEGIN
 IF current_user<>'postgres' OR current_setting('server_version_num')::int/10000<>17
 OR current_setting('hirefit.entitlement_review_target',true) IS DISTINCT FROM 'isolated-reviewed-target'
 OR current_setting('hirefit.entitlement_cutover_review',true) IS DISTINCT FROM 'all-runtime-paths-reviewed' THEN
   RAISE EXCEPTION 'Separate isolated Phase B/cutover review required'; END IF;
 IF to_regnamespace('supabase_migrations') IS NULL
 OR to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
   RAISE EXCEPTION 'Disposable baseline migration history missing; do not create/repair history'; END IF;
 EXECUTE $history_check$SELECT count(*) = 1 AND count(*) FILTER (
   WHERE version::text = '20261010120000' AND name = 'production_state_baseline') = 1
   FROM supabase_migrations.schema_migrations$history_check$ INTO history_matches;
 IF history_matches IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Disposable migration history differs from the single reviewed baseline row'; END IF;
 LOCK TABLE public.user_plans,public.career_profiles,public.analyses IN ACCESS EXCLUSIVE MODE;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.user_plans'::regclass AND relrowsecurity AND relowner='postgres'::regrole)
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.career_profiles'::regclass AND relrowsecurity AND relowner='postgres'::regrole) THEN
   RAISE EXCEPTION 'Baseline RLS/owner differs'; END IF;

 -- Exact baseline ACLs/policies on the legacy authority boundary; column grants also stop.
 SELECT coalesce(jsonb_agg(jsonb_build_object('object','public.'||c.relname,
   'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee)::text END,
   'grantor',pg_get_userbyid(a.grantor)::text,'grantable',a.is_grantable,'privilege',a.privilege_type)),'[]'::jsonb)
 INTO actual FROM pg_class c,LATERAL aclexplode(c.relacl) a
 WHERE c.oid=ANY(ARRAY['public.user_plans'::regclass,'public.user_plans_id_seq'::regclass,'public.career_profiles'::regclass]);
 expected := $acl$[{"object":"public.career_profiles","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"DELETE"},{"object":"public.career_profiles","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"INSERT"},{"object":"public.career_profiles","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"SELECT"},{"object":"public.career_profiles","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"UPDATE"},{"object":"public.career_profiles","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"DELETE"},{"object":"public.career_profiles","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"INSERT"},{"object":"public.career_profiles","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"MAINTAIN"},{"object":"public.career_profiles","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"REFERENCES"},{"object":"public.career_profiles","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"SELECT"},{"object":"public.career_profiles","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"TRIGGER"},{"object":"public.career_profiles","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"TRUNCATE"},{"object":"public.career_profiles","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"UPDATE"},{"object":"public.career_profiles","grantee":"service_role","grantor":"postgres","grantable":false,"privilege":"INSERT"},{"object":"public.career_profiles","grantee":"service_role","grantor":"postgres","grantable":false,"privilege":"SELECT"},{"object":"public.career_profiles","grantee":"service_role","grantor":"postgres","grantable":false,"privilege":"UPDATE"},{"object":"public.user_plans","grantee":"anon","grantor":"postgres","grantable":false,"privilege":"DELETE"},{"object":"public.user_plans","grantee":"anon","grantor":"postgres","grantable":false,"privilege":"INSERT"},{"object":"public.user_plans","grantee":"anon","grantor":"postgres","grantable":false,"privilege":"MAINTAIN"},{"object":"public.user_plans","grantee":"anon","grantor":"postgres","grantable":false,"privilege":"REFERENCES"},{"object":"public.user_plans","grantee":"anon","grantor":"postgres","grantable":false,"privilege":"SELECT"},{"object":"public.user_plans","grantee":"anon","grantor":"postgres","grantable":false,"privilege":"TRIGGER"},{"object":"public.user_plans","grantee":"anon","grantor":"postgres","grantable":false,"privilege":"TRUNCATE"},{"object":"public.user_plans","grantee":"anon","grantor":"postgres","grantable":false,"privilege":"UPDATE"},{"object":"public.user_plans","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"DELETE"},{"object":"public.user_plans","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"INSERT"},{"object":"public.user_plans","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"MAINTAIN"},{"object":"public.user_plans","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"REFERENCES"},{"object":"public.user_plans","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"SELECT"},{"object":"public.user_plans","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"TRIGGER"},{"object":"public.user_plans","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"TRUNCATE"},{"object":"public.user_plans","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"UPDATE"},{"object":"public.user_plans","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"DELETE"},{"object":"public.user_plans","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"INSERT"},{"object":"public.user_plans","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"MAINTAIN"},{"object":"public.user_plans","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"REFERENCES"},{"object":"public.user_plans","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"SELECT"},{"object":"public.user_plans","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"TRIGGER"},{"object":"public.user_plans","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"TRUNCATE"},{"object":"public.user_plans","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"UPDATE"},{"object":"public.user_plans","grantee":"service_role","grantor":"postgres","grantable":false,"privilege":"DELETE"},{"object":"public.user_plans","grantee":"service_role","grantor":"postgres","grantable":false,"privilege":"INSERT"},{"object":"public.user_plans","grantee":"service_role","grantor":"postgres","grantable":false,"privilege":"MAINTAIN"},{"object":"public.user_plans","grantee":"service_role","grantor":"postgres","grantable":false,"privilege":"REFERENCES"},{"object":"public.user_plans","grantee":"service_role","grantor":"postgres","grantable":false,"privilege":"SELECT"},{"object":"public.user_plans","grantee":"service_role","grantor":"postgres","grantable":false,"privilege":"TRIGGER"},{"object":"public.user_plans","grantee":"service_role","grantor":"postgres","grantable":false,"privilege":"TRUNCATE"},{"object":"public.user_plans","grantee":"service_role","grantor":"postgres","grantable":false,"privilege":"UPDATE"},{"object":"public.user_plans_id_seq","grantee":"anon","grantor":"postgres","grantable":false,"privilege":"SELECT"},{"object":"public.user_plans_id_seq","grantee":"anon","grantor":"postgres","grantable":false,"privilege":"UPDATE"},{"object":"public.user_plans_id_seq","grantee":"anon","grantor":"postgres","grantable":false,"privilege":"USAGE"},{"object":"public.user_plans_id_seq","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"SELECT"},{"object":"public.user_plans_id_seq","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"UPDATE"},{"object":"public.user_plans_id_seq","grantee":"authenticated","grantor":"postgres","grantable":false,"privilege":"USAGE"},{"object":"public.user_plans_id_seq","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"SELECT"},{"object":"public.user_plans_id_seq","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"UPDATE"},{"object":"public.user_plans_id_seq","grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"USAGE"},{"object":"public.user_plans_id_seq","grantee":"service_role","grantor":"postgres","grantable":false,"privilege":"SELECT"},{"object":"public.user_plans_id_seq","grantee":"service_role","grantor":"postgres","grantable":false,"privilege":"UPDATE"},{"object":"public.user_plans_id_seq","grantee":"service_role","grantor":"postgres","grantable":false,"privilege":"USAGE"}]$acl$::jsonb;
 IF jsonb_array_length(actual)<>jsonb_array_length(expected) OR NOT(actual @> expected AND expected @> actual) THEN
   RAISE EXCEPTION 'Legacy grants differ; do not stack security-hardening-v1'; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid IN ('public.user_plans'::regclass,'public.career_profiles'::regclass) AND attacl IS NOT NULL) THEN
   RAISE EXCEPTION 'Unexpected column grants'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('object',format('public.user_plans.%I',p.polname),
   'roles',(SELECT jsonb_agg(CASE WHEN rid=0 THEN 'PUBLIC' ELSE pg_get_userbyid(rid)::text END ORDER BY rid) FROM unnest(p.polroles) rid),
   'using',pg_get_expr(p.polqual,p.polrelid),'command',p.polcmd::text,'permissive',p.polpermissive,
   'with_check',pg_get_expr(p.polwithcheck,p.polrelid))),'[]'::jsonb)
 INTO actual FROM pg_policy p WHERE polrelid='public.user_plans'::regclass;
 expected := $pol$[{"object":"public.user_plans.\"Users can insert own plan\"","roles":["PUBLIC"],"using":null,"command":"a","permissive":true,"with_check":"((auth.uid())::text = user_id)"},{"object":"public.user_plans.\"Users can read own plan\"","roles":["PUBLIC"],"using":"((auth.uid())::text = user_id)","command":"r","permissive":true,"with_check":null},{"object":"public.user_plans.\"Users can update own plan\"","roles":["PUBLIC"],"using":"((auth.uid())::text = user_id)","command":"w","permissive":true,"with_check":null}]$pol$::jsonb;
 IF jsonb_array_length(actual)<>jsonb_array_length(expected) OR NOT(actual @> expected AND expected @> actual) THEN
   RAISE EXCEPTION 'Legacy owner policies differ'; END IF;

 IF md5(replace(pg_get_functiondef('public.increment_user_plan_analysis(uuid)'::regprocedure),chr(13),''))
 IS DISTINCT FROM 'd0c78ccd84453f57519cad8faccf61dc' THEN RAISE EXCEPTION 'Legacy RPC differs'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.increment_user_plan_analysis(uuid)'::regprocedure
   AND proowner='postgres'::regrole AND prosecdef
   AND (SELECT array_agg(x::text ORDER BY x::text) FROM unnest(proacl) x)=ARRAY[
     'anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[]) THEN
   RAISE EXCEPTION 'Legacy RPC owner/ACL differs'; END IF;
 IF (SELECT md5(replace(prosrc,chr(13),'')) FROM pg_proc WHERE oid='public.hirefit_analysis_entitlement(uuid,text,uuid,boolean,text,text,text)'::regprocedure)
 IS DISTINCT FROM 'd1a6de31c2c49785b0464619d99962fa'
 OR (SELECT md5(replace(prosrc,chr(13),'')) FROM pg_proc WHERE oid='public.hirefit_set_authoritative_plan(uuid,text,text)'::regprocedure)
 IS DISTINCT FROM '201cd4221e8f98505fa9b64d1be2190c' THEN RAISE EXCEPTION 'Phase A authority body differs'; END IF;
 FOREACH fn IN ARRAY ARRAY['public.hirefit_analysis_entitlement(uuid,text,uuid,boolean,text,text,text)'::regprocedure,
 'public.hirefit_set_authoritative_plan(uuid,text,text)'::regprocedure] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=fn AND NOT prosecdef AND proowner='postgres'::regrole
     AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[])
   OR has_function_privilege('anon',fn,'EXECUTE') OR has_function_privilege('authenticated',fn,'EXECUTE')
   OR NOT has_function_privilege('service_role',fn,'EXECUTE') THEN RAISE EXCEPTION 'Authority function privilege drift'; END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['analysis_entitlement_accounts','analysis_entitlement_requests'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=('public.'||t)::regclass AND relrowsecurity AND relowner='postgres'::regrole)
   OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=('public.'||t)::regclass)
   OR has_table_privilege('authenticated',('public.'||t)::regclass,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_table_privilege('anon',('public.'||t)::regclass,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'Authority table drift'; END IF;
 END LOOP;
END;
$guard$;
REVOKE SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON public.user_plans FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.user_plans TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.user_plans TO service_role;
REVOKE SELECT,UPDATE,USAGE ON SEQUENCE public.user_plans_id_seq FROM PUBLIC,anon,authenticated,service_role;
-- Old cached frontend calls fail harmlessly instead of double-charging authoritative usage.
-- Preserve function definition for audit; only owner retains access.
REVOKE EXECUTE ON FUNCTION public.increment_user_plan_analysis(uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER POLICY "Users can insert own plan" ON public.user_plans TO authenticated;
ALTER POLICY "Users can read own plan" ON public.user_plans TO authenticated;
ALTER POLICY "Users can update own plan" ON public.user_plans TO authenticated;
-- Remove direct profile flag forgery; existing server persistence already uses service SIU.
REVOKE SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON public.career_profiles FROM PUBLIC,anon,authenticated;
DO $post$
DECLARE r text; p text; history_matches boolean;
BEGIN
 IF to_regnamespace('supabase_migrations') IS NULL
 OR to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
   RAISE EXCEPTION 'Disposable baseline migration history missing; do not create/repair history'; END IF;
 EXECUTE $history_check$SELECT count(*) = 1 AND count(*) FILTER (
   WHERE version::text = '20261010120000' AND name = 'production_state_baseline') = 1
   FROM supabase_migrations.schema_migrations$history_check$ INTO history_matches;
 IF history_matches IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Disposable migration history differs from the single reviewed baseline row'; END IF;
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
   IF has_table_privilege(r,'public.user_plans',p) IS DISTINCT FROM
    ((r='authenticated' AND p='SELECT') OR (r='service_role' AND p IN ('SELECT','INSERT','UPDATE'))) THEN
    RAISE EXCEPTION 'Plan privilege postcondition failed'; END IF;
  END LOOP;
  IF has_sequence_privilege(r,'public.user_plans_id_seq','SELECT,UPDATE,USAGE')
  OR has_function_privilege(r,'public.increment_user_plan_analysis(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Legacy capability remains'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.user_plans'::regclass AND polroles<>ARRAY['authenticated'::regrole::oid])
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.user_plans'::regclass AND relrowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.career_profiles'::regclass AND relrowsecurity)
 OR has_table_privilege('authenticated','public.career_profiles','SELECT,INSERT,UPDATE,DELETE')
 OR has_table_privilege('anon','public.career_profiles','SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Owner isolation postcondition failed'; END IF;
END;
$post$;
COMMIT;
