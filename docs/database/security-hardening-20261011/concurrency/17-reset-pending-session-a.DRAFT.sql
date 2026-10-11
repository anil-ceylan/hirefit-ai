-- REVIEW-ONLY DRAFT; NOT AUTHORIZED FOR EXECUTION. SESSION A: Run complete file; start B STEP 1 during 20-second hold.
-- Disposable hirefit-baseline-replay ONLY; operator must independently verify dashboard/ref.
-- No AI/application call. No schema/history/bucket mutation. No sequence reset.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='40s';
-- These markers are assertions, NOT target authentication.
SET LOCAL hirefit.entitlement_review_target='isolated-reviewed-target';
SET LOCAL hirefit.concurrency_project_ref='nddfpwqrfgcddzjwjrsw';

DO $suite_guard$
DECLARE t text; nonempty boolean; actual jsonb; expected jsonb;
BEGIN
 IF current_user<>'postgres' OR current_setting('server_version_num')::int/10000<>17
 OR current_setting('hirefit.entitlement_review_target',true) IS DISTINCT FROM 'isolated-reviewed-target'
 OR current_setting('hirefit.concurrency_project_ref',true) IS DISTINCT FROM 'nddfpwqrfgcddzjwjrsw'
 THEN RAISE EXCEPTION 'External disposable identity approval required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='auth' AND NOT t.tgisinternal AND t.tgenabled<>'D') THEN
   RAISE EXCEPTION 'Auth user insert triggers require separate review'; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='auth.users'::regclass AND attidentity<>'')
 OR EXISTS(SELECT 1 FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
   WHERE d.adrelid='auth.users'::regclass AND NOT EXISTS(SELECT 1 FROM (VALUES
     ('phone','NULL::character varying',''),('phone_change','''''::character varying',''),
     ('phone_change_token','''''::character varying',''),
     ('confirmed_at','LEAST(email_confirmed_at, phone_confirmed_at)','s'),
     ('email_change_token_current','''''::character varying',''),('email_change_confirm_status','0',''),
     ('reauthentication_token','''''::character varying',''),('is_sso_user','false',''),('is_anonymous','false','')
   ) reviewed(column_name,expression,generated_kind) WHERE a.attname::text=reviewed.column_name
   AND pg_get_expr(d.adbin,d.adrelid)=reviewed.expression AND a.attgenerated::text=reviewed.generated_kind)) THEN
   RAISE EXCEPTION 'Unreviewed auth defaults/generated/identity; no automatic workaround'; END IF;
 IF (SELECT md5(replace(prosrc,chr(13),'')) FROM pg_proc WHERE oid='public.hirefit_analysis_entitlement(uuid,text,uuid,boolean,text,text,text)'::regprocedure)
 IS DISTINCT FROM 'd1a6de31c2c49785b0464619d99962fa'
 OR (SELECT md5(replace(prosrc,chr(13),'')) FROM pg_proc WHERE oid='public.hirefit_set_authoritative_plan(uuid,text,text)'::regprocedure)
 IS DISTINCT FROM '201cd4221e8f98505fa9b64d1be2190c' THEN RAISE EXCEPTION 'Authority function drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND NOT t.tgisinternal AND NOT(t.tgname IN ('opportunities_touch_updated_at',
     'opportunity_user_states_touch_updated_at','opportunity_location_preferences_touch_updated_at','opportunity_locations_touch_updated_at')
     AND t.tgfoid='public.opportunity_radar_touch_updated_at()'::regprocedure AND t.tgenabled='O' AND t.tgtype=19)) THEN
   RAISE EXCEPTION 'Unexpected application trigger; side effects require review'; END IF;


 SELECT jsonb_agg(jsonb_build_array(a.attname::text,format_type(a.atttypid,a.atttypmod),a.attnotnull,
   pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) INTO actual
 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid='public.analysis_entitlement_accounts'::regclass AND a.attnum>0 AND NOT a.attisdropped;
 IF actual IS DISTINCT FROM $columns$[["user_id","uuid",true,null],["plan","text",true,null],["analysis_count","integer",true,"0"],["last_reset_at","timestamp with time zone",true,null],["authority_source","text",true,null],["onboarding_state","text",true,"'closed'::text"],["onboarding_prepared","boolean",true,"false"],["onboarding_closed_reason","text",false,null],["updated_at","timestamp with time zone",true,"now()"]]$columns$::jsonb
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.analysis_entitlement_accounts'::regclass
   AND (attidentity<>'' OR attgenerated<>'' OR attacl IS NOT NULL))
 THEN RAISE EXCEPTION 'Phase A analysis_entitlement_accounts columns/defaults drift'; END IF;
 SELECT coalesce(jsonb_agg(pg_get_expr(conbin,conrelid) ORDER BY pg_get_expr(conbin,conrelid)),'[]'::jsonb)
 INTO actual FROM pg_constraint WHERE conrelid='public.analysis_entitlement_accounts'::regclass AND contype='c';
 expected := $checks$["(plan = ANY (ARRAY['free'::text, 'pro'::text]))","(analysis_count >= 0)","(authority_source = ANY (ARRAY['new_free'::text, 'reviewed'::text, 'admin'::text, 'payment'::text]))","(onboarding_state = ANY (ARRAY['available'::text, 'reserved'::text, 'consumed'::text, 'closed'::text]))","(onboarding_closed_reason = ANY (ARRAY['completed'::text, 'skipped'::text]))","((onboarding_state = 'closed'::text) OR (onboarding_closed_reason IS NULL))"]$checks$::jsonb;
 IF jsonb_array_length(actual)<>jsonb_array_length(expected) OR NOT(actual @> expected AND expected @> actual)
 OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.analysis_entitlement_accounts'::regclass
   AND (NOT convalidated OR condeferrable OR condeferred OR contype NOT IN ('c','p','f')))
 OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.analysis_entitlement_accounts'::regclass AND contype='p')<>1
 OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.analysis_entitlement_accounts'::regclass AND contype='f')<>1
 THEN RAISE EXCEPTION 'Phase A analysis_entitlement_accounts constraints drift'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.analysis_entitlement_accounts'::regclass AND contype='p'
   AND conkey=ARRAY[1]::smallint[])
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.analysis_entitlement_accounts'::regclass AND contype='f'
   AND conkey=ARRAY[1]::smallint[]
   AND confrelid='auth.users'::regclass
   AND confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=confrelid
   AND attname=CASE WHEN confrelid='auth.users'::regclass THEN 'id' ELSE 'user_id' END)]::smallint[] AND confdeltype='c' AND confupdtype='a' AND confmatchtype='s')
 THEN RAISE EXCEPTION 'Phase A analysis_entitlement_accounts PK/FK drift'; END IF;

 SELECT jsonb_agg(jsonb_build_array(a.attname::text,format_type(a.atttypid,a.atttypmod),a.attnotnull,
   pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) INTO actual
 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid='public.analysis_entitlement_requests'::regclass AND a.attnum>0 AND NOT a.attisdropped;
 IF actual IS DISTINCT FROM $columns$[["request_id","uuid",true,null],["user_id","uuid",true,null],["kind","text",true,null],["status","text",true,null],["is_pro","boolean",true,null],["charge_usage","boolean",true,null],["created_at","timestamp with time zone",true,"now()"],["expires_at","timestamp with time zone",true,null],["input_hash","text",true,null],["release_reason","text",false,null],["settled_at","timestamp with time zone",false,null]]$columns$::jsonb
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.analysis_entitlement_requests'::regclass
   AND (attidentity<>'' OR attgenerated<>'' OR attacl IS NOT NULL))
 THEN RAISE EXCEPTION 'Phase A analysis_entitlement_requests columns/defaults drift'; END IF;
 SELECT coalesce(jsonb_agg(pg_get_expr(conbin,conrelid) ORDER BY pg_get_expr(conbin,conrelid)),'[]'::jsonb)
 INTO actual FROM pg_constraint WHERE conrelid='public.analysis_entitlement_requests'::regclass AND contype='c';
 expected := $checks$["(kind = ANY (ARRAY['normal'::text, 'onboarding'::text]))","(status = ANY (ARRAY['pending'::text, 'completed'::text, 'released'::text, 'expired'::text]))","(input_hash ~ '^[0-9a-f]{64}$'::text)","(release_reason = ANY (ARRAY['engine_failure'::text, 'timeout'::text, 'onboarding_closed'::text, 'lease_expired'::text]))","(expires_at = (created_at + '00:15:00'::interval))","((status = ANY (ARRAY['released'::text, 'expired'::text])) = (release_reason IS NOT NULL))","((status = 'pending'::text) = (settled_at IS NULL))","((kind <> 'onboarding'::text) OR ((NOT charge_usage) AND (NOT is_pro)))"]$checks$::jsonb;
 IF jsonb_array_length(actual)<>jsonb_array_length(expected) OR NOT(actual @> expected AND expected @> actual)
 OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.analysis_entitlement_requests'::regclass
   AND (NOT convalidated OR condeferrable OR condeferred OR contype NOT IN ('c','p','f')))
 OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.analysis_entitlement_requests'::regclass AND contype='p')<>1
 OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.analysis_entitlement_requests'::regclass AND contype='f')<>1
 THEN RAISE EXCEPTION 'Phase A analysis_entitlement_requests constraints drift'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.analysis_entitlement_requests'::regclass AND contype='p'
   AND conkey=ARRAY[1]::smallint[])
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.analysis_entitlement_requests'::regclass AND contype='f'
   AND conkey=ARRAY[2]::smallint[]
   AND confrelid='public.analysis_entitlement_accounts'::regclass
   AND confkey=ARRAY[1]::smallint[] AND confdeltype='c' AND confupdtype='a' AND confmatchtype='s')
 THEN RAISE EXCEPTION 'Phase A analysis_entitlement_requests PK/FK drift'; END IF;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('hirefit_analysis_entitlement','hirefit_set_authoritative_plan'))<>2
 THEN RAISE EXCEPTION 'Unexpected authority overload'; END IF;
 IF (SELECT count(*) FROM pg_index WHERE indrelid='public.analysis_entitlement_accounts'::regclass)<>1
 OR (SELECT count(*) FROM pg_index WHERE indrelid='public.analysis_entitlement_requests'::regclass)<>3
 OR EXISTS(SELECT 1 FROM pg_index WHERE indrelid IN ('public.analysis_entitlement_accounts'::regclass,
   'public.analysis_entitlement_requests'::regclass) AND (NOT indisvalid OR NOT indisready OR indexprs IS NOT NULL))
 OR NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid='public.analysis_entitlement_pending_idx'::regclass
   AND indrelid='public.analysis_entitlement_requests'::regclass AND NOT indisunique
   AND indkey::text='2' AND pg_get_expr(indpred,indrelid)='(status = ''pending''::text)')
 OR NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid='public.analysis_entitlement_onboarding_once'::regclass
   AND indrelid='public.analysis_entitlement_requests'::regclass AND indisunique AND indkey::text='2'
   AND pg_get_expr(indpred,indrelid)='((kind = ''onboarding''::text) AND (status = ANY (ARRAY[''pending''::text, ''completed''::text])))')
 THEN RAISE EXCEPTION 'Phase A indexes drift'; END IF;
 FOREACH t IN ARRAY ARRAY['analyses','career_profiles','career_progress_snapshots','career_companion_cases',
 'career_companion_outcomes','opportunities','opportunity_user_states','opportunity_location_preferences',
 'opportunity_locations','profiles','waitlist'] LOOP
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',t) INTO nonempty;
   IF nonempty THEN RAISE EXCEPTION 'Other application data present: stop'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM storage.buckets)
 OR EXISTS(SELECT 1 FROM auth.users WHERE id<>'aaaaaaaa-aaaa-4aaa-8aaa-000000000008'::uuid)
 OR EXISTS(SELECT 1 FROM auth.identities)
 OR EXISTS(SELECT 1 FROM auth.users WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-000000000008'::uuid
   AND (email IS DISTINCT FROM 'entitlement-concurrency-8@example.invalid'
   OR aud IS DISTINCT FROM 'authenticated' OR role IS DISTINCT FROM 'authenticated'))
 OR EXISTS(SELECT 1 FROM public.analysis_entitlement_accounts WHERE user_id<>'aaaaaaaa-aaaa-4aaa-8aaa-000000000008'::uuid)
 OR EXISTS(SELECT 1 FROM public.analysis_entitlement_requests WHERE user_id<>'aaaaaaaa-aaaa-4aaa-8aaa-000000000008'::uuid
   OR request_id NOT IN ('88888888-8888-4888-8888-000000000101'::uuid,'88888888-8888-4888-8888-000000000102'::uuid,'88888888-8888-4888-8888-000000000201'::uuid,'88888888-8888-4888-8888-000000000202'::uuid,'88888888-8888-4888-8888-000000000301'::uuid,'88888888-8888-4888-8888-000000000302'::uuid,'88888888-8888-4888-8888-000000000401'::uuid,'88888888-8888-4888-8888-000000000402'::uuid,'88888888-8888-4888-8888-000000000501'::uuid,'88888888-8888-4888-8888-000000000502'::uuid,'88888888-8888-4888-8888-000000000601'::uuid,'88888888-8888-4888-8888-000000000602'::uuid))
 OR EXISTS(SELECT 1 FROM public.user_plans WHERE user_id<>'aaaaaaaa-aaaa-4aaa-8aaa-000000000008')
 THEN RAISE EXCEPTION 'Unexpected identity/data/bucket or fixture collision'; END IF;
END;
$suite_guard$;
DO $phase_a_acl_history_guard$
DECLARE t text; r text; p text; fn regprocedure; history_matches boolean;
BEGIN
 IF to_regnamespace('supabase_migrations') IS NULL
 OR to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
   RAISE EXCEPTION 'Disposable baseline migration history missing; do not create/repair history'; END IF;
 EXECUTE $history_check$SELECT count(*) = 1 AND count(*) FILTER (
   WHERE version::text = '20261010120000' AND name = 'production_state_baseline') = 1
   FROM supabase_migrations.schema_migrations$history_check$ INTO history_matches;
 IF history_matches IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Disposable migration history differs from the single reviewed baseline row'; END IF;
 FOREACH t IN ARRAY ARRAY['analysis_entitlement_accounts','analysis_entitlement_requests'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=('public.'||t)::regclass
     AND relowner='postgres'::regrole AND relrowsecurity AND NOT relforcerowsecurity)
   OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=('public.'||t)::regclass) THEN RAISE EXCEPTION 'Authority RLS differs'; END IF;
   FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
     FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
       IF has_table_privilege(r,('public.'||t)::regclass,p) IS DISTINCT FROM
          (r='service_role' AND p IN ('SELECT','INSERT','UPDATE')) THEN RAISE EXCEPTION 'Authority ACL differs'; END IF;
     END LOOP;
   END LOOP;
 END LOOP;
 FOREACH fn IN ARRAY ARRAY['public.hirefit_analysis_entitlement(uuid,text,uuid,boolean,text,text,text)'::regprocedure,
    'public.hirefit_set_authoritative_plan(uuid,text,text)'::regprocedure] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=fn AND NOT prosecdef AND proowner='postgres'::regrole
      AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[])
   OR NOT has_function_privilege('service_role',fn,'EXECUTE')
   OR has_function_privilege('anon',fn,'EXECUTE') OR has_function_privilege('authenticated',fn,'EXECUTE') THEN
     RAISE EXCEPTION 'Authority function ACL/security differs'; END IF;
 END LOOP;
END;
$phase_a_acl_history_guard$;
DO $exact_privileges$
DECLARE t text; fn regprocedure; actual jsonb; expected jsonb;
BEGIN
 FOREACH t IN ARRAY ARRAY['analysis_entitlement_accounts','analysis_entitlement_requests'] LOOP
   SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantee)::text,a.privilege_type,a.is_grantable,
     pg_get_userbyid(a.grantor)::text) ORDER BY a.grantee,a.privilege_type)
   INTO actual FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid=('public.'||t)::regclass;
   expected:=$acl$[["postgres","SELECT",false,"postgres"],["postgres","INSERT",false,"postgres"],["postgres","UPDATE",false,"postgres"],["postgres","DELETE",false,"postgres"],["postgres","TRUNCATE",false,"postgres"],["postgres","REFERENCES",false,"postgres"],["postgres","TRIGGER",false,"postgres"],["postgres","MAINTAIN",false,"postgres"],["service_role","SELECT",false,"postgres"],["service_role","INSERT",false,"postgres"],["service_role","UPDATE",false,"postgres"]]$acl$::jsonb;
   IF actual IS NULL OR jsonb_array_length(actual)<>jsonb_array_length(expected)
   OR NOT(actual @> expected AND expected @> actual)
   OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=('public.'||t)::regclass
     AND relkind='r' AND relpersistence='p' AND NOT relispartition)
   THEN RAISE EXCEPTION 'Authority exact relation ACL/type drift'; END IF;
 END LOOP;
 FOREACH fn IN ARRAY ARRAY['public.hirefit_analysis_entitlement(uuid,text,uuid,boolean,text,text,text)'::regprocedure,
 'public.hirefit_set_authoritative_plan(uuid,text,text)'::regprocedure] LOOP
   SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantee)::text,a.privilege_type,a.is_grantable,
     pg_get_userbyid(a.grantor)::text) ORDER BY a.grantee,a.privilege_type)
   INTO actual FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.oid=fn;
   expected:='[["postgres","EXECUTE",false,"postgres"],["service_role","EXECUTE",false,"postgres"]]'::jsonb;
   IF actual IS NULL OR jsonb_array_length(actual)<>2 OR NOT(actual @> expected AND expected @> actual)
   OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=fn
     AND prorettype='jsonb'::regtype AND prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
     AND NOT proisstrict AND NOT proleakproof AND provolatile='v' AND proparallel='u')
   THEN RAISE EXCEPTION 'Authority exact function ACL/mode drift'; END IF;
 END LOOP;
END;
$exact_privileges$;

DO $fixture$
BEGIN
 IF ((SELECT count(*) FROM auth.users WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-000000000008')=1) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Fixture user missing'; END IF;

 IF ((SELECT count(*) FROM public.analysis_entitlement_accounts)=1 AND
 EXISTS(SELECT 1 FROM public.analysis_entitlement_accounts WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-000000000008'
 AND plan='free' AND analysis_count=1 AND authority_source='new_free'
 AND onboarding_state='available' AND onboarding_prepared
 AND onboarding_closed_reason IS NULL)) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Fixture account differs'; END IF;

 IF ((SELECT count(*) FROM public.analysis_entitlement_requests)=1 AND
 (SELECT count(*) FROM public.analysis_entitlement_requests WHERE status='pending')=1) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Fixture request state differs'; END IF;

 IF ((SELECT count(*) FROM public.user_plans)=1 AND EXISTS(SELECT 1 FROM public.user_plans
 WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-000000000008' AND plan='free' AND analysis_count=1
 AND last_reset_at=(SELECT last_reset_at FROM public.analysis_entitlement_accounts WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-000000000008'))) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Legacy projection differs'; END IF;

END;
$fixture$;
SET LOCAL ROLE service_role;
DO $operation$
DECLARE q jsonb;
BEGIN

 IF (EXISTS(SELECT 1 FROM public.analysis_entitlement_requests WHERE request_id='88888888-8888-4888-8888-000000000501'
 AND user_id='aaaaaaaa-aaaa-4aaa-8aaa-000000000008' AND status='pending' AND kind='normal' AND is_pro=false AND charge_usage=true
 AND input_hash=repeat('8',64) AND expires_at=created_at+interval '15 minutes')) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Expected request differs'; END IF;

 IF ((SELECT clock_timestamp()-last_reset_at>=interval '720 hours' FROM public.analysis_entitlement_accounts WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-000000000008')) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Boundary fixture differs'; END IF;

 q:=public.hirefit_analysis_entitlement('aaaaaaaa-aaaa-4aaa-8aaa-000000000008','snapshot',NULL,false,'normal',NULL,NULL);
 IF ((q->>'analysis_count')::int=0 AND (q->>'pending_count')::int=1) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Reset lost hold'; END IF;

 IF (EXISTS(SELECT 1 FROM public.analysis_entitlement_requests WHERE request_id='88888888-8888-4888-8888-000000000501' AND expires_at>clock_timestamp())) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Hold expired'; END IF;

END;
$operation$;
RESET ROLE;
SELECT 'A acquired advisory lock; B must overlap now' AS checkpoint,pg_backend_pid() AS backend_pid,clock_timestamp() AS recorded_at;
SELECT last_value,is_called FROM public.user_plans_id_seq;
SELECT pg_sleep(20); -- SQL-only bounded hold, no AI.
DO $history_after$
DECLARE history_matches boolean;
BEGIN
 IF to_regnamespace('supabase_migrations') IS NULL
 OR to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
   RAISE EXCEPTION 'Disposable baseline migration history missing; do not create/repair history'; END IF;
 EXECUTE $history_check$SELECT count(*) = 1 AND count(*) FILTER (
   WHERE version::text = '20261010120000' AND name = 'production_state_baseline') = 1
   FROM supabase_migrations.schema_migrations$history_check$ INTO history_matches;
 IF history_matches IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Disposable migration history differs from the single reviewed baseline row'; END IF;
END;
$history_after$;
COMMIT;
