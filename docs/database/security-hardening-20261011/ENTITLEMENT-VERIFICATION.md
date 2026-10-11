# Entitlement verification: disposable execution package

Prepared 2026-10-11. Disposable verification was authorized and executed only against hirefit-baseline-replay (nddfpwqrfgcddzjwjrsw). Phase A installation, rollback-only sequential verification, and the reviewed two-session concurrency suite completed successfully. Cleanup and post-clean verification also passed. Production was not changed; Phase B remains unexecuted; no active entitlement migration has been created.

## Local evidence and limits

validate-entitlement-authority.mjs tests the real server authority against an isolated acceptance ledger: forged flags/identity, Free/Pro, final-slot concurrency model, one-time onboarding, skip/completion/prepare, close while running, failure/timeout, stale recovery, request-key replay/conflict and exact 720-hour model boundary. SQL checks inspect contracts and body hashes; they do not prove PostgreSQL.

validate-entitlement-runtime-routes.mjs exercises Express's actual shared route registrar and Vercel's actual dispatcher with the same authority fixture. It also runs real onboarding persistence against an isolated SDK fixture: close precedes profile writes; a failed write leaves closure; editable completion removal or prepare cannot reopen it. No HTTP/database transport occurs.

validate-entitlement-client.mjs checks input/account-scoped memory-only keys, key retention on ambiguous failure, authenticated benefit requests, and completion error propagation. All 19 local validators passed. Production build passed with the existing chunk-size warning. Focused lint passed on all additional files; App.jsx still has 33 baseline errors/7 warnings and server.js one baseline error, with no introduced findings compared with HEAD. git diff --check passed. No service credential variable or authority RPC identifier was found in the generated browser bundle.

The returning-profile fixture now uses real UUID shapes and a mocked lifecycle RPC. Its profile preservation/error/cache assertions remain intact. Other auth/profile/onboarding/Weekly Action/Companion/Radar/routing validators remain regression gates. Build must pass. Focused lint must have no introduced errors; existing App/server baseline findings must be reported separately.

## Prerequisites and strict ordering

1. The reviewed disposable project is hirefit-baseline-replay, ref nddfpwqrfgcddzjwjrsw. Production ref inmcvfyhsrwhznbjlnit is prohibited. The local Supabase link was switched to the reviewed disposable project before execution, and read-only preflight confirmed that target before any write. A SQL session marker alone cannot prove project identity; verify dashboard/project URL and approved baseline evidence externally before execution.
2. Record baseline metadata, bootstrap definition/owner/ACL/event-trigger fingerprint, all application row counts, bucket count, the exact registered baseline history row, and user_plans_id_seq last_value/is_called. supabase_migrations.schema_migrations must exist and contain exactly one row: version 20261010120000, name production_state_baseline. Zero rows, missing objects, another version/name, NULL values or any additional row must STOP. The accepted prior sequence advancement is disposable-only and need not be reset. Do not create, repair or mutate migration history or buckets.
3. Review auth.users columns/defaults/generated expressions against the earlier successful synthetic-user verification, and review all enabled insert triggers. The test script refuses custom enabled auth-user triggers. Minimal synthetic inserts must be supported by this exact target; otherwise STOP and use separately authorized test users through supported Auth administration.
4. Statically review Phase A and hashes. The draft expects PostgreSQL 17/postgres, the reviewed production-state baseline and bootstrap pair already present, current captured ACLs/policies, entitlement Phase A objects absent, the one registered baseline history row and the isolated marker. The pre-Phase A baseline fingerprint must be overall_md5 84eabb2aa7f0cf161bfdc0c83ddab171 with canonical_object_count 323; bootstrap definition/owner/ACL/event-trigger equivalence must still pass. This is an existing baseline database, not a fresh empty database. Phase A is not rerunnable and must not be stacked with security-hardening-v1.
5. After separate approval, set the session marker for this reviewed disposable target, then apply Phase A only. Phase A intentionally COMMITs schema creation in the disposable project. Do not run baseline again.
6. COMPLETED on the reviewed disposable project: Phase A metadata/privileges were inspected and the rollback-only sequential subset passed. Local validators exercised the shared server/runtime/client paths with isolated fixtures; no production environment was used.
7. COMPLETED on the reviewed disposable project using two real PostgreSQL connections. Cases A-F passed: final Free slot, same idempotency key, onboarding race, close-vs-settle, reset-while-pending, and grant-vs-reserve. Synthetic fixtures were cleaned up and post-clean verification confirmed zero synthetic auth, authority-account, authority-request, and legacy-plan rows.
8. Review app cutover evidence, then separately authorize Phase B with the isolated marker and cutover-review marker. Phase B intentionally COMMITs privilege changes in the disposable schema.
9. Repeat sequential tests and Phase B client-denial checks, all application regressions, metadata comparison and rollback cleanup checks. Production approval is a later gate.

All three SQL drafts verify the exact history row before and after their work using SELECT only. Manual Phase A/Phase B testing does not register either draft as a migration. No history INSERT/UPDATE/DELETE, migration repair or baseline replay is part of this test package. Phase A has no requirement for empty existing application tables; the rollback-only sequential test separately requires empty application row sets and absent synthetic identities to protect its fixture assumptions. Keep those safeguards and all schema/object/ACL checks unchanged.

### Markers â€” NOT AUTHORIZED / DO NOT RUN YET

In the approved disposable session only:

```sql
SELECT set_config('hirefit.entitlement_review_target','isolated-reviewed-target',false);
-- Set this only after app/runtime cutover is reviewed:
SELECT set_config('hirefit.entitlement_cutover_review','all-runtime-paths-reviewed',false);
```

These are session configuration, not project authentication. Never use them to work around a failing prerequisite.

## Sequential rollback-only SQL subset

entitlement-isolated-verification.DRAFT.sql has one BEGIN and final ROLLBACK, no DDL/helpers/COMMIT/setval/history/bucket mutations. It requires empty application tables and synthetic UUIDs absent. It creates eight minimal synthetic auth.users rows inside the transaction, tests service INVOKER operations, then uses standard SET LOCAL ROLE authenticated/JWT claims to prove client denial. Assertions raise on unexpected behavior.

Identities: aaaaaaaa-aaaa-4aaa-8aaa-000000000001 through ...000000000008; emails entitlement-fixture-N@example.invalid. They are disposable synthetic identities only. Request keys use 11111111/22222222/33333333 UUID prefixes. No real identity/secret/prompt/user record is copied.

The subset covers clean Free initialization, two successes, duplicate completion and replay, independent one-time benefit, skip/final closure and no reopening through prepare, lease expiry and late-completion fencing, explicit trusted admin Pro, forged historical Pro rejection and >=720-hour reset. It tests direct authority mutation/RPC denial to authenticated role. It can run after Phase A and again after Phase B because rows roll back.

Service operations intentionally generate user_plans identity values. PostgreSQL sequence advances are NOT transactional. The only accepted residual data state is recorded disposable sequence advancement; no setval/reset or exact next-value assertion. A failed test aborts the transaction and requires ROLLBACK/disconnect before further work. Verify cleanup independently even after success.

No synthetic account, request, profile or auth row may remain after the rollback-only subset. Committed concurrency-fixture reservations may exist only during the separately approved two-session test; record and clean up those synthetic fixtures afterward, or discard the disposable project. Never treat an unexplained pending reservation as acceptable residue.

## Exact read-only metadata/cleanup checks

Run BEFORE and AFTER in the approved disposable project, never in production for synthetic tests:

```sql
SELECT to_regnamespace('supabase_migrations') IS NOT NULL AS migration_schema_exists,
       to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS migration_table_exists,
       (SELECT count(*) FROM storage.buckets) AS bucket_count;
-- STOP if either existence field is false. Exactly one matching row is required:
SELECT count(*) AS migration_row_count,
       count(*) = 1 AND count(*) FILTER (
         WHERE version::text = '20261010120000' AND name = 'production_state_baseline') = 1 AS exact_baseline_history,
       coalesce(jsonb_agg(jsonb_build_object('version',version::text,'name',name) ORDER BY version::text,name),'[]'::jsonb) AS migration_rows
FROM supabase_migrations.schema_migrations;
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','S') ORDER BY c.relname;
SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default,is_identity,identity_generation
FROM information_schema.columns WHERE table_schema='public'
AND table_name IN ('analysis_entitlement_accounts','analysis_entitlement_requests') ORDER BY table_name,ordinal_position;
SELECT conrelid::regclass::text AS table_name,conname,contype,pg_get_constraintdef(oid,true) AS definition
FROM pg_constraint WHERE conrelid IN ('public.analysis_entitlement_accounts'::regclass,'public.analysis_entitlement_requests'::regclass)
ORDER BY table_name,conname;
SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public'
AND tablename IN ('analysis_entitlement_accounts','analysis_entitlement_requests') ORDER BY tablename,indexname;
SELECT * FROM pg_policies WHERE schemaname='public'
AND tablename IN ('user_plans','analysis_entitlement_accounts','analysis_entitlement_requests') ORDER BY tablename,policyname;
SELECT p.oid::regprocedure::text AS signature,p.prosecdef,pg_get_userbyid(p.proowner) AS owner,p.proconfig,p.proacl,
       md5(replace(p.prosrc,chr(13),'')) AS body_md5
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('hirefit_analysis_entitlement','hirefit_set_authoritative_plan','rls_auto_enable')
ORDER BY signature;
SELECT evtname,evtevent,evtenabled,evttags,pg_get_userbyid(evtowner) AS owner,evtfoid::regprocedure::text AS function
FROM pg_event_trigger ORDER BY evtname;
SELECT relname,pg_get_userbyid(a.grantee) AS grantee,a.privilege_type,a.is_grantable
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
LATERAL aclexplode(c.relacl) a
WHERE n.nspname='public' AND c.relname IN ('analysis_entitlement_accounts','analysis_entitlement_requests','user_plans','user_plans_id_seq')
ORDER BY relname,grantee,privilege_type;
SELECT count(*) AS synthetic_auth_rows FROM auth.users WHERE id::text LIKE 'aaaaaaaa-aaaa-4aaa-8aaa-%';
SELECT count(*) AS authority_accounts FROM public.analysis_entitlement_accounts;
SELECT count(*) AS authority_requests FROM public.analysis_entitlement_requests;
SELECT count(*) AS legacy_plans FROM public.user_plans;
SELECT last_value,is_called FROM public.user_plans_id_seq;
```

Record all 14 application table counts before/after, using the explicit table list in the test preflight. Sequential tests must leave them zero. Function/bootstrap/default-ACL/policy/index/trigger metadata must equal its immediately preceding phase snapshot. Phase A is expected to add exactly two tables/two functions/two explicit indexes plus PK/unique support indexes; Phase B changes only described ACL/policy roles. Compare these intentional phase changes separately from runtime-test before/after equality. Existing application metadata and bootstrap must not drift.

Migration history must remain exactly the one registered baseline row throughout: both existence fields true, migration_row_count=1, exact_baseline_history=true, and identical migration_rows before/after. No entitlement draft version may appear. Unexpected history drift is FAIL and must not be repaired during testing.

Expected new function body hashes (CR removed): authority d1a6de31c2c49785b0464619d99962fa; plan 201cd4221e8f98505fa9b64d1be2190c. Phase B and the local validator verify these against the exact Phase A draft.

### Effective-role checks, including Phase B

```sql
SELECT r.role_name,t.table_name,p.privilege,
       has_table_privilege(r.role_name,'public.'||t.table_name,p.privilege) AS allowed
FROM (VALUES ('anon'),('authenticated'),('service_role')) r(role_name)
CROSS JOIN (VALUES ('user_plans'),('analysis_entitlement_accounts'),('analysis_entitlement_requests')) t(table_name)
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege);
SELECT r.role_name,
 has_function_privilege(r.role_name,'public.hirefit_analysis_entitlement(uuid,text,uuid,boolean,text,text,text)','EXECUTE') AS authority_execute,
 has_function_privilege(r.role_name,'public.hirefit_set_authoritative_plan(uuid,text,text)','EXECUTE') AS plan_execute,
 has_function_privilege(r.role_name,'public.increment_user_plan_analysis(uuid)','EXECUTE') AS old_execute,
 has_sequence_privilege(r.role_name,'public.user_plans_id_seq','SELECT,UPDATE,USAGE') AS any_sequence_access
FROM (VALUES ('anon'),('authenticated'),('service_role')) r(role_name);
```

Authority table SIU and new RPC EXECUTE: service only. After Phase B, user_plans owner SELECT remains, service SIU remains; browser mutation and old increment EXECUTE and direct sequence access are false. Use JWT A then JWT B under authenticated role to attempt plan INSERT/UPDATE and old RPC: catch only insufficient_privilege and raise if a call succeeds. Owner SELECT must not expose B's projection to A. Do not disable policies or alter roles. Verify server profile flows remain operational after direct profile grants are revoked.

## Two-session tests â€” exact operations and expected outcomes

Use a dedicated committed synthetic account ...000000000008 with Free count=1, available/prepared onboarding and no requests. Seed in the approved disposable environment only; capture setup writes separately. Reset that synthetic fixture between cases through a separately reviewed fixture operation, never production.

| Test | Operations | Expected result |
| --- | --- | --- |
| Final normal slot | Sessions A/B call reserve with different UUIDs for the same user | Exactly one allowed=true; other denied; complete admitted key -> count=2 |
| Same request key | A/B reserve same UUID/hash | One execution admission; other IN_PROGRESS; completed replay ALREADY_COMPLETED |
| Benefit race | A/B reserve onboarding with different keys | Exactly one reserved; second denied; success consumes once |
| Close versus settle | A close skipped; B complete existing pending benefit | Serial lock order: either consumed first or closed first; never available/reopened, never two successes |
| Expiry versus late worker | Synthetic expires_at already <=now with matching created_at; A snapshot, B complete | expired; no charge/output; new key may retry only if available |
| Reset with pending hold | Anchor 720 hours ago; pending lease still valid; snapshot then complete | Count reset once; hold retained; completion charges new window once |
| Grant versus reservation | Reviewed admin plan change concurrent with reserve | Lock order yields one tier captured at admission; later plan change does not rewrite pending request |

Invocation shape, executed as service_role after separate authorization:

```sql
SELECT public.hirefit_analysis_entitlement(
 'aaaaaaaa-aaaa-4aaa-8aaa-000000000008','reserve',
 '88888888-8888-4888-8888-000000000001',false,'normal',repeat('8',64),NULL);
-- Session B uses ...000000000002 for a different key; same key for replay test.
```

Do not keep a PostgreSQL transaction open while invoking AI. To demonstrate locking deterministically, session A may begin, reserve, and delay releasing its transaction while B attempts reserve with a bounded lock timeout. B may block/timeout; retry only after A commits its synthetic fixture operation, then assert denial. These concurrency setup/commit operations need the next explicit disposable authorization and are not part of the rollback-only script.

## Remaining gates

Real PostgreSQL tests have NOT run. Provider source validation/historical reconciliation, production migration guards, all-backend/cache cutover and operational monitoring remain release blockers. The authority lifecycle, stale recovery, retry and accepted reset rules now have local acceptance coverage. Production remains NO until independent approval and execution evidence.
