# Phase A two-session concurrency harness — REVIEW ONLY

Target: **hirefit-baseline-replay**, ref **nddfpwqrfgcddzjwjrsw**.
No current execution authorization is implied by this package. No connection or SQL execution
was performed while drafting it. Production execution is forbidden. Phase B is excluded.

## Accepted starting evidence

Operator reports Phase A installed, exact single baseline history row, correct RLS/ACL/security,
sequential rollback verification and cleanup PASS. This package does not re-prove those reports
until separately authorized execution. The older ENTITLEMENT-VERIFICATION.md contains historical
pre-execution wording; its two-session scope is reused, not its stale local-link status.

Independently verify BOTH SQL Editor windows show this disposable project. A SQL marker is not
project authentication. Never paste this suite into another project. Before execution approve
this complete package, inspect current project identity and rerun the reviewed baseline/bootstrap
and Phase A read-only checks. Baseline history must contain exactly one row:
20261010120000 / production_state_baseline.

## Artifacts and guards

25 numbered SQL drafts plus this plan, outside active migrations. Each independently selected
transaction has a complete guard. No include commands, helper functions, schema creation, grants,
role-attribute changes or RLS disabling are needed.

Guards enforce PostgreSQL 17/postgres, exact history, reviewed auth defaults/generated expressions,
no custom auth triggers, expected application timestamp triggers, Phase A function body hashes
and signatures, INVOKER/search_path/owners, exact authority ACLs, effective client denials,
column order/type/nullability/defaults, PK/FK/CHECK definitions and indexes. CHECK/predicate strings
use PostgreSQL canonical deparsing; any difference must STOP for review, never be bypassed.
Other application tables, buckets and auth.identities must be empty. Only this suite's auth UUID,
email, account, legacy projection and enumerated request IDs are permitted.

Fixtures use:
- User: aaaaaaaa-aaaa-4aaa-8aaa-000000000008
- Email: entitlement-concurrency-8@example.invalid
- Keys: 88888888-8888-4888-8888-000000000101 / 102 through 601 / 602
- Input digest: repeat('8',64); digest mismatch test uses repeat('9',64)
- Initial normal count: 1, plan Free, authority_source new_free
- Benefit: available, prepared=true, no closure reason

No password, token, applicant payload or AI invocation is involved. Minimal synthetic auth rows
follow the already reviewed sequential-test insert shape. No auth identities are created.

## Literal operator sequence (repeat for every case)

1. Obtain separate disposable concurrency execution authorization. Verify project in both windows.
   Close unrelated test sessions; confirm reviewed empty scope, absent fixture and Phase A metadata.
   Save BEFORE read-only metadata/bootstrap/history/bucket snapshots from ENTITLEMENT-VERIFICATION.md.
2. Open SQL Editor window/tab **A** and window/tab **B**. Merely opening tabs does NOT establish
   distinct persistent PostgreSQL sessions: hosted SQL Editor can acquire a new connection per Run.
   The harness therefore never depends on session continuity between clicks.
3. In A run the case's SETUP file as one complete batch. Require success. Record result and sequence
   last_value/is_called. Setup COMMIT deliberately leaves only documented synthetic data.
4. Paste the case's A file into A. Paste the case's B file into B.
5. Click **Run** in A for its entire file. It begins a transaction, performs the RPC, then sleeps
   20 seconds while holding the per-user advisory transaction lock; it finally COMMITs.
6. While A is still running, select only B's **STEP 1** block (BEGIN through ROLLBACK) and click Run.
   This calls the competing RPC with lock_timeout=3s / statement_timeout=40s.
   Only SQLSTATE 55P03 is caught. Success requires the expected lock-timeout NOTICE; a competing
   call that succeeds without blocking raises an exception and is NOT concurrency proof.
   Record A/B backend_pid checkpoints, times and the timeout notice. They must represent two
   overlapping backends; if notices/IDs are hidden, retain request errors/results through a
   supported client or stop with verification unavailable. Do not add unsupported session tricks.
7. Wait for A to finish successfully and COMMIT. It must not be cancelled or error.
8. Select only B's **STEP 2** block and Run. It rechecks guards and expected committed A state,
   then retries the competing operation and asserts the exact outcome. Require success.
9. In A run the VERIFY file. It asserts request/account invariants, performs the documented
   settlement/replay tests, and COMMITs only synthetic changes. Require PASS checkpoint.
10. Only after PASS, run the next case's SETUP/RESET in A with both sessions idle. Never rerun 00.
    Resets assert the previous case's exact terminal request before deleting suite requests and
    reseeding this synthetic account. They are test-fixture surgery, NOT evidence that runtime
    prepare/close can reopen a terminal benefit.
11. Complete all six cases, then run 99-cleanup. Independently run its final read-only queries and
    the AFTER metadata/bootstrap snapshots. Require exact metadata equality, single unchanged
    history row, no buckets and zero auth/authority/request/legacy fixture rows.

DO NOT click Run on an entire B file: it contains two separately selected transactions and requires
an intervening successful A COMMIT. Every selected block includes its own transaction-local markers
and role handling, so later clicks can use another backend. The proof is overlap during STEP 1,
not persistence of an editor connection.

If SQL Editor serializes runs, reuses only one backend, hides the required timeout evidence or
terminates a 20-second Run before COMMIT, STOP: these scripts cannot establish real concurrency
through that execution surface. A separately authorized two-connection PostgreSQL client is then
required. No CLI, dependencies or connection workaround is part of this draft.

## Cases / exact committed states

All case starts retain the exact synthetic email/UUID, Free count=1, available/prepared benefit
unless noted. Projection matches authority count/plan/reset anchor. No extra requests are allowed.

| Case | Files | Initial requests | A while holding lock | B probe / retry | VERIFY and terminal state |
| --- | --- | --- | --- | --- | --- |
| A Final Free slot | 00–03 | none | reserves 101; allowed=true, Free chargeable | 102 times out; retry allowed=false, no row | completes 101 twice idempotently; count=2; exhausted; one completed row |
| B Same key | 04–07 | none | reserves 201 | same 201 times out; retry ANALYSIS_IN_PROGRESS | changed digest IDEMPOTENCY_CONFLICT; complete count=2; replay ANALYSIS_ALREADY_COMPLETED; one row |
| C Benefit race | 08–11 | none | reserves onboarding 301; reserved | 302 times out; retry allowed=false, no row | complete twice; consumed; count stays 1; prepare cannot reopen; 302 denied |
| D Close vs settle | 12–15 | pending onboarding 401 | close skipped -> closed, request released/onboarding_closed | complete 401 times out; retry must raise ENTITLEMENT_SETTLEMENT_CONFLICT | closed; count=1; zero completed benefits; prepare/reserve cannot reopen |
| E Reset with hold | 16–19 | valid normal pending 501; anchor >=720h old | snapshot resets count to 0, retains pending_count=1 | completion times out; retry completes count=1 | created_at < reset anchor <= settled_at; repeated snapshot/completion preserve anchor/count; one charge |
| F Grant vs reserve | 20–23 | none | reserves normal 601 as Free, charge_usage=true | admin Pro grant times out; retry success | original pending tier unchanged; completing 601 gives count=2; new 602 is Pro/nonchargeable; release leaves count=2 |

Each A transaction commits its admitted mutation only after the hold. B STEP 1 rolls back and leaves
no reservation. Each B retry and VERIFY commits only synthetic test rows. Finish each case within
15 minutes of reservation, otherwise the lease expiry is an expected STOP, not a failed race to
work around.

The deterministic lock order tested in D is **close first**, with skipped closure. Completion-first
can legitimately end consumed, but this package does not claim to execute both lock orders.
Likewise F tests **reserve first, grant second**; it proves admitted Free tier survives a later
grant and subsequent admissions use Pro. Grant-first admission is not a separate race in this
suite. These are controlled lock-contention tests, not a probabilistic stress benchmark.

E sets the reset anchor to clock_timestamp()-interval '720 hours' AFTER creating a valid hold.
It tests the reviewed >=720h boundary, not a mathematically exact timestamp equality. Existing
count=1 is reset, pending hold remains and settles into the new window exactly once.

## Cleanup and failure handling

Any unexpected error/result/guard mismatch: STOP immediately. Do not proceed to the next setup,
Phase B or any repair. Record the safe error and failed step. If an editor keeps an aborted
transaction, issue only ROLLBACK there or disconnect; never try COMMIT. Confirm both sessions are
idle before separately running reviewed 99-cleanup. Cleanup itself fails closed on unexpected
schema/history/data and waits at most 3 seconds for the same fixture lock; it must not remove data
while a race remains active. If its guard fails, stop for review rather than widening DELETE scope.

99 removes only suite-scoped request/account/user_plans/auth rows; deletion order is explicit.
It accepts documented partial test residue after a failed case, not unknown identities or keys.
It does not remove Phase A objects: they remain for separately authorized Phase B verification.
No bucket, history, schema, bootstrap or role attribute is changed.

Record sequence last_value/is_called BEFORE setup, in setup/reset/verification outputs and AFTER
cleanup. RPC compatibility INSERT ... ON CONFLICT and rolled-back probes can advance identity
sequences even when rows are unchanged. Such advancement is disposable-only, nontransactional
residue. Never call setval or otherwise rewind it. No exact advancement count is assumed.

## Static review and execution gates

Drafting checks: balanced dollar-quoted blocks/strings, manual SQL/PLpgSQL control-flow review,
Phase A schema/signature/body-hash alignment, all blocks guarded, bounded timeouts and sleeps,
all mutations limited to suite-owned data, no history/bucket mutation, no production ref,
no credentials and git diff --check. These are NOT actual PostgreSQL parsing or runtime proof.
No PostgreSQL parser/server was available during drafting; server-side syntax/metadata acceptance
is an execution gate. If deparsed CHECK/default/index strings differ, STOP and review the exact
difference; do not edit the draft during an execution run to make a guard pass.

This package is ready for static review and, after explicit review/authorization plus supported
two-backend access, disposable execution. Production readiness remains **NO**.
