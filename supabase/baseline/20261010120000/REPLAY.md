# Guarded fresh-project replay contract

Unattended `db reset` and normal fresh migration-runner replay are **NOT supported**
by this baseline package. The exact reviewed SQL retains its isolated-target
acknowledgement, fresh-object refusal and strict bootstrap-equivalence guards.
Do not remove these guards for convenience or claim normal CLI reset reproducibility.

## Existing production

Do NOT execute the baseline or bootstrap. History-only adoption is COMPLETE; see
ADOPTION.md and PRODUCTION-ADOPTION-COMPLETION.md. Do not repeat repair.
Production baseline SQL must NEVER be executed during adoption.

## Fresh disposable Supabase-compatible PostgreSQL 17 project

Each execution step requires separate explicit authorization and verified project identity.

1. Platform/auth roles, auth.users/auth.uid(), supported permissions and reviewed defaults
   must already be present. No platform-role/schema workaround is supplied here.
2. Inspect rls_auto_enable()/ensure_rls:
   - exact accepted equivalent present: preserve;
   - absent: STOP until separately authorized compatibility bootstrap creation;
   - partial/different/inaccessible: STOP, never overwrite or silently harden.
3. If authorized, run only the separate bootstrap using its own acknowledgement in that
   fresh project, then independently verify exact definition/ACL/event equivalence.
4. Only after bootstrap equivalence and separate baseline-execution approval, use the same
   reviewed SQL Editor/manual transaction procedure as the successful isolated replay.
   Set `hirefit.baseline_replay_target = 'isolated-reviewed-target'` in the same session
   before the complete baseline. This setting does not establish target identity or permission.
5. Independently compare full metadata and run separately authorized behavior tests.
6. If baseline execution was outside a migration runner, registering the baseline version
   in THAT project's history is another explicitly authorized metadata operation.
   Do not reuse a production-linked CLI context.

Execution details and read-only verification queries remain in
`docs/database/baseline-draft-20261008/REPLAY-CONTRACT.md` and
`BOOTSTRAP-VERIFICATION.md`. Runtime-test drafts stay there, not in migrations.
They contain an intentionally rollback-only subset; the successful RPC test and its
non-rollback sequence residue were separately accepted by the user for the disposable
project only. No sequence-restoration operation is provided.

## Scope and lifecycle

Never replay the archived historical chain. Never create missing CV/avatar buckets or
future-facing tables for bookkeeping. No production rows/counters/users/files are copied.
Current security semantics are fidelity-preserved, not security-approved; changes belong
in separately reviewed forward migrations after history adoption.

Original DRAFT banners remain in the copied artifacts because exact bytes were approved.
Manifest hashes, approval records and this contract govern the package's status; a file
being under migrations does not authorize running it.

A future unattended fresh migration workflow requires its own reviewed bootstrap/configuration
design and fresh equivalence validation. It is not implemented by this archival/promotional task.
