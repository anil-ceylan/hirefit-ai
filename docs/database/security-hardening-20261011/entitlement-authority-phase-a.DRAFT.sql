-- NON-ACTIVE REVIEW DRAFT: phase A. Do not execute or promote.
-- Baseline 20261010120000; no historical entitlement/counter values are adopted.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $guard$
DECLARE actual jsonb; expected jsonb; history_matches boolean;
BEGIN
 IF current_user <> 'postgres' OR current_setting('server_version_num')::int / 10000 <> 17
 OR current_setting('hirefit.entitlement_review_target',true) IS DISTINCT FROM 'isolated-reviewed-target' THEN
   RAISE EXCEPTION 'Separate isolated target authorization required';
 END IF;
 -- Reviewed adoption rehearsal: verify the one registered baseline; never write history.
 IF to_regnamespace('supabase_migrations') IS NULL
 OR to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
   RAISE EXCEPTION 'Disposable baseline migration history missing; do not create/repair history'; END IF;
 EXECUTE $history_check$SELECT count(*) = 1 AND count(*) FILTER (
   WHERE version::text = '20261010120000' AND name = 'production_state_baseline') = 1
   FROM supabase_migrations.schema_migrations$history_check$ INTO history_matches;
 IF history_matches IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Disposable migration history differs from the single reviewed baseline row'; END IF;
 LOCK TABLE public.user_plans,public.career_profiles,public.analyses IN ACCESS EXCLUSIVE MODE;
 -- Preserve all captured owner-specific default ACLs exactly; grantors are material.
 SELECT coalesce(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole)::text,
   'schema',n.nspname,'kind',d.defaclobjtype::text,
   'acl',(SELECT jsonb_agg(x::text ORDER BY x::text) FROM unnest(d.defaclacl) x))),'[]'::jsonb)
 INTO actual FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
 WHERE d.defaclrole='postgres'::regrole AND (d.defaclnamespace=0 OR n.nspname='public');
 expected := $defaults$[
 {"owner":"postgres","schema":"public","kind":"S","acl":["anon=rwU/postgres","authenticated=rwU/postgres","postgres=rwU/postgres","service_role=rwU/postgres"]},
 {"owner":"postgres","schema":"public","kind":"f","acl":["anon=X/postgres","authenticated=X/postgres","postgres=X/postgres","service_role=X/postgres"]},
 {"owner":"postgres","schema":"public","kind":"r","acl":["anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","postgres=arwdDxtm/postgres","service_role=arwdDxtm/postgres"]}
 ]$defaults$::jsonb;
 IF jsonb_array_length(actual)<>jsonb_array_length(expected) OR NOT(actual @> expected AND expected @> actual) THEN
   RAISE EXCEPTION 'Application owner default ACL drift'; END IF;
 IF to_regclass('public.analysis_entitlement_accounts') IS NOT NULL
 OR to_regclass('public.analysis_entitlement_requests') IS NOT NULL
 OR to_regtype('public.analysis_entitlement_accounts') IS NOT NULL
 OR to_regtype('public.analysis_entitlement_requests') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('hirefit_analysis_entitlement','hirefit_set_authoritative_plan')) THEN
   RAISE EXCEPTION 'Authority objects already exist; not rerunnable';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.user_plans') AND relowner='postgres'::regrole AND relrowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.career_profiles') AND relowner='postgres'::regrole AND relrowsecurity)
 OR to_regclass('public.analyses') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN
   RAISE EXCEPTION 'Reviewed baseline prerequisites missing';
 END IF;
 IF md5(replace(pg_get_functiondef('public.increment_user_plan_analysis(uuid)'::regprocedure),chr(13),''))
   IS DISTINCT FROM 'd0c78ccd84453f57519cad8faccf61dc' THEN RAISE EXCEPTION 'Legacy RPC differs'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.increment_user_plan_analysis(uuid)'::regprocedure
   AND proowner='postgres'::regrole AND prosecdef
   AND (SELECT array_agg(x::text ORDER BY x::text) FROM unnest(proacl) x)=ARRAY[
     'anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[]) THEN
   RAISE EXCEPTION 'Legacy RPC owner/ACL differs'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls))
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member IN ('anon'::regrole,'authenticated'::regrole,'service_role'::regrole))
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls AND NOT rolsuper) THEN
   RAISE EXCEPTION 'Unexpected role privileges'; END IF;
 IF has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE')
 OR has_schema_privilege('service_role','public','CREATE') THEN RAISE EXCEPTION 'Unexpected schema CREATE capability'; END IF;

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
END;
$guard$;

CREATE TABLE public.analysis_entitlement_accounts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 plan text NOT NULL CHECK(plan IN ('free','pro')),
 analysis_count integer NOT NULL DEFAULT 0 CHECK(analysis_count>=0),
 last_reset_at timestamptz NOT NULL,
 authority_source text NOT NULL CHECK(authority_source IN ('new_free','reviewed','admin','payment')),
 onboarding_state text NOT NULL DEFAULT 'closed' CHECK(onboarding_state IN ('available','reserved','consumed','closed')),
 onboarding_prepared boolean NOT NULL DEFAULT false,
 onboarding_closed_reason text CHECK(onboarding_closed_reason IN ('completed','skipped')),
 CHECK ((onboarding_state='closed') OR onboarding_closed_reason IS NULL),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.analysis_entitlement_accounts OWNER TO postgres;
ALTER TABLE public.analysis_entitlement_accounts ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.analysis_entitlement_requests (
 request_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES public.analysis_entitlement_accounts(user_id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('normal','onboarding')),
 status text NOT NULL CHECK(status IN ('pending','completed','released','expired')),
 is_pro boolean NOT NULL,
 charge_usage boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 input_hash text NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
 release_reason text CHECK(release_reason IN ('engine_failure','timeout','onboarding_closed','lease_expired')),
 settled_at timestamptz,
 CHECK(expires_at=created_at+interval '15 minutes'),
 CHECK((status IN ('released','expired'))=(release_reason IS NOT NULL)),
 CHECK ((status='pending')=(settled_at IS NULL)),
 CHECK(kind<>'onboarding' OR (NOT charge_usage AND NOT is_pro))
);
ALTER TABLE public.analysis_entitlement_requests OWNER TO postgres;
ALTER TABLE public.analysis_entitlement_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX analysis_entitlement_pending_idx ON public.analysis_entitlement_requests(user_id)
 WHERE status='pending';
CREATE UNIQUE INDEX analysis_entitlement_onboarding_once ON public.analysis_entitlement_requests(user_id)
 WHERE kind='onboarding' AND status IN ('pending','completed');

-- No client policies. Explicitly undo inherited broad defaults inside this transaction.
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
 ON public.analysis_entitlement_accounts, public.analysis_entitlement_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.analysis_entitlement_accounts, public.analysis_entitlement_requests TO service_role;

-- SECURITY INVOKER is intentional. Only trusted service-role server calls supply UUID/admin.
-- NOT an authenticated client RPC; no arbitrary-UUID SECURITY DEFINER shortcut.
CREATE FUNCTION public.hirefit_analysis_entitlement(
 p_user_id uuid, p_action text, p_request_id uuid DEFAULT NULL,
 p_is_admin boolean DEFAULT false, p_kind text DEFAULT 'normal',
 p_input_hash text DEFAULT NULL, p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp
AS $authority$
DECLARE a public.analysis_entitlement_accounts%ROWTYPE;
 r public.analysis_entitlement_requests%ROWTYPE;
 pending integer; allowed boolean := true; pro boolean; t timestamptz;
BEGIN
 IF current_user NOT IN ('service_role','postgres') OR p_user_id IS NULL
 OR p_action IS NULL OR p_action NOT IN ('snapshot','prepare','close','reserve','complete','release')
 OR p_kind IS NULL OR p_kind NOT IN ('normal','onboarding') OR p_is_admin IS NULL THEN
   RAISE EXCEPTION 'ENTITLEMENT_REQUEST_INVALID'; END IF;
 IF p_action IN ('reserve','complete','release') AND p_request_id IS NULL THEN RAISE EXCEPTION 'ENTITLEMENT_REQUEST_INVALID'; END IF;
 IF p_action='reserve' AND (p_input_hash IS NULL OR p_input_hash !~ '^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'ENTITLEMENT_REQUEST_INVALID'; END IF;
 IF p_action IN ('prepare','close') AND p_kind<>'onboarding' THEN RAISE EXCEPTION 'ENTITLEMENT_REQUEST_INVALID'; END IF;
 IF p_action='close' AND (p_reason IS NULL OR p_reason NOT IN ('completed','skipped')) THEN RAISE EXCEPTION 'ENTITLEMENT_REQUEST_INVALID'; END IF;
 IF p_action='release' AND (p_reason IS NULL OR p_reason NOT IN ('engine_failure','timeout')) THEN RAISE EXCEPTION 'ENTITLEMENT_REQUEST_INVALID'; END IF;
 -- All authority writers use the same lock order; time is sampled AFTER obtaining it.
 PERFORM pg_advisory_xact_lock(hashtextextended('hirefit_entitlement:'||p_user_id::text,0));
 t := clock_timestamp();
 SELECT * INTO a FROM public.analysis_entitlement_accounts WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN
   IF EXISTS(SELECT 1 FROM public.user_plans WHERE user_id=p_user_id::text)
   OR EXISTS(SELECT 1 FROM public.career_profiles WHERE user_id=p_user_id)
   OR EXISTS(SELECT 1 FROM public.analyses WHERE user_id=p_user_id) THEN
     RETURN jsonb_build_object('error','ENTITLEMENT_REVIEW_REQUIRED');
   END IF;
   INSERT INTO public.analysis_entitlement_accounts(user_id,plan,last_reset_at,authority_source,onboarding_state)
     VALUES(p_user_id,'free',t,'new_free','available') RETURNING * INTO a;
 END IF;
 -- Expiry fences late workers. Recovery never charges or returns an expired result.
 UPDATE public.analysis_entitlement_requests SET status='expired',settled_at=t,release_reason='lease_expired'
   WHERE user_id=p_user_id AND status='pending' AND expires_at<=t;
 IF a.onboarding_state='reserved' AND NOT EXISTS(SELECT 1 FROM public.analysis_entitlement_requests
   WHERE user_id=p_user_id AND kind='onboarding' AND status='pending') THEN
   UPDATE public.analysis_entitlement_accounts SET onboarding_state='available',updated_at=t
     WHERE user_id=p_user_id RETURNING * INTO a;
 END IF;
 IF t-a.last_reset_at >= interval '720 hours' THEN
   UPDATE public.analysis_entitlement_accounts SET analysis_count=0,last_reset_at=t,updated_at=t
     WHERE user_id=p_user_id RETURNING * INTO a;
 END IF;
 SELECT count(*) INTO pending FROM public.analysis_entitlement_requests
   WHERE user_id=p_user_id AND status='pending' AND charge_usage;
 pro := p_kind='normal' AND (a.plan='pro' OR p_is_admin);
 allowed := pro OR a.analysis_count::bigint+pending<2;
 IF p_kind='onboarding' THEN allowed := a.onboarding_state='available' AND a.onboarding_prepared; END IF;
 IF p_action='prepare' THEN
   -- Preparation never reopens a terminal benefit. No Career Memory field is authority.
   UPDATE public.analysis_entitlement_accounts SET onboarding_prepared=true,updated_at=t
     WHERE user_id=p_user_id AND NOT onboarding_prepared;
   SELECT * INTO a FROM public.analysis_entitlement_accounts WHERE user_id=p_user_id;
 ELSIF p_action='close' THEN
   UPDATE public.analysis_entitlement_requests SET status='released',settled_at=t,release_reason='onboarding_closed'
     WHERE user_id=p_user_id AND kind='onboarding' AND status='pending';
   UPDATE public.analysis_entitlement_accounts SET onboarding_state='closed',onboarding_closed_reason=p_reason,updated_at=t
     WHERE user_id=p_user_id AND onboarding_state IN ('available','reserved') RETURNING * INTO a;
   SELECT * INTO a FROM public.analysis_entitlement_accounts WHERE user_id=p_user_id;
 ELSIF p_action='reserve' THEN
   -- A key identifies one execution forever, including failed/expired attempts.
   SELECT * INTO r FROM public.analysis_entitlement_requests WHERE request_id=p_request_id;
   IF FOUND THEN
     IF r.user_id<>p_user_id OR r.kind<>p_kind OR r.input_hash<>p_input_hash THEN
       RETURN jsonb_build_object('error','IDEMPOTENCY_CONFLICT'); END IF;
     RETURN jsonb_build_object('error',CASE r.status
       WHEN 'pending' THEN 'ANALYSIS_IN_PROGRESS' WHEN 'completed' THEN 'ANALYSIS_ALREADY_COMPLETED'
       WHEN 'expired' THEN 'ANALYSIS_REQUEST_EXPIRED' ELSE 'ANALYSIS_REQUEST_RELEASED' END);
   END IF;
   IF allowed THEN
     INSERT INTO public.analysis_entitlement_requests(request_id,user_id,kind,status,is_pro,charge_usage,created_at,expires_at,input_hash)
       VALUES(p_request_id,p_user_id,p_kind,'pending',pro,p_kind='normal' AND a.plan<>'pro',t,t+interval '15 minutes',p_input_hash);
     IF p_kind='normal' AND a.plan<>'pro' THEN pending:=pending+1; END IF;
     IF p_kind='onboarding' THEN
       UPDATE public.analysis_entitlement_accounts SET onboarding_state='reserved',updated_at=t
         WHERE user_id=p_user_id RETURNING * INTO a;
     END IF;
   END IF;
 ELSIF p_action IN ('complete','release') THEN
   SELECT * INTO r FROM public.analysis_entitlement_requests
     WHERE request_id=p_request_id AND user_id=p_user_id AND kind=p_kind FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'ENTITLEMENT_REQUEST_NOT_OWNED'; END IF;
   IF r.status='expired' THEN RETURN jsonb_build_object('error','ANALYSIS_REQUEST_EXPIRED'); END IF;
   IF r.status='pending' THEN
     IF p_action='complete' THEN
       IF r.kind='onboarding' AND a.onboarding_state<>'reserved' THEN RAISE EXCEPTION 'ENTITLEMENT_SETTLEMENT_CONFLICT'; END IF;
       UPDATE public.analysis_entitlement_accounts SET
         analysis_count=analysis_count+CASE WHEN r.charge_usage THEN 1 ELSE 0 END,
         onboarding_state=CASE WHEN r.kind='onboarding' THEN 'consumed' ELSE onboarding_state END,updated_at=t
         WHERE user_id=p_user_id RETURNING * INTO a;
     ELSIF r.kind='onboarding' AND a.onboarding_state='reserved' THEN
       UPDATE public.analysis_entitlement_accounts SET onboarding_state='available',updated_at=t
         WHERE user_id=p_user_id RETURNING * INTO a;
     END IF;
     UPDATE public.analysis_entitlement_requests SET
       status=CASE WHEN p_action='complete' THEN 'completed' ELSE 'released' END,settled_at=t,
       release_reason=CASE WHEN p_action='release' THEN p_reason ELSE NULL END WHERE request_id=p_request_id;
   ELSIF (r.status='completed' AND p_action<>'complete') OR (r.status='released' AND p_action<>'release') THEN
     RAISE EXCEPTION 'ENTITLEMENT_SETTLEMENT_CONFLICT';
   END IF;
   SELECT count(*) INTO pending FROM public.analysis_entitlement_requests
     WHERE user_id=p_user_id AND status='pending' AND charge_usage;
 END IF;
 -- Compatibility projection is never read as entitlement authority.
 INSERT INTO public.user_plans(user_id,plan,analysis_count,last_reset_at)
   VALUES(p_user_id::text,a.plan,a.analysis_count,a.last_reset_at)
   ON CONFLICT(user_id) DO UPDATE SET plan=EXCLUDED.plan,analysis_count=EXCLUDED.analysis_count,last_reset_at=EXCLUDED.last_reset_at
   WHERE (user_plans.plan,user_plans.analysis_count,user_plans.last_reset_at)
     IS DISTINCT FROM (EXCLUDED.plan,EXCLUDED.analysis_count,EXCLUDED.last_reset_at);
 RETURN jsonb_build_object('plan',a.plan,'is_pro',pro,'analysis_count',a.analysis_count,
   'last_reset_at',a.last_reset_at,'pending_count',pending,'free_limit',2,'allowed',allowed,
   'onboarding_state',a.onboarding_state);
END;
$authority$;
ALTER FUNCTION public.hirefit_analysis_entitlement(uuid,text,uuid,boolean,text,text,text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.hirefit_analysis_entitlement(uuid,text,uuid,boolean,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hirefit_analysis_entitlement(uuid,text,uuid,boolean,text,text,text) TO service_role;

CREATE FUNCTION public.hirefit_set_authoritative_plan(p_user_id uuid,p_plan text,p_source text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp
AS $plan$
DECLARE a public.analysis_entitlement_accounts%ROWTYPE;
BEGIN
 IF current_user NOT IN ('service_role','postgres') OR p_user_id IS NULL OR p_plan IS NULL
 OR p_plan NOT IN ('free','pro') OR p_source IS NULL OR p_source<>'admin' THEN
   RAISE EXCEPTION 'ENTITLEMENT_REQUEST_INVALID'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('hirefit_entitlement:'||p_user_id::text,0));
 SELECT * INTO a FROM public.analysis_entitlement_accounts WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','ENTITLEMENT_REVIEW_REQUIRED'); END IF;
 UPDATE public.analysis_entitlement_accounts SET plan=p_plan,authority_source=p_source,updated_at=clock_timestamp()
   WHERE user_id=p_user_id;
 INSERT INTO public.user_plans(user_id,plan,analysis_count,last_reset_at)
   VALUES(p_user_id::text,p_plan,a.analysis_count,a.last_reset_at)
   ON CONFLICT(user_id) DO UPDATE SET plan=EXCLUDED.plan,analysis_count=EXCLUDED.analysis_count,last_reset_at=EXCLUDED.last_reset_at;
 RETURN jsonb_build_object('success',true);
END;
$plan$;
ALTER FUNCTION public.hirefit_set_authoritative_plan(uuid,text,text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.hirefit_set_authoritative_plan(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hirefit_set_authoritative_plan(uuid,text,text) TO service_role;

DO $postconditions$
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
$postconditions$;
COMMIT;
