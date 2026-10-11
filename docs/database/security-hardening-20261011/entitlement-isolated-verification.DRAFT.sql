-- NON-ACTIVE DRAFT. Execute ONLY after separate disposable-project authorization.
-- Sequential runtime subset. Two-session concurrency is a separate documented gate.
-- Identity nextval residue is expected even after ROLLBACK; never reset a sequence.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL statement_timeout='60s';
SET LOCAL lock_timeout='5s';
DO $preflight$
DECLARE t text; nonempty boolean; history_matches boolean;
BEGIN
 IF current_user<>'postgres' OR current_setting('hirefit.entitlement_review_target',true)
   IS DISTINCT FROM 'isolated-reviewed-target' THEN RAISE EXCEPTION 'Disposable authorization required'; END IF;
 IF to_regnamespace('supabase_migrations') IS NULL
 OR to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
   RAISE EXCEPTION 'Disposable baseline migration history missing; do not create/repair history'; END IF;
 EXECUTE $history_check$SELECT count(*) = 1 AND count(*) FILTER (
   WHERE version::text = '20261010120000' AND name = 'production_state_baseline') = 1
   FROM supabase_migrations.schema_migrations$history_check$ INTO history_matches;
 IF history_matches IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Disposable migration history differs from the single reviewed baseline row'; END IF;
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
 FOREACH t IN ARRAY ARRAY['user_plans','analyses','career_profiles','career_progress_snapshots',
   'career_companion_cases','career_companion_outcomes','opportunities','opportunity_user_states',
   'opportunity_location_preferences','opportunity_locations','profiles','waitlist',
   'analysis_entitlement_accounts','analysis_entitlement_requests'] LOOP
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',t) INTO nonempty;
   IF nonempty THEN RAISE EXCEPTION 'Test requires empty disposable application tables'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM storage.buckets) THEN RAISE EXCEPTION 'Expected absent buckets'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id::text LIKE 'aaaaaaaa-aaaa-4aaa-8aaa-%') THEN
   RAISE EXCEPTION 'Synthetic identity collision'; END IF;
END;
$preflight$;
-- Minimal explicit synthetic auth rows; no identities/files/real users are copied.
INSERT INTO auth.users(id,aud,role,email,email_confirmed_at)
SELECT ('aaaaaaaa-aaaa-4aaa-8aaa-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated',
 'entitlement-fixture-'||n||'@example.invalid',clock_timestamp() FROM generate_series(1,8) n;

SET LOCAL ROLE service_role;
DO $runtime$
DECLARE a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
 b uuid:='aaaaaaaa-aaaa-4aaa-8aaa-000000000002';
 c uuid:='aaaaaaaa-aaaa-4aaa-8aaa-000000000003';
 d uuid:='aaaaaaaa-aaaa-4aaa-8aaa-000000000004';
 e uuid:='aaaaaaaa-aaaa-4aaa-8aaa-000000000005';
 f uuid:='aaaaaaaa-aaaa-4aaa-8aaa-000000000006';
 g uuid:='aaaaaaaa-aaaa-4aaa-8aaa-000000000007';
 k uuid:='11111111-1111-4111-8111-000000000001';
 q jsonb; n integer;
BEGIN
 q:=public.hirefit_analysis_entitlement(a,'snapshot');
 IF q->>'plan' IS DISTINCT FROM 'free' OR (q->>'analysis_count')::int IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Free initialization failed'; END IF;
 FOR n IN 1..2 LOOP
   k:=('11111111-1111-4111-8111-'||lpad(n::text,12,'0'))::uuid;
   q:=public.hirefit_analysis_entitlement(a,'reserve',k,false,'normal',repeat('a',64));
   IF (q->>'allowed')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Admission failed'; END IF;
   PERFORM public.hirefit_analysis_entitlement(a,'complete',k);
   PERFORM public.hirefit_analysis_entitlement(a,'complete',k);
 END LOOP;
 q:=public.hirefit_analysis_entitlement(a,'snapshot');
 IF (q->>'allowed')::boolean IS DISTINCT FROM false OR (q->>'analysis_count')::int IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'Quota/idempotency failed'; END IF;
 UPDATE public.user_plans SET plan='pro',analysis_count=0,last_reset_at=clock_timestamp() WHERE user_id=a::text;
 q:=public.hirefit_analysis_entitlement(a,'snapshot');
 IF q->>'plan' IS DISTINCT FROM 'free' OR (q->>'analysis_count')::int IS DISTINCT FROM 2
 OR (q->>'allowed')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'Legacy forgery influenced authority'; END IF;
 q:=public.hirefit_analysis_entitlement(a,'reserve',k,false,'normal',repeat('a',64));
 IF q->>'error' IS DISTINCT FROM 'ANALYSIS_ALREADY_COMPLETED' THEN RAISE EXCEPTION 'Replay fence failed'; END IF;
 PERFORM public.hirefit_analysis_entitlement(b,'prepare',NULL,false,'onboarding');
 k:='22222222-2222-4222-8222-000000000001';
 q:=public.hirefit_analysis_entitlement(b,'reserve',k,false,'onboarding',repeat('b',64));
 IF q->>'onboarding_state' IS DISTINCT FROM 'reserved' THEN RAISE EXCEPTION 'Benefit reserve failed'; END IF;
 PERFORM public.hirefit_analysis_entitlement(b,'complete',k,false,'onboarding');
 q:=public.hirefit_analysis_entitlement(b,'snapshot',NULL,false,'onboarding');
 IF q->>'onboarding_state' IS DISTINCT FROM 'consumed' OR (q->>'allowed')::boolean IS DISTINCT FROM false
 OR (q->>'analysis_count')::int IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Benefit consumption failed'; END IF;
 PERFORM public.hirefit_analysis_entitlement(c,'close',NULL,false,'onboarding',NULL,'skipped');
 PERFORM public.hirefit_analysis_entitlement(c,'prepare',NULL,false,'onboarding');
 PERFORM public.hirefit_analysis_entitlement(d,'close',NULL,false,'onboarding',NULL,'completed');
 IF (SELECT count(*) FROM public.analysis_entitlement_accounts WHERE user_id IN(c,d) AND onboarding_state='closed')<>2 THEN RAISE EXCEPTION 'Closure failed'; END IF;
 PERFORM public.hirefit_analysis_entitlement(e,'prepare',NULL,false,'onboarding');
 k:='33333333-3333-4333-8333-000000000001';
 PERFORM public.hirefit_analysis_entitlement(e,'reserve',k,false,'onboarding',repeat('c',64));
 -- Synthetic time shift, preserves exact lease CHECK. No sleep or client-controlled clock.
 UPDATE public.analysis_entitlement_requests SET created_at=created_at-interval '16 minutes',expires_at=expires_at-interval '16 minutes' WHERE request_id=k;
 q:=public.hirefit_analysis_entitlement(e,'complete',k,false,'onboarding');
 IF q->>'error' IS DISTINCT FROM 'ANALYSIS_REQUEST_EXPIRED' THEN RAISE EXCEPTION 'Late settlement fence failed'; END IF;
 q:=public.hirefit_analysis_entitlement(e,'snapshot',NULL,false,'onboarding');
 IF q->>'onboarding_state' IS DISTINCT FROM 'available' THEN RAISE EXCEPTION 'Recovery failed'; END IF;
 PERFORM public.hirefit_analysis_entitlement(f,'snapshot');
 q:=public.hirefit_set_authoritative_plan(f,'pro','admin');
 IF (q->>'success')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Trusted grant failed'; END IF;
 q:=public.hirefit_analysis_entitlement(f,'snapshot');
 IF (q->>'is_pro')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Pro authority failed'; END IF;
 INSERT INTO public.user_plans(user_id,plan,analysis_count,last_reset_at) VALUES(g::text,'pro',0,clock_timestamp());
 q:=public.hirefit_analysis_entitlement(g,'snapshot');
 IF q->>'error' IS DISTINCT FROM 'ENTITLEMENT_REVIEW_REQUIRED' THEN RAISE EXCEPTION 'Legacy Pro adoption occurred'; END IF;
 UPDATE public.analysis_entitlement_accounts SET last_reset_at=clock_timestamp()-interval '720 hours' WHERE user_id=a;
 q:=public.hirefit_analysis_entitlement(a,'snapshot');
 IF (q->>'analysis_count')::int IS DISTINCT FROM 0 OR (q->>'allowed')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Reset failed'; END IF;
END;
$runtime$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims='{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-000000000001","role":"authenticated"}';
SET LOCAL request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
DO $client_denial$
BEGIN
 IF auth.uid() IS DISTINCT FROM 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'::uuid THEN RAISE EXCEPTION 'JWT emulation differs'; END IF;
 BEGIN
   PERFORM public.hirefit_analysis_entitlement(auth.uid(),'snapshot');
   RAISE EXCEPTION 'Client executed authority';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF current_setting('hirefit.entitlement_cutover_review',true)='all-runtime-paths-reviewed' THEN
   BEGIN
     UPDATE public.user_plans SET plan='pro' WHERE user_id=auth.uid()::text;
     RAISE EXCEPTION 'Client retained plan mutation after cutover';
   EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   BEGIN
     PERFORM public.increment_user_plan_analysis(auth.uid());
     RAISE EXCEPTION 'Client retained obsolete increment after cutover';
   EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END IF;
 BEGIN
   UPDATE public.analysis_entitlement_accounts SET plan='pro' WHERE user_id=auth.uid();
   RAISE EXCEPTION 'Client wrote authority';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$client_denial$;
RESET ROLE;
DO $history_post$
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
$history_post$;
ROLLBACK;
