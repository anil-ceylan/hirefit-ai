# Security hardening v1 — audit and non-active draft

Date: 2026-10-11. Safe for static review: YES. Ready for production: **NO**.
No SQL, Supabase command, production connection, migration execution, commit or push
was performed. This is a partial privilege-reduction proposal, not a claim that
entitlement security is fixed. Baseline/bootstrap/archive remain immutable.

## Evidence and scope

Authority: baseline 20261010120000, approved package 023c57cdb16e52a58570305e4005795a075db3a0,
completion record 477c49f933ae0fe41b7da9ad69acfc622717247b, and the local production
metadata capture. Production completion evidence is operator-supplied, not rechecked.
Read-only repository search covered src/, lib/, server/, api/ and remaining JS/TS
sources for Supabase creation, from/rpc/storage calls and literal object references.
Tests, historical SQL and docs are not treated as runtime consumers. No hidden
external integrations or deployed-code equivalence are assumed proven.

Exact SQL proposal: `security-hardening-v1.DRAFT.sql` (same directory). Proposed future
version 20261011120000 is NOT reserved or installed in active migrations. The draft
requires the reviewed baseline history and an isolated-target acknowledgment; a
missing isolated history prerequisite causes STOP, not automatic history creation.
Its privilege/policy/function guards are targeted baseline checks, not a substitute
for a new full-schema equivalence audit before any authorized application.

## Repository runtime map and minimum privileges

S/I/U/D = SELECT/INSERT/UPDATE/DELETE. None means no current runtime requirement found.
Browser uses src/supabaseClient.js (anon key plus signed-in session); a signed-in
Supabase session executes as authenticated, not anon. Most API persistence uses
lib/careerMemory/persistence.js:getServiceClient with the service-role key. That
client bypasses RLS; authenticated server user scoping remains mandatory.

| Object | Browser/direct access | Server/service access and evidence | Required current privileges |
|---|---|---|---|
| user_plans | src/App.jsx:6460-6517 reads, inserts default free row with conflict-ignore upsert, fills/resets last_reset_at and analysis_count | server/server.js:608,684 and lib/vercelApi/careerApiRouter.js:681 admin/billing upsert plan | authenticated SIU currently; service SIU for upsert/conflict expressions; owner RPC writes |
| analyses | App.jsx:6539 list,7055 insert returning id; ReportPage.jsx:610 owner read | careerApiRouter.js:803-817 authenticates user but creates anon-key client without forwarding JWT; query already denied by RLS | authenticated SI; no functioning anon/service consumer found |
| career_profiles | No direct browser table call | careerMemory/persistence.js; careerOnboarding/persistence.js; careerActionLoop/persistence.js; account/avatarStorage.js read/upsert/update | service SIU; includes Weekly Action JSON persistence and avatar metadata |
| career_progress_snapshots | No direct browser call | careerProgress/persistence.js:8,24 list/insert | service SI |
| career_companion_cases | UI calls authenticated API, not table | careerCompanion/persistence.js list/get/upsert/update; delete constrained atomically by id,user_id,status=draft | service SIUD |
| career_companion_outcomes | API only | same module owner-case check, upsert on case_id returning row | service SIU; parent FK cascade does not need a separate caller DELETE grant |
| opportunities | Radar client uses API | opportunityRadar/persistence.js list/hydrate/eligibility; location/opportunityLocationPersistence.js embedded read | service S; no catalog writer exists |
| opportunity_user_states | Radar API only | persistence.js:63,78 scoped read and upsert on (user_id,opportunity_id); Saved embedded relationship | service SIU |
| opportunity_location_preferences | API only | location/preferencePersistence.js get/upsert/update(enabled)/delete | service SIUD |
| opportunity_locations | No browser table call | embedded opportunity locations read in location/opportunityLocationPersistence.js | service S; ingestion has no DB writer |
| profiles | No runtime DB reference found | No runtime reference found; structurally retained legacy table | none; owner retains administration |
| waitlist | App.jsx:6575-6586 uses localStorage, not public.waitlist | No runtime DB reference found | none; owner retains administration |
| user_plans_id_seq | No direct sequence/RPC calls | Native identity allocation on inserts; RPC executes as postgres | no caller USAGE/SELECT/UPDATE needed for native identity; postgres unchanged |
| increment_user_plan_analysis(uuid) | App.jsx:7124-7131 calls only when user.id exists; anon branch uses localStorage | No service-role RPC call found | authenticated EXECUTE; postgres ownership retained |
| opportunity_radar_touch_updated_at() | No direct call | Four existing BEFORE UPDATE triggers on opportunities, states and location tables | retain service EXECUTE for trigger-related operations; no client/PUBLIC callable interface needed |
| rls_auto_enable()/ensure_rls | Not application-callable workflow | Separate provenance-uncertain compatibility behavior | UNCHANGED; do not harden it in this draft |

No auth/storage object or bucket privilege changes proposed. Avatar/CV storage paths
are separate existing runtime dependencies and bucket gaps; this draft neither creates
missing buckets nor treats absent buckets as an ACL problem.

## Findings, practical impact, disposition

1. **Critical — direct entitlement writes.** user_plans policies are permissive to
   PUBLIC, comparing auth.uid()::text to user_id; UPDATE has no explicit WITH CHECK
   (USING is also applied as the check). No column restriction protects plan,
   analysis_count, last_reset_at, id or created_at. An authenticated owner can set
   plan=pro or reset counters via normal REST UPDATE. INSERT can create an own pro
   row too, so revoking UPDATE alone is insufficient. Foreign user_id reassignment
   is blocked by the implicit owner check; same-owner protected fields are not.
   App.jsx sets isPro from this row. Existing direct resets mean a blanket write revoke
   would break current initialization/reset flows. v1 retains SIU explicitly and DOES
   NOT close this issue. Column grants allowing counter writes would still permit
   arbitrary counter resets; they are not a complete security solution.
2. **High — API tier trust is separate.** careerApiRouter.js:698,710 and
   server/server.js:136,157 pass body.isPro into analysis tier gating. Database ACL
   hardening alone cannot establish server-authoritative entitlement/counter enforcement.
   Fix with the server-controlled plan lifecycle, not an unreviewed SQL shortcut.
3. **High — TRUNCATE and other non-row privileges.** analyses, companion cases/outcomes,
   profiles, user_plans, waitlist grant anon/authenticated the full eight table privileges
   including TRUNCATE, REFERENCES, TRIGGER, MAINTAIN. RLS is not a defense for whole-table
   operations. Direct SQL execution under such roles is dangerous even on no-policy
   tables. This is NOT proof that ordinary PostgREST exposes arbitrary TRUNCATE/DDL;
   practical exploitation requires a reachable SQL/definer/injection path. Remove all
   unused privileges, not merely DELETE. service_role's broad catalog/location/state
   grants similarly exceed runtime need and enlarge compromised-key impact.
4. **High — bypass of API business rules by direct client writes.** Companion ALL
   owner policies plus client CRUD permit deletion of guided/outcome cases and arbitrary
   guidance edits without draft-only/AI validation. Career Profile owner writes can
   bypass server composition; progress clients can insert/delete their own evidence.
   No browser call requires these grants. v1 revokes client table access, keeps policies
   unchanged, and preserves server CRUD. Service compromise still bypasses RLS.
5. **High — sequence UPDATE.** anon/authenticated/service currently have SELECT, UPDATE,
   USAGE on user_plans_id_seq. UPDATE permits setval; USAGE permits direct nextval.
   Neither is a safe public sequence API. Current native GENERATED BY DEFAULT AS IDENTITY
   needs no caller sequence grant; removing these does not convert it to bigserial.
   Identity generation still advances even on rolled-back inserts: isolated verification
   must acknowledge sequence residue. No sequence values are touched by this migration.
6. **Medium — unnecessary RPC/trigger EXECUTE.** anon RPC requests without auth.uid
   already fail its guard; anon EXECUTE adds attack surface, not a proven ownership bypass.
   Remove it. Retain authenticated execution. RPC current search_path=public is weaker
   than necessary; public CREATE is not granted to clients in the capture, so an active
   public-object hijack is not proven. Use pg_catalog,pg_temp (temp last) with existing
   qualified table/auth references; body/guard/counter behavior remain exact. Trigger
   function already uses pg_catalog. rls_auto_enable is expressly out of scope.
7. **Medium — legacy no-policy tables.** profiles/waitlist have RLS enabled and NO
   policies. Normal client row access is denied, but their non-row grants remain risky.
   Remove unused anon/auth/service grants; preserve structure, policies and data.
8. **High latent risk — future defaults.** postgres/public table/sequence defaults grant
   full privileges to anon/auth/service; function defaults grant each EXECUTE. Remove
   these explicit schema-local defaults so future table/sequence grants must be explicit.
   PostgreSQL's built-in global PUBLIC EXECUTE for future functions remains: schema-local
   revocation cannot remove it. A global postgres default change could affect future
   auth/storage/platform objects and is deliberately deferred. Every new application
   function must revoke PUBLIC in its creation transaction. A dedicated future app
   migration-owner/default policy needs separate platform-compatibility review.
9. **Existing report bug, not an anon requirement.** authenticated HTTP report handler
   constructs an anonymous database client and ignores its query error. There is no
   analyses anon SELECT policy, so before hardening it receives no row (then falls back
   to generic report values); after revoke it gets permission denial. Do not open anon
   access to compensate. A separately reviewed JWT-forwarded/server-scoped read is needed.

## Before -> after effective target matrix

ALL8 = S/I/U/D/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN. Owner postgres unchanged throughout.
Every role still needs platform-provided public schema USAGE; no schema ACL is changed.
RLS and all 18 policy definitions remain unchanged. Removed grants make unused policies
inert rather than dropping/recreating them. No bypass policy is added.

| Object | anon before -> after | authenticated before -> after | service_role before -> after |
|---|---|---|---|
| analyses | ALL8 -> none | ALL8 -> SI | ALL8 -> none |
| career_companion_cases | ALL8 -> none | ALL8 -> none | ALL8 -> SIUD |
| career_companion_outcomes | ALL8 -> none | ALL8 -> none | ALL8 -> SIU |
| career_profiles | none -> none | SIUD -> none | SIU -> SIU |
| career_progress_snapshots | none -> none | SID -> none | SI -> SI |
| opportunities | none -> none | S -> none | ALL8 -> S |
| opportunity_user_states | none -> none | S -> none | ALL8 -> SIU |
| opportunity_location_preferences | none -> none | none -> none | ALL8 -> SIUD |
| opportunity_locations | none -> none | none -> none | ALL8 -> S |
| profiles, waitlist | ALL8 -> none | ALL8 -> none | ALL8 -> none |
| user_plans | ALL8 -> none | ALL8 -> SIU (critical exception) | ALL8 -> SIU |
| user_plans_id_seq | SELECT/UPDATE/USAGE -> none | same -> none | same -> none |
| increment RPC | EXECUTE -> none | EXECUTE -> EXECUTE | EXECUTE -> none |
| Radar trigger function | EXECUTE via PUBLIC/direct -> none | same -> none | EXECUTE -> EXECUTE |

For the Radar trigger function PUBLIC EXECUTE is removed too. Native trigger invocation
is not a direct RPC workflow; service EXECUTE is retained conservatively. Future catalog
writing would require a separately reviewed writer capability/grant, not restoring ALL8.

## Draft safety and limitations

One BEGIN/COMMIT, explicit REVOKE/GRANT, no data DML, no policy replacement, no history
mutation and no sequence setters. Preflight checks exact captured direct ACLs (including
grantor/grant option), all 18 policies, owner/RLS state, absent column ACLs, identity
definition, normalized exact function definitions/ACLs and postgres/public default ACLs.
It rejects unexpected inherited roles/client BYPASSRLS/schema CREATE. Postconditions
check effective privileges per role, sequence/function grants, policies, RLS and defaults.
Table locks precede table ACL inspection. A DDL/role/default-ACL maintenance freeze is
still required; table locks do not serialize all function/role/default-ACL changes.
Draft is intentionally non-rerunnable: already-hardened ACLs fail the baseline preflight.

No grants are required for direct browser sequence operations because none exist.
Identity and actual PostgREST upserts MUST be verified on disposable PostgreSQL 17;
static source reasoning is not runtime validation. Service roles remain platform-managed,
with BYPASSRLS unchanged; this draft narrows object permissions, not role identity.

No unknown external consumer is assumed safe to break. Confirm deployments/integrations
before promotion. Fresh isolated history may still be absent: STOP and separately
design/authorize that prerequisite rather than relaxing it or creating history implicitly.

## Required next engineering work (not implemented)

1. Review this partial draft and its SQL guards; independently check current production
   metadata only under future authorization. Do not execute this draft on production.
2. Implement authenticated, server-authoritative free-row initialization and atomic reset/
   consumption with server time, bounded cadence and concurrency controls. Server must
   derive paid access from trusted billing/admin state, never request isPro. Browser becomes
   read-only for plans. Existing increment RPC is not a reset API and must not initialize
   a zero-usage row by consuming a credit accidentally.
3. Then a separately reviewed migration can remove authenticated INSERT/UPDATE entirely
   and restrict user_plans policy roles to authenticated without weakening predicates.
   Validate both INSERT and UPDATE escalation, id spoofing, user_id reassignment, count
   resets and reset timestamps; keep server billing/admin operations working.
4. Execute the isolated tests only after explicit authorization. Resolve external access,
   report-handler and global future-function-default questions before production approval.
   Broad v1 grant reductions are independently useful but are not full security completion.

## Primary references

- PostgreSQL 17 RLS boundaries: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- Default ACL scope/global PUBLIC behavior: https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html
- SECURITY DEFINER/search_path guidance: https://www.postgresql.org/docs/17/sql-createfunction.html
- Native identity NextValueExpr calls nextval_internal with permission check false:
  https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/executor/execExprInterp.c

These references explain database semantics, not evidence of production exploitation.
