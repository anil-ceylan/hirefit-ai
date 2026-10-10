# Archived migrations — NOT ACTIVE / DO NOT APPLY

These eleven migrations were moved from `supabase/migrations` on 2026-10-10
under LOCAL PACKAGE PREPARATION authorization only. They are historical evidence
and existing validator fixtures, not an executable migration chain.

- `20260406120000_user_plans_unique_increment_rpc.sql`
- `20260416093000_enable_rls_user_owned_tables.sql`
- `20260527120000_career_profiles.sql`
- `20260528120000_career_progress.sql`
- `20260529120000_career_onboarding.sql`
- `20260530120000_career_intelligence.sql`
- `20260531120000_career_os_future_schema.sql`
- `20260532120000_career_cv_storage.sql`
- `20260916100000_career_companion.sql`
- `20260925120000_opportunity_radar.sql`
- `20261008120000_opportunity_radar_location_v1.sql`

## Preservation

`SHA256SUMS.json` records original/target paths, pre-move and archived SHA-256,
byte lengths, original HEAD/index Git identities and unfiltered working-tree blob IDs.
The authority for byte preservation is the pre-move working-tree file.
Three originals have working-tree blob IDs different from HEAD/index because of
line-ending representation; both identities are retained, not silently normalized.
Narrow `.gitattributes` rules prevent conversion of archived SQL bytes.
No original SQL content or filename was edited, including `20260532120000`.
Byte preservation also retains original CRLF and trailing blank lines. A raw
no-index whitespace check can report those historical bytes; do not format the
archive to silence diagnostics. Hash equality is the archival acceptance check.

## Replacement and history

The sole active baseline is `supabase/migrations/20261010120000_production_state_baseline.sql`.
Production baseline SQL must NEVER be executed during adoption.
Production history repair is NOT AUTHORIZED. All eleven legacy versions are intended
to remain absent from production history, subject to fresh read-only verification.

See `supabase/baseline/20261010120000/ADOPTION.md` and `REPLAY.md`.
Do not restore these files under active migrations or use a recursive SQL runner.
Do not create dormant future tables or buckets merely because an archived file mentions them.

Existing Companion/Radar/location historical validators now read this archive with
their original assertions unchanged. SQL-executing validators were NOT run during packaging.
Those historical tests do not substitute for the baseline's separately recorded replay evidence.
