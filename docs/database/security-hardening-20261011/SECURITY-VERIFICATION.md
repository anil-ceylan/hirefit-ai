# Security hardening verification plan — NOT EXECUTED

Static review only today. No runnable runtime fixture script is authorized here.
All future tests target a separately verified disposable Supabase-compatible PostgreSQL 17
project, never production inmcvfyhsrwhznbjlnit. No real users/data or credentials in logs.

## Gates and rollback model

1. Compare protected baseline/bootstrap/archive hashes and approved metadata. Verify
   project identity outside SQL, roles, platform auth support, exact baseline history,
   policies, ACLs and unchanged bootstrap. If isolated history is absent, stop; this
   draft does not create/repair it. Obtain separate prerequisite authorization.
2. Review expected ACL/policy literals against the capture; test preflight failures for
   unexpected grant, grant option, policy, owner, identity, function, column grant,
   inherited role, RLS flag and default ACL. Every such variant must abort with no changes.
3. For a rollback-only first rehearsal, prepare a SEPARATELY REVIEWED test variant that
   replaces the migration's final COMMIT with assertions followed by ROLLBACK, keeping
   one outer BEGIN. Do not wrap a script containing COMMIT in an outer transaction.
   Run with stop-on-error; any unexpected exception aborts the transaction. Expected
   permission failures use narrow SQLSTATE 42501 exception blocks/savepoints; unexpected
   success RAISES EXCEPTION. Never catch all exceptions and label them denial.
4. Only create deterministic synthetic auth users if supported and reviewed for that
   hosted target; do not create auth identities unless required. No auth schema/role/DDL
   workarounds, RLS disabling or SECURITY DEFINER test helpers. Unsupported session-role
   switching/auth fixtures make those tests BLOCKED, not a reason to bypass restrictions.
5. Use SET LOCAL ROLE and transaction-local request.jwt.claims (sub/role), assert auth.uid()
   equals synthetic A/B/null before each test. SQL emulation does NOT prove HTTP JWT
   verification. Separate authenticated app/PostgREST testing requires explicit later
   authorization and only isolated credentials. Cross-connection HTTP writes cannot be
   rolled back by the SQL Editor transaction; use disposable destruction/cleanup as a
   separately authorized test plan, never claim global transaction rollback covers them.
6. Use explicit synthetic identity IDs for ordinary plan fixtures to avoid sequence
   advancement. Own/free-plan RPC always attempts INSERT/ON CONFLICT and may advance
   identity even if row already exists. Native identity insert tests do too. Those
   subtests require explicit acceptance of disposable-only nontransactional sequence
   residue; otherwise mark NOT EXECUTED. No setval/reset to conceal residue.
7. Snapshot schema/ACL/defaults/bootstrap/history/bucket state before and after rollback,
   compare exact equality. Check every synthetic UUID absent in auth and all app tables.
   Successful completion ends ROLLBACK; failure also leaves no committed test rows/DDL.
   Sequence residue is the documented exception, never a production operation.

## Acceptance matrix

| Test | v1 expectation / assertion |
|---|---|
| A reads own analyses and user_plans | Own rows visible; no B rows; exact values |
| A inserts own analysis | Success and returning id; B user_id rejected by RLS |
| A updates/deletes analyses | Permission denied after v1; no runtime call requires it |
| A initializes free plan | Current conflict-ignore upsert and SELECT work; repeat does not overwrite plan |
| Current client reset paths | last_reset_at fill and count reset still work (known vulnerability, not security PASS) |
| A writes B plan or reassigns user_id to B | Denied/zero affected rows as appropriate; B row unchanged |
| A changes own plan/count/reset timestamp; inserts own pro row | STILL ALLOWED by v1; demonstrate on synthetic rows and record KNOWN FAIL for entitlement security; do not certify remediation |
| A mutates own plan id/created_at | Still potentially allowed; retained table-wide writes; follow-up required |
| anon selects/inserts/updates/deletes each app table | Permission denial; no anon row flow needs access; verify no data/error details leak |
| Direct client Companion/Profile/Progress/Radar/location tables | Denied even for owner after v1; API remains intended path |
| tables with no policies: profiles/waitlist and location tables | Client denied; postgres remains administrator; no new policies |
| service_role per-object matrix | Exact allowed S/I/U/D succeed, disallowed operations fail; not just a blanket service-role success |
| service Companion save/reopen/guidance/outcome | Existing ownership checks and payload validation; row values preserved; repeated outcome idempotent |
| service Companion delete | Own draft only via handler; guided/foreign rejected; API predicate still mandatory because service bypasses RLS |
| Profile/onboarding/Weekly Action/progress/avatar metadata | Service reads/upserts/updates/inserts work; no score/business changes; use mocks for absent storage buckets |
| Radar retrieval and Saved embedded join | Eligible results and own saved state; service needs SELECT on both relations; user isolation preserved |
| Radar state/location preference writes | Same-owner upsert/idempotency, enable/delete preferences; foreign request scoped to authenticated identity |
| Opportunity catalog/locations writes as service | Denied; no approved writer exists |
| TRUNCATE, REFERENCES, TRIGGER, MAINTAIN | has_table_privilege false for all three non-owner roles; actual synthetic TRUNCATE must fail even on profiles/waitlist; never use production or CASCADE |
| Sequence SELECT/UPDATE/USAGE | has_sequence_privilege false; setval attempt denied before mutation under each role; verify no sequence state change for denial-only test |
| Native identity insert | Generates id despite no direct sequence grants; separately approved disposable sequence residue only |
| RPC anon/service | EXECUTE denied; no owner bypass invocation available through these roles |
| RPC authenticated null/mismatched sub | Guard rejects before INSERT; assert no counter/row/sequence change |
| RPC own/free path | Existing count n becomes n+1; missing row initializes free with count 1; guarded path still works after search_path change; approved disposable sequence residue required |
| RPC repeated call | Still increments repeatedly; no assertion of quota/idempotency enforcement; separate entitlement redesign |
| Timestamp triggers | Service state/preference meaningful change sets updated_at; no-op update preserves it; compare an explicitly old fixture timestamp because now() is transaction-stable |
| Default table/sequence ACLs | New postgres/public test objects (separately authorized transactional DDL) have no anon/auth/service grants; RLS bootstrap unchanged; ROLLBACK removes fixtures |
| Default function ACL caveat | Future function still gets built-in PUBLIC EXECUTE; assert known limitation, then future design requires explicit per-function revoke; do not report fully private defaults |
| App report handler | Document pre-existing anon-client/RLS failure; no newly authorized disclosure; fix separately without anon grant |
| Rollback cleanup | No synthetic rows or helper/schema objects; schema/bootstrap/history/buckets same; sequence exception explicitly recorded |

Do not create an authenticated policy on a server-only table merely to make a test pass.
SQL service-role tests do not validate handler authentication/ownership. Pair them with
isolated API integration and existing client/ownership regression tests after authorization.

## Promotion blockers and recovery

No production approval until static SQL review and isolated execution pass; inventory of
external consumers/deployed runtime must be confirmed. The retained user_plans entitlement
flaw and body.isPro trust must be explicitly resolved or separately triaged as an incomplete
security release; this artifact does not authorize accepting the risk.

Migration transaction failure rolls back ACL/search_path/default changes. No application
row data is changed by the migration. After any eventual committed deployment, do not run
the fidelity baseline or replay archived SQL to undo it: design a targeted reviewed forward
recovery preserving history. Avoid blanket re-granting vulnerable privileges. Schema/default
changes can affect future objects, so inventory any later-created objects during recovery.

No tests in this plan have been executed. Build and app tests are not substitutes for real
PostgreSQL grants/RLS verification; conversely do not run existing SQL-executing validators
under the current no-SQL-execution instruction.
