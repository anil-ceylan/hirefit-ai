# Production-state baseline adoption — COMPLETE

## Completion supersedes the historical preparation plan below

Operator-supplied verified evidence confirms that the separately authorized one-time
history repair completed. Its authorization is consumed: **DO NOT rerun repair**.
See `PRODUCTION-ADOPTION-COMPLETION.md` for the immutable-style execution record.
No production connection was made during this documentation closeout.

Approved package commit: `023c57cdb16e52a58570305e4005795a075db3a0`.
Only `20261010120000` is registered remotely, with one history row named
`production_state_baseline`; all eleven archived legacy versions remain absent.
Pre/post semantic fingerprint: `84eabb2aa7f0cf161bfdc0c83ddab171`, 323 objects, PASS.
Bootstrap post-check and excluded bucket/future-table absence checks passed.
Production baseline/bootstrap SQL were never executed; only history metadata was added.
Future schema/security changes must be NEW separately reviewed forward migrations.
Unattended db reset / normal fresh migration-runner replay remains unsupported.

## Historical preparation record (not current instructions)

The following text preserves the package's pre-approval safety context verbatim.
Its pending gates and commands are historical, NOT authorization or instructions to
repeat the now-completed adoption. No further production action is authorized.

**NOT AUTHORIZED FOR PRODUCTION HISTORY REPAIR.**
**Production baseline SQL must NEVER be executed during adoption.**
No Supabase connection, SQL execution, repair, push/up/reset, commit or push occurred
while preparing this package.

## Package authority

- Version: `20261010120000`.
- Sole active migration: `supabase/migrations/20261010120000_production_state_baseline.sql`.
- Baseline SHA-256: `ed6a2878faaf90d9f500d29b19bdfb3950b9f67c685f1d1d1c847e68d786f103`.
- Source: `docs/database/baseline-draft-20261008/production-state.DRAFT.sql`.
- Bootstrap: `supabase/bootstrap/production-compatibility/rls-auto-enable.sql`.
- Bootstrap SHA-256: `a71ce8982b848fd1c3bee24a6d7909f1a27952837eb713ab5cb3074d2514e567`.
- Eleven original migrations: `supabase/archive/migrations-pre-baseline-20261010/`.
- Source/target/hash/Git evidence: `manifest.json` and archive `SHA256SUMS.json`.
- Both promoted SQL files are exact byte copies, including existing DRAFT comments and
  isolated-target/bootstrap guards. Promotion did not grant execution permission.

The user reports all isolated structural, metadata and runtime gates PASS, including
successful own/free-plan RPC and cleanup. These were not rerun during local packaging.
The accepted disposable sequence residue (1,false -> 2,true) is not migrated data.
The baseline still defines the fresh identity's start at 1; never adjust production counters.

## Production fidelity and exclusions

All 12 captured tables, including profiles/waitlist, captured functions/triggers/policies,
RLS, identity and ACL/default-ACL semantics are preserved. No historical-intent schema
is recreated to make history look complete. Future-profile tables and both absent buckets
(career-cvs/profile-avatars) remain excluded. Security hardening is separate forward work.

The uncertain rls_auto_enable/ensure_rls pair is a separate compatibility prerequisite,
not an active migration or newly asserted application-owned object. Production already
has the reviewed pair; do not execute bootstrap there.

## Required next gates

1. Human review of this exact local package, manifests, source/target hashes and reference updates.
2. Separate authorization to durably version the approved package; no commit/push is implicit.
3. Migration automation freeze and independently verified production identity:
   `inmcvfyhsrwhznbjlnit`. The disposable project must never share an unverified CLI context.
4. Fresh production READ-ONLY schema/bootstrap/ACL/identity equivalence and history inventory.
   Do not assume the prior Remote-blank history is still current. Do not inspect production row data.
5. Confirm baseline version unused, all eleven legacy versions absent and no unexplained history rows.
6. Confirm production history infrastructure state; the disposable project's absent history
   is not evidence of production state. If CLI repair would initialize metadata infrastructure,
   that exact scope requires explicit approval. No manual CREATE workarounds.
7. Explicit authorization of the pinned CLI 2.120.0 history-only repair and recovery plan.
8. Read-only post-repair verification; no application SQL, bootstrap execution or db push.

No `supabase/config.toml` existed at preparation; none was created. Review pinned CLI
configuration requirements as a separate readiness check. Do not run init to resolve this automatically.
No checked-in .github workflow was found. External migration/deployment automation remains
unverified and must be paused/checked before history adoption.

## Future command — NOT AUTHORIZED / DO NOT RUN YET

Only after ALL gates above, from the exact approved checkout with an independently verified
production link, the intended history-only operation is:

```text
npx supabase@2.120.0 migration repair 20261010120000 --status applied --linked
```

Do not run db push (including dry-run), migration up/reset, or baseline SQL against production.
Do not repair any archived version to applied/reverted. The old versions remain absent.
The only intended history delta is the approved new baseline registration.

Post-repair, read-only history inspection must show 20261010120000 on both local and remote
sides, no historical version newly added, and no unrelated history change.
Application schema/bootstrap/security/sequence configuration must remain unchanged.
Normal live application activity can affect row counts/counters; do not attempt to reset them.

Until history adoption occurs, the active baseline is pending from production's perspective.
Do not let any runner attempt to apply it. Guards are defense-in-depth, not execution authorization.
An old checkout containing the eleven-file chain must never drive production migrations afterward.

## Stop and recovery

Stop on target ambiguity, checksum drift, extra/missing active/archive files, bootstrap/schema
drift, unexpected remote history, concurrent migration activity, permission/config uncertainty
or any command proposing application SQL. Capture ambiguous repair output and inspect history
before considering a retry.

If ONLY the newly registered baseline history row is wrong, a separately approved targeted
`migration repair 20261010120000 --status reverted --linked` may restore the prior metadata
state. This is NOT AUTHORIZED now and does not undo schema. Freeze migration runners because
the baseline becomes pending again. Never blindly delete unrelated history or reset production.

## Human-review checklist

- [ ] Exactly one active SQL, exact baseline source hash.
- [ ] Exactly eleven archived SQLs, original names/bytes/hashes and Git provenance.
- [ ] Bootstrap exact source hash, outside active migrations.
- [ ] Narrow Git attributes preserve the reviewed bytes on subsequent checkout.
- [ ] No runtime tests/capture/config/secrets promoted into migrations.
- [ ] Validator assertions unchanged; historical fixtures clearly identified.
- [ ] REPLAY.md honestly retains guarded/manual fresh-project limitations.
- [ ] Package approval recorded; production history permission still separate.
